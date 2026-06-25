from dotenv import load_dotenv
import os

# This looks for the .env file and loads the variables into your system memory
load_dotenv()

class Settings:
    # Now os.getenv will actually find the values you put in the .env file
    SECRET_KEY: str = os.getenv("SECRET_KEY", "INSECURE_DEFAULT_DEV_KEY_CHANGE_ME")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    FIREBASE_KEY_PATH: str = os.getenv("FIREBASE_KEY_PATH", "firebase_key.json")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma2")

    def __init__(self):
        # Warn if API key is missing but don't crash the entire server
        if not self.GEMINI_API_KEY:
            print("[WARNING] GEMINI_API_KEY is not set in .env — AI features will use fallback responses.")

settings = Settings()