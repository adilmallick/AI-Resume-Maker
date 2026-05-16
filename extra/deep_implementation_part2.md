# Career Vault — Deep Implementation Document
## Part 2 of 2: Frontend, Admin Panel, Data Flows & Design Decisions

---

## 12. Frontend Architecture (Next.js 15)

### 12.1 Technology Stack
| Technology | Version | Role |
|---|---|---|
| Next.js | 15 | App Router, SSR/CSR hybrid |
| React | 19 | UI rendering |
| TypeScript | 5.x | Type safety |
| TipTap | 2.x | Rich text editor (WYSIWYG for bullets) |
| Vanilla CSS | — | Styling (globals.css) |

### 12.2 App Router Pages

```
src/app/
├── layout.tsx        # Root layout: fonts, metadata, AuthProvider wrapper
├── page.tsx          # Root — redirects to /vault if logged in, else /login
├── globals.css       # Design system: CSS variables, dark mode, animations
├── login/
│   └── page.tsx      # Login form → POST /auth/login → store JWT
├── signup/
│   └── page.tsx      # Signup form → POST /auth/signup → store JWT
└── vault/
    └── page.tsx      # Main Career Vault dashboard (protected)
```

### 12.3 Component Tree

```
vault/page.tsx (orchestrator)
  ├── AppContainer         # Global layout wrapper + auth guard
  ├── VaultHeader          # Title bar, user info, theme toggle
  ├── VaultTabs            # Tab navigation (Profile/Experience/Education/etc.)
  │
  ├── [tab === 'profile']
  │   └── ProfileSection   # Name, email, phone, location, summary
  │
  ├── [tab === 'experience']
  │   └── ExperienceSection
  │       ├── Experience cards (read view)
  │       └── Modal → ExperienceForm (add/edit)
  │
  ├── [tab === 'projects']
  │   └── ProjectSection
  │       ├── Project cards
  │       └── Modal → ProjectForm
  │
  ├── [tab === 'education']
  │   └── EducationSection
  │
  ├── [tab === 'skills']
  │   └── SkillsSection    # Comma-separated batch add, category grouping
  │
  ├── [tab === 'socials']
  │   └── SocialsSection   # Platform name, URL, display text
  │
  └── [tab === 'generate']
      ├── GenerateResumePanel  # Job URL / paste-text input, trigger AI
      └── ReviewWorkspace      # Full resume editor + PDF export
          ├── Summary editor (TipTap)
          ├── TechnicalSkills editor
          ├── ExperienceBlocks (per-company)
          │   └── Bullet list (TipTap rich text, drag-to-reorder)
          ├── ProjectBlocks
          │   └── Bullet list (TipTap rich text, drag-to-reorder)
          ├── EducationBlocks
          ├── ATSScorePanel    # Live ATS scoring display
          └── TemplateConfig   # Font, size, section order → export PDF
```

### 12.4 `useVault` Hook — State Management

`src/hooks/useVault.ts` is the single source of truth for all vault data. It provides:

**State:** `profile`, `experiences`, `projects`, `skills`, `educations`, `socials`

**Methods per entity:** `save*()`, `delete*()`, `fetchVault()`

**SessionStorage Cache:**
```typescript
VAULT_CACHE_KEY = `vault_cache_${userId}`

fetchVault(forceRefresh = false)
  → if not forceRefresh and cache exists: hydrate state from sessionStorage
  → else: parallel fetch all 6 endpoints → save to sessionStorage

// All mutations update state AND patch the sessionStorage cache
// so tab switches don't re-fetch from network
```

**Optimistic Cache Patching Pattern:**
```typescript
const updated = [...experiences, saved];
setExperiences(updated);
const cached = loadVaultCache() || {};
saveVaultCache({ ...cached, experiences: updated });
```

### 12.5 Auth Context

```
AuthContext (React Context)
  state: { token: string|null, userId: string|null, isLoading: boolean }

  login(email, password)
    → POST /auth/login
    → store token in localStorage ('cv_token')
    → store userId in localStorage ('cv_user_id')
    → update context state

  logout()
    → clear localStorage
    → clear sessionStorage vault cache
    → redirect to /login

  // Token read from localStorage on mount → auto-login on page refresh
```

### 12.6 ReviewWorkspace — The Core Editor

`ReviewWorkspace.tsx` (41 KB) is the most complex component. It manages:

**State:**
- `stagedBullets`: per-experience/project bullet arrays (user-editable)
- `technicalSkills`: grouped skill categories
- `summary`: professional summary string
- `atsResult`: ATS scoring result object
- `templateConfig`: `{ font_size, font_family, section_order }`

**Drag-and-Drop Bullet Reordering:**
```typescript
// HTML5 drag API on bullet list items
onDragStart → store dragged index
onDragOver  → prevent default (enable drop)
onDrop      → splice arrays, update stagedBullets state
// Dedicated drag handle (⠿ icon) prevents conflict with TipTap editing area
```

**PDF Export Flow:**
```typescript
handleExportPDF()
  → Assemble ResumePDFRequest from all staged state
  → Format dates: date objects → "MMM YYYY" strings
  → POST /generate-resume-pdf (binary response)
  → URL.createObjectURL(blob)
  → <a download="resume.pdf"> click trigger
```

**LaTeX Preview Mode:**
```typescript
handlePreviewLatex()
  → POST /preview-latex (returns {latex: string})
  → Renders raw LaTeX in a <pre> panel for debugging
```

**ATS Score Trigger:**
```typescript
handleATSScore()
  → Assemble staged_data payload (profile, skills, experiences, projects)
  → POST /api/ats/score with job_input + resume_data
  → Display: overall score gauge, keyword matches, missing keywords, tips
```

---

## 13. Admin Panel

### 13.1 Architecture
The admin panel is a **standalone HTML/CSS/JS** application (no build step, no framework). It lives in `admin-panel/` and communicates with the FastAPI backend via `fetch()` using the `X-Admin-Secret` header.

Files:
- `admin-panel/index.html` — main dashboard
- `admin-panel/impersonate.html` — user impersonation tool

### 13.2 Dashboard Features
| Feature | Endpoint Used |
|---|---|
| System stats (users, experiences, apps) | GET /admin/stats |
| User list with profile + counts | GET /admin/users |
| User detail modal | GET /admin/users/{id} |
| Toggle account active/inactive | PATCH /admin/users/{id}/toggle-active |
| Adjust AI credits | PATCH /admin/users/{id}/credits |
| View job applications | GET /admin/users/{id}/applications |
| Delete user (permanent) | DELETE /admin/users/{id} |
| LLM provider status | GET /admin/config |
| Hot-swap LLM provider | PUT /admin/config |
| User impersonation | POST /admin/users/{id}/impersonate |

### 13.3 Impersonation Flow
```
Admin panel → POST /admin/users/{id}/impersonate
  → Backend generates short-lived JWT (2h, same format as user JWT)
  → Returns { access_token, user_id, email, expires_in_minutes: 120 }
  → impersonate.html copies token to clipboard
  → Admin pastes token into frontend app's localStorage as 'cv_token'
  → Admin can now browse the app AS that user
```

---

## 14. End-to-End Data Flows

### 14.1 Full Resume Generation Flow

```
1. User navigates to Career Vault → fetchVault() → populate all sections

2. User enters Job URL or pastes JD text in GenerateResumePanel

3. POST /generate-resume { job_url | job_text }
   Backend:
   a. Fetch vault data (experiences, projects, skills, profile) from DB
   b. If job_url: asyncio.to_thread(extract_job_info, url)
                  (Playwright scrape → structured job dict)
      If job_text: asyncio.to_thread(extract_from_text, text)
   c. Build job_description string
   d. asyncio.to_thread(app_state.pipeline.generate, ...)
       → KeywordExtractor.extract(jd)
       → SkillMatcher.match(skills, keywords)
       → RAGRetriever.retrieve_examples(jd, skills)
       → PromptBuilder.build(all context)
       → llm.generate(prompt)  ← cloud/local API call
       → OutputValidator.validate(response)
   e. Return: { summary, technical_skills[], experiences[], projects[], job_data }

4. Frontend receives JSON → populates ReviewWorkspace staged state

5. User edits bullets in TipTap rich text editors
   (drag to reorder, add/remove bullets, bold/italic key terms)

6. User clicks "Check ATS Score"
   → POST /api/ats/score → display 0-100 score with breakdown

7. User selects template config (font, section order)

8. User clicks "Export PDF"
   → POST /generate-resume-pdf
   → Backend: sanitize → LaTeX build → pdflatex × 2 → PDF bytes
   → Browser: download as resume.pdf
```

### 14.2 Resume Upload / Auto-Populate Flow

```
1. User uploads PDF or DOCX via drag/drop or file picker

2. POST /api/vault/resume/extract (multipart/form-data)
   → Read file bytes
   → Extract text: pypdf (PDF) or python-docx (DOCX)
   → LLM extraction:
      Gemini/Anthropic: direct API call, strip markdown fences, json.loads()
      Groq/Ollama: LangChain chain (PromptTemplate | ChatLLM | JsonOutputParser)
   → Return ResumeExtractionSchema:
      { profile, experiences[], skills[], projects[], educations[] }

3. Frontend shows preview of extracted data in modal
   User confirms or discards

4. POST /api/vault/resume/save-extracted
   { strategy: "overwrite", data: ResumeExtractionSchema }
   → DELETE existing records for user
   → parse_date() all date strings
   → INSERT all new records (with field length truncation)
   → commit

5. Frontend calls fetchVault(forceRefresh=true) → UI updates
```

---

## 15. RAG System

### 15.1 Architecture

```
InMemoryVectorStore
  └── documents: List[{text, embedding}]
  └── embed(text) → cosine_similarity against all stored docs
  └── add_documents(texts) → embed and store
  └── similarity_search(query, k) → top-K by cosine sim

RAGRetriever
  └── retrieve_examples(job_description, skills) → List[str]
      → Combines jd + skills as query
      → Retrieves example bullets from pre-seeded store
      → These examples guide the LLM on bullet style (not content)
```

### 15.2 Embeddings Implementations

**`KeywordEmbeddings`** (zero-dependency fallback):
```
Tokenize text → TF bag-of-words → 512-dim vector
Hash token to index: idx = abs(hash(token)) % 512
L2-normalize for cosine compatibility
Works on Render free tier with no external calls
```

**`OllamaEmbeddings`**: POST to `http://localhost:11434/api/embeddings` (nomic-embed-text model)

**`HuggingFaceEmbeddings`**: POST to HF Inference API (sentence-transformers/all-MiniLM-L6-v2, 384-dim)

---

## 16. Key Design Decisions

### 16.1 Async Throughout
All FastAPI route handlers are `async def`. Database access uses `SQLAlchemy 2.0 AsyncSession + asyncpg`. CPU-bound tasks (LLM calls, pdflatex, Playwright scraping) are offloaded via `asyncio.to_thread()` to avoid blocking the event loop.

### 16.2 Lazy Pipeline Initialization
The `_AppState._ensure_pipeline()` method defers building the LLM provider and pipeline until the first actual request, keeping server startup fast. On switch, the new pipeline is built synchronously inside a thread pool.

### 16.3 DB-Persisted Provider Config
The LLM provider choice is stored in `system_config` table (not `.env`), allowing runtime changes via the admin panel that survive server restarts. On startup, the DB value overrides the env var.

### 16.4 HTML-to-LaTeX Bridge
The AI generates bullet points with `<b>...</b>` HTML tags around key terms. The LaTeX sanitizer converts these to `\textbf{...}`. This allows rich bold formatting in the final PDF while keeping the AI output format simple.

### 16.5 Section Order as User Config
`template_config.section_order` is a user-configurable `List[str]` (e.g., `["summary", "experiences", "education", "skills", "projects"]`). The LaTeX builder iterates this list, enabling any section ordering without template changes.

### 16.6 Weighted Bullet Budget
Instead of a fixed 3 bullets per job, the PromptBuilder dynamically calculates how many bullets each experience/project should get based on: total count of entries, recency weighting (recent = more bullets), and hard caps (7 max for most recent, 6 for others).

### 16.7 Decoupled Admin Panel
The admin dashboard is a standalone static HTML file to avoid bundling admin logic into the user-facing Next.js app. It uses a separate `X-Admin-Secret` auth mechanism so it can be hosted on a completely different origin or even opened as a `file://` URL (with `ALLOW_ALL_ORIGINS=true`).

### 16.8 SessionStorage Vault Cache
To eliminate redundant API calls when switching tabs, `useVault` caches all vault data in `sessionStorage`. Mutations patch the cache in-place. `fetchVault(forceRefresh=true)` is called after operations that change server state (e.g., resume upload save).

---

## 17. Security Considerations

| Area | Implementation |
|---|---|
| Password storage | bcrypt via `passlib` — never stored in plaintext |
| JWT tokens | HS256, 7-day expiry, validated on every request |
| Admin access | Separate `X-Admin-Secret` header, independent from user JWTs |
| Impersonation tokens | 2-hour expiry (vs 7-day user tokens) |
| LaTeX injection | `-no-shell-escape` flag + full string sanitization before TeX injection |
| pdflatex isolation | Isolated tempdir per call, hard 15s timeout, stripped env |
| SQL injection | SQLAlchemy ORM parameterized queries — no raw SQL |
| CORS | Configurable per-origin allowlist; wildcard only with `ALLOW_ALL_ORIGINS=true` |
| User data isolation | All vault queries filter by `user_id = current_user.id` |

---

## 18. Technology Dependencies Summary

### Backend
```
fastapi==0.115.0          # ASGI web framework
uvicorn[standard]==0.30.6  # ASGI server
sqlalchemy>=2.0.0          # Async ORM
asyncpg>=0.29.0            # PostgreSQL async driver
alembic>=1.13.1            # Database migrations
pydantic>=2.12             # Data validation / schemas
langchain==0.2.16          # LLM orchestration
langchain-ollama==0.1.3    # Ollama integration
langchain-groq             # Groq integration
langchain-google-genai     # Gemini integration
langchain-anthropic        # Anthropic integration
langchain-community==0.2.16 # Shared community LLM tools
playwright==1.49.1         # Headless browser scraping
beautifulsoup4==4.12.3     # HTML parsing
python-jose[cryptography]  # JWT encoding/decoding
passlib[bcrypt]            # Password hashing
pypdf>=5.1.0               # PDF text extraction
python-docx>=1.1.2         # DOCX text extraction
python-multipart==0.0.9    # File upload handling
email-validator>=2.1.0     # Email field validation
python-dotenv>=1.0.0       # .env file loading
```

### Frontend
```
next@15                    # React framework (App Router)
react@19                   # UI library
typescript@5               # Type safety
@tiptap/react              # Rich text editor
@tiptap/starter-kit        # TipTap extensions bundle
```

### Infrastructure
```
PostgreSQL                 # Primary database
pdflatex (TeX Live)        # PDF compilation
Playwright Chromium        # Job scraping browser
Docker + docker-compose    # Containerization
```
