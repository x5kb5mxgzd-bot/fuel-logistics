from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import resend
import requests as http_requests
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
import io
import base64
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'diesel-express-secret-key-2024')
JWT_ALGORITHM = "HS256"

# Resend Configuration
resend.api_key = os.environ.get('RESEND_API_KEY', '')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'aliarefuel@gmail.com')
SENDER_EMAIL = "contact@refueltours.com"

# OVH SMTP Configuration
SMTP_HOST = "ssl0.ovh.net"
SMTP_PORT = 587
SMTP_USER = os.environ.get('SMTP_USER', 'contact@refueltours.com')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')

# SumUp Configuration
SUMUP_API_KEY = os.environ.get('SUMUP_API_KEY', '')
SUMUP_MERCHANT_CODE = os.environ.get('SUMUP_MERCHANT_CODE', '')
SUMUP_API_URL = "https://api.sumup.com/v0.1"

# Company Information for invoices
COMPANY_INFO = {
    "name": "ALIA REFUEL",
    "siren": "987 944 527",
    "address": "130 rue Francis Perrin",
    "postal_code": "37260",
    "city": "MONTS",
    "phone": "06 09 88 32 50",
    "email": "aliarefuel@gmail.com"
}

# Create the main app
app = FastAPI(title="Alia Refuel API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Diesel price per liter (in euros)
DIESEL_PRICE_PER_LITER = 1.80
DELIVERY_FEE = 0.00
MINIMUM_QUANTITY = 20

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    user_type: str = Field(..., pattern="^(pro|particulier)$")
    full_name: str
    company_name: Optional[str] = None
    phone: str
    address: str
    city: str
    postal_code: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    user_type: str
    full_name: str
    company_name: Optional[str] = None
    phone: str
    address: str
    city: str
    postal_code: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class OrderCreate(BaseModel):
    quantity: int = Field(..., ge=MINIMUM_QUANTITY)
    delivery_address: str
    delivery_city: str
    delivery_postal_code: str
    delivery_date: str
    delivery_time_slot: str
    notes: Optional[str] = None

class OrderResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    quantity: int
    price_fuel: float
    delivery_fee: float
    total_price: float
    delivery_address: str
    delivery_city: str
    delivery_postal_code: str
    delivery_date: str
    delivery_time_slot: str
    status: str
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None
    checkout_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str

class OrderStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|confirmed|in_delivery|delivered|cancelled)$")

class CheckoutCreate(BaseModel):
    order_id: str
    return_url: str

class CheckoutResponse(BaseModel):
    checkout_id: str
    checkout_url: str
    amount: float
    status: str

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token invalide")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # Create user
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "user_type": user_data.user_type,
        "full_name": user_data.full_name,
        "company_name": user_data.company_name,
        "phone": user_data.phone,
        "address": user_data.address,
        "city": user_data.city,
        "postal_code": user_data.postal_code,
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email)
    user_response = UserResponse(
        id=user_id,
        email=user_data.email,
        user_type=user_data.user_type,
        full_name=user_data.full_name,
        company_name=user_data.company_name,
        phone=user_data.phone,
        address=user_data.address,
        city=user_data.city,
        postal_code=user_data.postal_code,
        created_at=now
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    token = create_token(user["id"], user["email"])
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        user_type=user["user_type"],
        full_name=user["full_name"],
        company_name=user.get("company_name"),
        phone=user["phone"],
        address=user["address"],
        city=user["city"],
        postal_code=user["postal_code"],
        created_at=user["created_at"]
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# Zone de livraison autorisée (codes postaux)
ALLOWED_POSTAL_CODES_PREFIX = ["37"]  # Indre-et-Loire

def is_delivery_zone_valid(postal_code: str) -> bool:
    """Check if postal code is in delivery zone"""
    return any(postal_code.startswith(prefix) for prefix in ALLOWED_POSTAL_CODES_PREFIX)

# ==================== SUMUP PAYMENT HELPERS ====================

async def create_sumup_checkout(order: dict, redirect_url: str) -> dict:
    """Create a SumUp checkout for an order"""
    try:
        checkout_data = {
            "checkout_reference": order["id"],
            "amount": order["total_price"],
            "currency": "EUR",
            "merchant_code": SUMUP_MERCHANT_CODE,
            "description": f"Alia Refuel - {order['quantity']}L Diesel",
            "redirect_url": redirect_url
        }
        
        headers = {
            "Authorization": f"Bearer {SUMUP_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = http_requests.post(
            f"{SUMUP_API_URL}/checkouts",
            json=checkout_data,
            headers=headers
        )
        
        if response.status_code in [200, 201]:
            return response.json()
        else:
            logger.error(f"SumUp checkout creation failed: {response.text}")
            return None
            
    except Exception as e:
        logger.error(f"SumUp checkout error: {str(e)}")
        return None

async def get_sumup_checkout_status(checkout_id: str) -> dict:
    """Get the status of a SumUp checkout"""
    try:
        headers = {
            "Authorization": f"Bearer {SUMUP_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = http_requests.get(
            f"{SUMUP_API_URL}/checkouts/{checkout_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"SumUp status check failed: {response.text}")
            return None
            
    except Exception as e:
        logger.error(f"SumUp status error: {str(e)}")
        return None

# ==================== EMAIL HELPERS ====================

async def send_email_smtp(to_email: str, subject: str, html_content: str, attachments: list = None):
    """Send email via OVH SMTP"""
    try:
        message = MIMEMultipart()
        message["From"] = SMTP_USER
        message["To"] = to_email
        message["Subject"] = subject
        
        # Add HTML content
        message.attach(MIMEText(html_content, "html"))
        
        # Add attachments if any
        if attachments:
            for attachment in attachments:
                part = MIMEApplication(base64.b64decode(attachment["content"]))
                part.add_header("Content-Disposition", "attachment", filename=attachment["filename"])
                message.attach(part)
        
        # Send via SMTP
        await aiosmtplib.send(
            message,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            start_tls=True
        )
        
        logger.info(f"Email sent via SMTP to {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"SMTP email error: {str(e)}")
        return False


async def send_order_notification_email(order: dict, customer: dict):
    """Send email notification to admin when new order is placed"""
    try:
        # Format date nicely
        date_str = order['delivery_date']
        time_slot = order['delivery_time_slot'].replace('-', ' - ')
        
        # Generate invoice PDF
        invoice_pdf = await generate_invoice_pdf(order, customer)
        invoice_filename = f"facture_alia_refuel_{order['id'][:8].upper()}.pdf"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #0F172A; padding: 20px; text-align: center;">
                <h1 style="color: #F59E0B; margin: 0;">⛽ Nouvelle Commande Alia Refuel</h1>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border: 1px solid #e2e8f0;">
                <h2 style="color: #0F172A; border-bottom: 2px solid #F59E0B; padding-bottom: 10px;">
                    Commande #{order['id'][:8].upper()}
                </h2>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <strong>👤 Client :</strong>
                        </td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            {customer['full_name']}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <strong>📞 Téléphone :</strong>
                        </td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            {customer['phone']}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <strong>📧 Email :</strong>
                        </td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            {customer['email']}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <strong>⛽ Quantité :</strong>
                        </td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <span style="font-size: 18px; font-weight: bold; color: #F59E0B;">{order['quantity']} litres</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <strong>💰 Total :</strong>
                        </td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <span style="font-size: 20px; font-weight: bold; color: #0F172A;">{order['total_price']:.2f}€</span>
                        </td>
                    </tr>
                </table>
                
                <div style="background-color: #0F172A; color: white; padding: 15px; margin-top: 20px; border-radius: 8px;">
                    <h3 style="color: #F59E0B; margin-top: 0;">📍 Adresse de livraison</h3>
                    <p style="margin: 5px 0;">{order['delivery_address']}</p>
                    <p style="margin: 5px 0;">{order['delivery_postal_code']} {order['delivery_city']}</p>
                </div>
                
                <div style="background-color: #F59E0B; color: #0F172A; padding: 15px; margin-top: 15px; border-radius: 8px;">
                    <h3 style="margin-top: 0;">📅 Date & Heure</h3>
                    <p style="margin: 5px 0; font-size: 18px; font-weight: bold;">{date_str}</p>
                    <p style="margin: 5px 0;">🕐 {time_slot}</p>
                </div>
                
                {f'<div style="background-color: #f1f5f9; padding: 15px; margin-top: 15px; border-radius: 8px; border-left: 4px solid #F59E0B;"><strong>📝 Instructions :</strong><p style="margin: 5px 0;">{order["notes"]}</p></div>' if order.get('notes') else ''}
                
                <div style="margin-top: 20px; padding: 15px; background-color: #dcfce7; border-radius: 8px;">
                    <p style="margin: 0;">📎 <strong>Facture PDF jointe</strong> pour la comptabilité</p>
                </div>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
                <p>Alia Refuel - Livraison de diesel sur Tours et ses alentours</p>
            </div>
        </div>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [ADMIN_EMAIL],
            "subject": f"🛢️ Nouvelle commande #{order['id'][:8].upper()} - {order['quantity']}L - {customer['full_name']}",
            "html": html_content,
            "attachments": [
                {
                    "filename": invoice_filename,
                    "content": invoice_pdf
                }
            ]
        }
        
        # Send email in background (non-blocking)
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email notification with invoice sent for order {order['id']}")
        
    except Exception as e:
        logger.error(f"Failed to send email notification: {str(e)}")
        # Don't raise exception - order should still be created even if email fails


async def send_customer_confirmation_email(order: dict, customer: dict):
    """Send confirmation email to customer after payment"""
    try:
        date_str = order['delivery_date']
        time_slot = order['delivery_time_slot'].replace('-', ' - ')
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #0F172A; padding: 30px; text-align: center;">
                <h1 style="color: #F59E0B; margin: 0; font-size: 28px;">✅ Commande Confirmée !</h1>
                <p style="color: white; margin: 10px 0 0 0;">Merci pour votre confiance</p>
            </div>
            
            <div style="padding: 30px; background-color: #ffffff;">
                <p style="font-size: 16px; color: #334155;">
                    Bonjour <strong>{customer['full_name']}</strong>,
                </p>
                <p style="font-size: 16px; color: #334155;">
                    Votre commande de diesel a bien été enregistrée et payée. Voici le récapitulatif :
                </p>
                
                <div style="background-color: #f8fafc; border-radius: 12px; padding: 25px; margin: 25px 0;">
                    <h2 style="color: #0F172A; margin-top: 0; border-bottom: 2px solid #F59E0B; padding-bottom: 10px;">
                        Commande #{order['id'][:8].upper()}
                    </h2>
                    
                    <table style="width: 100%;">
                        <tr>
                            <td style="padding: 12px 0; color: #64748b;">Quantité</td>
                            <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 18px; color: #F59E0B;">
                                ⛽ {order['quantity']} litres
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 0; color: #64748b;">Total payé</td>
                            <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 20px; color: #0F172A;">
                                {order['total_price']:.2f}€
                            </td>
                        </tr>
                    </table>
                </div>
                
                <div style="background-color: #0F172A; border-radius: 12px; padding: 25px; margin: 25px 0; color: white;">
                    <h3 style="color: #F59E0B; margin-top: 0;">📍 Livraison prévue</h3>
                    <p style="margin: 8px 0; font-size: 18px; font-weight: bold;">{date_str}</p>
                    <p style="margin: 8px 0;">🕐 Entre {time_slot}</p>
                    <hr style="border: none; border-top: 1px solid #334155; margin: 15px 0;">
                    <p style="margin: 8px 0;">{order['delivery_address']}</p>
                    <p style="margin: 8px 0;">{order['delivery_postal_code']} {order['delivery_city']}</p>
                </div>
                
                <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin: 25px 0;">
                    <p style="margin: 0; color: #92400e;">
                        <strong>📞 Une question ?</strong><br>
                        Contactez-nous au <strong>06 09 88 32 50</strong>
                    </p>
                </div>
                
                <p style="font-size: 14px; color: #64748b; text-align: center;">
                    📎 Votre facture est jointe à cet email.
                </p>
            </div>
            
            <div style="background-color: #0F172A; padding: 20px; text-align: center;">
                <p style="color: #F59E0B; font-weight: bold; margin: 0;">ALIA REFUEL</p>
                <p style="color: #94a3b8; font-size: 12px; margin: 10px 0 0 0;">
                    Livraison de diesel sur Tours et ses alentours
                </p>
            </div>
        </div>
        """
        
        # Generate invoice PDF
        invoice_pdf = await generate_invoice_pdf(order, customer)
        invoice_filename = f"facture_alia_refuel_{order['id'][:8].upper()}.pdf"
        
        # Send to customer with invoice
        params = {
            "from": SENDER_EMAIL,
            "to": [customer['email']],
            "subject": f"✅ Commande confirmée #{order['id'][:8].upper()} - Alia Refuel",
            "html": html_content,
            "attachments": [
                {
                    "filename": invoice_filename,
                    "content": invoice_pdf
                }
            ]
        }
        
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Customer confirmation email sent to {customer['email']}")
        
        # Also send invoice to admin for accounting
        admin_params = {
            "from": SENDER_EMAIL,
            "to": [ADMIN_EMAIL],
            "subject": f"📄 Facture #{order['id'][:8].upper()} - {customer['full_name']} - {order['total_price']:.2f}€",
            "html": f"""
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>📄 Nouvelle facture pour la comptabilité</h2>
                <p><strong>Client :</strong> {customer['full_name']}</p>
                <p><strong>Montant :</strong> {order['total_price']:.2f}€</p>
                <p><strong>Date :</strong> {order['delivery_date']}</p>
                <p>La facture est jointe à cet email.</p>
            </div>
            """,
            "attachments": [
                {
                    "filename": invoice_filename,
                    "content": invoice_pdf
                }
            ]
        }
        
        await asyncio.to_thread(resend.Emails.send, admin_params)
        logger.info(f"Invoice sent to admin for accounting")
        
    except Exception as e:
        logger.error(f"Failed to send customer confirmation email: {str(e)}")


async def generate_invoice_pdf(order: dict, customer: dict) -> str:
    """Generate a PDF invoice and return as base64 string"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1*cm, leftMargin=1.5*cm, rightMargin=1.5*cm)
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#0F172A'), alignment=TA_CENTER)
    header_style = ParagraphStyle('Header', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#64748b'))
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10)
    bold_style = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold')
    right_style = ParagraphStyle('Right', parent=styles['Normal'], fontSize=10, alignment=TA_RIGHT)
    
    elements = []
    
    # Header with company info
    invoice_date = datetime.now().strftime("%d/%m/%Y")
    invoice_number = f"FA-{order['id'][:8].upper()}"
    
    header_data = [
        [
            Paragraph(f"<b>{COMPANY_INFO['name']}</b><br/>{COMPANY_INFO['address']}<br/>{COMPANY_INFO['postal_code']} {COMPANY_INFO['city']}<br/>Tél: {COMPANY_INFO['phone']}<br/>Email: {COMPANY_INFO['email']}<br/>SIREN: {COMPANY_INFO['siren']}", header_style),
            Paragraph(f"<b>FACTURE</b><br/><br/>N°: {invoice_number}<br/>Date: {invoice_date}", ParagraphStyle('RightHeader', parent=header_style, alignment=TA_RIGHT, fontSize=12))
        ]
    ]
    
    header_table = Table(header_data, colWidths=[10*cm, 7*cm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 1*cm))
    
    # Client info box
    client_info = f"""
    <b>FACTURER À :</b><br/><br/>
    <b>{customer['full_name']}</b><br/>
    {customer.get('company_name', '') + '<br/>' if customer.get('company_name') else ''}
    {customer['address']}<br/>
    {customer['postal_code']} {customer['city']}<br/>
    Tél: {customer['phone']}<br/>
    Email: {customer['email']}
    """
    
    client_table = Table([[Paragraph(client_info, normal_style)]], colWidths=[9*cm])
    client_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('PADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(client_table)
    elements.append(Spacer(1, 0.8*cm))
    
    # Delivery info
    delivery_info = f"""
    <b>LIVRAISON :</b> {order['delivery_date']} - Créneau {order['delivery_time_slot'].replace('-', 'h à ')}h<br/>
    <b>ADRESSE :</b> {order['delivery_address']}, {order['delivery_postal_code']} {order['delivery_city']}
    """
    if order.get('notes'):
        delivery_info += f"<br/><b>INSTRUCTIONS :</b> {order['notes']}"
    
    elements.append(Paragraph(delivery_info, normal_style))
    elements.append(Spacer(1, 0.8*cm))
    
    # Calculate prices with TVA
    # Prix TTC -> HT = TTC / 1.20, TVA = TTC - HT
    total_ttc = order['total_price']
    total_ht = round(total_ttc / 1.20, 2)
    tva_amount = round(total_ttc - total_ht, 2)
    
    fuel_ttc = order['price_fuel']
    fuel_ht = round(fuel_ttc / 1.20, 2)
    
    delivery_ttc = order['delivery_fee']
    delivery_ht = round(delivery_ttc / 1.20, 2) if delivery_ttc > 0 else 0
    
    price_per_liter_ttc = fuel_ttc / order['quantity'] if order['quantity'] > 0 else DIESEL_PRICE_PER_LITER
    price_per_liter_ht = round(price_per_liter_ttc / 1.20, 2)
    
    # Invoice items table
    items_data = [
        ['Description', 'Quantité', 'Prix unitaire HT', 'Total HT']
    ]
    
    # Diesel line
    items_data.append([
        'Diesel (Gazole)',
        f"{order['quantity']} L",
        f"{price_per_liter_ht:.2f} €",
        f"{fuel_ht:.2f} €"
    ])
    
    # Delivery line (if applicable)
    if order['delivery_fee'] > 0:
        items_data.append([
            'Frais de livraison',
            '1',
            f"{delivery_ht:.2f} €",
            f"{delivery_ht:.2f} €"
        ])
    else:
        items_data.append([
            'Frais de livraison',
            '1',
            'Offert',
            '0.00 €'
        ])
    
    items_table = Table(items_data, colWidths=[9*cm, 2.5*cm, 3*cm, 2.5*cm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 0.5*cm))
    
    # Totals with TVA
    totals_data = [
        ['', '', 'Total HT:', f"{total_ht:.2f} €"],
        ['', '', 'TVA (20%):', f"{tva_amount:.2f} €"],
        ['', '', 'Total TTC:', f"{total_ttc:.2f} €"],
    ]
    
    totals_table = Table(totals_data, colWidths=[9*cm, 2.5*cm, 3*cm, 2.5*cm])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (2, 2), (-1, 2), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTSIZE', (2, 2), (-1, 2), 12),
        ('BACKGROUND', (2, 2), (-1, 2), colors.HexColor('#F59E0B')),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 1*cm))
    
    # Payment info
    payment_info = f"""
    <b>PAIEMENT :</b> Carte bancaire (SumUp)<br/>
    <b>STATUT :</b> Payé<br/>
    <b>N° COMMANDE :</b> {order['id'][:8].upper()}
    """
    elements.append(Paragraph(payment_info, normal_style))
    elements.append(Spacer(1, 1.5*cm))
    
    # Footer
    footer_text = """
    Merci pour votre confiance !<br/>
    ALIA REFUEL - Livraison de diesel sur Tours et ses alentours
    """
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#64748b'), alignment=TA_CENTER)
    elements.append(Paragraph(footer_text, footer_style))
    
    # Build PDF
    doc.build(elements)
    
    # Get PDF bytes and convert to base64
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return base64.b64encode(pdf_bytes).decode('utf-8')

# ==================== ORDER ROUTES ====================

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order_data: OrderCreate, current_user: dict = Depends(get_current_user)):
    # Vérifier la zone de livraison
    if not is_delivery_zone_valid(order_data.delivery_postal_code):
        raise HTTPException(
            status_code=400, 
            detail="Désolé, nous ne livrons pas dans cette zone. Nous livrons uniquement en Indre-et-Loire (37)."
        )
    
    order_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    price_fuel = order_data.quantity * DIESEL_PRICE_PER_LITER
    total_price = price_fuel + DELIVERY_FEE
    
    order_doc = {
        "id": order_id,
        "user_id": current_user["id"],
        "quantity": order_data.quantity,
        "price_fuel": round(price_fuel, 2),
        "delivery_fee": DELIVERY_FEE,
        "total_price": round(total_price, 2),
        "delivery_address": order_data.delivery_address,
        "delivery_city": order_data.delivery_city,
        "delivery_postal_code": order_data.delivery_postal_code,
        "delivery_date": order_data.delivery_date,
        "delivery_time_slot": order_data.delivery_time_slot,
        "status": "pending",
        "notes": order_data.notes,
        "created_at": now,
        "updated_at": now
    }
    
    await db.orders.insert_one(order_doc)
    
    # Commande créée - le paiement sera fait sur la page de paiement
    
    return OrderResponse(**order_doc)

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(current_user: dict = Depends(get_current_user)):
    orders = await db.orders.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return [OrderResponse(**order) for order in orders]

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one(
        {"id": order_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    return OrderResponse(**order)

@api_router.put("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(order_id: str, status_data: OrderStatusUpdate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.orders.find_one_and_update(
        {"id": order_id, "user_id": current_user["id"]},
        {"$set": {"status": status_data.status, "updated_at": now}},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    
    # Remove _id before returning
    result.pop("_id", None)
    return OrderResponse(**result)

@api_router.delete("/orders/{order_id}")
async def cancel_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": current_user["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    
    if order["status"] not in ["pending", "confirmed"]:
        raise HTTPException(status_code=400, detail="Cette commande ne peut plus être annulée")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "cancelled", "updated_at": now}}
    )
    
    return {"message": "Commande annulée avec succès"}

# ==================== PAYMENT ROUTES ====================

@api_router.post("/payments/create-checkout")
async def create_payment_checkout(order_id: str, return_url: str = None, current_user: dict = Depends(get_current_user)):
    """Create a SumUp checkout for an order"""
    order = await db.orders.find_one({"id": order_id, "user_id": current_user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Cette commande est déjà payée")
    
    # Create SumUp checkout with unique reference
    try:
        # Generate unique reference for each checkout attempt
        unique_ref = f"{order_id[:8]}-{str(uuid.uuid4())[:8]}"
        
        checkout_data = {
            "checkout_reference": unique_ref,
            "amount": order["total_price"],
            "currency": "EUR",
            "merchant_code": SUMUP_MERCHANT_CODE,
            "description": f"Alia Refuel - {order['quantity']}L Diesel",
        }
        
        if return_url:
            checkout_data["return_url"] = return_url
        
        headers = {
            "Authorization": f"Bearer {SUMUP_API_KEY}",
            "Content-Type": "application/json"
        }
        
        response = http_requests.post(
            f"{SUMUP_API_URL}/checkouts",
            json=checkout_data,
            headers=headers
        )
        
        if response.status_code in [200, 201]:
            checkout = response.json()
            
            # Store checkout_id in order
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"pending_checkout_id": checkout.get("id")}}
            )
            
            return {
                "checkout_id": checkout.get("id"),
                "order_id": order["id"],
                "amount": order["total_price"],
                "currency": "EUR",
                "merchant_code": SUMUP_MERCHANT_CODE,
                "description": f"Alia Refuel - {order['quantity']}L Diesel"
            }
        else:
            logger.error(f"SumUp checkout creation failed: {response.text}")
            raise HTTPException(status_code=500, detail="Erreur lors de la création du paiement")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SumUp checkout error: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur lors de la création du paiement")

@api_router.post("/payments/confirm/{order_id}")
async def confirm_payment(order_id: str, checkout_id: str = None, current_user: dict = Depends(get_current_user)):
    """Confirm payment after SumUp checkout completion"""
    order = await db.orders.find_one({"id": order_id, "user_id": current_user["id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update order with payment info
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "payment_status": "paid",
            "payment_method": "sumup",
            "checkout_id": checkout_id,
            "status": "confirmed",
            "updated_at": now
        }}
    )
    
    # Send email notification to admin
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    await send_order_notification_email(updated_order, current_user)
    
    # Send confirmation email to customer
    await send_customer_confirmation_email(updated_order, current_user)
    
    return {"message": "Paiement confirmé", "status": "confirmed"}

@api_router.get("/payments/config")
async def get_payment_config():
    """Get SumUp configuration for frontend"""
    return {
        "merchant_code": SUMUP_MERCHANT_CODE,
        "currency": "EUR"
    }

# ==================== PLANNING / DELIVERY ROUTES ====================

@api_router.get("/planning/tomorrow")
async def get_tomorrow_planning():
    """Get all confirmed orders for tomorrow - for delivery planning"""
    tomorrow = datetime.now(timezone.utc).date() + timedelta(days=1)
    tomorrow_str = tomorrow.strftime("%Y-%m-%d")
    
    orders = await db.orders.find(
        {
            "delivery_date": tomorrow_str,
            "payment_status": "paid",
            "status": {"$nin": ["cancelled", "delivered"]}
        },
        {"_id": 0}
    ).sort("delivery_time_slot", 1).to_list(100)
    
    # Group by time slot
    by_slot = {}
    for order in orders:
        slot = order.get("delivery_time_slot", "Non défini")
        if slot not in by_slot:
            by_slot[slot] = []
        by_slot[slot].append(order)
    
    return {
        "date": tomorrow_str,
        "total_orders": len(orders),
        "total_liters": sum(o["quantity"] for o in orders),
        "orders_by_slot": by_slot,
        "orders": orders
    }

@api_router.get("/planning/send-email")
async def send_planning_email():
    """Send tomorrow's planning email to the driver"""
    tomorrow = datetime.now(timezone.utc).date() + timedelta(days=1)
    tomorrow_str = tomorrow.strftime("%Y-%m-%d")
    tomorrow_formatted = tomorrow.strftime("%A %d/%m/%Y").replace("Monday", "Lundi").replace("Tuesday", "Mardi").replace("Wednesday", "Mercredi").replace("Thursday", "Jeudi").replace("Friday", "Vendredi").replace("Saturday", "Samedi").replace("Sunday", "Dimanche")
    
    orders = await db.orders.find(
        {
            "delivery_date": tomorrow_str,
            "payment_status": "paid",
            "status": {"$nin": ["cancelled", "delivered"]}
        },
        {"_id": 0}
    ).sort("delivery_time_slot", 1).to_list(100)
    
    if not orders:
        return {"message": "Aucune livraison prévue pour demain", "orders_count": 0}
    
    # Group by time slot
    by_slot = {}
    for order in orders:
        slot = order.get("delivery_time_slot", "Non défini")
        if slot not in by_slot:
            by_slot[slot] = []
        by_slot[slot].append(order)
    
    total_liters = sum(o["quantity"] for o in orders)
    total_revenue = sum(o["total_price"] for o in orders)
    
    # Build email HTML
    orders_html = ""
    order_num = 1
    for slot, slot_orders in sorted(by_slot.items()):
        slot_label = slot.replace("-", "h - ") + "h"
        slot_liters = sum(o["quantity"] for o in slot_orders)
        orders_html += f"""
        <div style="margin-bottom: 30px;">
            <div style="background-color: #0F172A; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0;">
                <table style="width: 100%;">
                    <tr>
                        <td><h3 style="color: #F59E0B; margin: 0;">🕐 CRÉNEAU {slot_label}</h3></td>
                        <td style="text-align: right; color: #F59E0B; font-size: 18px;"><strong>{len(slot_orders)} livraison{"s" if len(slot_orders) > 1 else ""}</strong> - {slot_liters}L</td>
                    </tr>
                </table>
            </div>
        """
        for order in slot_orders:
            # Get customer info
            user = await db.users.find_one({"id": order["user_id"]}, {"_id": 0})
            customer_name = user.get("full_name", "Client") if user else "Client"
            customer_phone = user.get("phone", "N/A") if user else "N/A"
            customer_email = user.get("email", "N/A") if user else "N/A"
            customer_type = "PRO" if user.get("user_type") == "pro" else "PARTICULIER"
            company_name = user.get("company_name", "") if user else ""
            
            orders_html += f"""
            <div style="background-color: #ffffff; padding: 20px; border: 2px solid #e2e8f0; border-top: none; {'border-bottom: 2px solid #F59E0B;' if order == slot_orders[-1] else ''}">
                <table style="width: 100%; margin-bottom: 15px;">
                    <tr>
                        <td>
                            <span style="background-color: #0F172A; color: white; padding: 3px 10px; border-radius: 4px; font-size: 12px;">LIVRAISON #{order_num}</span>
                            <span style="background-color: {'#3b82f6' if customer_type == 'PRO' else '#22c55e'}; color: white; padding: 3px 10px; border-radius: 4px; font-size: 12px; margin-left: 5px;">{customer_type}</span>
                        </td>
                        <td style="text-align: right;">
                            <strong style="font-size: 24px; color: #F59E0B;">⛽ {order['quantity']}L</strong>
                        </td>
                    </tr>
                </table>
                
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #0F172A;">👤 INFORMATIONS CLIENT</h4>
                    <table style="width: 100%;">
                        <tr>
                            <td style="padding: 5px 0; width: 50%;"><strong>Nom :</strong> {customer_name}</td>
                            <td style="padding: 5px 0;"><strong>Type :</strong> {customer_type}</td>
                        </tr>
                        {f"<tr><td colspan='2' style='padding: 5px 0;'><strong>Entreprise :</strong> {company_name}</td></tr>" if company_name else ""}
                        <tr>
                            <td style="padding: 5px 0;"><strong style="font-size: 16px;">📞 {customer_phone}</strong></td>
                            <td style="padding: 5px 0;"><strong>📧</strong> {customer_email}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="background-color: #0F172A; color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #F59E0B;">📍 ADRESSE DE LIVRAISON</h4>
                    <p style="margin: 5px 0; font-size: 16px;"><strong>{order['delivery_address']}</strong></p>
                    <p style="margin: 5px 0; font-size: 16px;"><strong>{order['delivery_postal_code']} {order['delivery_city']}</strong></p>
                </div>
                
                <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #22c55e;">
                    <h4 style="margin: 0 0 10px 0; color: #0F172A;">🛢️ COMMANDE</h4>
                    <table style="width: 100%;">
                        <tr>
                            <td style="padding: 5px 0;"><strong>Quantité :</strong></td>
                            <td style="padding: 5px 0; font-size: 18px; color: #F59E0B;"><strong>{order['quantity']} litres</strong></td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0;"><strong>Prix carburant :</strong></td>
                            <td style="padding: 5px 0;">{order['price_fuel']:.2f}€</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0;"><strong>Livraison :</strong></td>
                            <td style="padding: 5px 0;">{"Gratuite" if order['delivery_fee'] == 0 else f"{order['delivery_fee']:.2f}€"}</td>
                        </tr>
                        <tr style="border-top: 2px solid #22c55e;">
                            <td style="padding: 10px 0;"><strong style="font-size: 16px;">TOTAL À ENCAISSER :</strong></td>
                            <td style="padding: 10px 0; font-size: 20px; color: #0F172A;"><strong>{order['total_price']:.2f}€</strong></td>
                        </tr>
                    </table>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b;">Paiement effectué par carte (SumUp) ✅</p>
                </div>
                
                {f'''<div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B;">
                    <h4 style="margin: 0 0 10px 0; color: #92400e;">📝 COMMENTAIRES / INSTRUCTIONS</h4>
                    <p style="margin: 0; color: #0F172A; font-size: 14px;">{order['notes']}</p>
                </div>''' if order.get('notes') else ''}
            </div>
            """
            order_num += 1
        orders_html += "</div>"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <div style="background-color: #0F172A; padding: 25px; text-align: center;">
            <h1 style="color: #F59E0B; margin: 0; font-size: 28px;">📋 PLANNING LIVRAISONS</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 20px;">{tomorrow_formatted}</p>
        </div>
        
        <div style="background-color: #F59E0B; padding: 20px;">
            <table style="width: 100%; color: #0F172A; text-align: center;">
                <tr>
                    <td>
                        <strong style="font-size: 32px;">{len(orders)}</strong><br>
                        <span style="font-size: 14px;">LIVRAISONS</span>
                    </td>
                    <td>
                        <strong style="font-size: 32px;">{total_liters}L</strong><br>
                        <span style="font-size: 14px;">TOTAL DIESEL</span>
                    </td>
                    <td>
                        <strong style="font-size: 32px;">{total_revenue:.2f}€</strong><br>
                        <span style="font-size: 14px;">CHIFFRE D'AFFAIRES</span>
                    </td>
                </tr>
            </table>
        </div>
        
        <div style="padding: 25px; background-color: #f8fafc;">
            {orders_html}
        </div>
        
        <div style="background-color: #0F172A; padding: 20px; text-align: center; color: #94a3b8;">
            <p style="margin: 0;"><strong style="color: #F59E0B;">ALIA REFUEL</strong></p>
            <p style="margin: 5px 0; font-size: 12px;">Planning généré le {datetime.now().strftime("%d/%m/%Y à %H:%M")}</p>
            <p style="margin: 5px 0; font-size: 12px;">130 rue Francis Perrin, 37260 MONTS - 06 09 88 32 50</p>
        </div>
    </div>
    """
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [ADMIN_EMAIL],
            "subject": f"📋 Planning livraisons du {tomorrow_formatted} - {len(orders)} livraison{'s' if len(orders) > 1 else ''} - {total_liters}L",
            "html": html_content
        }
        
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Planning email sent for {tomorrow_str}")
        
        return {
            "message": "Planning envoyé par email",
            "date": tomorrow_str,
            "orders_count": len(orders),
            "total_liters": total_liters
        }
        
    except Exception as e:
        logger.error(f"Failed to send planning email: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur lors de l'envoi de l'email")

# ==================== STATS ROUTES ====================

@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
    total_orders = len(orders)
    total_liters = sum(o["quantity"] for o in orders)
    total_spent = sum(o["total_price"] for o in orders)
    
    pending = sum(1 for o in orders if o["status"] == "pending")
    confirmed = sum(1 for o in orders if o["status"] == "confirmed")
    in_delivery = sum(1 for o in orders if o["status"] == "in_delivery")
    delivered = sum(1 for o in orders if o["status"] == "delivered")
    
    return {
        "total_orders": total_orders,
        "total_liters": total_liters,
        "total_spent": round(total_spent, 2),
        "orders_by_status": {
            "pending": pending,
            "confirmed": confirmed,
            "in_delivery": in_delivery,
            "delivered": delivered
        }
    }

@api_router.get("/pricing")
async def get_pricing():
    return {
        "price_per_liter": DIESEL_PRICE_PER_LITER,
        "delivery_fee": DELIVERY_FEE,
        "minimum_quantity": MINIMUM_QUANTITY,
        "currency": "EUR"
    }

@api_router.get("/")
async def root():
    return {"message": "Alia Refuel API v1.0", "status": "running"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
