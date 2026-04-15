# AI Resume Maker

AI-powered job scraper, resume bullet generator, and **PDF compiler** using **LangChain + Ollama** backend, **pdflatex** for PDF generation, and a **Next.js + TypeScript** frontend.

## Stack

| Layer        | Technology                                  |
|--------------|---------------------------------------------|
| LLM          | Ollama — `llama3.1:8b`                      |
| Embedder     | Ollama — `nomic-embed-text`                 |
| RAG          | Dependency-free Cosine Similarity           |
| Chains       | LangChain (`langchain-ollama`)              |
| Backend      | Python — FastAPI + Uvicorn                  |
| PDF Engine   | pdflatex (TeX Live / BasicTeX)              |
| Frontend     | Next.js 15 + TypeScript                     |
| Parsing      | BeautifulSoup4 + custom JSON extractor      |

## How It Works

```
Job URL
  │
  ▼
POST /scrape              → Scrapes structured job info (title, description, requirements)
  │
  ▼
POST /generate-resume     → RAG pipeline generates ATS-optimized bullet points via Ollama
  │
  ▼
POST /generate-resume-pdf → Injects bullets into a static LaTeX template → pdflatex → PDF
```

- The **LLM never writes LaTeX** — only sanitized plain text is injected into predefined template slots.
- All user/AI text is **escaped for LaTeX special characters** before injection.
- pdflatex runs with `-no-shell-escape` and a **15-second timeout** inside an isolated temp directory.

## Prerequisites

1. **Python 3.10+** and `pip`
2. **Node.js 18+** and `npm` (installed via nvm)
3. **Ollama** (Local AI Model Runner)
4. **pdflatex** via BasicTeX or MacTeX (required for PDF generation)

## Setup & Run

### 0 — Ollama Setup

Ollama is required to run the local AI models for this project.

1. **Install Ollama**: Download and install it from [https://ollama.com/download](https://ollama.com/download).
2. **Start Ollama Service**: Ensure the Ollama service is running in the background before continuing.
   - *macOS/Windows*: Launch the Ollama app (look for the icon in your menu bar/system tray).
   - *Linux/Terminal*: Run `ollama serve` in a dedicated terminal.
3. **Pull Models**: Open a terminal and pull the required models:
   ```bash
   ollama pull llama3.1:8b
   ollama pull nomic-embed-text
   ```
4. **Run the Model (Optional)**: Start an interactive session to ensure the model runs correctly:
   ```bash
   ollama run llama3.1:8b
   ```

### 1 — pdflatex Setup (Required for PDF Generation)

> **pdflatex is a system-level binary** — it is installed once at the OS level, not inside the Python venv.

**macOS — Install BasicTeX (~130 MB):**

```bash
# Download BasicTeX installer
curl -L https://mirror.ctan.org/systems/mac/mactex/BasicTeX.pkg -o ~/Downloads/BasicTeX.pkg

# Install system-wide (requires your Mac password)
sudo installer -pkg ~/Downloads/BasicTeX.pkg -target /

# (Optional) Add pdflatex to your PATH for manual terminal usage.
# The backend automatically detects /Library/TeX/texbin, so this isn't strictly required.
echo 'export PATH="/Library/TeX/texbin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Install required LaTeX packages** (the template uses these):

```bash
sudo tlmgr update --self
sudo tlmgr install enumitem titlesec hyperref parskip lm
```

**Verify:**

```bash
which pdflatex      # → /Library/TeX/texbin/pdflatex
pdflatex --version
```

**Linux (Ubuntu/Debian):**

```bash
sudo apt-get install -y texlive-latex-base texlive-latex-extra texlive-fonts-recommended
```

**Docker:** Add to your `Dockerfile`:

```dockerfile
RUN apt-get update && apt-get install -y texlive-latex-extra texlive-fonts-recommended
```

### 2 — Backend

```bash
cd /path/to/Project

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browser (needed for JS-heavy job sites)
playwright install chromium

# Start API server (port 8000)
python -m uvicorn main:app --reload --port 8000
```

### 3 — Frontend

```bash
cd /path/to/Project/frontend

# Install dependencies
npm install

# Start dev server (port 3000)
npm run dev
```

### 4 — Open App

Visit `http://localhost:3000`, paste a job listing URL, and click **Extract Job Info ⚡**.

After extraction, enter your skills to generate ATS-optimized resume bullets. Once generated, click **⬇️ Download Resume PDF** to compile and download the PDF.

## API Endpoints

| Method | Path                    | Body                                         | Response           |
|--------|-------------------------|----------------------------------------------|--------------------|
| GET    | `/health`               | —                                            | `{ status, model }` |
| POST   | `/scrape`               | `{ "url": "..." }`                          | Structured job JSON |
| POST   | `/generate-resume`      | `{ "job_url": "...", "skills": [] }`        | `{ "experience": [] }` |
| POST   | `/generate-resume-pdf`  | `{ "bullets": [], ...optional fields }`     | `application/pdf` stream |

### `POST /generate-resume-pdf` — Full Request Schema

```json
{
  "bullets": ["Led team of 5 engineers", "Reduced latency by 40%"],
  "candidate_name":      "Jane Doe",
  "candidate_email":     "jane@example.com",
  "candidate_phone":     "+1 (555) 000-0000",
  "candidate_location":  "San Francisco, CA",
  "summary":             "Backend engineer with 6 years of Python experience.",
  "job_title":           "Senior Software Engineer",
  "job_date_range":      "Jan 2021 -- Present",
  "company_name":        "Acme Corp",
  "job_location":        "Remote",
  "skills_list":         "Python, FastAPI, Docker, PostgreSQL",
  "degree":              "Bachelor of Science in Computer Science",
  "education_date_range":"2015 -- 2019",
  "institution":         "UC Berkeley"
}
```

Only `bullets` is required. All other fields have defaults and are optional.

**Quick test via curl:**

```bash
curl -X POST http://localhost:8000/generate-resume-pdf \
  -H "Content-Type: application/json" \
  -d '{"bullets": ["Built REST APIs with FastAPI", "Reduced latency by 40%"]}' \
  --output resume.pdf && open resume.pdf
```

## Project Structure

```text
Project/
├── main.py                   # FastAPI app — registers all routers
├── requirements.txt          # Python dependencies
├── templates/
│   └── resume.tex            # Static LaTeX resume template (placeholders only)
├── pdf/                      # PDF Generation Service
│   ├── __init__.py
│   ├── sanitizer.py          # Single-pass LaTeX special-character escaper
│   ├── template_engine.py    # Thread-safe template loader + placeholder injector
│   ├── generator.py          # pdflatex subprocess runner (-no-shell-escape, 15s timeout)
│   └── router.py             # POST /generate-resume-pdf endpoint
├── ai/                       # Modular AI Pipeline
│   ├── interfaces/           # Abstractions for LLMs and Vector Stores
│   ├── llm/                  # Ollama integration handlers
│   ├── rag/                  # Embeddings, Vector Store, and Retriever
│   ├── pipeline.py           # E2E Resume Pipeline
│   └── validator.py          # Response validation logic
├── scraper/
│   ├── __init__.py
│   └── extractor.py          # LangChain + Ollama job extraction chain
├── tests/
│   └── test_pdf_pipeline.py  # Smoke tests for pdf/ modules
└── frontend/                 # Next.js Application
    └── src/
        ├── app/
        │   ├── page.tsx      # Main UI page
        │   ├── layout.tsx
        │   └── globals.css   # Dark glassmorphism styles
        ├── components/
        │   ├── JobCard.tsx           # Job result display component
        │   └── ResumeGenerator.tsx   # Bullet generator + PDF download button
        ├── lib/
        │   └── api.ts        # Frontend API client (scrape, generateResume, downloadResumePdf)
        └── types/
            └── job.ts        # TypeScript type definitions
```

## PDF Security Model

| Constraint | How Enforced |
|---|---|
| LLM never writes LaTeX | Only pre-approved `{{PLACEHOLDER}}` slots exist in the static template |
| No LaTeX injection | Whitelist of allowed placeholder keys — unknown keys silently ignored |
| `-no-shell-escape` | Hard-coded in the pdflatex subprocess command |
| Hard timeout | 15-second wall-clock limit via `subprocess.run(timeout=15)` |
| No persistent files | `tempfile.TemporaryDirectory` — auto-deleted on success and error |
| Thread-safe | Each request owns its own temp dir; template cache uses a `threading.Lock` |
| Async-safe | `compile_latex` is offloaded via `asyncio.to_thread` |

## Running Tests

```bash
cd /path/to/Project
source .venv/bin/activate
python tests/test_pdf_pipeline.py
```

Expected output:
```
Running pdf pipeline smoke tests...

  PASS  sanitize()
  PASS  sanitize_bullet_list()
  PASS  render_template()
  PASS  unknown placeholder ignored
  PASS  router has /generate-resume-pdf

All tests passed.
```

## Troubleshooting

| Error | Fix |
|---|---|
| `pdflatex binary not found` | Install BasicTeX. On macOS, the backend automatically locates `/Library/TeX/texbin`, so manual PATH setup is no longer required. |
| `LaTeX compilation failed` | Run `sudo tlmgr install enumitem titlesec hyperref parskip lm` to install missing packages |
| `BrowserType.launch: Executable doesn't exist` | Run `playwright install chromium` inside your venv |
| PDF download button doesn't appear | Generate resume bullets first — the button only shows after a successful `/generate-resume` call |
| `500 Internal Server Error` on `/generate-resume-pdf` | Check FastAPI logs — the error message includes the first LaTeX error line |

