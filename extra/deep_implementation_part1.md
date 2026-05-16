# Career Vault — Deep Implementation Document
## Part 1 of 2: System Overview, Architecture & Backend

---

## 1. Project Overview

**Career Vault** is a full-stack, AI-powered resume generation platform. Users store their career data (experiences, education, skills, projects) in a "vault," provide a target job posting URL or raw text, and the system generates a fully ATS-optimized, tailored PDF resume using a multi-step AI pipeline.

### Core Capabilities
| Feature | Description |
|---|---|
| Resume Vault | Per-user CRUD storage for career data (profile, experience, education, skills, projects, social links) |
| AI Resume Generation | Job-aware bullet generation via pluggable LLM providers |
| Resume Parsing | Upload PDF/DOCX → AI extracts structured data → auto-populates vault |
| ATS Scoring | Keyword + skills + completeness scoring against any JD |
| PDF Compilation | LaTeX template engine + `pdflatex` compilation |
| Admin Panel | Standalone HTML dashboard for user/system management |
| Multi-LLM Support | Gemini, Anthropic, Groq, Ollama (local), Gemma (local) — hot-swappable at runtime |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│  Next.js 15 (App Router)   │   Admin Panel (Standalone HTML/JS)    │
│  React 19 · TypeScript     │   admin-panel/index.html              │
└────────────────┬───────────┴───────────────────┬───────────────────┘
                 │  REST / JSON  (HTTP + Bearer)  │  X-Admin-Secret
                 ▼                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       FASTAPI APPLICATION (main.py)                 │
│  uvicorn ASGI server · Python 3.10                                  │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │   auth/  │ │ api/     │ │ api/     │ │  pdf/    │ │  admin/  │ │
│  │ router   │ │ routers  │ │ resume_  │ │ router   │ │  api     │ │
│  │ /auth/*  │ │/api/vault│ │ upload   │ │ /generate│ │ /admin/* │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    AI MODULE (ai/)                            │  │
│  │  ResumePipeline → KeywordExtractor → SkillMatcher →          │  │
│  │  PromptBuilder → LLMProvider → OutputValidator               │  │
│  │  ATSScorer · RAGRetriever · InMemoryVectorStore              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────┐   ┌───────────────────────────────────┐  │
│  │   app_state.py       │   │  pdf/ module                      │  │
│  │   _AppState Singleton│   │  sanitizer · template_engine      │  │
│  │   Provider Catalogue │   │  generator (pdflatex subprocess)  │  │
│  └──────────────────────┘   └───────────────────────────────────┘  │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │  asyncpg (async SQLAlchemy 2.0)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PostgreSQL Database                                     │
│  users · user_profiles · user_settings · user_experiences          │
│  user_educations · user_skills · user_projects · user_social_links  │
│  job_applications · resumes · system_config                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure

```
Project/
├── main.py                   # FastAPI app factory, global routes, startup hook
├── app_state.py              # Mutable singleton for runtime LLM swapping
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
│
├── auth/
│   ├── router.py             # POST /auth/signup, /auth/login, GET /auth/me
│   ├── security.py           # JWT (HS256), bcrypt password hashing
│   └── dependencies.py       # get_current_user FastAPI dependency
│
├── api/
│   ├── routers.py            # /api/vault/* CRUD for all vault entities
│   ├── resume_upload.py      # /api/vault/resume/extract + /save-extracted
│   └── admin.py              # /admin/* admin-only endpoints
│
├── db/
│   ├── database.py           # SQLAlchemy async engine + session factory
│   └── models.py             # All ORM models
│
├── ai/
│   ├── pipeline.py           # ResumePipeline orchestrator
│   ├── prompt_builder.py     # Weighted bullet-budget prompt construction
│   ├── validator.py          # JSON cleaning + schema validation
│   ├── ats_scorer.py         # ATSScorer (4-factor scoring)
│   ├── resume_parser.py      # Resume upload → structured extraction
│   ├── keyword_extractor.py  # LLM-backed keyword extraction from JD
│   ├── skill_matcher.py      # Fuzzy skill intersection
│   ├── interfaces/
│   │   └── llm_provider.py   # Abstract LLMProvider base class
│   ├── llm/
│   │   ├── ollama_provider.py
│   │   ├── gemma_ollama_provider.py
│   │   ├── llama_groq_provider.py
│   │   ├── gemini_provider.py
│   │   └── anthropic_provider.py
│   └── rag/
│       ├── embeddings.py     # OllamaEmbeddings | HuggingFaceEmbeddings | KeywordEmbeddings
│       ├── vector_store.py   # InMemoryVectorStore (cosine similarity)
│       └── retriever.py      # RAGRetriever — example bullet retrieval
│
├── pdf/
│   ├── generator.py          # compile_latex() — pdflatex subprocess
│   ├── router.py             # /generate-resume-pdf, /preview-latex, /compile-raw
│   ├── sanitizer.py          # LaTeX-escape all user/AI strings
│   └── template_engine.py   # Loads resume.tex template, injects data dict
│
├── scraper/
│   └── extractor.py          # Playwright-based job scraping
│
├── templates/
│   └── resume.tex            # Master LaTeX resume template
│
├── alembic/                  # Database migration scripts
├── admin-panel/              # Standalone HTML admin dashboard
│   ├── index.html
│   └── impersonate.html
└── frontend/                 # Next.js application
    └── src/
        ├── app/              # App Router pages
        │   ├── page.tsx      # Landing/redirect
        │   ├── login/
        │   ├── signup/
        │   └── vault/        # Main vault dashboard
        ├── components/
        │   ├── vault/        # 10 modular vault UI components
        │   ├── ResumeGenerator.tsx
        │   ├── RichTextEditor.tsx
        │   └── Modal.tsx
        ├── hooks/
        │   └── useVault.ts   # Central data hook with sessionStorage cache
        ├── contexts/          # Auth context (JWT storage)
        ├── lib/               # API utility helpers
        └── types/             # TypeScript type definitions
```

---

## 4. Database Schema (PostgreSQL)

All IDs are `UUID v4`. All relationships cascade on delete.

### 4.1 Entity Relationship Overview

```
users (1) ──< user_profiles       (1:1)
users (1) ──< user_settings       (1:1)
users (1) ──< user_experiences    (1:N)
users (1) ──< user_educations     (1:N)
users (1) ──< user_skills         (1:N)
users (1) ──< user_projects       (1:N)
users (1) ──< user_social_links   (1:N)
users (1) ──< job_applications    (1:N)
job_applications (1) ──< resumes  (1:1)

system_config                     (standalone key-value store)
```

### 4.2 Table Definitions

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | uuid4 default |
| email | VARCHAR(255) | unique, indexed |
| password_hash | VARCHAR(255) | bcrypt |
| is_active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | server default now() |

#### `user_profiles`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | unique, cascade delete |
| first_name | VARCHAR(100) | |
| last_name | VARCHAR(100) | |
| email | VARCHAR(255) | |
| phone | VARCHAR(20) | |
| location | VARCHAR(100) | |
| summary | TEXT | |

#### `user_settings`
| Column | Type | Notes |
|---|---|---|
| user_id | UUID PK FK → users | cascade delete |
| preferred_template_id | VARCHAR(100) | default "standard" |
| ai_credits | INTEGER | default 10 |
| is_dark_mode_ui | BOOLEAN | default true |

#### `user_experiences`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| company_name | VARCHAR(255) | |
| job_title | VARCHAR(255) | |
| location | VARCHAR(100) | |
| start_date | DATE | |
| end_date | DATE | nullable |
| is_current | BOOLEAN | default false |
| raw_description | TEXT | HTML formatted |
| is_active | BOOLEAN | default true |

#### `user_projects`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| title | VARCHAR(255) | |
| role | VARCHAR(150) | |
| repository_url | VARCHAR(1024) | |
| live_demo_url | VARCHAR(1024) | |
| tech_stack | ARRAY(String) | PostgreSQL native array |
| raw_description | TEXT | HTML formatted |
| start_date | DATE | nullable |
| end_date | DATE | nullable |
| is_ongoing | BOOLEAN | |
| is_active | BOOLEAN | |
| sort_order | INTEGER | |

#### `system_config`
| Column | Type | Notes |
|---|---|---|
| key | VARCHAR(128) PK | e.g. `llm_provider` |
| value | TEXT | |
| updated_at | TIMESTAMPTZ | auto-updated |

---

## 5. Authentication System

### 5.1 Flow
```
POST /auth/signup
  → validate email uniqueness
  → bcrypt hash password
  → INSERT users + user_profiles (flush to get UUID)
  → sign JWT (sub=email, exp=7 days, HS256)
  → return {access_token, token_type}

POST /auth/login
  → lookup user by email
  → verify bcrypt hash
  → sign JWT
  → return {access_token, token_type}
```

### 5.2 JWT Configuration
```python
SECRET_KEY  = env SECRET_KEY         # HS256 signing key
ALGORITHM   = "HS256"
EXPIRY      = 60 * 24 * 7 minutes    # 7 days (normal users)
             120 minutes              # admin impersonation tokens
```

### 5.3 Route Protection
Every protected route declares:
```python
current_user: User = Depends(get_current_user)
```
`get_current_user` (in `auth/dependencies.py`):
1. Extracts `Authorization: Bearer <token>` header via `OAuth2PasswordBearer`
2. Decodes JWT with `python-jose`
3. Queries `users` table by `sub` claim (email)
4. Returns `User` ORM object or raises HTTP 401

### 5.4 Admin Authentication
Admin routes use a separate `X-Admin-Secret` header mechanism — completely decoupled from user JWTs so it can be rotated independently.
```python
ADMIN_SECRET = env ADMIN_SECRET   # checked per-request
```

---

## 6. Backend API Reference

### 6.1 Auth Routes (`/auth/*`)
| Method | Path | Description |
|---|---|---|
| POST | /auth/signup | Create account, return JWT |
| POST | /auth/login | Login with credentials, return JWT |
| GET | /auth/me | Return current user info |

### 6.2 Vault CRUD Routes (`/api/vault/*`)
All routes require `Authorization: Bearer <token>`.

| Method | Path | Entity |
|---|---|---|
| GET/PUT | /api/vault/profile | User profile |
| GET/POST | /api/vault/experiences | Experiences list |
| GET/PUT/DELETE | /api/vault/experiences/{id} | Single experience |
| GET/POST | /api/vault/projects | Projects list |
| GET/PUT/DELETE | /api/vault/projects/{id} | Single project |
| GET/POST | /api/vault/skills | Skills list |
| GET/PUT/DELETE | /api/vault/skills/{id} | Single skill |
| GET/POST | /api/vault/educations | Education list |
| GET/PUT/DELETE | /api/vault/educations/{id} | Single education |
| GET/POST | /api/vault/socials | Social links list |
| GET/PUT/DELETE | /api/vault/socials/{id} | Single social link |

### 6.3 Resume Upload Routes (`/api/vault/resume/*`)
| Method | Path | Description |
|---|---|---|
| POST | /api/vault/resume/extract | Upload PDF/DOCX → AI extraction |
| POST | /api/vault/resume/save-extracted | Persist extraction to vault DB |

### 6.4 Core Generation Routes
| Method | Path | Description |
|---|---|---|
| POST | /scrape | Playwright scrape a job URL |
| POST | /generate-resume | Full AI generation (returns JSON payload) |
| POST | /api/ats/score | ATS score current staged resume against JD |
| GET | /health | Server health + active provider info |

### 6.5 PDF Routes
| Method | Path | Description |
|---|---|---|
| POST | /generate-resume-pdf | Structured data → LaTeX → PDF bytes |
| POST | /preview-latex | Returns raw LaTeX string (debug) |
| POST | /compile-raw | Raw LaTeX string → PDF bytes |

### 6.6 Admin Routes (`/admin/*`)
| Method | Path | Description |
|---|---|---|
| GET | /admin/stats | Platform-wide system statistics |
| GET | /admin/users | List all users with counts |
| GET | /admin/users/{id} | Full user detail |
| PATCH | /admin/users/{id}/toggle-active | Activate/deactivate account |
| PATCH | /admin/users/{id}/credits | Set AI credits |
| GET | /admin/users/{id}/applications | All applications for user |
| DELETE | /admin/users/{id} | Permanently delete user + cascade |
| POST | /admin/users/{id}/impersonate | Generate short-lived impersonation JWT |
| GET | /admin/config | Current LLM provider + catalogue |
| PUT | /admin/config | Hot-swap LLM provider |

---

## 7. AppState Singleton — Runtime LLM Provider

`app_state.py` is the central nerve for all AI operations.

### 7.1 Design Pattern
```
_AppState (singleton) ─── lazy init ──→ _build_pipeline()
     │                                       │
     │  provider_name: str (persisted)        ├─ _build_provider() → LLMProvider
     │  _llm_provider: LLMProvider (memory)   └─ _build_embeddings() → Embeddings
     └─ _pipeline: ResumePipeline (memory)         └─ InMemoryVectorStore
                                                        └─ RAGRetriever
```

### 7.2 Provider Catalogue
```python
PROVIDER_CATALOGUE = [
  { "id": "gemini",      "model": "gemini-3-flash-preview",      "local": False, "key_env": "GEMINI_API_KEY" },
  { "id": "anthropic",   "model": "claude-3-5-sonnet-20241022",  "local": False, "key_env": "ANTHROPIC_API_KEY" },
  { "id": "groq",        "model": "llama-3.1-8b-instant",        "local": False, "key_env": "GROQ_API_KEY" },
  { "id": "ollama",      "model": "llama3.1:8b",                  "local": True,  "key_env": None },
  { "id": "gemma_ollama","model": "gemma2:9b",                    "local": True,  "key_env": None },
]
```

### 7.3 Startup Flow
```
FastAPI @startup event
  → await app_state.load_from_db(db)
      → SELECT system_config WHERE key='llm_provider'
      → if found: set provider_name (pipeline NOT built yet — lazy)
      → if not found: INSERT default from env var
```

### 7.4 Hot-Swap Flow (Admin PUT /admin/config)
```
Admin sends { provider: "gemini", api_key: "..." }
  → validate provider exists in catalogue
  → if key required but missing → HTTP 422
  → asyncio.to_thread(_sync_switch, provider, api_key)
      → os.environ[key_env] = api_key  (session-level)
      → _build_pipeline(provider)      (CPU-bound, in thread)
      → app_state._pipeline = new_pipeline
  → UPDATE system_config SET value=provider (async DB write)
  → return success
```

### 7.5 Embeddings Selection Logic
```python
if HUGGINGFACE_API_KEY:
    → HuggingFaceEmbeddings (sentence-transformers/all-MiniLM-L6-v2, 384-dim)
elif provider in ("ollama", "gemma_ollama"):
    → OllamaEmbeddings (nomic-embed-text, local)
else:
    → KeywordEmbeddings (TF bag-of-words, 512-dim, zero-dependency fallback)
```

---

## 8. AI Pipeline — Deep Dive

### 8.1 `ResumePipeline.generate()` Steps

```
Input: job_description, candidate_skills, candidate_profile,
       candidate_experiences, candidate_projects

Step 1 — Keyword Extraction
  KeywordExtractor.extract(job_description)
  → LLM call: "List 15-20 important skills/keywords from this JD"
  → returns: List[str] e.g. ["Python", "FastAPI", "PostgreSQL"]

Step 2 — Skill Matching
  SkillMatcher.match(flat_skills, keywords)
  → intersection of candidate skills vs JD keywords
  → returns: matched_skills List[str]

Step 3 — RAG Retrieval
  RAGRetriever.retrieve_examples(job_description, flat_skills)
  → embed job_description → cosine similarity vs stored example bullets
  → returns top-K example bullets for style reference

Step 4 — Prompt Construction
  PromptBuilder.build(...)
  → Sorts experiences by end_date DESC (most recent gets most bullets)
  → Calculates weighted bullet budget per experience/project
  → Builds 4-task prompt (summary, technical_skills, experiences, projects)

Step 5 — LLM Generation (with retry)
  max_retries = 2
  for attempt in range(3):
      response_text = llm.generate(prompt)
      validated_data = OutputValidator.validate(response_text, flat_skills)
      if valid: return validated_data
      else: retry

Step 6 — Validation
  OutputValidator.validate(response_text)
  → _clean_llm_json(): strip markdown fences, extract JSON object,
                        fix trailing commas, remove control characters
  → json.loads()
  → Check required keys: summary, technical_skills, experiences, projects
  → Validate bullets are non-empty strings
  → Return structured dict
```

### 8.2 Bullet Budget Algorithm

The PromptBuilder dynamically allocates bullet point counts:

```python
total_available = max(2, 20 - (2 * (num_exps + num_projs)))

# Experience weights: more recent = more bullets (3/1, 3/2, 3/3...)
exp_weights  = [3.0 / (i + 1) for i in range(num_exps)]
proj_weights = [1.5 / (j + 1) for j in range(num_projs)]

# Per-experience target: 2–7 bullets (first exp), 2–6 (others)
# Per-project target: 2–6 bullets
# Rollover from capped experience slots redistributed to projects
```

### 8.3 LLM Provider Implementations

Each provider in `ai/llm/` implements:
```python
class LLMProvider(ABC):
    def generate(self, prompt: str) -> str: ...
```

| Provider | SDK | Model | Notes |
|---|---|---|---|
| `OllamaProvider` | `langchain-ollama` | llama3.1:8b | Local inference via HTTP :11434 |
| `GemmaOllamaProvider` | `langchain-ollama` | gemma2:9b | Local inference via HTTP :11434 |
| `LlamaGroqProvider` | `langchain-groq` | llama-3.1-8b-instant | Cloud, free tier |
| `GeminiProvider` | `langchain-google-genai` | gemini-3-flash-preview | Cloud API |
| `AnthropicProvider` | `langchain-anthropic` | claude-3-5-sonnet-20241022 | Cloud API |

### 8.4 ATS Scorer — 4-Factor Scoring

```
Final Score = (keyword_score × 0.40) +
              (skill_score   × 0.25) +
              (title_score   × 0.15) +
              (completeness  × 0.20)
```

| Factor | Weight | Calculation |
|---|---|---|
| Keyword Match | 40% | LLM-extracted JD keywords found in full resume corpus |
| Skills Coverage | 25% | JD keywords found in explicit skills list |
| Title Alignment | 15% | Job title found in summary or experience titles |
| Completeness | 20% | Summary(20) + Experiences(30) + Projects(20) + Skills(20) + Education(10) |

Output includes: `overall_score`, `matched_keywords`, `missing_keywords`, `tips[]`, `suggested_titles[]`

### 8.5 Resume Parser (Upload Flow)

```
POST /api/vault/resume/extract (multipart file)
  → extract_text_from_file():
      .pdf  → pypdf.PdfReader → page.extract_text()
      .docx → python-docx → paragraph text concatenation
  → extract_resume_data(text):
      if provider in (gemini, anthropic):
          → _call_provider_directly() (bypasses LangChain SDK quirks)
      else (groq, ollama):
          → LangChain chain: PromptTemplate | ChatLLM | JsonOutputParser
  → returns ResumeExtractionSchema (Pydantic)

POST /api/vault/resume/save-extracted
  → parse_date() for all date strings:
      handles: YYYY-MM-DD, YYYY-MM, YYYY, MM/YYYY,
               "Aug 2023", "August 2023", "Aug. 2023",
               "Present", "Current" → None
  → DELETE existing records (overwrite strategy)
  → INSERT new records with field truncation (prevents DB varchar overflow)
  → commit
```

---

## 9. PDF Generation Pipeline

### 9.1 Full Flow
```
Frontend ReviewWorkspace → POST /generate-resume-pdf
  ↓
ResumePDFRequest (Pydantic)
  → candidate_name, email, phone, location, summary
  → experiences[], projects[], education_blocks[]
  → grouped_skills[], social_links[]
  → template_config: { font_size, font_family, section_order }
  ↓
pdf/router.py → build_latex_source()
  → sanitize() all strings (LaTeX-escape special chars)
  → Build LaTeX blocks: summary, education, experiences, projects, skills
  → Social links → fontawesome5 icons (faGithub, faLinkedin, etc.)
  → section_order controls block sequence
  → render_template(data) → inject into templates/resume.tex
  ↓
pdf/generator.py → compile_latex(latex_source)
  → Write .tex to tempfile.TemporaryDirectory
  → Run pdflatex × 2 (resolves cross-links):
      pdflatex -interaction=nonstopmode -no-shell-escape
               -halt-on-error -output-directory <tmpdir>
  → Timeout: 15 seconds
  → Read PDF bytes from tmpdir/resume.pdf
  → Cleanup temp dir (success & failure)
  ↓
StreamingResponse(application/pdf)
  Content-Disposition: attachment; filename="resume.pdf"
```

### 9.2 Security & Sandboxing
- `-no-shell-escape` disables TeX shell commands
- All files scoped to isolated `tempfile.TemporaryDirectory`
- Hard 15-second timeout via `subprocess.run(timeout=...)`
- Minimal safe environment (only PATH, HOME, TEXMFHOME passed)
- No persistent filesystem writes; no network access from TeX

### 9.3 LaTeX Template System
`templates/resume.tex` uses placeholder tokens:
```
{{CANDIDATE_NAME}}, {{CANDIDATE_EMAIL}}, {{CANDIDATE_PHONE}}
{{CANDIDATE_LOCATION}}, {{SOCIAL_LINKS_BLOCK}}, {{BODY_BLOCK}}
{{DOC_FONT_SIZE}}, {{DOC_FONT_FAMILY}}, {{DOC_HEADING_FORMAT}}
```

Font families:
- `sans-serif` → `\renewcommand{\familydefault}{\sfdefault}` + `\bfseries` headings
- `serif` → `\renewcommand{\familydefault}{\rmdefault}` + `\scshape` headings
- `monospace` → `\renewcommand{\familydefault}{\ttdefault}` + `\bfseries` headings

### 9.4 LaTeX Sanitizer
`pdf/sanitizer.py` escapes all special LaTeX characters in user/AI content:
- `&` → `\&`, `%` → `\%`, `$` → `\$`, `#` → `\#`, `_` → `\_`
- `{` → `\{`, `}` → `\}`, `~` → `\textasciitilde{}`
- `^` → `\textasciicircum{}`, `\` → `\textbackslash{}`
- HTML bold tags `<b>...</b>` → `\textbf{...}` (rich text bridge)
- Strips all other HTML tags

---

## 10. Job Scraper

`scraper/extractor.py` uses **Playwright** (Chromium) in sync mode:

```python
extract_job_info(url: str) -> dict
  → asyncio.to_thread() used from async handlers to avoid event loop conflicts
  → Playwright headless Chromium navigates to URL
  → Extracts: title, company, description, requirements

extract_from_text(text: str) -> dict
  → LLM call to structure raw pasted job description
  → Returns same shape dict
```

If scraping is blocked (bot protection), the API returns HTTP 400 with a message prompting the user to paste the raw JD text instead.

---

## 11. Docker / Deployment

### 11.1 Dockerfile
```
Base: python:3.10-slim
System deps (single layer):
  - texlive-latex-base/extra/fonts-recommended/fonts-extra (pdflatex)
  - Chromium runtime libs (libnss3, libatk, libdrm, etc.)
  - fonts-liberation, fonts-noto-core

Python deps: pip install -r requirements.txt
Playwright: playwright install chromium (binary only)

CMD: alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000
```

### 11.2 Environment Variables
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL asyncpg URL |
| `SECRET_KEY` | Yes | JWT signing secret |
| `ADMIN_SECRET` | Yes | Admin panel shared secret |
| `LLM_PROVIDER` | No | Default provider (ollama) |
| `GEMINI_API_KEY` | If using Gemini | Google AI API key |
| `ANTHROPIC_API_KEY` | If using Anthropic | Anthropic API key |
| `GROQ_API_KEY` | If using Groq | Groq API key |
| `HUGGINGFACE_API_KEY` | No | Better RAG embeddings |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `ALLOW_ALL_ORIGINS` | Dev only | Set `true` to bypass CORS |

### 11.3 Database Migrations
Managed via **Alembic**. The Docker CMD runs `alembic upgrade head` before starting uvicorn, ensuring schema is always current on deploy.
