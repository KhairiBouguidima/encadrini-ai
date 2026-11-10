import smtplib
from email.message import EmailMessage
import requests

from app.core.config import settings


def _send_email_transport(to_email: str, subject: str, html_content: str, text_content: str, email_type: str = "email") -> bool:
    """
    Sends an email using Resend (HTTPS 443), Brevo (HTTPS 443), or SMTP (465/587).
    HTTPS APIs (Resend/Brevo) are strongly recommended because Render Free tier blocks
    outbound SMTP ports (25, 465, 587).
    """
    # 1. Resend HTTP API (Port 443 - Works seamlessly on Render free tier)
    if settings.RESEND_API_KEY:
        try:
            from_addr = settings.EMAIL_FROM or "Encadrini <onboarding@resend.dev>"
            res = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
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
                print(f"[{email_type}] Successfully delivered email via Resend to {to_email}", flush=True)
                return True
            else:
                print(f"[{email_type}] Resend API error ({res.status_code}): {res.text}", flush=True)
        except Exception as e:
            print(f"[{email_type}] Resend request exception: {e}", flush=True)

    # 2. Brevo HTTP API (Port 443 - Works seamlessly on Render free tier)
    if settings.BREVO_API_KEY:
        try:
            sender_email = settings.SMTP_FROM_EMAIL if "@" in settings.SMTP_FROM_EMAIL and "local" not in settings.SMTP_FROM_EMAIL else "contact@encadrini.com"
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
                print(f"[{email_type}] Successfully delivered email via Brevo to {to_email}", flush=True)
                return True
            else:
                print(f"[{email_type}] Brevo API error ({res.status_code}): {res.text}", flush=True)
        except Exception as e:
            print(f"[{email_type}] Brevo request exception: {e}", flush=True)

    # 3. Standard SMTP (Port 465 SSL or Port 587 TLS)
    if settings.SMTP_HOST:
        try:
            message = EmailMessage()
            message["Subject"] = subject
            message["From"] = settings.SMTP_FROM_EMAIL
            message["To"] = to_email
            message.set_content(text_content)
            message.add_alternative(html_content, subtype="html")

            if settings.SMTP_PORT == 465:
                with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12) as smtp:
                    if settings.SMTP_USERNAME:
                        smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                    smtp.send_message(message)
            else:
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12) as smtp:
                    if settings.SMTP_USE_TLS:
                        smtp.starttls()
                    if settings.SMTP_USERNAME:
                        smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                    smtp.send_message(message)
            print(f"[{email_type}] Successfully delivered email via SMTP to {to_email}", flush=True)
            return True
        except Exception as e:
            print(f"[{email_type}] SMTP error to {to_email}: {e} (Note: Render Free tier blocks ports 25, 465, 587. Configure RESEND_API_KEY to send emails via HTTPS)", flush=True)

    # 4. Fallback log for development / debugging
    print(f"[{email_type}] Notice: No mail provider configured or active. Email for {to_email} skipped.", flush=True)
    return False


def build_email_confirmation_link(token: str) -> str:
    separator = "&" if "?" in settings.FRONTEND_URL else "?"
    return f"{settings.FRONTEND_URL}{separator}confirm_email={token}"


def send_email_confirmation(to_email: str, first_name: str, token: str) -> bool:
    confirmation_link = build_email_confirmation_link(token)
    subject = "Confirmez votre adresse email - Encadrini"

    text_content = f"""Bonjour {first_name},

Merci de vous être inscrit sur Encadrini.

Pour activer votre compte et commencer à utiliser la plateforme, veuillez cliquer sur le lien ci-dessous :
{confirmation_link}

Ce lien expire dans 24 heures.

Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email.

L'équipe Encadrini
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; }}
    .container {{ max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; border: 1px solid #e5e7eb; }}
    .logo {{ font-size: 24px; font-weight: bold; color: #1e3a8a; margin-bottom: 24px; }}
    .title {{ font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 16px; }}
    .text {{ font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 24px; }}
    .btn {{ display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 12px 28px; text-decoration: none; border-radius: 8px; margin: 12px 0 28px 0; text-align: center; }}
    .link-alt {{ font-size: 13px; color: #6b7280; word-break: break-all; }}
    .footer {{ font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Encadrini</div>
    <div class="title">Bienvenue, {first_name} !</div>
    <p class="text">Merci de vous être inscrit sur <strong>Encadrini</strong>, la plateforme d'encadrement et de suivi des projets de fin d'études.</p>
    <p class="text">Veuillez confirmer votre adresse email pour activer votre compte :</p>
    <div>
      <a href="{confirmation_link}" target="_blank" class="btn">Activer mon compte</a>
    </div>
    <p class="link-alt">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br><a href="{confirmation_link}">{confirmation_link}</a></p>
    <div class="footer">
      Ce lien expire dans 24 heures.<br>
      Si vous n'avez pas créé ce compte, veuillez ignorer ce message.
    </div>
  </div>
</body>
</html>
"""

    print(f"[email-confirmation] Confirmation link for {to_email}: {confirmation_link}", flush=True)
    return _send_email_transport(to_email, subject, html_content, text_content, "email-confirmation")


def build_password_reset_link(token: str) -> str:
    separator = "&" if "?" in settings.FRONTEND_URL else "?"
    return f"{settings.FRONTEND_URL}{separator}reset_token={token}"


def send_password_reset_email(to_email: str, first_name: str, token: str) -> bool:
    reset_link = build_password_reset_link(token)
    subject = "Réinitialisation de votre mot de passe - Encadrini"

    text_content = f"""Bonjour {first_name},

Vous avez demandé la réinitialisation de votre mot de passe Encadrini.

Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :
{reset_link}

Ce lien expire dans 1 heure.

Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.

L'équipe Encadrini
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; }}
    .container {{ max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; border: 1px solid #e5e7eb; }}
    .logo {{ font-size: 24px; font-weight: bold; color: #1e3a8a; margin-bottom: 24px; }}
    .title {{ font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 16px; }}
    .text {{ font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 24px; }}
    .btn {{ display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 12px 28px; text-decoration: none; border-radius: 8px; margin: 12px 0 28px 0; text-align: center; }}
    .link-alt {{ font-size: 13px; color: #6b7280; word-break: break-all; }}
    .footer {{ font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Encadrini</div>
    <div class="title">Réinitialisation de mot de passe</div>
    <p class="text">Bonjour <strong>{first_name}</strong>,</p>
    <p class="text">Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte Encadrini.</p>
    <div>
      <a href="{reset_link}" target="_blank" class="btn">Changer mon mot de passe</a>
    </div>
    <p class="link-alt">Ou copiez ce lien :<br><a href="{reset_link}">{reset_link}</a></p>
    <div class="footer">
      Ce lien expire dans 1 heure.<br>
      Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
    </div>
  </div>
</body>
</html>
"""

    print(f"[password-reset] Reset link for {to_email}: {reset_link}", flush=True)
    return _send_email_transport(to_email, subject, html_content, text_content, "password-reset")


def build_invitation_link(token: str) -> str:
    separator = "&" if "?" in settings.FRONTEND_URL else "?"
    return f"{settings.FRONTEND_URL}{separator}invitation_token={token}"


def send_supervisor_invitation_email(to_email: str, student_name: str, project_title: str, token: str) -> bool:
    invitation_link = build_invitation_link(token)
    subject = f"Invitation à encadrer le projet PFE de {student_name} - Encadrini"

    text_content = f"""Bonjour,

L'étudiant(e) {student_name} vous a invité(e) à encadrer son projet de fin d'études :
« {project_title} »

Pour créer ou lier votre compte encadreur et accepter l'invitation, cliquez sur ce lien :
{invitation_link}

Ce lien expire dans 7 jours.

L'équipe Encadrini
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; }}
    .container {{ max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; border: 1px solid #e5e7eb; }}
    .logo {{ font-size: 24px; font-weight: bold; color: #1e3a8a; margin-bottom: 24px; }}
    .title {{ font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 16px; }}
    .text {{ font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 24px; }}
    .project-box {{ background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px; font-weight: 500; color: #1f2937; }}
    .btn {{ display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 12px 28px; text-decoration: none; border-radius: 8px; margin: 12px 0 28px 0; text-align: center; }}
    .link-alt {{ font-size: 13px; color: #6b7280; word-break: break-all; }}
    .footer {{ font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Encadrini</div>
    <div class="title">Invitation d'encadrement PFE</div>
    <p class="text">Bonjour,</p>
    <p class="text">L'étudiant(e) <strong>{student_name}</strong> vous a invité(e) à être son encadreur sur le projet :</p>
    <div class="project-box">« {project_title} »</div>
    <div>
      <a href="{invitation_link}" target="_blank" class="btn">Accepter l'invitation</a>
    </div>
    <p class="link-alt">Lien direct :<br><a href="{invitation_link}">{invitation_link}</a></p>
    <div class="footer">
      Ce lien expire dans 7 jours.<br>
      Si vous n'êtes pas concerné(e), vous pouvez ignorer cet email.
    </div>
  </div>
</body>
</html>
"""

    print(f"[supervisor-invitation] Invitation link for {to_email}: {invitation_link}", flush=True)
    return _send_email_transport(to_email, subject, html_content, text_content, "supervisor-invitation")
