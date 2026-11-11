import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Sends transactional email over SMTP.

    With no SMTP_HOST configured (normal for local development) nothing is sent;
    outside production the link is printed in the server log so you can click it.
    """

    async def send_verification_email(self, to_email: str, full_name: str, link: str) -> None:
        body = (
            f"Hi {full_name},\n\n"
            "Welcome! Please confirm your email address to activate your account:\n\n"
            f"{link}\n\n"
            f"This link expires in {settings.email_verification_expire_hours} hours. "
            "If you did not create an account, you can ignore this email."
        )
        await self._deliver(to_email, "Verify your email address", body, link)

    async def send_password_reset_email(self, to_email: str, full_name: str, link: str) -> None:
        body = (
            f"Hi {full_name},\n\n"
            "We received a request to reset your password. Use the link below to choose a new one:\n\n"
            f"{link}\n\n"
            f"This link expires in {settings.password_reset_expire_minutes} minutes. "
            "If you did not request this, you can ignore this email and your password will stay the same."
        )
        await self._deliver(to_email, "Reset your password", body, link)

    async def _deliver(self, to_email: str, subject: str, body: str, link: str) -> None:
        if not settings.smtp_host:
            if settings.is_production:
                logger.warning("SMTP is not configured; email was not sent (subject=%r)", subject)
            else:
                logger.info("DEV EMAIL (SMTP not configured) subject=%r link=%s", subject, link)
            return
        try:
            await asyncio.to_thread(self._send_smtp, to_email, subject, body)
        except Exception as exc:  # never fail the request because email failed
            logger.error("Failed to send email (subject=%r): %s", subject, type(exc).__name__)

    @staticmethod
    def _send_smtp(to_email: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = settings.email_from
        message["To"] = to_email
        message.set_content(body)

        if settings.smtp_use_ssl:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
        with server:
            if settings.smtp_starttls and not settings.smtp_use_ssl:
                server.starttls()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password or "")
            server.send_message(message)
