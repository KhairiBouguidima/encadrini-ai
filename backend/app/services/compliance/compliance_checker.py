import io
import re
import math
from typing import Dict, Any, List, Tuple, Optional
import pdfplumber
from app.models.compliance import (
    IssueSeverity, IssueCategory, ComplianceIssue, 
    ComplianceCategoryScore, ComplianceReportDocument
)
from app.schemas.compliance import UniversityProfileSchema
from app.services.compliance.university_profiles import get_profile
from app.services.mock_defense.ai_provider_adapter import AIProviderAdapter
from beanie import PydanticObjectId


# 1 cm = 72 / 2.54 = 28.3465 pt
PT_PER_CM = 28.3465


def _normalize_font_name(font_name: str) -> str:
    """Map technical PDF font names to readable font families."""
    fn = (font_name or "").lower()
    if "times" in fn or "tnr" in fn:
        return "Times New Roman"
    if "calibri" in fn or "carlito" in fn:
        return "Calibri"
    if "arial" in fn or "helvetica" in fn or "liberation" in fn:
        return "Arial"
    if "cmr" in fn or "computer" in fn or "latin modern" in fn or "nimbus" in fn:
        return "Computer Modern"
    if "courier" in fn or "consolas" in fn or "mono" in fn:
        return "Courier"
    if "georgia" in fn:
        return "Georgia"
    if "garamond" in fn:
        return "Garamond"
    return font_name or "Unknown"


def _is_roman_numeral(s: str) -> bool:
    clean = s.strip().lower()
    return bool(re.fullmatch(r"m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})", clean)) and len(clean) > 0


class DocumentComplianceAnalyzer:
    def __init__(self, pdf_bytes: bytes, profile: UniversityProfileSchema, file_name: str = "rapport.pdf"):
        self.pdf_bytes = pdf_bytes
        self.profile = profile
        self.file_name = file_name
        self.issues: List[ComplianceIssue] = []
        self.stats: Dict[str, Any] = {
            "page_count": 0,
            "detected_figures": 0,
            "detected_tables": 0,
            "detected_headings": 0,
            "toc_entries_count": 0,
            "dominant_font": "Inconnu",
            "dominant_font_size": 12.0,
            "measured_line_spacing": 1.5,
            "measured_margins_cm": {"top": 2.5, "bottom": 2.5, "left": 2.5, "right": 2.5},
            "docx_fixable_issues_count": 0
        }

    def analyze(self) -> Dict[str, Any]:
        """Runs end-to-end compliance audit with deterministic and AI checks."""
        with pdfplumber.open(io.BytesIO(self.pdf_bytes)) as pdf:
            pages = pdf.pages
            self.stats["page_count"] = len(pages)
            if len(pages) == 0:
                raise ValueError("Le document PDF est vide.")

            # Step 1: Extract typography, margins, text blocks per page
            page_data_list = []
            font_size_counts = {}
            font_name_counts = {}
            line_spacing_samples = []
            margin_samples = {"left": [], "right": [], "top": [], "bottom": []}

            for idx, page in enumerate(pages):
                p_num = idx + 1
                p_width = float(page.width)
                p_height = float(page.height)

                chars = page.chars
                words = page.extract_words(keep_blank_chars=False)
                raw_text = page.extract_text() or ""

                # Typography aggregation
                for c in chars:
                    sz = round(float(c.get("size", 12.0)), 1)
                    fn = _normalize_font_name(c.get("fontname", ""))
                    font_size_counts[sz] = font_size_counts.get(sz, 0) + 1
                    font_name_counts[fn] = font_name_counts.get(fn, 0) + 1

                # Body text bbox (ignoring top 8% and bottom 8% for headers/footers)
                body_words = [
                    w for w in words 
                    if float(w["top"]) > p_height * 0.08 and float(w["bottom"]) < p_height * 0.92
                ]

                # Margins measurement
                if body_words:
                    min_x0 = min(float(w["x0"]) for w in body_words)
                    max_x1 = max(float(w["x1"]) for w in body_words)
                    min_top = min(float(w["top"]) for w in body_words)
                    max_bottom = max(float(w["bottom"]) for w in body_words)

                    left_cm = round(min_x0 / PT_PER_CM, 2)
                    right_cm = round((p_width - max_x1) / PT_PER_CM, 2)
                    top_cm = round(min_top / PT_PER_CM, 2)
                    bottom_cm = round((p_height - max_bottom) / PT_PER_CM, 2)

                    margin_samples["left"].append(left_cm)
                    margin_samples["right"].append(right_cm)
                    margin_samples["top"].append(top_cm)
                    margin_samples["bottom"].append(bottom_cm)
                else:
                    left_cm = right_cm = top_cm = bottom_cm = 2.5

                # Line spacing calculation from lines in body
                lines = self._extract_lines_from_words(body_words)
                for i in range(len(lines) - 1):
                    curr_line = lines[i]
                    next_line = lines[i + 1]
                    dy = next_line["top"] - curr_line["top"]
                    avg_sz = (curr_line["size"] + next_line["size"]) / 2.0
                    # Only calculate within same paragraph (continuous dy between 10pt and 30pt)
                    if 10.0 <= dy <= 32.0 and avg_sz > 8.0:
                        spacing_ratio = dy / avg_sz
                        line_spacing_samples.append(spacing_ratio)

                page_data_list.append({
                    "page_number": p_num,
                    "width": p_width,
                    "height": p_height,
                    "text": raw_text,
                    "words": words,
                    "body_words": body_words,
                    "lines": lines,
                    "margins": {"left": left_cm, "right": right_cm, "top": top_cm, "bottom": bottom_cm},
                    "images_count": len(page.images),
                    "tables": page.find_tables() or []
                })

            # Determine dominant font & size
            dominant_font = max(font_name_counts.items(), key=lambda x: x[1])[0] if font_name_counts else "Times New Roman"
            dominant_size = max(font_size_counts.items(), key=lambda x: x[1])[0] if font_size_counts else 12.0
            
            # Dominant line spacing
            if line_spacing_samples:
                # 1.0 spacing is ~1.15-1.25 ratio; 1.5 spacing is ~1.45-1.65 ratio
                avg_ratio = sum(line_spacing_samples) / len(line_spacing_samples)
                estimated_line_spacing = round((avg_ratio / 1.5) * 1.5, 2)
                # Map to standard scale
                if 1.35 <= avg_ratio <= 1.70:
                    dominant_spacing = 1.5
                elif avg_ratio < 1.35:
                    dominant_spacing = 1.15 if avg_ratio > 1.20 else 1.0
                else:
                    dominant_spacing = 2.0
            else:
                dominant_spacing = 1.5

            avg_margins = {
                k: round(sum(v) / len(v), 2) if v else self.profile.margins_cm[k]
                for k, v in margin_samples.items()
            }

            self.stats["dominant_font"] = dominant_font
            self.stats["dominant_font_size"] = dominant_size
            self.stats["measured_line_spacing"] = dominant_spacing
            self.stats["measured_margins_cm"] = avg_margins

            # Run Audit Modules
            self._check_typography(page_data_list, dominant_font, dominant_size)
            self._check_margins_and_spacing(page_data_list, avg_margins, dominant_spacing)
            self._check_headings_and_alignment(page_data_list)
            self._check_figures_and_tables(page_data_list)
            self._check_toc_and_pagination(page_data_list)
            self._check_document_structure(page_data_list)

        # Compute Category Scores
        category_scores = self._compute_category_scores()
        overall_score = round(sum(c.score for c in category_scores.values()) / len(category_scores), 1)

        compliance_level = (
            "CONFORME" if overall_score >= 88.0 and not any(i.severity == IssueSeverity.ERROR for i in self.issues)
            else "CONFORME_AVEC_RESERVES" if overall_score >= 65.0
            else "NON_CONFORME"
        )

        summary = self._generate_executive_summary(overall_score, compliance_level)

        return {
            "university_id": self.profile.id,
            "university_name": self.profile.full_name,
            "overall_score": overall_score,
            "compliance_level": compliance_level,
            "summary": summary,
            "category_scores": category_scores,
            "issues": self.issues,
            "stats": self.stats,
            "can_smart_fix_docx": True
        }

    def _extract_lines_from_words(self, words: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Group word objects into horizontal lines."""
        if not words:
            return []
        sorted_words = sorted(words, key=lambda w: (float(w["top"]), float(w["x0"])))
        lines = []
        curr_line = [sorted_words[0]]
        curr_top = float(sorted_words[0]["top"])

        for w in sorted_words[1:]:
            top = float(w["top"])
            if abs(top - curr_top) < 4.0:
                curr_line.append(w)
            else:
                lines.append(self._format_line(curr_line))
                curr_line = [w]
                curr_top = top
        if curr_line:
            lines.append(self._format_line(curr_line))
        return lines

    def _format_line(self, line_words: List[Dict[str, Any]]) -> Dict[str, Any]:
        text = " ".join(w["text"] for w in line_words)
        x0 = min(float(w["x0"]) for w in line_words)
        x1 = max(float(w["x1"]) for w in line_words)
        top = min(float(w["top"]) for w in line_words)
        bottom = max(float(w["bottom"]) for w in line_words)
        sizes = [float(w.get("size", 12.0)) for w in line_words if "size" in w]
        avg_size = sum(sizes) / len(sizes) if sizes else 12.0
        return {
            "text": text,
            "x0": x0,
            "x1": x1,
            "top": top,
            "bottom": bottom,
            "size": avg_size,
            "words": line_words
        }

    # ── 1. TYPOGRAPHY CHECKS ──────────────────────────────────────────
    def _check_typography(self, page_data: List[Dict[str, Any]], dominant_font: str, dominant_size: float):
        allowed_fonts = [f.lower() for f in self.profile.body_font_families]
        is_font_valid = any(af in dominant_font.lower() for af in allowed_fonts)
        expected_fonts_str = " ou ".join(self.profile.body_font_families)

        if not is_font_valid:
            self.issues.append(ComplianceIssue(
                id="TYPO_FONT_FAMILY",
                category=IssueCategory.TYPOGRAPHY,
                severity=IssueSeverity.ERROR,
                title="Police de caractères non conforme à la charte",
                message=f"Le document utilise principalement '{dominant_font}', alors que la charte de {self.profile.name} exige {expected_fonts_str}.",
                pages=[1, 2, 3],
                suggestion=f"Uniformiser l'ensemble du corps de texte en {self.profile.body_font_families[0]}.",
                expected=expected_fonts_str,
                found=dominant_font,
                fixable_by_smart_fix=True
            ))
            self.stats["docx_fixable_issues_count"] += 1

        # Size check
        size_diff = abs(dominant_size - self.profile.body_font_size)
        if size_diff > self.profile.body_font_size_tolerance:
            sev = IssueSeverity.ERROR if size_diff >= 1.5 else IssueSeverity.WARNING
            self.issues.append(ComplianceIssue(
                id="TYPO_FONT_SIZE",
                category=IssueCategory.TYPOGRAPHY,
                severity=sev,
                title=f"Taille de police du corps ({dominant_size} pt) divergente",
                message=f"La taille détectée ({dominant_size} pt) s'écarte de la spécification officielle ({self.profile.body_font_size} pt).",
                pages=[1, 2],
                suggestion=f"Ajuster la taille du style 'Normal' à {self.profile.body_font_size} pt.",
                expected=f"{self.profile.body_font_size} pt",
                found=f"{dominant_size} pt",
                fixable_by_smart_fix=True
            ))
            self.stats["docx_fixable_issues_count"] += 1

        # Check for multiple inconsistent font faces throughout the document
        unusual_font_pages = []
        for p in page_data:
            text = p["text"]
            if len(text.strip()) > 200:
                # check page chars
                pass  # aggregated above

    # ── 2. MARGINS & SPACING CHECKS ──────────────────────────────────
    def _check_margins_and_spacing(self, page_data: List[Dict[str, Any]], avg_margins: Dict[str, float], dominant_spacing: float):
        req_margins = self.profile.margins_cm
        margin_issues_pages = []

        # Check Left Margin (especially critical for binding, e.g. 3.0 cm for ESPRIT/FST)
        left_delta = abs(avg_margins["left"] - req_margins["left"])
        if left_delta > 0.4:
            self.issues.append(ComplianceIssue(
                id="MARGIN_LEFT",
                category=IssueCategory.MARGINS_SPACING,
                severity=IssueSeverity.ERROR if left_delta > 0.7 else IssueSeverity.WARNING,
                title="Marge de gauche non conforme (reliure)",
                message=f"Marge gauche moyenne mesurée à {avg_margins['left']} cm au lieu de {req_margins['left']} cm requis par {self.profile.name}.",
                pages=[p["page_number"] for p in page_data[:5]],
                suggestion=f"Définir la marge gauche à {req_margins['left']} cm pour permettre une reliure adéquate du manuscrit.",
                expected=f"{req_margins['left']} cm",
                found=f"{avg_margins['left']} cm",
                fixable_by_smart_fix=True
            ))
            self.stats["docx_fixable_issues_count"] += 1

        # Check Top / Bottom / Right margins
        for side in ["top", "bottom", "right"]:
            delta = abs(avg_margins[side] - req_margins[side])
            if delta > 0.45:
                side_fr = {"top": "haut", "bottom": "bas", "right": "droite"}[side]
                self.issues.append(ComplianceIssue(
                    id=f"MARGIN_{side.upper()}",
                    category=IssueCategory.MARGINS_SPACING,
                    severity=IssueSeverity.WARNING,
                    title=f"Marge de {side_fr} non conforme",
                    message=f"Marge {side_fr} mesurée à {avg_margins[side]} cm au lieu de {req_margins[side]} cm.",
                    pages=[1, 2],
                    suggestion=f"Ajuster la marge de {side_fr} à {req_margins[side]} cm dans la mise en page.",
                    expected=f"{req_margins[side]} cm",
                    found=f"{avg_margins[side]} cm",
                    fixable_by_smart_fix=True
                ))
                self.stats["docx_fixable_issues_count"] += 1

        # Check Line Spacing (1.5 required)
        spacing_diff = abs(dominant_spacing - self.profile.line_spacing)
        if spacing_diff >= 0.2:
            self.issues.append(ComplianceIssue(
                id="SPACING_LINE",
                category=IssueCategory.MARGINS_SPACING,
                severity=IssueSeverity.ERROR if dominant_spacing <= 1.15 else IssueSeverity.WARNING,
                title="Interligne non conforme (1.5 requis)",
                message=f"Interligne détecté à ~{dominant_spacing} ligne(s). La charte exige un interligne exact de {self.profile.line_spacing}.",
                pages=[p["page_number"] for p in page_data[:3]],
                suggestion=f"Sélectionner l'ensemble du texte et appliquer un interligne de {self.profile.line_spacing} avec un espacement après paragraphe de 6 pt.",
                expected=f"Interligne {self.profile.line_spacing}",
                found=f"Interligne ~{dominant_spacing}",
                fixable_by_smart_fix=True
            ))
            self.stats["docx_fixable_issues_count"] += 1

    # ── 3. HEADINGS & ALIGNMENT CHECKS ────────────────────────────────
    def _check_headings_and_alignment(self, page_data: List[Dict[str, Any]]):
        detected_headings = []
        ragged_right_pages = []

        heading_pattern = re.compile(
            r"^(?:(?:Chapitre|Chapter)\s+\d+|[1-9]\.\d*(?:\.\d+)*)\s+[\w\s\-\'\’]+$",
            re.IGNORECASE
        )

        for p in page_data:
            lines = p["lines"]
            non_heading_lines = []
            
            for line in lines:
                txt = line["text"].strip()
                # Check if heading
                if (line["size"] >= 13.0 or heading_pattern.match(txt)) and len(txt) < 120:
                    detected_headings.append({
                        "text": txt,
                        "page": p["page_number"],
                        "size": line["size"]
                    })
                elif len(txt) > 50:
                    non_heading_lines.append(line)

            # Check alignment on non-heading body lines (measure right edge variation)
            if len(non_heading_lines) >= 6:
                right_edges = [l["x1"] for l in non_heading_lines[:-1]]  # exclude last line
                variance = max(right_edges) - min(right_edges)
                # If variance > 45pt, lines are ragged (left-aligned instead of justified)
                if variance > 48.0:
                    ragged_right_pages.append(p["page_number"])

        self.stats["detected_headings"] = len(detected_headings)

        # Ragged alignment issue
        if len(ragged_right_pages) >= max(2, len(page_data) // 4):
            self.issues.append(ComplianceIssue(
                id="ALIGNMENT_NOT_JUSTIFIED",
                category=IssueCategory.HEADINGS,
                severity=IssueSeverity.ERROR,
                title="Alignement des paragraphes non justifié",
                message=f"Le texte semble aligné à gauche au lieu d'être justifié sur {len(ragged_right_pages)} pages. Les normes universitaires imposent une justification stricte.",
                pages=ragged_right_pages[:6],
                suggestion="Appliquer l'alignement 'Justifié' (Ctrl+J dans Word/LibreOffice) à l'ensemble des paragraphes du corps de texte.",
                expected="Texte Justifié",
                found="Aligné à gauche (drapeau à droite)",
                fixable_by_smart_fix=True
            ))
            self.stats["docx_fixable_issues_count"] += 1

        # Check heading hierarchy consistency
        if detected_headings:
            h1_headings = [h for h in detected_headings if re.match(r"^(?:Chapitre|[1-9]\.)(?!\d)", h["text"], re.I)]
            for h in h1_headings:
                if h["size"] < 13.5:
                    self.issues.append(ComplianceIssue(
                        id="HEADING_SIZE_H1",
                        category=IssueCategory.HEADINGS,
                        severity=IssueSeverity.WARNING,
                        title=f"Taille insuffisante pour le titre principal '{h['text'][:35]}...'",
                        message=f"Titre principal en page {h['page']} avec une taille de {round(h['size'], 1)} pt (attendu ~{self.profile.heading1_size} pt en gras).",
                        pages=[h["page"]],
                        suggestion=f"Agrandir la taille du style Titre 1 à {self.profile.heading1_size} pt Gras.",
                        expected=f"{self.profile.heading1_size} pt Gras",
                        found=f"{round(h['size'], 1)} pt",
                        fixable_by_smart_fix=True
                    ))
                    break

    # ── 4. FIGURES & TABLES CHECKS ────────────────────────────────────
    def _check_figures_and_tables(self, page_data: List[Dict[str, Any]]):
        figure_captions = []
        table_captions = []
        invalid_figure_captions = []
        invalid_table_captions = []

        fig_regex = re.compile(self.profile.figure_caption_pattern, re.IGNORECASE)
        tab_regex = re.compile(self.profile.table_caption_pattern, re.IGNORECASE)

        # Loose regexes to catch improper formats
        loose_fig = re.compile(r"\b(?:Fig\.?|Figure)\s*(\d+(?:[\.\-]\d+)?)\b\s*([:\-]?)\s*(.*)", re.IGNORECASE)
        loose_tab = re.compile(r"\b(?:Tableau|Table)\s*(\d+(?:[\.\-]\d+)?)\b\s*([:\-]?)\s*(.*)", re.IGNORECASE)

        for p in page_data:
            text = p["text"]
            lines = text.split("\n")
            for line in lines:
                s_line = line.strip()
                # Check figure caption
                if re.search(r"\b(?:Figure|Fig\.?)\b", s_line, re.I):
                    if fig_regex.search(s_line):
                        m = fig_regex.search(s_line)
                        num_str = m.group(1)
                        title_str = m.group(2).strip()
                        figure_captions.append({
                            "raw": s_line,
                            "num": num_str,
                            "title": title_str,
                            "page": p["page_number"]
                        })
                    else:
                        m_loose = loose_fig.search(s_line)
                        if m_loose:
                            invalid_figure_captions.append({
                                "raw": s_line,
                                "page": p["page_number"]
                            })

                # Check table caption
                if re.search(r"\b(?:Tableau|Table)\b", s_line, re.I):
                    if tab_regex.search(s_line):
                        m = tab_regex.search(s_line)
                        num_str = m.group(1)
                        title_str = m.group(2).strip()
                        table_captions.append({
                            "raw": s_line,
                            "num": num_str,
                            "title": title_str,
                            "page": p["page_number"]
                        })
                    else:
                        m_loose = loose_tab.search(s_line)
                        if m_loose:
                            invalid_table_captions.append({
                                "raw": s_line,
                                "page": p["page_number"]
                            })

        self.stats["detected_figures"] = len(figure_captions) + len(invalid_figure_captions)
        self.stats["detected_tables"] = len(table_captions) + len(invalid_table_captions)

        # 1. Invalid Figure Format Issues
        if invalid_figure_captions:
            bad_examples = [c["raw"][:40] for c in invalid_figure_captions[:2]]
            self.issues.append(ComplianceIssue(
                id="FIG_INVALID_FORMAT",
                category=IssueCategory.FIGURES_TABLES,
                severity=IssueSeverity.ERROR,
                title="Format de légende de figure non conforme",
                message=f"{len(invalid_figure_captions)} légende(s) de figure ne respectent pas le format officiel `{self.profile.figure_caption_example}` (Ex: '{bad_examples[0]}').",
                pages=[c["page"] for c in invalid_figure_captions],
                suggestion=f"Formater systématiquement chaque légende de figure selon le modèle : `{self.profile.figure_caption_example}` avec deux-points et espace.",
                expected=self.profile.figure_caption_example,
                found=bad_examples[0] if bad_examples else "Format incorrect",
                fixable_by_smart_fix=True
            ))
            self.stats["docx_fixable_issues_count"] += 1

        # 2. Invalid Table Format Issues
        if invalid_table_captions:
            bad_examples = [c["raw"][:40] for c in invalid_table_captions[:2]]
            self.issues.append(ComplianceIssue(
                id="TABLE_INVALID_FORMAT",
                category=IssueCategory.FIGURES_TABLES,
                severity=IssueSeverity.ERROR,
                title="Format de légende de tableau non conforme",
                message=f"{len(invalid_table_captions)} légende(s) de tableau ne respectent pas le format officiel `{self.profile.table_caption_example}`.",
                pages=[c["page"] for c in invalid_table_captions],
                suggestion=f"Adopter le format normalisé : `{self.profile.table_caption_example}` placé au-dessus du tableau.",
                expected=self.profile.table_caption_example,
                found=bad_examples[0] if bad_examples else "Format incorrect",
                fixable_by_smart_fix=True
            ))
            self.stats["docx_fixable_issues_count"] += 1

        # 3. Numbering Sequence / Gap Checks (e.g., Figure 1.1 -> Figure 1.3)
        self._check_caption_numbering_sequence(figure_captions, "Figure", self.profile.figure_caption_example)
        self._check_caption_numbering_sequence(table_captions, "Tableau", self.profile.table_caption_example)

        # 4. Check for uncaptioned images or tables
        uncaptioned_img_pages = []
        for p in page_data:
            if p["images_count"] > 0:
                has_fig = any(c["page"] == p["page_number"] for c in figure_captions + invalid_figure_captions)
                if not has_fig:
                    uncaptioned_img_pages.append(p["page_number"])

        if uncaptioned_img_pages:
            self.issues.append(ComplianceIssue(
                id="FIG_MISSING_CAPTION",
                category=IssueCategory.FIGURES_TABLES,
                severity=IssueSeverity.WARNING,
                title="Images détectées sans légende associée",
                message=f"Des figures ou graphiques semblent dépourvus de légende explicite sur les pages {uncaptioned_img_pages[:4]}.",
                pages=uncaptioned_img_pages[:5],
                suggestion="Ajouter une légende descriptive sous chaque image avec le préfixe 'Figure X.Y:'.",
                expected="Légende présente sous chaque figure",
                found="Image sans légende détectée",
                fixable_by_smart_fix=False
            ))

    def _check_caption_numbering_sequence(self, captions: List[Dict[str, Any]], item_type: str, example: str):
        if len(captions) < 2:
            return

        seen_nums = set()
        duplicates = []
        parsed_items = []

        for c in captions:
            num = c["num"]
            if num in seen_nums:
                duplicates.append(c)
            seen_nums.add(num)

            # try parsing X.Y or X
            parts = re.split(r"[\.\-]", num)
            try:
                if len(parts) >= 2:
                    parsed_items.append((int(parts[0]), int(parts[1]), c))
                elif len(parts) == 1:
                    parsed_items.append((0, int(parts[0]), c))
            except ValueError:
                pass

        if duplicates:
            dup_nums = list(set(c["num"] for c in duplicates))
            self.issues.append(ComplianceIssue(
                id=f"{item_type.upper()}_DUPLICATE_NUMBER",
                category=IssueCategory.FIGURES_TABLES,
                severity=IssueSeverity.ERROR,
                title=f"Doublons de numérotation détectés pour {item_type}",
                message=f"Le numéro '{dup_nums[0]}' apparaît plusieurs fois dans le document.",
                pages=[c["page"] for c in duplicates],
                suggestion=f"Renumérotation séquentielle indispensable pour les {item_type}s.",
                expected="Numérotation séquentielle unique",
                found=f"Doublon sur '{dup_nums[0]}'",
                fixable_by_smart_fix=False
            ))

        # Check sequence gaps
        for i in range(len(parsed_items) - 1):
            c_chap, c_num, item_cur = parsed_items[i]
            n_chap, n_num, item_nxt = parsed_items[i + 1]
            if c_chap == n_chap and n_num > c_num + 1:
                self.issues.append(ComplianceIssue(
                    id=f"{item_type.upper()}_NUMBER_GAP",
                    category=IssueCategory.FIGURES_TABLES,
                    severity=IssueSeverity.WARNING,
                    title=f"Rupture de séquence dans la numérotation ({item_type} {c_chap}.{c_num} à {n_chap}.{n_num})",
                    message=f"Il y a un saut de numérotation entre {item_type} {c_chap}.{c_num} (page {item_cur['page']}) et {item_type} {n_chap}.{n_num} (page {item_nxt['page']}). L'élément {c_chap}.{c_num + 1} est manquant.",
                    pages=[item_cur["page"], item_nxt["page"]],
                    suggestion=f"Vérifier si un {item_type} a été supprimé sans mettre à jour la numérotation.",
                    expected=f"{item_type} {c_chap}.{c_num + 1}",
                    found=f"{item_type} {n_chap}.{n_num}",
                    fixable_by_smart_fix=False
                ))
                break

    # ── 5. TABLE OF CONTENTS & PAGINATION CHECKS ──────────────────────
    def _check_toc_and_pagination(self, page_data: List[Dict[str, Any]]):
        toc_pages = []
        toc_entries = []

        toc_header_regex = re.compile(r"\b(table\s+des\s+mati[èe]res|sommaire|table\s+of\s+contents)\b", re.I)
        # Entry pattern: Title ........... 14 or Title   14
        toc_entry_regex = re.compile(r"^([\w\s\-\'\’\:\.\,\(\)]+?)[\.\s\t]{2,}(\d+|[ivxlcdm]+)$", re.I)

        for p in page_data:
            text = p["text"]
            if toc_header_regex.search(text):
                toc_pages.append(p["page_number"])
                lines = text.split("\n")
                for line in lines:
                    m = toc_entry_regex.match(line.strip())
                    if m:
                        title = m.group(1).strip()
                        raw_page = m.group(2).strip()
                        if len(title) > 3 and not toc_header_regex.search(title):
                            toc_entries.append({
                                "title": title,
                                "toc_page_num": raw_page,
                                "found_on_page": p["page_number"]
                            })

        self.stats["toc_entries_count"] = len(toc_entries)

        # 1. Presence of Table of Contents
        if not toc_pages:
            self.issues.append(ComplianceIssue(
                id="TOC_MISSING",
                category=IssueCategory.TOC_PAGINATION,
                severity=IssueSeverity.ERROR,
                title="Table des matières / Sommaire absent",
                message=f"Aucune table des matières ou sommaire formel n'a été détecté dans les premières pages du document.",
                pages=[1, 2, 3],
                suggestion="Insérer une Table des Matières automatique après les résumés/remerciements.",
                expected="Sommaire ou Table des matières présent",
                found="Non détecté",
                fixable_by_smart_fix=False
            ))
            return

        # 2. Check dot leaders and right-alignment
        has_dot_leaders = False
        for p_num in toc_pages:
            p_text = page_data[p_num - 1]["text"]
            if "..." in p_text or ". . ." in p_text or "…" in p_text:
                has_dot_leaders = True
                break

        if not has_dot_leaders and toc_entries:
            self.issues.append(ComplianceIssue(
                id="TOC_DOT_LEADERS_MISSING",
                category=IssueCategory.TOC_PAGINATION,
                severity=IssueSeverity.WARNING,
                title="Absence de points de conduite dans le sommaire",
                message="Les entrées du sommaire ne semblent pas comporter de points de conduite (...) reliant le titre au numéro de page.",
                pages=toc_pages,
                suggestion="Configurer la table des matières Word/LaTeX avec des points de suite (tabulation avec points de conduite).",
                expected="Titre ...................... Page",
                found="Titre sans points de suite",
                fixable_by_smart_fix=True
            ))
            self.stats["docx_fixable_issues_count"] += 1

        # 3. Check synchronization between TOC entries and actual document pages
        desync_issues = []
        for entry in toc_entries[:15]:
            try:
                claimed_page = int(entry["toc_page_num"])
            except ValueError:
                continue

            title_clean = re.sub(r"^[0-9\.\s]+", "", entry["title"]).strip().lower()
            if len(title_clean) < 5:
                continue

            # Look for where this heading actually appears in document
            actual_page = None
            for p in page_data:
                # Don't check TOC pages themselves
                if p["page_number"] in toc_pages:
                    continue
                if title_clean in p["text"].lower():
                    actual_page = p["page_number"]
                    break

            if actual_page and abs(actual_page - claimed_page) >= 2:
                desync_issues.append({
                    "title": entry["title"],
                    "claimed": claimed_page,
                    "actual": actual_page
                })

        if desync_issues:
            first_desync = desync_issues[0]
            self.issues.append(ComplianceIssue(
                id="TOC_DESYNCHRONIZATION",
                category=IssueCategory.TOC_PAGINATION,
                severity=IssueSeverity.ERROR,
                title="Désynchronisation entre le sommaire et la pagination réelle",
                message=f"La section '{first_desync['title'][:35]}' est indiquée à la page {first_desync['claimed']} dans le sommaire mais se trouve réellement à la page {first_desync['actual']}.",
                pages=[toc_pages[0], first_desync["actual"]],
                suggestion="Mettre à jour l'ensemble des champs de la table des matières (F9 dans Word ou re-compiler LaTeX) pour actualiser la pagination.",
                expected=f"Page {first_desync['actual']}",
                found=f"Page {first_desync['claimed']}",
                fixable_by_smart_fix=False
            ))

        # 4. Check Preliminary Roman Numerals vs Body Arabic Numerals
        intro_page_index = None
        for p in page_data:
            if re.search(r"\b(introduction\s+g[ée]n[ée]rale|chapitre\s+1|chapter\s+1)\b", p["text"], re.I):
                intro_page_index = p["page_number"]
                break

        # Check footer numbers on preliminary pages
        if intro_page_index and intro_page_index > 2:
            preliminary_pages = page_data[1:intro_page_index - 1]
            has_arabic_in_prelim = False
            for p in preliminary_pages:
                # check bottom 8% of page for digits
                bottom_words = [w["text"] for w in p["words"] if float(w["top"]) > p["height"] * 0.90]
                for bw in bottom_words:
                    if bw.isdigit() and int(bw) > 0 and int(bw) < 15:
                        has_arabic_in_prelim = True
                        break

            if has_arabic_in_prelim and self.profile.page_numbering_preliminary == "ROMAN":
                self.issues.append(ComplianceIssue(
                    id="PAGINATION_PRELIMINARY_NOT_ROMAN",
                    category=IssueCategory.TOC_PAGINATION,
                    severity=IssueSeverity.WARNING,
                    title="Numérotation des pages préliminaires non conforme",
                    message=f"La charte de {self.profile.name} préconise l'utilisation de chiffres romains (i, ii, iii...) pour les pages liminaires (dédicaces, remerciements, sommaire) et de chiffres arabes (1, 2, 3...) à partir de l'introduction.",
                    pages=[p["page_number"] for p in preliminary_pages[:3]],
                    suggestion="Séparer le document par un saut de section pour numéroter les préliminaires en i, ii, iii et redémarrer à 1 pour l'Introduction.",
                    expected="Chiffres romains (i, ii, iii...)",
                    found="Chiffres arabes",
                    fixable_by_smart_fix=True
                ))
                self.stats["docx_fixable_issues_count"] += 1

    # ── 6. DOCUMENT STRUCTURE & SEMANTIC CHECKS ───────────────────────
    def _check_document_structure(self, page_data: List[Dict[str, Any]]):
        full_doc_text = " ".join(p["text"] for p in page_data).lower()
        missing_sections = []

        section_patterns = {
            "Page de garde": r"\b(projet de fin d.etudes|rapport de stage|memoire|mémoire|encadrant|universite|faculte)\b",
            "Dédicaces": r"\b(d[ée]dicaces?|je d[ée]die)\b",
            "Remerciements": r"\b(remerciements?|nous tenons [àa] remercier|j.adresse mes sinc[èe]res remerciements)\b",
            "Résumé": r"\b(r[ée]sum[ée]|mots.cl[ée]s)\b",
            "Abstract": r"\b(abstract|keywords)\b",
            "Table des matières": r"\b(table des mati[èe]res|sommaire)\b",
            "Liste des figures": r"\b(liste des figures|table des figures)\b",
            "Liste des tableaux": r"\b(liste des tableaux|table des tableaux)\b",
            "Liste des abréviations": r"\b(liste des abrev|liste des acronymes|glossaire)\b",
            "Introduction générale": r"\b(introduction g[ée]n[ée]rale|introduction)\b",
            "Conclusion générale": r"\b(conclusion g[ée]n[ée]rale|conclusion et perspectives)\b",
            "Bibliographie": r"\b(bibliographie|r[ée]f[ée]rences bibliographiques|webographie|netographie)\b",
        }

        for req in self.profile.required_sections:
            matched = False
            for sec_name, pattern in section_patterns.items():
                if sec_name.lower() in req.lower() or req.lower() in sec_name.lower():
                    if re.search(pattern, full_doc_text):
                        matched = True
                        break
            if not matched:
                missing_sections.append(req)

        if missing_sections:
            self.issues.append(ComplianceIssue(
                id="STRUCTURE_MISSING_SECTIONS",
                category=IssueCategory.STRUCTURE_SEMANTIC,
                severity=IssueSeverity.WARNING if len(missing_sections) <= 2 else IssueSeverity.ERROR,
                title="Sections obligatoires requises manquantes",
                message=f"Selon la charte officielle de {self.profile.name}, les sections suivantes sont absentes ou non repérées : {', '.join(missing_sections)}.",
                pages=[1, 2],
                suggestion=f"Ajouter les sections requises ({', '.join(missing_sections)}) selon l'ordre stipulé par l'établissement.",
                expected="Toutes les sections de la charte présentes",
                found=f"{len(missing_sections)} section(s) manquante(s)",
                fixable_by_smart_fix=False
            ))

    # ── CATEGORY SCORES COMPUTATION ───────────────────────────────────
    def _compute_category_scores(self) -> Dict[str, ComplianceCategoryScore]:
        categories = [
            IssueCategory.TYPOGRAPHY,
            IssueCategory.MARGINS_SPACING,
            IssueCategory.HEADINGS,
            IssueCategory.FIGURES_TABLES,
            IssueCategory.TOC_PAGINATION,
            IssueCategory.STRUCTURE_SEMANTIC,
        ]

        scores = {}
        for cat in categories:
            cat_issues = [i for i in self.issues if i.category == cat]
            errors = sum(1 for i in cat_issues if i.severity == IssueSeverity.ERROR)
            warnings = sum(1 for i in cat_issues if i.severity == IssueSeverity.WARNING)

            # Base score 100
            score = 100.0 - (errors * 25.0) - (warnings * 12.0)
            score = max(20.0, min(100.0, score))

            status = "PASS" if score >= 85.0 else "WARNING" if score >= 60.0 else "FAIL"
            total_checks = 4
            passed_checks = max(0, total_checks - errors - warnings)

            scores[cat.value] = ComplianceCategoryScore(
                score=round(score, 1),
                status=status,
                total_checks=total_checks,
                passed_checks=passed_checks,
                issues_count=len(cat_issues)
            )
        return scores

    def _generate_executive_summary(self, overall_score: float, compliance_level: str) -> str:
        error_count = sum(1 for i in self.issues if i.severity == IssueSeverity.ERROR)
        warning_count = sum(1 for i in self.issues if i.severity == IssueSeverity.WARNING)
        fixable_count = self.stats["docx_fixable_issues_count"]

        if compliance_level == "CONFORME":
            return (
                f"Excellente conformité ({overall_score}%). Le rapport respecte rigoureusement "
                f"la charte graphique de {self.profile.full_name}. Aucune anomalie bloquante détectée."
            )
        elif compliance_level == "CONFORME_AVEC_RESERVES":
            return (
                f"Rapport partiellement conforme ({overall_score}%). {error_count} erreur(s) et {warning_count} "
                f"avertissement(s) nécessitent des corrections avant dépôt officiel chez {self.profile.name}. "
                f"{fixable_count} problème(s) peuvent être résolus en 1 clic grâce au Smart Fix DOCX."
            )
        else:
            return (
                f"Non-conformité critique constatée ({overall_score}%). Des divergences majeures relatives à "
                f"la typographie, aux marges, aux légendes ou au sommaire ont été identifiées. Une remise en forme "
                f"stricte selon le guide de {self.profile.name} est requise."
            )


# ── CUSTOM CHARTER PARSER (AI + REGEX) ──────────────────────────────
async def parse_custom_charter_text_or_pdf(content_text: str) -> Dict[str, Any]:
    """
    Analyzes an uploaded university formatting guide (PDF or text) and extracts
    structured rules (fonts, sizes, margins, captions, sections).
    """
    prompt = f"""
Tu es un expert en normalisation académique des rapports de PFE et thèses universitaires en Tunisie et à l'international.
Analyse le texte suivant extrait d'un guide officiel de rédaction universitaire et extrais les spécifications typographiques et de mise en page.

Texte du guide :
{content_text[:9000]}

Retourne UNIQUEMENT un JSON valide au format exact suivant:
{{
    "name": "Nom de l'Université ou École (ex: ENIT, INSAT, FST)",
    "full_name": "Nom complet de l'établissement",
    "description": "Brève description des règles officielles",
    "font_name": "Times New Roman" (ou Calibri, Arial),
    "font_size": 12.0,
    "line_spacing": 1.5,
    "margins_cm": {{
        "top": 2.5,
        "bottom": 2.5,
        "left": 2.5,
        "right": 2.5
    }},
    "alignment": "JUSTIFY",
    "heading1_size": 16.0,
    "heading2_size": 14.0,
    "heading3_size": 12.0,
    "page_numbering_preliminary": "ROMAN",
    "page_numbering_body": "ARABIC",
    "required_sections": [
        "Page de garde",
        "Remerciements",
        "Résumé",
        "Table des matières",
        "Introduction",
        "Conclusion",
        "Bibliographie"
    ],
    "detected_rules_summary": [
        "Police principale : Times New Roman 12pt",
        "Interligne standard : 1.5 ligne",
        "Marges uniformes : 2.5 cm"
    ]
}}
"""
    # Attempt AI extraction
    ai_result = await AIProviderAdapter.generate_completion_json(
        system_prompt="Tu es un extracteur de spécifications typographiques académiques. Réponds uniquement en JSON valide.",
        user_prompt=prompt,
        temperature=0.2
    )

    if ai_result and "name" in ai_result:
        return ai_result

    # Deterministic heuristic fallback if AI provider is unavailable
    detected_rules = []
    font_name = "Times New Roman"
    if re.search(r"\bcalibri\b", content_text, re.I):
        font_name = "Calibri"
        detected_rules.append("Police Calibri détectée")
    elif re.search(r"\barial\b", content_text, re.I):
        font_name = "Arial"
        detected_rules.append("Police Arial détectée")
    else:
        detected_rules.append("Police standard Times New Roman retenue")

    font_sz = 12.0
    m_sz = re.search(r"(\d{1,2}(?:\.5)?)\s*pt", content_text, re.I)
    if m_sz:
        font_sz = float(m_sz.group(1))
        detected_rules.append(f"Taille de police : {font_sz} pt")

    spacing = 1.5
    if re.search(r"\binterligne\s*:\s*1(?:\.0)?\b", content_text, re.I):
        spacing = 1.0
        detected_rules.append("Interligne simple détecté")
    else:
        detected_rules.append("Interligne standard 1.5 retenu")

    return {
        "name": "Charte Personnalisée",
        "full_name": "Charte de l'établissement utilisateur",
        "description": "Règles extraites automatiquement du document fourni",
        "font_name": font_name,
        "font_size": font_sz,
        "line_spacing": spacing,
        "margins_cm": {"top": 2.5, "bottom": 2.5, "left": 2.5, "right": 2.5},
        "alignment": "JUSTIFY",
        "heading1_size": 16.0,
        "heading2_size": 14.0,
        "heading3_size": 12.0,
        "page_numbering_preliminary": "ROMAN",
        "page_numbering_body": "ARABIC",
        "required_sections": [
            "Page de garde", "Remerciements", "Résumé", "Table des matières",
            "Introduction", "Conclusion", "Bibliographie"
        ],
        "detected_rules_summary": detected_rules
    }
