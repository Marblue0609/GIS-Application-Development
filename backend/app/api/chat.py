"""
Restaurant assistant endpoint.

The frontend calls this backend route instead of DeepSeek directly so the API
key stays on the server. Restaurant facts are supplied from app/AGENTS.md.
"""

import json
from pathlib import Path
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings

router = APIRouter(prefix="/api/chat", tags=["Restaurant Chat"])

AGENTS_PATH = Path(__file__).resolve().parents[1] / "AGENTS.md"


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class RestaurantChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=16)


def read_restaurant_agents() -> str:
    if not AGENTS_PATH.exists():
        raise HTTPException(status_code=500, detail="Restaurant AGENTS.md not found")
    return AGENTS_PATH.read_text(encoding="utf-8")


def call_deepseek(messages: list[dict[str, str]]) -> dict:
    if not settings.deepseek_api_key:
        raise HTTPException(status_code=503, detail="DEEPSEEK_API_KEY is not configured")

    endpoint = f"{settings.deepseek_base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.deepseek_model,
        "messages": messages,
        "thinking": {"type": "disabled"},
        "temperature": 0.3,
        "max_tokens": 900,
        "stream": False,
    }
    request = Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.deepseek_api_key}",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"DeepSeek API error: {detail}") from error
    except URLError as error:
        raise HTTPException(status_code=502, detail=f"DeepSeek API unavailable: {error.reason}") from error
    except TimeoutError as error:
        raise HTTPException(status_code=504, detail="DeepSeek API request timed out") from error


@router.post("/restaurants")
def chat_with_restaurant_agent(payload: RestaurantChatRequest):
    system_prompt = read_restaurant_agents()
    conversation = [
        {"role": "system", "content": system_prompt},
        *[message.model_dump() for message in payload.messages[-12:]],
    ]
    result = call_deepseek(conversation)
    reply = result.get("choices", [{}])[0].get("message", {}).get("content", "")

    return {
        "code": 200,
        "message": "OK",
        "data": {
            "reply": reply,
            "model": result.get("model", settings.deepseek_model),
            "usage": result.get("usage"),
        },
    }
