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
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# SumUp Configuration
SUMUP_API_KEY = os.environ.get('SUMUP_API_KEY', '')
SUMUP_MERCHANT_CODE = os.environ.get('SUMUP_MERCHANT_CODE', '')
SUMUP_API_URL = "https://api.sumup.com/v0.1"

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

async def send_order_notification_email(order: dict, customer: dict):
    """Send email notification to admin when new order is placed"""
    try:
        # Format date nicely
        date_str = order['delivery_date']
        time_slot = order['delivery_time_slot'].replace('-', ' - ')
        
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
            "html": html_content
        }
        
        # Send email in background (non-blocking)
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email notification sent for order {order['id']}")
        
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
            </div>
            
            <div style="background-color: #0F172A; padding: 20px; text-align: center;">
                <p style="color: #F59E0B; font-weight: bold; margin: 0;">ALIA REFUEL</p>
                <p style="color: #94a3b8; font-size: 12px; margin: 10px 0 0 0;">
                    Livraison de diesel sur Tours et ses alentours
                </p>
            </div>
        </div>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [customer['email']],
            "subject": f"✅ Commande confirmée #{order['id'][:8].upper()} - Alia Refuel",
            "html": html_content
        }
        
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Customer confirmation email sent to {customer['email']}")
        
    except Exception as e:
        logger.error(f"Failed to send customer confirmation email: {str(e)}")

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
    
    # Ne pas envoyer d'email ici - sera envoyé après paiement
    # await send_order_notification_email(order_doc, current_user)
    
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
    
    # Create SumUp checkout
    try:
        checkout_data = {
            "checkout_reference": order_id,
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
    tomorrow_formatted = tomorrow.strftime("%d/%m/%Y")
    
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
    for slot, slot_orders in sorted(by_slot.items()):
        slot_label = slot.replace("-", "h - ") + "h"
        orders_html += f"""
        <div style="margin-bottom: 30px;">
            <h3 style="background-color: #F59E0B; color: #0F172A; padding: 10px 15px; margin: 0; border-radius: 8px 8px 0 0;">
                🕐 {slot_label} ({len(slot_orders)} livraison{"s" if len(slot_orders) > 1 else ""})
            </h3>
        """
        for order in slot_orders:
            # Get customer info
            user = await db.users.find_one({"id": order["user_id"]}, {"_id": 0})
            customer_name = user.get("full_name", "Client") if user else "Client"
            customer_phone = user.get("phone", "N/A") if user else "N/A"
            
            orders_html += f"""
            <div style="background-color: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-top: none;">
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 60%;">
                            <strong style="font-size: 16px;">👤 {customer_name}</strong><br>
                            <span style="color: #64748b;">📞 {customer_phone}</span>
                        </td>
                        <td style="text-align: right;">
                            <strong style="font-size: 20px; color: #F59E0B;">⛽ {order['quantity']}L</strong><br>
                            <span style="color: #0F172A; font-weight: bold;">{order['total_price']:.2f}€</span>
                        </td>
                    </tr>
                </table>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e2e8f0;">
                    <strong>📍 Adresse :</strong><br>
                    {order['delivery_address']}<br>
                    {order['delivery_postal_code']} {order['delivery_city']}
                </div>
                {f"<div style='margin-top: 10px; padding: 10px; background-color: #fef3c7; border-radius: 4px;'><strong>📝 Note :</strong> {order['notes']}</div>" if order.get('notes') else ""}
            </div>
            """
        orders_html += "</div>"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background-color: #0F172A; padding: 20px; text-align: center;">
            <h1 style="color: #F59E0B; margin: 0;">📋 PLANNING LIVRAISONS</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">{tomorrow_formatted}</p>
        </div>
        
        <div style="background-color: #F59E0B; padding: 15px; text-align: center;">
            <table style="width: 100%; color: #0F172A;">
                <tr>
                    <td style="text-align: center;">
                        <strong style="font-size: 24px;">{len(orders)}</strong><br>
                        <span>livraisons</span>
                    </td>
                    <td style="text-align: center;">
                        <strong style="font-size: 24px;">{total_liters}L</strong><br>
                        <span>total</span>
                    </td>
                    <td style="text-align: center;">
                        <strong style="font-size: 24px;">{total_revenue:.2f}€</strong><br>
                        <span>CA</span>
                    </td>
                </tr>
            </table>
        </div>
        
        <div style="padding: 20px;">
            {orders_html}
        </div>
        
        <div style="background-color: #0F172A; padding: 15px; text-align: center; color: #94a3b8; font-size: 12px;">
            <p>Alia Refuel - Planning généré automatiquement</p>
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
