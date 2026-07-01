"""
OTP Service — Local & SMTP
Handles generating, sending (via SMTP email), and verifying one-time passwords.
"""
import os
import random
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# SMTP Configuration
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "")
SMTP_FROM = SMTP_USER # Force using the authenticated user to prevent Gmail from dropping the mail

# In-memory store for OTPs: { "email": {"code": "123456", "expires_at": 123456789.0} }
_otp_store = {}
OTP_EXPIRY_SECONDS = 600  # 10 minutes

def normalize_phone(to: str, channel: str = None) -> str:
    """Keep this function signature for compatibility, though we mainly use emails now."""
    if channel is None:
        channel = "email" if "@" in to else "sms"
    
    if channel != "sms":
        return to
    
    clean = "".join(filter(str.isdigit, to))
    if to.strip().startswith("+"):
        return f"+{clean}"
    if len(clean) == 10:
        return f"+91{clean}"
    return f"+{clean}"

def generate_otp() -> str:
    """Generate a random 6-digit OTP."""
    return str(random.randint(100000, 999999))

def get_html_template(otp_code: str) -> str:
    """Read the HTML template and inject the OTP code."""
    # mail.html is in server/templates/
    server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_path = os.path.join(server_dir, "templates", "mail.html")
    
    try:
        with open(template_path, "r", encoding="utf-8") as f:
            content = f.read()
            # Inject code with a dash for readability like in the template (e.g. 482-901)
            formatted_code = f"{otp_code[:3]}-{otp_code[3:]}"
            return content.replace("{OTP_CODE}", formatted_code)
    except Exception as e:
        print(f"[OTP] [WARN] Could not load HTML template at {template_path}: {e}")
        return f"Your Verification Code is: {otp_code}"

def send_otp(to: str, channel: str = "email") -> dict:
    """
    Generate and send an OTP to `to` via `channel` (primarily 'email').
    Returns {"status": "pending"} on success.
    """
    to = normalize_phone(to, channel)
    
    otp_code = generate_otp()
    expires_at = time.time() + OTP_EXPIRY_SECONDS
    
    # Store locally
    _otp_store[to] = {
        "code": otp_code,
        "expires_at": expires_at
    }
    
    if channel != "email":
        print(f"[OTP] [WARN] Unsupported channel '{channel}' for local OTP. Defaulting to print.")
        print(f"[OTP] Mock SMS to {to}: {otp_code}")
        return {"status": "pending", "dev_mode": True}

    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[OTP] [WARN] SMTP not configured. OTP for {to} is {otp_code[:3]}-{otp_code[3:]}")
        return {"status": "pending", "dev_mode": True}
        
    # Send actual email
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Verify your identity - Warden"
        msg["From"] = SMTP_FROM
        msg["To"] = to

        html_content = get_html_template(otp_code)
        part = MIMEText(html_content, "html")
        msg.attach(part)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to, msg.as_string())
            
        print(f"[OTP] [SUCCESS] Email sent to {to}")
        return {"status": "pending"}
    except Exception as e:
        print(f"[OTP] [ERROR] Email send error: {e}")
        return {"status": "error", "message": str(e)}

def verify_otp(to: str, code: str) -> bool:
    """
    Verify the OTP `code` submitted for `to`.
    Returns True if approved, False otherwise.
    """
    to = normalize_phone(to)
    
    # Clean the input code (remove dashes if user entered them)
    code = code.replace("-", "").strip()
    
    record = _otp_store.get(to)
    if not record:
        return False
        
    if time.time() > record["expires_at"]:
        print(f"[OTP] [EXPIRED] OTP expired for {to}")
        del _otp_store[to]
        return False
        
    if record["code"] == code:
        del _otp_store[to]
        print(f"[OTP] [SUCCESS] Verification successful for {to}")
        return True
        
    print(f"[OTP] [ERROR] Incorrect OTP for {to}")
    return False

def find_to_by_otp(code: str) -> str:
    """
    Reverse lookup: Find the identifier (email/phone) associated with an OTP.
    Returns the identifier if found and not expired, else None.
    """
    code = code.replace("-", "").strip()
    now = time.time()
    
    for identifier, record in _otp_store.items():
        if record["code"] == code and now <= record["expires_at"]:
            return identifier
            
    return None
