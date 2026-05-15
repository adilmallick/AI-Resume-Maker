"""
app_state.py — mutable singleton for runtime-swappable AI components.

Provider preference is persisted in the `system_config` DB table (key=llm_provider).
Startup: call `await app_state.load_from_db(db)` in the FastAPI lifespan.
Switch:  call `await app_state.switch_provider(name, db)` from the admin endpoint.

The in-memory pipeline objects (llm_provider, ResumePipeline) live here because
they cannot be serialised — only the provider *name* goes into the DB.
"""

import os
import logging

logger = logging.getLogger(__name__)

# ── Provider catalogue ─────────────────────────────────────────────────────────
PROVIDER_CATALOGUE = [
    {
        "id": "gemini",
        "name": "Google Gemini",
        "model": "gemini-3-flash-preview",
        "description": "Google's Gemini Flash — fast, high-quality, cloud API",
        "requires_key": True,
        "key_env": "GEMINI_API_KEY",
        "local": False,
    },
    {
        "id": "anthropic",
        "name": "Anthropic Claude",
        "model": "claude-3-5-sonnet-20241022",
        "description": "Claude 3.5 Sonnet — excellent reasoning, cloud API",
        "requires_key": True,
        "key_env": "ANTHROPIC_API_KEY",
        "local": False,
    },
    {
        "id": "groq",
        "name": "Groq (Llama)",
        "model": "llama-3.1-8b-instant",
        "description": "Llama 3.1 8B via Groq cloud — free tier, very fast",
        "requires_key": True,
        "key_env": "GROQ_API_KEY",
        "local": False,
    },
    {
        "id": "ollama",
        "name": "Ollama (Llama 3.1)",
        "model": "llama3.1:8b",
        "description": "Local Llama 3.1 8B via Ollama — fully private, no API key",
        "requires_key": False,
        "key_env": None,
        "local": True,
    },
    {
        "id": "gemma_ollama",
        "name": "Ollama (Gemma 2)",
        "model": "gemma2:9b",
        "description": "Local Gemma 2 9B via Ollama — Google model, fully private",
        "requires_key": False,
        "key_env": None,
        "local": True,
    },
]


# ── Internal helpers ───────────────────────────────────────────────────────────

def _build_provider(provider_name: str):
    from ai.llm.ollama_provider import OllamaProvider
    from ai.llm.gemma_ollama_provider import GemmaOllamaProvider
    from ai.llm.llama_groq_provider import LlamaGroqProvider

    if provider_name == "groq":
        return LlamaGroqProvider()
    elif provider_name == "gemma_ollama":
        return GemmaOllamaProvider()
    elif provider_name == "gemini":
        from ai.llm.gemini_provider import GeminiProvider
        return GeminiProvider(model="gemini-3-flash-preview")
    elif provider_name == "anthropic":
        from ai.llm.anthropic_provider import AnthropicProvider
        return AnthropicProvider(model="claude-3-5-sonnet-20241022")
    else:
        return OllamaProvider(model="llama3.1:8b")


def _build_embeddings(provider_name: str):
    from ai.rag.embeddings import OllamaEmbeddings, HuggingFaceEmbeddings, KeywordEmbeddings
    hf_key = os.getenv("HUGGINGFACE_API_KEY", "")
    if hf_key:
        return HuggingFaceEmbeddings(api_key=hf_key)
    elif provider_name in ("ollama", "gemma_ollama"):
        return OllamaEmbeddings(model="nomic-embed-text")
    else:
        return KeywordEmbeddings()


def _build_pipeline(provider_name: str):
    from ai.rag.vector_store import InMemoryVectorStore
    from ai.rag.retriever import RAGRetriever
    from ai.pipeline import ResumePipeline

    llm = _build_provider(provider_name)
    emb = _build_embeddings(provider_name)
    store = InMemoryVectorStore(emb)
    retriever = RAGRetriever(store)
    return llm, ResumePipeline(llm, retriever)


# ── DB helpers (async, using SQLAlchemy) ─────────────────────────────────────

async def _db_get(db, key: str) -> str | None:
    from sqlalchemy.future import select
    from db.models import SystemConfig
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    row = result.scalars().first()
    return row.value if row else None


async def _db_set(db, key: str, value: str) -> None:
    from sqlalchemy.future import select
    from db.models import SystemConfig
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    row = result.scalars().first()
    if row:
        row.value = value
    else:
        db.add(SystemConfig(key=key, value=value))
    await db.commit()


# ── Mutable app state singleton ───────────────────────────────────────────────

class _AppState:
    """
    Holds the currently active LLM provider and ResumePipeline in memory.
    The provider *name* is authoritative in the DB; the pipeline objects
    are rebuilt here on startup and on each switch.
    """

    def __init__(self):
        # Bootstrap from env — overwritten by load_from_db() at startup
        self.provider_name: str = os.getenv("LLM_PROVIDER", "ollama").lower()
        self._llm_provider = None
        self._pipeline = None

    # ── Lazy pipeline init ────────────────────────────────────────────────────
    def _ensure_pipeline(self):
        if self._pipeline is None:
            logger.info(f"[AppState] Building pipeline for: {self.provider_name}")
            self._llm_provider, self._pipeline = _build_pipeline(self.provider_name)

    @property
    def llm_provider(self):
        self._ensure_pipeline()
        return self._llm_provider

    @property
    def pipeline(self):
        self._ensure_pipeline()
        return self._pipeline

    # ── DB sync ───────────────────────────────────────────────────────────────
    async def load_from_db(self, db) -> None:
        """
        Called once at FastAPI startup.
        Reads the saved provider from system_config; falls back to the env var.
        Does NOT build the pipeline yet (lazy init keeps startup fast).
        """
        saved = await _db_get(db, "llm_provider")
        if saved:
            logger.info(f"[AppState] Loaded provider from DB: {saved}")
            self.provider_name = saved
            self._llm_provider = None   # force rebuild on next use
            self._pipeline = None
        else:
            # First run — seed the DB with the current env value
            logger.info(f"[AppState] No DB config found; seeding from env: {self.provider_name}")
            await _db_set(db, "llm_provider", self.provider_name)

    async def switch_provider(self, new_provider: str, db, api_key: str | None = None) -> None:
        """
        Hot-swap the LLM provider and persist the choice to the DB.
        `db` is an AsyncSession (passed from the admin endpoint).
        """
        catalogue_entry = next((p for p in PROVIDER_CATALOGUE if p["id"] == new_provider), None)
        if not catalogue_entry:
            raise ValueError(f"Unknown provider: {new_provider}")

        # Persist API key to os.environ if supplied (session-level only)
        if api_key and catalogue_entry["key_env"]:
            os.environ[catalogue_entry["key_env"]] = api_key
            logger.info(f"[AppState] Updated {catalogue_entry['key_env']} in os.environ")

        # Persist the provider name to DB
        await _db_set(db, "llm_provider", new_provider)

        # Rebuild the pipeline synchronously (this is called inside asyncio.to_thread)
        logger.info(f"[AppState] Switching provider: {self.provider_name} → {new_provider}")
        new_llm, new_pipeline = _build_pipeline(new_provider)
        self.provider_name = new_provider
        self._llm_provider = new_llm
        self._pipeline = new_pipeline
        logger.info(f"[AppState] Provider switch complete: {new_provider}")

    # ── Catalogue helper ──────────────────────────────────────────────────────
    def catalogue_with_status(self) -> list[dict]:
        result = []
        for p in PROVIDER_CATALOGUE:
            entry = dict(p)
            entry["has_key"] = bool(os.getenv(entry["key_env"], "")) if entry["key_env"] else True
            entry["is_active"] = (self.provider_name == p["id"])
            result.append(entry)
        return result


# Module-level singleton
state = _AppState()
