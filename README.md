# AI Resume Maker

A fully authenticated, AI-powered platform for generating **ATS-optimized resumes**. It utilizes **LangChain + Ollama** for AI logic, **PostgreSQL** for storing user history vaults, **pdflatex** for PDF compilation, and a **Next.js + TypeScript** frontend with Dark Glassmorphism aesthetics.

## Stack

| Layer        | Technology                                  |
|--------------|---------------------------------------------|
| LLM          | Ollama — `llama3.1:8b`                      |
| Embedder     | Ollama — `nomic-embed-text`                 |
| Database     | PostgreSQL (SQLAlchemy + asyncpg + Alembic) |
| Backend      | Python — FastAPI + Uvicorn                  |
| Auth         | JWT Authentication (bcrypt + python-jose)   |
| PDF Engine   | pdflatex (TeX Live / BasicTeX)              |
| Frontend     | Next.js 15 + TypeScript (React Context API) |

## How It Works

Instead of manually typing out skills every time you apply for a job, you store your entire professional history in the **Vault**. When you find a job you like, the AI reads your Vault and writes a bespoke resume for you.

```
          [Authenticates User]  →  [Updates/Stores Experiences, Projects, Profile]
                 │                                        │
                 ▼                                        ▼
POST /auth/login & /auth/signup                GET/POST /api/vault/...
                 │                                        │
                 └────────────────────────────────────────┘
                                      │
                                      ▼
POST /generate-resume     → Backend pulls User Vault from PostgreSQL
                          → Scrapes Job URL for requirements
                          → RAG pipeline dynamically tailors experiences to the Job 
                          → Compiles & Downloads the PDF instantly
```

## Prerequisites

1. **Python 3.10+** and `pip`
2. **Node.js 18+** and `npm`
3. **Docker Desktop** (To run PostgreSQL seamlessly)
4. **Ollama** (Local AI Model Runner)
5. **pdflatex** via BasicTeX or MacTeX (required for PDF generation)

## Setup & Run

### 0 — Infrastructure Setup
**Ollama & Models:**
1. Install [Ollama](https://ollama.com/download), start the service, and pull the models:
   ```bash
   ollama pull llama3.1:8b
   ollama pull nomic-embed-text
   ```
**PostgreSQL (Docker):**
2. In the root directory, start the database container:
   ```bash
   docker compose up -d
   ```

### 1 — pdflatex Setup (Required for PDF Generation)

**macOS — Install BasicTeX (~130 MB):**
```bash
curl -L https://mirror.ctan.org/systems/mac/mactex/BasicTeX.pkg -o ~/Downloads/BasicTeX.pkg
sudo installer -pkg ~/Downloads/BasicTeX.pkg -target /
```
**Install required LaTeX packages**:
```bash
sudo tlmgr update --self
sudo tlmgr install enumitem titlesec hyperref parskip lm
```

### 2 — Backend Deployment

```bash
cd /path/to/Project

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browser (needed for scraping JS-heavy job sites)
playwright install chromium

# Generate and Run Database Migrations (Creates the 15+ Tracking Tables)
alembic revision --autogenerate -m "Init Schema"
alembic upgrade head

# Start API server
python -m uvicorn main:app --reload --port 8000
```

### 3 — Frontend UI

```bash
cd /path/to/Project/frontend

npm install
npm run dev
```

### 4 — Open App
Visit `http://localhost:3000`. 
1. Create a new account via the **Signup** portal.
2. Navigate to your **Dashboard**.
3. Input your entire professional history (Experiences, Projects).
4. Return to the Home screen, paste a Job URL, and let the AI generate the perfectly tailored PDF instantly!

---

## Project Structure

```text
Project/
├── docker-compose.yml        # PostgreSQL Container Configuration
├── alembic/                  # Database Migration Tracking
├── db/
│   ├── database.py           # Async SQLAlchemy Engine setup
│   └── models.py             # All 15 PostgreSQL Table Schemas
├── auth/
│   ├── dependencies.py       # Injectable JWT Guards
│   ├── router.py             # Login & Signup APIs
│   └── security.py           # Bcrypt & python-jose Logic
├── api/
│   └── routers.py            # Dashboard Vault CRUD Endpoints
├── main.py                   # FastAPI Application Entry Point
├── templates/
│   └── resume.tex            # Static LaTeX Resume Template
├── pdf/                      # Local pdflatex Compilation Engine
├── ai/                       # Local Ollama LangChain Integration
├── scraper/                  # Playwright Extractor Logic
└── frontend/                 # Next.js React Application
    └── src/
        ├── contexts/
        │   └── AuthContext.tsx # Global UI JWT Management
        ├── app/
        │   ├── layout.tsx      # Application Frame & Navigation
        │   ├── page.tsx        # Generation Splash Screen (Protected)
        │   ├── login/          # Glassmorphic Login UI
        │   ├── signup/         # Glassmorphic Registration UI
        │   └── dashboard/      # The Vault Manager UI
        ├── components/
        └── lib/
```

## PDF Security Model
| Constraint | How Enforced |
|---|---|
| LLM never writes LaTeX | Only pre-approved `{{PLACEHOLDER}}` slots exist in the static template |
| No LaTeX injection | Whitelist of allowed placeholder keys — unknown keys silently ignored |
| `-no-shell-escape` | Hard-coded in the pdflatex subprocess command |
| Hard timeout | 15-second wall-clock limit via `subprocess.run(timeout=15)` |

## Troubleshooting

| Error | Fix |
|---|---|
| Postgres Connection Error | Ensure Docker is running and you executed `docker compose up -d` |
| Alembic target metadata | Ensure the `.venv` is activated when running alembic upgrades |
| `pdflatex binary not found` | Install BasicTeX. On macOS, the backend automatically locates `/Library/TeX/texbin`. |
| `LaTeX compilation failed` | Run `sudo tlmgr install enumitem titlesec hyperref parskip lm` to install missing packages |
| `BrowserType.launch: Executable doesn't exist` | Run `playwright install chromium` inside your venv |
