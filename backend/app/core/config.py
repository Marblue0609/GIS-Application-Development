"""
Generate global configuration
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CityTaste API"
    app_env: str = "dev"
    database_url: str = "postgresql://citytaste_user:123456@127.0.0.1:5432/citytaste"

    # 高德 Web 服务 API key, 用于路线规划接口 (route.py). 不填则路线退回直线估算.
    amap_key: str = ""

    # DeepSeek Chat API configuration. API key is read only by the backend.
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-flash"

    # The urls that backend is allowed to access
    backend_cors_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:3000,"
        "http://127.0.0.1:3000"
    )

    # To read .env config
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # To turn cross-domain urls into a list
    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.backend_cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
