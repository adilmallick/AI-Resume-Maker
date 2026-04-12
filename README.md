# 🔍 Job Info Extractor

AI-powered job scraper and resume bullet generator using **LangChain + Ollama (deepseek-coder:1.3b)** backend and a **Next.js + TypeScript** frontend.

## Stack

| Layer     | Technology                             |
|-----------|----------------------------------------|
| LLM       | Ollama — `deepseek-coder:1.3b`         |
| Embedder  | Ollama — `nomic-embed-text`            |
| RAG       | Dependency-free Cosine Similarity      |
| Chains    | LangChain (`langchain-ollama`)         |
| Backend   | Python — FastAPI + Uvicorn             |
| Frontend  | Next.js 15 + TypeScript                |
| Parsing   | BeautifulSoup4 + custom JSON extractor |

## Prerequisites

1. **Python 3.10+** and `pip`
2. **Node.js 18+** and `npm` (installed via nvm)
3. **Ollama** (Local AI Model Runner)

## Setup & Run

### 0 — Ollama Setup

Ollama is required to run the local AI models for this project.

1. **Install Ollama**: Download and install it from [https://ollama.com/download](https://ollama.com/download).
2. **Start Ollama Service**: Ensure the Ollama service is running in the background before continuing.
   - *macOS/Windows*: Launch the Ollama app (look for the icon in your menu bar/system tray).
   - *Linux/Terminal*: Run `ollama serve` in a dedicated terminal.
3. **Pull Models**: Open a terminal and pull the required models:
   ```bash
   ollama pull deepseek-coder:1.3b
   ollama pull nomic-embed-text
   ```
4. **Run the Model (Optional)**: Start an interactive session to ensure the model runs correctly:
   ```bash
   ollama run deepseek-coder:1.3b
   ```

### 1 — Backend

```bash
cd /Users/adil/Desktop/Project

# Create virtual env
python3 -m venv .venv
source .venv/bin/activate

# Install deps
pip install -r requirements.txt

# Start API server (port 8000)
uvicorn main:app --reload --port 8000
```

### 2 — Frontend

```bash
cd /Users/adil/Desktop/Project/frontend

# Install dependencies
npm install

# Start dev server (port 3000)
npm run dev
```

### 3 — Open App

Visit `http://localhost:3000`, paste a job listing URL, and click **Extract Job Info ⚡**. Afterward, enter your skills to spawn ATS-Optimized resume bullet points.

## API Endpoints

| Method | Path               | Description                               |
|--------|--------------------|-------------------------------------------|
| GET    | `/health`          | Check API + model status                  |
| POST   | `/scrape`          | `{"url": "..."}` → structured job         |
| POST   | `/generate-resume` | `{"job_url": "...", "skills": []}` → JSON |

## Project Structure

```text
Project/
├── main.py                  # FastAPI server with application endpoints
├── requirements.txt         # Python dependencies
├── ai/                      # Modular AI Pipeline
│   ├── interfaces/          # Abstractions for LLMs and Vector Stores
│   ├── llm/                 # Ollama integration handlers
│   ├── rag/                 # Embeddings, Vector Store, and Retriever
│   ├── pipeline.py          # E2E Resume Pipeline
│   └── validator.py         # Response validation logic
├── scraper/
│   ├── __init__.py
│   └── extractor.py         # LangChain + Ollama job extraction chain
└── frontend/                # Next.js Application
    └── src/
        ├── app/
        │   ├── page.tsx     # Main UI page
        │   ├── layout.tsx
        │   └── globals.css  # Dark glassmorphism styles
        ├── components/
        │   ├── JobCard.tsx  # Job result display component
        │   └── ResumeGenerator.tsx # RAG Generator UI for resume bullets
        ├── lib/
        │   └── api.ts       # Frontend API client utilities
        └── types/
            └── job.ts       # TypeScript type definitions
```
# AI-Resume-Maker
# AI-Resume-Maker
