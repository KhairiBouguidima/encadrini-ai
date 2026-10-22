import hashlib
import io
from datetime import datetime, timezone
from typing import Optional, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing

from app.models.certificate import PFEValidationCertificate


def compute_certificate_hash(
    certificate_id: str,
    project_id: str,
    report_id: str,
    version_number: int,
    student_names: List[str],
    supervisor_name: str,
    validation_date: datetime,
) -> str:
    raw = f"{certificate_id}:{project_id}:{report_id}:{version_number}:{','.join(sorted(student_names))}:{supervisor_name}:{validation_date.isoformat()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def generate_qr_drawing(data: str, size: float = 75) -> Drawing:
    qr = QrCodeWidget(data)
    b = qr.getBounds()
    w = b[2] - b[0]
    h = b[3] - b[1]
    d = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
    d.add(qr)
    return d


def generate_pfe_certificate_pdf(
    cert: PFEValidationCertificate,
    verification_url: str,
) -> io.BytesIO:
    """
    Generates a professional, legally-distinguished, high-resolution official
    PFE Validation & Deposit Certificate PDF.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=32,
        bottomMargin=32,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    header_title_style = ParagraphStyle(
        "CertHeaderTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        alignment=1,  # Center
    )

    subtitle_style = ParagraphStyle(
        "CertSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#2563eb"),
        alignment=1,
    )

    section_heading_style = ParagraphStyle(
        "CertSectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#1e293b"),
    )

    body_style = ParagraphStyle(
        "CertBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155"),
    )

    label_style = ParagraphStyle(
        "CertLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#475569"),
    )

    elements = []

    # 1. Top Decorative Bar & Branding Header
    elements.append(HRFlowable(width="100%", thickness=3, color=colors.HexColor("#1d4ed8"), spaceAfter=8))

    header_table_data = [
        [
            Paragraph("RÉPUBLIQUE TUNISIENNE<br/>Ministère de l'Enseignement Supérieur", ParagraphStyle("Gov", fontName="Helvetica", fontSize=8, leading=10, textColor=colors.HexColor("#64748b"))),
            Paragraph("<b>ENCADRINI AI PLATFORM</b><br/><font size=7 color='#64748b'>Gestion & Conformité PFE</font>", ParagraphStyle("Sys", fontName="Helvetica", fontSize=9, leading=12, alignment=2, textColor=colors.HexColor("#2563eb"))),
        ]
    ]
    header_table = Table(header_table_data, colWidths=[260, 260])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 10))

    # 2. Certificate Official Title
    elements.append(Paragraph("ATTESTATION OFFICIELLE DE VALIDATION PFE", header_title_style))
    elements.append(Spacer(1, 2))
    elements.append(Paragraph("AUTORISATION DE DÉPÔT ET D'ACCÈS À LA SOUTENANCE", subtitle_style))
    elements.append(Spacer(1, 10))

    # 3. Certificate Reference Badge
    val_date_str = cert.validation_date.strftime("%d/%m/%Y à %H:%M") if cert.validation_date else datetime.now(timezone.utc).strftime("%d/%m/%Y à %H:%M")
    ref_data = [
        [
            Paragraph(f"<b>N° CERTIFICAT :</b> <font color='#1d4ed8'>{cert.certificate_id}</font>", label_style),
            Paragraph(f"<b>ANNÉE UNIVERSITAIRE :</b> {cert.academic_year}", label_style),
            Paragraph(f"<b>DATE D'ÉMISSION :</b> {val_date_str}", label_style),
        ]
    ]
    ref_table = Table(ref_data, colWidths=[180, 160, 180])
    ref_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    elements.append(ref_table)
    elements.append(Spacer(1, 12))

    # 4. Project & Academic Metadata Table
    students_display = "<br/>".join([
        f"• <b>{name}</b> ({email})"
        for name, email in zip(cert.student_names, cert.student_emails)
    ]) if cert.student_names else "Étudiant"

    meta_rows = [
        [
            Paragraph("Établissement :", label_style),
            Paragraph(f"<b>{cert.institution_name}</b>", body_style),
        ],
        [
            Paragraph("Projet de Fin d'Études :", label_style),
            Paragraph(f"<b>{cert.project_title}</b>", body_style),
        ],
        [
            Paragraph("Candidat(s) / Binôme :", label_style),
            Paragraph(students_display, body_style),
        ],
        [
            Paragraph("Version validée :", label_style),
            Paragraph(f"Rapport PFE — <b>Version {cert.version_number}</b> (Manuscrit Final Déposé)", body_style),
        ],
    ]
    meta_table = Table(meta_rows, colWidths=[140, 380])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 12))

    # 5. Supervision & Approval Decision Box
    elements.append(Paragraph("Validation et Décision de l'Encadrement", section_heading_style))
    elements.append(Spacer(1, 4))

    sup_academic_txt = f"<b>{cert.supervisor_name}</b><br/>{cert.supervisor_email}<br/><font color='#1d4ed8'>Encadrant Académique Principal</font>"
    sup_enterprise_txt = (
        f"<b>{cert.enterprise_supervisor_name}</b><br/>{cert.enterprise_supervisor_email}<br/><font color='#0f766e'>Tuteur en Entreprise</font>"
        if cert.enterprise_supervisor_name
        else "<i>Non applicable / Encadrement interne</i>"
    )

    decision_badge = (
        f"<font color='#15803d' size=10><b>✔ {cert.supervisor_mention or 'FAVORABLE POUR SOUTENANCE'}</b></font>"
    )

    supervisor_rows = [
        [
            Paragraph("Encadreur Universitaire :", label_style),
            Paragraph(sup_academic_txt, body_style),
            Paragraph("Encadreur Entreprise :", label_style),
            Paragraph(sup_enterprise_txt, body_style),
        ],
        [
            Paragraph("Avis Pédagogique :", label_style),
            Paragraph(decision_badge, body_style),
            Paragraph("Remarques éventuelles :", label_style),
            Paragraph(cert.supervisor_notes or "Rapport conforme aux exigences académiques. Dépôt autorisé.", body_style),
        ]
    ]
    supervisor_table = Table(supervisor_rows, colWidths=[120, 140, 110, 150])
    supervisor_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ffffff")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(supervisor_table)
    elements.append(Spacer(1, 10))

    # 6. AI Compliance Score Block (Optional - Never Fabricated!)
    elements.append(Paragraph("Audit Technique & Conformité de Rédaction (IA)", section_heading_style))
    elements.append(Spacer(1, 4))

    if cert.ai_compliance_score is not None:
        level_label = cert.ai_compliance_level or "CONFORME"
        summary_txt = cert.ai_compliance_summary or "Contrôles typographiques, marges, pagination et structuration validés."
        comp_data = [
            [
                Paragraph(
                    f"Score de Conformité : <b>{cert.ai_compliance_score:.1f}%</b> ({level_label})",
                    ParagraphStyle("CompBadge", fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor("#15803d")),
                ),
                Paragraph(f"Détails de l'analyse : {summary_txt}", body_style),
            ]
        ]
        comp_bg = "#f0fdf4"
        comp_border = "#86efac"
    else:
        comp_data = [
            [
                Paragraph("<b>Audit IA :</b> Non requis ou non exécuté sur cette version", label_style),
                Paragraph("La validation finale repose pleinement sur l'avis souverain des encadreurs universitaires.", body_style),
            ]
        ]
        comp_bg = "#f8fafc"
        comp_border = "#e2e8f0"

    comp_table = Table(comp_data, colWidths=[200, 320])
    comp_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(comp_bg)),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor(comp_border)),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(comp_table)
    elements.append(Spacer(1, 12))

    # 7. Verification QR Code & Authenticity Block
    qr_drawing = generate_qr_drawing(verification_url, size=70)
    verif_text = (
        "<b>VÉRIFICATION DE L'AUTHENTICITÉ DU CERTIFICAT :</b><br/>"
        "Ce document officiel dispose d'un identifiant unique et infalsifiable. "
        "L'administration de l'établissement ou le jury de soutenance peut scanner le QR Code "
        "ou consulter l'adresse officielle ci-dessous pour confirmer instantanément la validité du dépôt "
        "sans exposer le contenu confidentiel du manuscrit.<br/>"
        f"<font color='#2563eb'><u>{verification_url}</u></font><br/>"
        f"<font size=7 color='#64748b'>Empreinte SHA-256 : {cert.certificate_hash}</font>"
    )

    qr_block_data = [
        [
            qr_drawing,
            Paragraph(verif_text, body_style),
        ]
    ]
    qr_table = Table(qr_block_data, colWidths=[80, 440])
    qr_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(qr_table)
    elements.append(Spacer(1, 10))

    # 8. Legal Distinction / Disclaimer Box (Important requirement)
    disclaimer_text = (
        "<b>AVIS LÉGAL ET RÉGLEMENTAIRE :</b> "
        + cert.legal_notice
        + " Toute falsification ou altération de ce document engage la responsabilité pénale et disciplinaire de son auteur."
    )
    disclaimer_table = Table(
        [[Paragraph(disclaimer_text, ParagraphStyle("Disc", fontName="Helvetica-Oblique", fontSize=7, leading=9.5, textColor=colors.HexColor("#64748b")))]],
        colWidths=[520],
    )
    disclaimer_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(disclaimer_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer
