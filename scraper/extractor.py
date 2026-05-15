import requests
from bs4 import BeautifulSoup
from langchain_ollama import OllamaLLM
from langchain.prompts import PromptTemplate
from pydantic import BaseModel, Field
from typing import Optional
import json
import re
import logging

logger = logging.getLogger(__name__)


# ── Pydantic schema ───────────────────────────────────────────────────────────

class JobInfo(BaseModel):
    title: str = Field(description="Job title or position name")
    company: str = Field(description="Company name")
    location: str = Field(description="Job location (city, state, remote, etc.)")
    salary: Optional[str] = Field(description="Salary or compensation range if mentioned")
    job_type: Optional[str] = Field(description="Full-time, Part-time, Contract, Internship, etc.")
    experience: Optional[str] = Field(description="Required years of experience")
    description: str = Field(description="Brief summary of the job role and responsibilities")
    requirements: list[str] = Field(description="List of key requirements or qualifications")
    benefits: Optional[list[str]] = Field(description="List of benefits if mentioned")
    apply_url: Optional[str] = Field(description="Direct URL to apply for the job")
    posted_date: Optional[str] = Field(description="When the job was posted")


# ── Minimal text length required ──────────────────────────────────────────────
MIN_TEXT_LEN = 200


# ── Static HTTP fetch ─────────────────────────────────────────────────────────

def _fetch_static(url: str) -> str | None:
    """Try fetching with plain requests. Returns cleaned text or None."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Referer": url.split("?")[0],
    }
    try:
        resp = requests.get(url, headers=headers, timeout=20, allow_redirects=True)
        # Fix common encoding issue
        if resp.encoding and resp.encoding.upper() in ("ISO-8859-1", "LATIN-1"):
            resp.encoding = resp.apparent_encoding or "utf-8"
        return resp.text
    except Exception as e:
        logger.warning(f"Static fetch failed: {e}")
        return None


# ── Playwright (JS rendering) fetch ──────────────────────────────────────────

def _fetch_with_playwright(url: str) -> str:
    """Use headless Chromium to render JS-heavy pages."""
    from playwright.sync_api import sync_playwright

    logger.info(f"Using Playwright for JS rendering: {url}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            locale="en-US",
        )
        page = context.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # Wait a bit for JS to hydrate
            page.wait_for_timeout(3000)
            html = page.content()
        finally:
            browser.close()

    return html


def _html_to_text(html: str) -> str:
    """Parse HTML and extract clean text."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "iframe",
                     "noscript", "aside", "svg", "img", "link", "meta"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def fetch_page(url: str) -> str:
    """
    Fetch and clean a job listing page.
    Tries static HTTP first; falls back to Playwright for JS-rendered sites.
    """
    # Sites known to use enterprise bot protection
    BOT_BLOCKED_DOMAINS = ["naukri.com", "linkedin.com", "indeed.com"]
    BOT_BLOCK_PHRASES = ["access denied", "you don't have permission", "blocked", "captcha"]

    def _is_bot_blocked(text: str) -> bool:
        low = text.lower()
        return any(phrase in low for phrase in BOT_BLOCK_PHRASES) and len(text) < 1000

    # --- Static attempt ---
    html = _fetch_static(url)
    if html:
        text = _html_to_text(html)
        if _is_bot_blocked(text):
            logger.info("Static fetch was bot-blocked, trying Playwright")
        elif len(text) >= MIN_TEXT_LEN:
            logger.info(f"Static fetch OK: {len(text)} chars")
            return text[:8000]
        else:
            logger.info(f"Static text too short ({len(text)} chars), switching to Playwright")

    # --- Playwright fallback ---
    html = _fetch_with_playwright(url)
    text = _html_to_text(html)

    if _is_bot_blocked(text):
        domain = url.split("/")[2] if "/" in url else url
        raise RuntimeError(
            f"This site ({domain}) uses bot protection (Akamai/Cloudflare) and is blocking automated access. "
            "Try a URL from: Greenhouse, Lever, Workday, or any ATS that doesn't block scrapers. "
            "Alternatively, copy the job description text and use a paste-based endpoint."
        )

    if len(text) < MIN_TEXT_LEN:
        raise RuntimeError(
            "Page content is too short even after JS rendering. "
            "The page may require login or is blocking automated access."
        )

    logger.info(f"Playwright fetch OK: {len(text)} chars")
    return text[:8000]



# ── LangChain Extraction Chain ────────────────────────────────────────────────

PROMPT_TEMPLATE = """You are an expert job listing parser. Extract structured job information from the following web page text.

Return ONLY valid JSON matching this exact schema — no explanation, no markdown, no extra text:
{{
  "title": "...",
  "company": "...",
  "location": "...",
  "salary": "...",
  "job_type": "...",
  "experience": "...",
  "description": "...",
  "requirements": ["...", "..."],
  "benefits": ["...", "..."],
  "apply_url": "...",
  "posted_date": "..."
}}

Use null for any field you cannot find. Requirements and benefits must be arrays of strings.

Page content:
{page_content}

JSON output:"""

prompt = PromptTemplate(
    input_variables=["page_content"],
    template=PROMPT_TEMPLATE,
)


def _generate_with_llm(page_content: str) -> str:
    """Use the globally configured LLM to generate the extraction JSON."""
    formatted_prompt = prompt.format(page_content=page_content[:3500])
    
    import os
    provider_name = os.getenv("LLM_PROVIDER", "ollama").lower()
    
    if provider_name == "groq":
        from ai.llm.llama_groq_provider import LlamaGroqProvider
        logger.info("Extracting job info using Groq (llama-3.1-8b-instant)...")
        return LlamaGroqProvider(model="llama-3.1-8b-instant").generate(formatted_prompt)
        
    elif provider_name == "gemma_ollama":
        from ai.llm.gemma_ollama_provider import GemmaOllamaProvider
        logger.info("Extracting job info using Ollama (gemma2:9b)...")
        return GemmaOllamaProvider().generate(formatted_prompt)
        
    elif provider_name == "gemini":
        from ai.llm.gemini_provider import GeminiProvider
        logger.info("Extracting job info using Gemini...")
        return GeminiProvider().generate(formatted_prompt)
        
    elif provider_name == "anthropic":
        from ai.llm.anthropic_provider import AnthropicProvider
        logger.info("Extracting job info using Anthropic...")
        return AnthropicProvider(model="claude-3-5-sonnet-20241022").generate(formatted_prompt)
        
    else:
        # Default to local Ollama Llama 3.1
        from langchain_ollama import OllamaLLM
        logger.info("Extracting job info using local Ollama (llama3.1:8b)...")
        llm = OllamaLLM(model="llama3.1:8b", temperature=0)
        return llm.invoke(formatted_prompt)

def _parse_json_from_response(text: str) -> dict:
    """Robustly extract JSON from LLM response text."""
    import json
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    logger.warning(f"Could not parse JSON from LLM output: {text[:200]}")
    return {
        "title": "Extraction failed",
        "company": "Unknown",
        "location": "Unknown",
        "salary": None,
        "job_type": None,
        "experience": None,
        "description": "The model could not produce valid JSON. Try again or use a different URL.",
        "requirements": [],
        "benefits": [],
        "apply_url": None,
        "posted_date": None,
    }



def extract_job_info(url: str) -> dict:
    """Fetch page, run LLM extraction chain, return structured job dict."""
    page_text = fetch_page(url)
    raw_output = _generate_with_llm(page_text)
    result = _parse_json_from_response(raw_output)
    result["source_url"] = url
    return result


def extract_from_text(text: str, source_url: str = "pasted-text") -> dict:
    """Extract job info directly from pasted text — no browser fetch needed."""
    raw_output = _generate_with_llm(text)
    result = _parse_json_from_response(raw_output)
    result["source_url"] = source_url
    return result

