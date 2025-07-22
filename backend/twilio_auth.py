import os
import random
from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel
from twilio.rest import Client

TWILIO_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE = os.getenv("TWILIO_PHONE_NUMBER")
TWILIO_VERIFY_SERVICE_SID = os.getenv("TWILIO_VERIFY_SERVICE_SID")

router = APIRouter()

# In-memory OTP store (use Redis/DB for production)
otp_store = {}

class OTPRequest(BaseModel):
    phone_number: str

@router.post("/auth/send-otp")
async def send_otp(request: OTPRequest):
    print("TWILIO_ACCOUNT_SID:", os.getenv("TWILIO_ACCOUNT_SID"))
    print(f"Received phone: {request.phone_number}")
    if not (TWILIO_SID and TWILIO_AUTH and TWILIO_VERIFY_SERVICE_SID):
        raise HTTPException(status_code=500, detail="Twilio API keys not set")
    if not request.phone_number.startswith('+'):
        raise HTTPException(status_code=422, detail="Phone number must include country code")
    
    try:
        client = Client(TWILIO_SID, TWILIO_AUTH)
        # Use Twilio Verify instead of regular messaging
        verification = client.verify \
            .v2 \
            .services(TWILIO_VERIFY_SERVICE_SID) \
            .verifications \
            .create(to=request.phone_number, channel='sms')
        
        print(f"Twilio Verify sent to {request.phone_number}, status: {verification.status}")
        return {"success": True}
    except Exception as e:
        print(f"Twilio Verify error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class OTPVerifyRequest(BaseModel):
    phone_number: str
    otp: str

@router.post("/auth/verify-otp")
async def verify_otp(request: OTPVerifyRequest):
    print(f"Verifying OTP for {request.phone_number}: {request.otp}")
    if not (TWILIO_SID and TWILIO_AUTH and TWILIO_VERIFY_SERVICE_SID):
        raise HTTPException(status_code=500, detail="Twilio API keys not set")
    
    try:
        client = Client(TWILIO_SID, TWILIO_AUTH)
        # Use Twilio Verify to check the code
        verification_check = client.verify \
            .v2 \
            .services(TWILIO_VERIFY_SERVICE_SID) \
            .verification_checks \
            .create(to=request.phone_number, code=request.otp)
        
        print(f"Twilio Verify check status: {verification_check.status}")
        
        if verification_check.status == 'approved':
            return {"success": True, "user": {"phone": request.phone_number}}
        else:
            return {"success": False, "error": "Invalid code"}
    except Exception as e:
        print(f"Twilio Verify check error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# To use: import and include router in main.py
# API keys: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in your environment or .env file 