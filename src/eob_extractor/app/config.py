import os
from dotenv import load_dotenv

load_dotenv()

DOCUMENT_INTELLIGENCE_ENDPOINT = os.getenv("DOCUMENT_INTELLIGENCE_ENDPOINT", "")

DOCUMENT_INTELLIGENCE_KEY = os.getenv("DOCUMENT_INTELLIGENCE_KEY", "")

FOUNDRY_ENDPOINT = os.getenv("FOUNDRY_ENDPOINT", "")

FOUNDRY_API_KEY = os.getenv("FOUNDRY_API_KEY", "")

FOUNDRY_MODEL = os.getenv("FOUNDRY_MODEL", "gpt-4.1")
