from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'diesel-express-secret-key-2024')
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="DieselExpress API")

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
    notes: Optional[str] = None
    created_at: str
    updated_at: str

class OrderStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|confirmed|in_delivery|delivered|cancelled)$")

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

# ==================== ORDER ROUTES ====================

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order_data: OrderCreate, current_user: dict = Depends(get_current_user)):
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
    return {"message": "DieselExpress API v1.0", "status": "running"}

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
