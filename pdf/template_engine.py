"""
pdf/template_engine.py
──────────────────────
Loads the static LaTeX resume template from disk (with in-memory caching)
and injects sanitized data into named ``{{PLACEHOLDER}}`` slots.

Design decisions
────────────────
* The template is loaded once and cached at module level (thread-safe reads).
* Only whitelisted placeholders are replaced — unknown keys in *data* are
  silently ignored, preventing accidental LaTeX injection.
* All values supplied via *data* MUST already be sanitized before reaching
  this module (the router enforces this via the sanitizer module).
"""

import threading
from pathlib import Path
from typing import Dict

# ── Template location ──────────────────────────────────────────────────────
_TEMPLATE_PATH = Path(__file__).parent.parent / "templates" / "resume.tex"

# ── In-memory cache (populated lazily on first call) ──────────────────────
_cache_lock = threading.Lock()
_cached_template: str | None = None

# ── Whitelisted placeholder keys ───────────────────────────────────────────
# Any key NOT in this set is silently ignored, protecting against injection
# via fabricated placeholder names in AI-supplied data.
ALLOWED_PLACEHOLDERS: frozenset[str] = frozenset(
    {
        "CANDIDATE_NAME",
        "CANDIDATE_EMAIL",
        "CANDIDATE_PHONE",
        "CANDIDATE_LOCATION",
        "SOCIAL_LINKS_BLOCK",
        "SUMMARY_BLOCK",
        "EXPERIENCES_BLOCK",
        "PROJECTS_BLOCK",
        "EDUCATION_BLOCK",
        "SKILLS_BLOCK"
    }
)


class TemplateNotFoundError(FileNotFoundError):
    """Raised when the LaTeX template file cannot be located."""


class UnknownPlaceholderError(KeyError):
    """Raised when a required placeholder is missing in the template."""


def _load_template() -> str:
    """Read and cache the raw template content from disk."""
    global _cached_template

    if _cached_template is not None:
        return _cached_template

    with _cache_lock:
        # Double-checked locking
        if _cached_template is not None:
            return _cached_template

        if not _TEMPLATE_PATH.exists():
            raise TemplateNotFoundError(
                f"LaTeX template not found at: {_TEMPLATE_PATH}"
            )

        _cached_template = _TEMPLATE_PATH.read_text(encoding="utf-8")
        return _cached_template


def render_template(data: Dict[str, str]) -> str:
    """
    Load the cached template and substitute all whitelisted placeholders.

    Args:
        data: Mapping of placeholder key → already-sanitized string value.
              Only keys present in ``ALLOWED_PLACEHOLDERS`` are substituted.

    Returns:
        Fully rendered LaTeX source as a string.

    Raises:
        TemplateNotFoundError: If ``templates/resume.tex`` is missing.
    """
    template = _load_template()
    result = template

    for key in ALLOWED_PLACEHOLDERS:
        placeholder = "{{" + key + "}}"
        value = data.get(key, "")
        result = result.replace(placeholder, value)

    return result


def invalidate_cache() -> None:
    """
    Force the template to be re-read from disk on next call.
    Useful for hot-reloading in development without restarting the server.
    """
    global _cached_template
    with _cache_lock:
        _cached_template = None
