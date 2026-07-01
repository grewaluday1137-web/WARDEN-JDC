import os
from google.genai import Client
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# Configure Gemini removed from module level

class ChatRequest(BaseModel):
    message: str
    context: str = ""

@router.post("/chat")
async def chat_with_warden(request: ChatRequest):
    """
    General AI assistant for guests to ask questions about the crisis or safety.
    """
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return {
                "response": "I am currently running in offline mode. Please refer to the designated safe zones on your map or contact Staff directly.",
                "status": "offline"
            }
            
        client = Client(api_key=api_key)
        
        # Construct a prompt with context if available
        system_instruction = (
            "You are WARDEN (Wireless Advanced Response & Defense Network) Intelligence. "
            "You are an AI assistant helping guests during a crisis in a building. "
            "Be concise, helpful, and prioritize safety. "
            "If you don't know the exact floorplan details, advise following the green exit signs. "
            "Never cause panic. Keep answers tactical and supportive."
        )
        
        full_prompt = f"{system_instruction}\n\nContext: {request.context}\n\nUser Question: {request.message}"
        
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=full_prompt
        )
        
        return {
            "response": response.text,
            "status": "success"
        }
    except Exception as e:
        print(f"[AI] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
