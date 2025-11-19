import json
import http.client
import smtplib
import ssl
from email.message import EmailMessage
from app.config import settings

def send_email(to: str, subject: str, body: str) -> tuple[bool, str | None]:
    """Send email via SendGrid API or SMTP based on EMAIL_PROVIDER setting."""
    provider = settings.EMAIL_PROVIDER.lower()
    
    if provider == "sendgrid":
        if not settings.SENDGRID_API_KEY or not settings.EMAIL_FROM:
            return False, "SendGrid not configured"
        try:
            conn = http.client.HTTPSConnection("api.sendgrid.com")
            from_email = settings.EMAIL_FROM.split("<")[-1].replace(">", "").strip() if "<" in settings.EMAIL_FROM else settings.EMAIL_FROM
            payload = {
                "personalizations": [{"to": [{"email": to}]}],
                "from": {"email": from_email},
                "subject": subject,
                "content": [{"type": "text/plain", "value": body}]
            }
            headers = {
                "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                "Content-Type": "application/json"
            }
            conn.request("POST", "/v3/mail/send", json.dumps(payload), headers)
            resp = conn.getresponse()
            if resp.status in (200, 202):
                return True, None
            return False, f"SendGrid status {resp.status}"
        except Exception as e:
            return False, str(e)

    # SMTP fallback
    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    user = settings.SMTP_USER
    pwd = settings.SMTP_PASS
    from_addr = settings.SMTP_FROM or settings.EMAIL_FROM or user
    
    if not (host and user and pwd and from_addr):
        return False, "SMTP not configured (set SMTP_* in .env)"
    
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.set_content(body)
    
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context()) as s:
                s.login(user, pwd)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, port) as s:
                if settings.SMTP_TLS:
                    s.starttls(context=ssl.create_default_context())
                s.login(user, pwd)
                s.send_message(msg)
        return True, None
    except Exception as e:
        return False, str(e)

def send_password_reset(to: str, token: str) -> tuple[bool, str | None]:
    subject = "Password Reset Instructions"
    body = (
        "You requested a password reset for your account.\n\n"
        f"Your reset token is:\n\n{token}\n\n"
        "Open the app, go to the password reset screen, and paste your token to set a new password.\n"
        "If you did not request this, ignore this email."
    )
    return send_email(to, subject, body)