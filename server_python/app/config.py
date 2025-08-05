import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    IRIS_API_URL = os.getenv("IRIS_API_URL")
    IRIS_API_TOKEN = os.getenv("IRIS_API_TOKEN")
    PORT = int(os.getenv("PORT", 4000))

config = Config()