import smtplib
from email.message import EmailMessage
import requests

from app.core.config import settings


def _send_email_transport(to_email: str, subject: str, html_content: str, text_content: str, email_type: str = "email") -> bool:
    """
    Sends an email using Resend (HTTPS 443), Brevo (HTTPS 443), or SMTP (465/587).
    All credentials are read strictly from environment variables (.env).
    
    HTTPS APIs (Resend/Brevo) bypass Render Free tier restrictions because
    Render Free blocks outbound TCP connections on SMTP ports (25, 465, 587).
    """
    # 1. Resend HTTP API (Port 443 - Works seamlessly on Render free tier)
    if settings.RESEND_API_KEY:
        try:
            api_key = settings.RESEND_API_KEY.strip().strip('"\'')
            from_addr = settings.RESEND_FROM_EMAIL.strip() if settings.RESEND_FROM_EMAIL else "Encadrini <onboarding@resend.dev>"
            res = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_addr,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content,
                    "text": text_content,
                },
                timeout=12,
            )
            if res.status_code in [200, 201]:
                print(f"[{email_type}] Successfully delivered email via Resend HTTPS to {to_email}", flush=True)
                return True
            else:
                print(f"[{email_type}] Resend API error ({res.status_code}): {res.text}", flush=True)
        except Exception as e:
            print(f"[{email_type}] Resend request exception: {e}", flush=True)

    # 2. Brevo HTTP API (Port 443 - Works seamlessly on Render free tier)
    if settings.BREVO_API_KEY:
        try:
            sender_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME or "contact@encadrini.com"
            res = requests.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": settings.BREVO_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "sender": {"name": "Encadrini", "email": sender_email},
                    "to": [{"email": to_email}],
                    "subject": subject,
                    "htmlContent": html_content,
                    "textContent": text_content,
                },
                timeout=12,
            )
            if res.status_code in [200, 201]:
                print(f"[{email_type}] Successfully delivered email via Brevo HTTPS to {to_email}", flush=True)
                return True
            else:
                print(f"[{email_type}] Brevo API error ({res.status_code}): {res.text}", flush=True)
        except Exception as e:
            print(f"[{email_type}] Brevo request exception: {e}", flush=True)

    # 3. Standard SMTP (Port 465 SSL or Port 587 STARTTLS)
    if settings.SMTP_HOST:
        try:
            message = EmailMessage()
            message["Subject"] = subject

            from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
            if from_email and "<" not in from_email:
                message["From"] = f"Encadrini <{from_email}>"
            else:
                message["From"] = from_email

            message["To"] = to_email
            message.set_content(text_content)
            message.add_alternative(html_content, subtype="html")

            if settings.SMTP_PORT == 465:
                with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12) as smtp:
                    if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                        smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                    smtp.send_message(message)
            else:
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12) as smtp:
                    if settings.SMTP_USE_TLS:
                        smtp.starttls()
                    if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                        smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                    smtp.send_message(message)

            print(f"[{email_type}] Successfully delivered email via SMTP to {to_email}", flush=True)
            return True
        except Exception as e:
            print(
                f"[{email_type}] SMTP error sending email to {to_email}: {e} "
                f"(If running on Render Free tier, outbound SMTP ports 25, 465, 587 are blocked by Render. "
                f"Set RESEND_API_KEY or BREVO_API_KEY in your .env / Render environment variables to send via HTTPS port 443).",
                flush=True
            )
            return False

    print(f"[{email_type}] Notice: No email provider configured in .env (set RESEND_API_KEY, BREVO_API_KEY, or SMTP_HOST). Email for {to_email} skipped.", flush=True)
    return False


def _build_frontend_query_link(query_param: str, token: str) -> str:
    base = (settings.FRONTEND_URL or "https://encadrini-ai.vercel.app").rstrip("/")
    if "?" in base:
        return f"{base}&{query_param}={token}"
    return f"{base}/?{query_param}={token}"


def build_email_confirmation_link(token: str) -> str:
    return _build_frontend_query_link("confirm_email", token)


def build_password_reset_link(token: str) -> str:
    return _build_frontend_query_link("reset_token", token)


def build_invitation_link(token: str) -> str:
    return _build_frontend_query_link("invitation_token", token)


def _build_html_email(
    badge_label: str,
    headline: str,
    greeting: str,
    body_paragraphs: list[str],
    cta_label: str,
    cta_url: str,
    detail_box: str | None = None,
    expiry_notice: str | None = None,
    security_notice: str | None = None,
) -> str:
    """
    Constructs a modern, responsive, and bulletproof HTML email template
    compatible with all major email clients (Outlook, Gmail, Apple Mail, etc.).
    """
    paragraphs_html = "".join(
        f'<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.65; color: #334155;">{p}</p>'
        for p in body_paragraphs
    )

    detail_box_html = ""
    if detail_box:
        detail_box_html = f"""
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
            {detail_box}
        </div>
        """

    expiry_html = ""
    if expiry_notice:
        expiry_html = f"""
        <div style="display: flex; align-items: center; margin-bottom: 8px; font-size: 13px; color: #64748b; line-height: 1.5;">
            <strong style="color: #475569; margin-right: 6px;">⏱ Validité :</strong> {expiry_notice}
        </div>
        """

    security_html = ""
    if security_notice:
        security_html = f"""
        <div style="font-size: 13px; color: #64748b; line-height: 1.5;">
            <strong style="color: #475569; margin-right: 6px;">🔒 Sécurité :</strong> {security_notice}
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{headline}</title>
  <style type="text/css">
    body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
    table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
    img {{ -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }}
    body {{ margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }}
    .cta-button:hover {{ background-color: #1d4ed8 !important; }}
    @media screen and (max-width: 600px) {{
      .email-container {{ width: 100% !important; padding: 12px !important; }}
      .content-card {{ padding: 24px 18px !important; }}
    }}
  </style>
</head>
<body style="margin: 0; padding: 32px 0; background-color: #f1f5f9; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <!-- Wrapper container -->
        <table border="0" cellpadding="0" cellspacing="0" width="580" class="email-container" style="max-width: 580px; width: 100%;">
          
          <!-- Brand Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #1e3a8a; text-decoration: none; display: inline-block;">
                      Encadrini<span style="color: #2563eb;">.ai</span>
                    </span>
                    <div style="font-size: 12px; color: #64748b; font-weight: 500; letter-spacing: 0.3px; margin-top: 4px; text-transform: uppercase;">
                      Plateforme d'Encadrement Académique & Suivi PFE
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Card -->
          <tr>
            <td class="content-card" style="background-color: #ffffff; border-radius: 12px; padding: 36px 36px 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
              
              <!-- Badge -->
              <div style="margin-bottom: 16px;">
                <span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; border: 1px solid #dbeafe;">
                  {badge_label}
                </span>
              </div>

              <!-- Headline & Greeting -->
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.35;">
                {headline}
              </h1>

              <p style="margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #1e293b;">
                {greeting}
              </p>

              <!-- Body paragraphs -->
              {paragraphs_html}

              <!-- Detail / highlight box if applicable -->
              {detail_box_html}

              <!-- Bulletproof Call-To-Action Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 24px;">
                <tr>
                  <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" bgcolor="#2563eb" style="border-radius: 8px;">
                          <a href="{cta_url}" target="_blank" class="cta-button" style="display: inline-block; padding: 14px 34px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 8px; background-color: #2563eb; letter-spacing: 0.2px;">
                            {cta_label}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Alternative URL box -->
              <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 6px; padding: 12px 14px; margin-top: 24px; word-break: break-all;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">
                  Si le bouton ne fonctionne pas, copiez et collez l'URL suivante dans votre navigateur :
                </div>
                <a href="{cta_url}" target="_blank" style="font-size: 12px; color: #2563eb; text-decoration: underline; word-break: break-all;">
                  {cta_url}
                </a>
              </div>

              <!-- Notice & Security Box -->
              <div style="border-top: 1px solid #f1f5f9; margin-top: 28px; padding-top: 20px;">
                {expiry_html}
                {security_html}
              </div>

            </td>
          </tr>

          <!-- Professional Footer -->
          <tr>
            <td align="center" style="padding-top: 24px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="font-size: 12px; color: #94a3b8; line-height: 1.6;">
                    <p style="margin: 0 0 6px;">
                      © 2026 <strong>Encadrini</strong> • Plateforme d'Encadrement et de Suivi de Projets de Fin d'Études.
                    </p>
                    <p style="margin: 0 0 6px;">
                      Cet email est confidentiel et a été envoyé automatiquement. Merci de ne pas y répondre directement.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_email_confirmation(to_email: str, first_name: str, token: str) -> bool:
    confirmation_link = build_email_confirmation_link(token)
    subject = "Confirmation de votre compte • Encadrini"

    body_paragraphs = [
        "Nous vous remercions pour votre inscription sur <strong>Encadrini</strong>, la solution dédiée à l'accompagnement, au suivi et à la réussite des projets de fin d'études.",
        "Afin de finaliser l'ouverture de votre compte et de débloquer l'ensemble de vos fonctionnalités, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :",
    ]

    html_content = _build_html_email(
        badge_label="Activation de compte",
        headline="Bienvenue sur Encadrini",
        greeting=f"Bonjour {first_name},",
        body_paragraphs=body_paragraphs,
        cta_label="Activer mon compte",
        cta_url=confirmation_link,
        expiry_notice="Ce lien de confirmation est sécurisé et demeure valide pendant <strong>24 heures</strong>.",
        security_notice="Si vous n'êtes pas à l'origine de cette inscription, veuillez simplement ignorer cet email. Aucun compte ne sera activé sans votre confirmation.",
    )

    text_content = f"""Bonjour {first_name},

Bienvenue sur Encadrini, la plateforme universitaire de suivi et d'encadrement des projets de fin d'études.

Pour finaliser l'activation de votre compte et accéder à votre espace de travail, veuillez confirmer votre adresse email en ouvrant le lien suivant :
{confirmation_link}

Validité : Ce lien demeure actif pendant 24 heures.
Sécurité : Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email en toute sécurité.

Cordialement,
L'équipe Encadrini
Plateforme Académique & Suivi PFE
"""

    print(f"[email-confirmation] Confirmation link for {to_email}: {confirmation_link}", flush=True)
    return _send_email_transport(to_email, subject, html_content, text_content, "email-confirmation")


def send_password_reset_email(to_email: str, first_name: str, token: str) -> bool:
    reset_link = build_password_reset_link(token)
    subject = "Réinitialisation de votre mot de passe • Encadrini"

    body_paragraphs = [
        "Nous avons reçu une demande de réinitialisation du mot de passe associé à votre compte <strong>Encadrini</strong>.",
        "Pour définir un nouveau mot de passe et rétablir vos accès en toute sécurité, veuillez cliquer sur le bouton suivant :",
    ]

    html_content = _build_html_email(
        badge_label="Sécurité du compte",
        headline="Réinitialisation de mot de passe",
        greeting=f"Bonjour {first_name},",
        body_paragraphs=body_paragraphs,
        cta_label="Réinitialiser mon mot de passe",
        cta_url=reset_link,
        expiry_notice="Par mesure de sécurité, ce lien à usage unique expire dans <strong>1 heure</strong>.",
        security_notice="Si vous n'avez pas sollicité cette réinitialisation, aucune action n'est requise. Votre mot de passe actuel reste actif et inchangé.",
    )

    text_content = f"""Bonjour {first_name},

Nous avons reçu une demande de réinitialisation du mot de passe associé à votre compte Encadrini.

Pour définir un nouveau mot de passe sécurisé, veuillez suivre ce lien :
{reset_link}

Validité : Ce lien à usage unique expire dans 1 heure.
Sécurité : Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message ; vos identifiants actuels demeurent parfaitement protégés.

Cordialement,
L'équipe Encadrini
Plateforme Académique & Suivi PFE
"""

    print(f"[password-reset] Reset link for {to_email}: {reset_link}", flush=True)
    return _send_email_transport(to_email, subject, html_content, text_content, "password-reset")


def send_supervisor_invitation_email(to_email: str, student_name: str, project_title: str, token: str) -> bool:
    invitation_link = build_invitation_link(token)
    subject = f"Invitation d'encadrement PFE : {project_title} • Encadrini"

    body_paragraphs = [
        f"L'étudiant(e) <strong>{student_name}</strong> vous invite formellement à assurer l'encadrement de son projet de fin d'études sur la plateforme <strong>Encadrini</strong>.",
        "En acceptant cette invitation, vous accéderez à l'espace de suivi dédié, au calendrier des jalons clés, aux livrables de l'étudiant ainsi qu'aux outils d'évaluation.",
    ]

    detail_box = f"""
    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #2563eb; margin-bottom: 4px;">
      Projet de fin d'études
    </div>
    <div style="font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.4;">
      « {project_title} »
    </div>
    <div style="font-size: 13px; color: #64748b; margin-top: 6px;">
      Étudiant(e) demandeur(se) : <strong>{student_name}</strong>
    </div>
    """

    html_content = _build_html_email(
        badge_label="Supervision Académique",
        headline="Invitation d'encadrement de projet",
        greeting="Bonjour,",
        body_paragraphs=body_paragraphs,
        cta_label="Accepter l'encadrement",
        cta_url=invitation_link,
        detail_box=detail_box,
        expiry_notice="Cette invitation est valable pendant <strong>7 jours</strong>.",
        security_notice="Si cette demande ne vous concerne pas ou a été émise par erreur, vous pouvez simplement ignorer ce message.",
    )

    text_content = f"""Bonjour,

L'étudiant(e) {student_name} vous invite à assurer l'encadrement de son projet de fin d'études (PFE) sur la plateforme Encadrini.

Projet : « {project_title} »
Étudiant(e) : {student_name}

En acceptant cette invitation, vous aurez accès à l'espace collaboratif du projet, au calendrier des jalons, aux livrables et aux outils d'évaluation.

Pour accepter cette invitation, veuillez cliquer sur le lien suivant :
{invitation_link}

Validité : Ce lien d'invitation reste valide pendant 7 jours.
Si vous n'êtes pas concerné(e), vous pouvez ignorer cet email.

Cordialement,
L'équipe Encadrini
Plateforme Académique & Suivi PFE
"""

    print(f"[supervisor-invitation] Invitation link for {to_email}: {invitation_link}", flush=True)
    return _send_email_transport(to_email, subject, html_content, text_content, "supervisor-invitation")


def send_binome_invitation_email(to_email: str, student_name: str, project_title: str, token: str) -> bool:
    invitation_link = build_invitation_link(token)
    subject = f"Invitation à former une équipe binôme : {project_title} • Encadrini"

    body_paragraphs = [
        f"L'étudiant(e) <strong>{student_name}</strong> vous invite à former une équipe en binôme pour son projet de fin d'études sur la plateforme <strong>Encadrini</strong>.",
        "En acceptant cette invitation, vous collaborerez directement sur le même espace de travail, partagerez le suivi des jalons clés, les dépôts de livrables et les simulations de soutenance.",
    ]

    detail_box = f"""
    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #2563eb; margin-bottom: 4px;">
      Projet de fin d'études (Binôme)
    </div>
    <div style="font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.4;">
      « {project_title} »
    </div>
    <div style="font-size: 13px; color: #64748b; margin-top: 6px;">
      Étudiant(e) initiateur(trice) : <strong>{student_name}</strong>
    </div>
    """

    html_content = _build_html_email(
        badge_label="Collaboration Étudiante",
        headline="Invitation à former un binôme PFE",
        greeting="Bonjour,",
        body_paragraphs=body_paragraphs,
        cta_label="Rejoindre le projet en binôme",
        cta_url=invitation_link,
        detail_box=detail_box,
        expiry_notice="Cette invitation est valable pendant <strong>7 jours</strong>.",
        security_notice="Si cette invitation ne vous concerne pas ou si vous faites déjà partie d'un autre projet, vous pouvez simplement l'ignorer.",
    )

    text_content = f"""Bonjour,

L'étudiant(e) {student_name} vous invite à former une équipe en binôme pour son projet de fin d'études (PFE) sur la plateforme Encadrini.

Projet : « {project_title} »
Étudiant(e) : {student_name}

En acceptant cette invitation, vous collaborerez directement sur le même espace de travail et partagerez les livrables ainsi que le calendrier du projet.

Pour accepter cette invitation et rejoindre l'équipe, veuillez cliquer sur le lien suivant :
{invitation_link}

Validité : Ce lien d'invitation reste valide pendant 7 jours.
Si vous n'êtes pas concerné(e), vous pouvez ignorer cet email.

Cordialement,
L'équipe Encadrini
Plateforme Académique & Suivi PFE
"""

    print(f"[binome-invitation] Invitation link for {to_email}: {invitation_link}", flush=True)
    return _send_email_transport(to_email, subject, html_content, text_content, "binome-invitation")
