import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="CityTaste API",
    description="Citytaste Backend API",
    version="0.1.0",
    servers=[{"url": "http://127.0.0.1:8000", "description": "Localhost server"}],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Root"])
def Root():
    return {"message": "CityTaste API is alive", "docs": "/docs", "openapi": "/openapi.json"}


@app.get("/api/health", tags=["Health Check"])
def HealthCheck():
    return {"status": "OK", "version": "0.1.0", "update date": "2026-05-28"}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
