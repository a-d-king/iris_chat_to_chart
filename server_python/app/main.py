import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.controllers.app_controller import router
from app.config import config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Chat to Chart Python Server",
    description="Python backend for Chat to Chart application",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)

# Health check endpoint
@app.get("/")
async def root():
    return {"message": "Chat to Chart Python Server is running", "status": "healthy"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "chat-to-chart-python"}

if __name__ == "__main__":
    import uvicorn
    logger.info(f"✅ Server starting on http://localhost:{config.PORT}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=config.PORT, reload=True)