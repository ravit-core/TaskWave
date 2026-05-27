from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from features.auth.router import router as auth_router
from features.tasks.router import router as tasks_router
from features.voice.router import router as voice_router

app = FastAPI(
    title="TaskWave AI API",
    description="Voice-first task manager — Gemini Live bidi audio with tool calling",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["tasks"])
app.include_router(voice_router, prefix="/api/voice", tags=["voice"])


@app.get("/", tags=["health"])
async def root():
    return {"name": "TaskWave AI", "status": "running", "version": "0.1.0"}


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=settings.debug)
