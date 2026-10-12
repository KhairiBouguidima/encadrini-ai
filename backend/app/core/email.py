import smtplib
from email.message import EmailMessage

from app.core.config import settings


def build_email_confirmation_link(token: str) -> str:
    separator = "&" if "?" in settings.FRONTEND_URL else "?"
    return f"{settings.FRONTEND_URL}{separator}confirm_email={token}"


def send_email_confirmation(to_email: str, first_name: str, token: str) -> None:
    confirmation_link = build_email_confirmation_link(token)

    if not settings.SMTP_HOST:
        print(f"[email-confirmation] Send this link to {to_email}: {confirmation_link}")
        return

    message = EmailMessage()
    message["Subject"] = "Confirmez votre email Encadrini"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                f"Bonjour {first_name},",
                "",
                "Confirmez votre adresse email pour activer votre compte Encadrini :",
                confirmation_link,
                "",
                "Ce lien expire dans 24 heures.",
            ]
        )
    )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls()
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)

def build_password_reset_link(token: str) -> str:
    separator = "&" if "?" in settings.FRONTEND_URL else "?"
    return f"{settings.FRONTEND_URL}{separator}reset_token={token}"

def send_password_reset_email(to_email: str, first_name: str, token: str) -> None:
    reset_link = build_password_reset_link(token)

    if not settings.SMTP_HOST:
        print(f"[password-reset] Send this link to {to_email}: {reset_link}", flush=True)
        return

    message = EmailMessage()
    message["Subject"] = "Réinitialisation de votre mot de passe Encadrini"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                f"Bonjour {first_name},",
                "",
                "Vous avez demandé à réinitialiser votre mot de passe.",
                "Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe :",
                reset_link,
                "",
                "Ce lien expire dans 1 heure.",
                "Si vous n'avez pas demandé de réinitialisation, veuillez ignorer cet email.",
            ]
        )
    )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls()
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)

def build_invitation_link(token: str) -> str:
    separator = "&" if "?" in settings.FRONTEND_URL else "?"
    return f"{settings.FRONTEND_URL}{separator}invitation_token={token}"

def send_supervisor_invitation_email(to_email: str, student_name: str, project_title: str, token: str) -> bool:
    invitation_link = build_invitation_link(token)

    if not settings.SMTP_HOST:
        print(f"[supervisor-invitation] Send this link to {to_email}: {invitation_link}", flush=True)
        return False

    message = EmailMessage()
    message["Subject"] = f"Invitation à encadrer le projet PFE de {student_name}"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                "Bonjour,",
                "",
                f"{student_name} vous invite à encadrer son projet PFE : « {project_title} ».",
                "",
                "Pour créer votre compte encadreur et accepter l'invitation, cliquez sur le lien suivant :",
                invitation_link,
                "",
                "Ce lien expire dans 7 jours.",
                "",
                "Si vous n'êtes pas concerné(e), vous pouvez ignorer cet email.",
            ]
        )
    )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except Exception as e:
        print(f"[email] Failed to send invitation email to {to_email}: {e}", flush=True)
        return False

