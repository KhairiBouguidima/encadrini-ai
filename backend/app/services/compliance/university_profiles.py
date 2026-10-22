from typing import Dict, Any, List
from app.schemas.compliance import UniversityProfileSchema

PROFILES: Dict[str, UniversityProfileSchema] = {
    "INSAT": UniversityProfileSchema(
        id="INSAT",
        name="INSAT",
        full_name="Institut National des Sciences Appliquées et de Technologie",
        description="Charte graphique officielle PFE - INSAT Tunis (Université de Carthage)",
        badge_color="#0284C7",
        body_font_families=["Times New Roman", "Times", "Arial"],
        body_font_size=12.0,
        body_font_size_tolerance=0.6,
        line_spacing=1.5,
        margins_cm={"top": 2.5, "bottom": 2.5, "left": 2.5, "right": 2.5},
        alignment="JUSTIFY",
        heading1_size=16.0,
        heading2_size=14.0,
        heading3_size=12.0,
        figure_caption_pattern=r"^(?:Figure|Fig\.?)\s+(\d+[\.\-]\d+)\s*[:\-]\s*(.+)$",
        figure_caption_example="Figure 1.2: Architecture microservices de la plateforme",
        table_caption_pattern=r"^(?:Tableau|Table)\s+(\d+[\.\-]\d+)\s*[:\-]\s*(.+)$",
        table_caption_example="Tableau 2.1: Comparatif des bases de données NoSQL",
        page_numbering_preliminary="ROMAN",
        page_numbering_body="ARABIC",
        required_sections=[
            "Page de garde",
            "Dédicaces",
            "Remerciements",
            "Résumé",
            "Abstract",
            "Table des matières",
            "Liste des figures",
            "Liste des tableaux",
            "Introduction générale",
            "Conclusion générale",
            "Bibliographie"
        ]
    ),
    "ESPRIT": UniversityProfileSchema(
        id="ESPRIT",
        name="ESPRIT",
        full_name="École Supérieure Privée d'Ingénierie et de Technologies",
        description="Guide officiel de rédaction des mémoires PFE - ESPRIT Ingénieur",
        badge_color="#DC2626",
        body_font_families=["Calibri", "Carlito", "Times New Roman"],
        body_font_size=11.0,
        body_font_size_tolerance=0.8,
        line_spacing=1.5,
        margins_cm={"top": 2.5, "bottom": 2.5, "left": 3.0, "right": 2.5},
        alignment="JUSTIFY",
        heading1_size=16.0,
        heading2_size=14.0,
        heading3_size=12.0,
        figure_caption_pattern=r"^(?:Figure|Fig\.?)\s+(\d+[\.\-]\d+)\s*[:\-]\s*(.+)$",
        figure_caption_example="Figure 2.3: Diagramme de cas d'utilisation global",
        table_caption_pattern=r"^(?:Tableau|Table)\s+(\d+[\.\-]\d+)\s*[:\-]\s*(.+)$",
        table_caption_example="Tableau 3.1: Matrice de traçabilité des exigences",
        page_numbering_preliminary="ROMAN",
        page_numbering_body="ARABIC",
        required_sections=[
            "Page de garde",
            "Dédicaces",
            "Remerciements",
            "Résumé",
            "Abstract",
            "Table des matières",
            "Liste des figures",
            "Liste des tableaux",
            "Liste des abréviations",
            "Introduction générale",
            "Conclusion générale",
            "Bibliographie"
        ]
    ),
    "ENSI": UniversityProfileSchema(
        id="ENSI",
        name="ENSI",
        full_name="École Nationale des Sciences de l'Informatique",
        description="Guide et normes de présentation du rapport PFE - ENSI Manouba",
        badge_color="#4F46E5",
        body_font_families=["Times New Roman", "Times", "CMR10", "Computer Modern", "Nimbus Roman"],
        body_font_size=12.0,
        body_font_size_tolerance=0.5,
        line_spacing=1.5,
        margins_cm={"top": 2.5, "bottom": 2.5, "left": 2.5, "right": 2.5},
        alignment="JUSTIFY",
        heading1_size=16.0,
        heading2_size=14.0,
        heading3_size=12.0,
        figure_caption_pattern=r"^(?:Figure|Fig\.?)\s+(\d+[\.\-]\d+)\s*[:\-]\s*(.+)$",
        figure_caption_example="Figure 1.1: Schéma du réseau de neurones convolutif",
        table_caption_pattern=r"^(?:Tableau|Table)\s+(\d+[\.\-]\d+)\s*[:\-]\s*(.+)$",
        table_caption_example="Tableau 1.2: Métriques de précision et F1-score",
        page_numbering_preliminary="ROMAN",
        page_numbering_body="ARABIC",
        required_sections=[
            "Page de garde",
            "Remerciements",
            "Résumé",
            "Abstract",
            "Table des matières",
            "Liste des figures",
            "Liste des tableaux",
            "Introduction générale",
            "Conclusion générale",
            "Références bibliographiques (IEEE)"
        ]
    ),
    "FST": UniversityProfileSchema(
        id="FST",
        name="FST",
        full_name="Faculté des Sciences de Tunis",
        description="Charte de mémoire de mastère et rapport PFE - FST Tunis El Manar",
        badge_color="#059669",
        body_font_families=["Times New Roman", "Times"],
        body_font_size=12.0,
        body_font_size_tolerance=0.5,
        line_spacing=1.5,
        margins_cm={"top": 2.5, "bottom": 2.5, "left": 3.0, "right": 2.0},
        alignment="JUSTIFY",
        heading1_size=16.0,
        heading2_size=14.0,
        heading3_size=12.0,
        figure_caption_pattern=r"^(?:Figure|Fig\.?)\s+(\d+[\.\-]\d+)\s*[:\-]\s*(.+)$",
        figure_caption_example="Figure 3.2: Architecture distribuée des serveurs",
        table_caption_pattern=r"^(?:Tableau|Table)\s+(\d+[\.\-]\d+)\s*[:\-]\s*(.+)$",
        table_caption_example="Tableau 2.2: Paramètres des expérimentations",
        page_numbering_preliminary="ROMAN",
        page_numbering_body="ARABIC",
        required_sections=[
            "Page de garde",
            "Dédicaces",
            "Remerciements",
            "Résumé",
            "Abstract",
            "Table des matières",
            "Liste des figures",
            "Liste des tableaux",
            "Introduction",
            "Conclusion",
            "Bibliographie"
        ]
    ),
    "ISET": UniversityProfileSchema(
        id="ISET",
        name="ISET",
        full_name="Réseau des Instituts Supérieurs des Études Technologiques",
        description="Cahier des charges et charte de rédaction du rapport de stage de fin d'études DGET / ISET",
        badge_color="#D97706",
        body_font_families=["Arial", "Helvetica", "Times New Roman"],
        body_font_size=12.0,
        body_font_size_tolerance=0.5,
        line_spacing=1.5,
        margins_cm={"top": 2.5, "bottom": 2.5, "left": 2.5, "right": 2.5},
        alignment="JUSTIFY",
        heading1_size=16.0,
        heading2_size=14.0,
        heading3_size=12.0,
        figure_caption_pattern=r"^(?:Figure|Fig\.?)\s+(\d+[\.\-]\d+)\s*[:\-]\s*(.+)$",
        figure_caption_example="Figure 2.1: Schéma de câblage de l'automate",
        table_caption_pattern=r"^(?:Tableau|Table)\s+(\d+[\.\-]\d+)\s*[:\-]\s*(.+)$",
        table_caption_example="Tableau 1.1: Fiche technique des capteurs",
        page_numbering_preliminary="ROMAN",
        page_numbering_body="ARABIC",
        required_sections=[
            "Page de garde",
            "Remerciements",
            "Sommaire",
            "Liste des figures",
            "Liste des tableaux",
            "Introduction générale",
            "Présentation de l'entreprise",
            "Réalisation & Tests",
            "Conclusion",
            "Netographie / Bibliographie"
        ]
    )
}

def get_profile(university_id: str, custom_rules: Dict[str, Any] = None) -> UniversityProfileSchema:
    normalized_id = (university_id or "").strip().upper()
    if normalized_id in PROFILES and normalized_id != "CUSTOM":
        return PROFILES[normalized_id]
    
    # Custom profile fallback with user-provided overrides
    custom = custom_rules or {}
    font_name = custom.get("font_name", "Times New Roman")
    font_size = float(custom.get("font_size", 12.0))
    line_spacing = float(custom.get("line_spacing", 1.5))
    margins = custom.get("margins_cm", {"top": 2.5, "bottom": 2.5, "left": 2.5, "right": 2.5})
    
    return UniversityProfileSchema(
        id="CUSTOM",
        name="Charte Personnalisée",
        full_name=custom.get("full_name", "Charte Universitaire Spécifique"),
        description=custom.get("description", "Règles extraites ou configurées par l'utilisateur"),
        badge_color="#8B5CF6",
        body_font_families=[font_name, "Times New Roman", "Arial"],
        body_font_size=font_size,
        body_font_size_tolerance=0.6,
        line_spacing=line_spacing,
        margins_cm=margins,
        alignment=custom.get("alignment", "JUSTIFY"),
        heading1_size=float(custom.get("heading1_size", 16.0)),
        heading2_size=float(custom.get("heading2_size", 14.0)),
        heading3_size=float(custom.get("heading3_size", 12.0)),
        figure_caption_pattern=r"^(?:Figure|Fig\.?)\s+(\d+[\.\-]\d+)\s*[:\-]\s*(.+)$",
        figure_caption_example="Figure 1.1: Intitulé descriptif",
        table_caption_pattern=r"^(?:Tableau|Table)\s+(\d+[\.\-]\d+)\s*[:\-]\s*(.+)$",
        table_caption_example="Tableau 1.1: Intitulé descriptif",
        page_numbering_preliminary=custom.get("page_numbering_preliminary", "ROMAN"),
        page_numbering_body=custom.get("page_numbering_body", "ARABIC"),
        required_sections=custom.get("required_sections", [
            "Page de garde", "Remerciements", "Table des matières", "Introduction", "Conclusion", "Bibliographie"
        ])
    )
