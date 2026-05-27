from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Server ────────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:3000"
    port: int = 8000
    host: str = "0.0.0.0"
    debug: bool = True

    # ── Google Gemini ─────────────────────────────────────────────────
    # Single key, two models. Live = bidi audio agent. Text = optional
    # standby for non-audio reasoning (rarely used; Live handles most).
    google_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"
    gemini_live_model: str = "gemini-2.5-flash-native-audio-latest"

    # ── Supabase ──────────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_key: str = ""              # anon (used for token validation)
    supabase_service_role_key: str = "" # service-role (admin client, RLS bypass)

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
