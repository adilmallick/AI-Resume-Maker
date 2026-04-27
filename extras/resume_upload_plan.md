# Upload and Scrape Resume Data

This plan outlines the architecture for allowing users to upload an existing resume (PDF format), extracting the raw text from the file, and leveraging our existing LLM pipeline to structure the data (experience, education, skills, projects) and save it directly into the user's Vault.

## User Review Required

> [!TIP]
> **Provider Support**: We will support both **Groq API** and **Local Ollama**. If Groq is configured, it will provide near-instant extraction. If not (or if explicitly selected), it will fallback to the local Ollama model, which may take 15-30+ seconds.

> [!IMPORTANT]  
> **Preview Step**: Instead of saving the data automatically, the backend will return the extracted data to the frontend. The frontend will present a **Preview Screen** where the user can review the data and then explicitly confirm to save it (and choose whether to Append or Overwrite).

## Open Questions

- None at the moment. All previous questions have been resolved (DOCX supported, Preview step added, Append/Overwrite handled at the Preview step).

## Proposed Changes

### Backend Logic

#### [MODIFY] `requirements.txt`
- Add `pypdf` (or `pdfplumber`) for PDF extraction.
- Add `python-docx` for `.docx` extraction.

#### [NEW] `api/routers/resume_upload.py` (or modify `api/routers.py`)
- Implement a `POST /vault/extract` endpoint using FastAPI's `UploadFile`.
- **Workflow**:
  1. Receive PDF or DOCX file.
  2. Extract raw text based on the file extension.
  3. Send raw text to the **LLM Pipeline**.
  4. Parse the LLM's JSON response using Pydantic.
  5. Return the structured JSON to the frontend **without saving it to the database**.
- Implement a `POST /vault/save-extracted` endpoint.
  1. Receives the validated JSON payload from the frontend after the user reviews it, along with a `strategy` flag (`append` or `overwrite`).
  2. Saves the records to `UserExperience`, `UserEducation`, `UserSkill`, and `UserProject` tables.

#### [NEW] `ai/resume_parser.py`
- Create a dedicated LangChain pipeline for taking unstructured text and extracting structured user vault details.
- **Provider Support**: Abstract the LLM initialization so it can dynamically use `ChatGroq` (if an API key is present) or fallback to `ChatOllama` (using the local `deepseek-coder` or similar model).
- Define a strict Pydantic model (`ResumeExtractionSchema`) to ensure the LLM returns data that perfectly maps to our database fields.

### Frontend Logic

#### [MODIFY] `frontend/src/app/dashboard/page.tsx`
- Add an "Upload Resume" button to the Vault interface.
- Implement an `<input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />` triggered by the button.
- Add an uploading and parsing state (e.g., a spinner with text like "AI is analyzing your resume...").
- **API Call**: Send the file via `FormData` to `/vault/extract`.
- **Preview Screen (New UI Component)**: 
  - Once the backend returns the parsed data, display a Review UI showing the extracted Education, Experience, Skills, and Projects.
  - Provide a final "Save to Vault" button alongside a choice to "Append to existing data" or "Overwrite existing data".
  - When confirmed, send the final payload to `/vault/save-extracted`.
- Once successfully saved, trigger a refresh of the Vault data to display the newly imported items.

## Verification Plan

### Automated Tests
- Test the text extraction on a sample PDF to ensure accurate text layout reading.
- Validate the LangChain prompt with sample text to ensure the JSON output strictly adheres to the schema.
- Test the API endpoint using standard test client requests.

### Manual Verification
- Upload a complex PDF resume via the frontend Vault.
- Verify the frontend loading state persists until the backend finishes.
- Check the Vault UI afterward to ensure Education, Experience, Skills, and Projects are populated correctly.
