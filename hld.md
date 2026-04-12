# High-Level Design (HLD) - Job Info Extractor & ATS Generator

## 1. System Overview
The system is a full-stack, AI-driven web application that allows users to paste a job listing URL from platforms like Greenhouse or Lever, parse it into structured JSON data, and sequentially run an AI pipeline to generate strictly formatted, ATS-compliant resume experience bullet points based on the user's specific technical skills.

## 2. Architecture Pattern
The application uses a **Client-Server Architecture** heavily decoupled into three primary execution areas:
- **Client (Frontend)**: Next.js 15 (React) providing the UI.
- **API Control Layer (Backend)**: FastAPI mediating logic between crawlers and AI.
- **Local AI Engine**: Ollama running local LLMs and embeddings isolated from business logic.

## 3. High-Level Components

### A. Frontend System (Next.js)
- **Job Submission UI**: Receives raw web URLs and handles loading states.
- **Job Card Rendering**: Generates tags and clean visual blocks of parsed job schemas (`title`, `requirements`, etc.).
- **ATS Resume Generator**: An isolated React subsystem embedded on successful parsing, capturing candidate skills, and updating state sequentially as RAG injections complete.

### B. Backend Scraping System (Python + BeautifulSoup/Playwright)
- **Static Extractor**: Uses `requests` and `BeautifulSoup4` for lightweight html stripping.
- **JS Render Fallback**: Uses `playwright` for dynamically rendered sites.
- **LangChain Extractor**: A secondary extraction pipeline binding Ollama to cleanly pull structured requirements and company logic from raw text bypassing raw scraping unreliability.

### C. Modular AI Generation System (Python)
- **Data Ingestion**: Takes raw text and arrays from the frontend and scraping bounds.
- **RAG & Context Manager**: Embeddings-based matching to fetch the most applicable context.
- **Text Generation Wrapper**: Securely packages queries, talks to Ollama models, validates schema formatting, handles retries, and returns final payload.

## 4. System Data Flow

<div align="center">
  <img src="https://kroki.io/mermaid/svg/eNqNUdtOg0AQffcrNvlQW-IDL7UxMdpEDX2w8WGz0F1gmYVldgE1_XdnQYs16YPNvXNm5sxZOCM6aI4mB6G0d4JpW0Fm0g_KOCzttQk6qJkQZl1Yn1E-iYQ_z-4O1o5xSg98D65nF1A7oSE4d232c-35gO_gS4j0Bv4tPIMX8BSGz10v2aQ4Q011O68_uA_xPtwP8T7cj_E-3E_xfrzX1uR0l0D9s5yH8D7CD_E-wg_xPsKP8T7CvxvvI_-7Rfkj2k9L5L2cRof82vF2U7n6K1Z92BWe7K7v_w2l3Tj7gH80A2m-I64i60b-8E81U1lOcpJ5O8A6n1WfE4mKzEYqOcltXqX2R1tL-iA8jA4K4wF3R62YqV021jI_PZlRkX3eF6Pj6U0qR_L32V6R140bZ1Vey0c9Ew0P9H2vBXX1xXJ9A54H2uM=" alt="HLD Component Diagram" />
</div>

## 5. Technology Stack
- **Frontend Framework**: Next.js (App Router), React, Vanilla CSS.
- **Backend Framework**: Python 3.10+, FastAPI, Uvicorn.
- **Crawlers**: BeautifulSoup4, Playwright.
- **AI Tooling**: LangChain, Local Ollama (`deepseek-coder:1.3b` + `nomic-embed-text`).
