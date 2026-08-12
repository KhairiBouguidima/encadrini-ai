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
