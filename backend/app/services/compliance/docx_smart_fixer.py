import io
import re
from typing import Dict, Any, List, Tuple
import docx
from docx.shared import Pt, Cm, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from app.schemas.compliance import UniversityProfileSchema


class DocxSmartFixer:
    def __init__(self, docx_bytes: bytes, profile: UniversityProfileSchema):
        self.docx_bytes = docx_bytes
        self.profile = profile
        self.fixes_applied: List[str] = []

    def fix(self) -> Tuple[bytes, List[str]]:
        doc = docx.Document(io.BytesIO(self.docx_bytes))
        primary_font = self.profile.body_font_families[0]

        # 1. Page Margins across all sections
        req_margins = self.profile.margins_cm
        sections_count = len(doc.sections)
        for section in doc.sections:
            section.top_margin = Cm(req_margins.get("top", 2.5))
            section.bottom_margin = Cm(req_margins.get("bottom", 2.5))
            section.left_margin = Cm(req_margins.get("left", 2.5))
            section.right_margin = Cm(req_margins.get("right", 2.5))

        self.fixes_applied.append(
            f"Marges normalisées selon {self.profile.name} sur {sections_count} section(s) : "
            f"Haut={req_margins.get('top', 2.5)}cm, Bas={req_margins.get('bottom', 2.5)}cm, "
            f"Gauche={req_margins.get('left', 2.5)}cm, Droite={req_margins.get('right', 2.5)}cm."
        )

        # 2. Update Style Definitions
        try:
            normal_style = doc.styles["Normal"]
            normal_style.font.name = primary_font
            normal_style.font.size = Pt(self.profile.body_font_size)
            normal_style.paragraph_format.line_spacing = self.profile.line_spacing
            normal_style.paragraph_format.space_after = Pt(6)
            normal_style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        except Exception:
            pass

        # Configure Heading Styles
        heading_specs = [
            ("Heading 1", self.profile.heading1_size, Pt(12), Pt(6)),
            ("Heading 2", self.profile.heading2_size, Pt(10), Pt(4)),
            ("Heading 3", self.profile.heading3_size, Pt(6), Pt(2)),
        ]
        for style_name, size_val, sp_before, sp_after in heading_specs:
            try:
                if style_name in doc.styles:
                    h_style = doc.styles[style_name]
                    h_style.font.name = primary_font
                    h_style.font.size = Pt(size_val)
                    h_style.font.bold = True
                    h_style.paragraph_format.space_before = sp_before
                    h_style.paragraph_format.space_after = sp_after
                    h_style.paragraph_format.keep_with_next = True
            except Exception:
                pass

        self.fixes_applied.append(
            f"Styles de titres harmonisés : Titre 1 ({self.profile.heading1_size}pt Gras), "
            f"Titre 2 ({self.profile.heading2_size}pt Gras), Titre 3 ({self.profile.heading3_size}pt Gras)."
        )

        # 3. Process Paragraphs
        paragraphs_adjusted = 0
        captions_fixed = 0

        fig_pattern = re.compile(r"^(?:Fig\.?|Figure)\s*(\d+(?:[\.\-]\d+)?)\s*[:\-\.]?\s*(.*)$", re.IGNORECASE)
        table_pattern = re.compile(r"^(?:Tableau|Table)\s*(\d+(?:[\.\-]\d+)?)\s*[:\-\.]?\s*(.*)$", re.IGNORECASE)

        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue

            style_name = p.style.name.lower() if p.style and p.style.name else ""

            # Check if this is a figure caption
            fig_match = fig_pattern.match(text)
            table_match = table_pattern.match(text)

            if fig_match:
                num = fig_match.group(1).replace("-", ".")
                title = fig_match.group(2).strip()
                new_text = f"Figure {num}: {title}" if title else f"Figure {num}"
                p.text = new_text
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(4)
                p.paragraph_format.space_after = Pt(12)
                p.paragraph_format.line_spacing = 1.0
                for run in p.runs:
                    run.font.name = primary_font
                    run.font.size = Pt(10.0)
                    run.font.italic = True
                captions_fixed += 1
                continue

            elif table_match:
                num = table_match.group(1).replace("-", ".")
                title = table_match.group(2).strip()
                new_text = f"Tableau {num}: {title}" if title else f"Tableau {num}"
                p.text = new_text
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(12)
                p.paragraph_format.space_after = Pt(4)
                p.paragraph_format.line_spacing = 1.0
                for run in p.runs:
                    run.font.name = primary_font
                    run.font.size = Pt(10.0)
                    run.font.italic = True
                captions_fixed += 1
                continue

            # Standard body paragraphs
            is_heading = "heading" in style_name or "titre" in style_name
            if not is_heading:
                # Retain centered text if intentionally centered (e.g. quotes or title elements under 40 chars)
                if p.alignment != WD_ALIGN_PARAGRAPH.CENTER or len(text) > 80:
                    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

                p.paragraph_format.line_spacing = self.profile.line_spacing
                if p.paragraph_format.space_after is None or p.paragraph_format.space_after.pt < 2:
                    p.paragraph_format.space_after = Pt(6)

                # Harmonize run fonts
                for run in p.runs:
                    run.font.name = primary_font
                    if not run.font.size:
                        run.font.size = Pt(self.profile.body_font_size)

                paragraphs_adjusted += 1

        self.fixes_applied.append(
            f"{paragraphs_adjusted} paragraphe(s) de corps mis en conformité : police {primary_font} "
            f"{self.profile.body_font_size}pt, interligne {self.profile.line_spacing} et alignement justifié."
        )

        if captions_fixed > 0:
            self.fixes_applied.append(
                f"{captions_fixed} légende(s) de figures et tableaux normalisées (format officiel, 10pt italique centré)."
            )

        # 4. Save to Bytes
        output_stream = io.BytesIO()
        doc.save(output_stream)
        output_stream.seek(0)
        return output_stream.getvalue(), self.fixes_applied
