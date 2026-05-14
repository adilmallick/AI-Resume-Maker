# Implementation Plan: Editable Resume Templates & Generated Output

This plan outlines how to enable users to customize the visual appearance of their resumes (templates) and edit the raw generated output (LaTeX) without breaking the existing data pipeline.

## 1. Core Objectives
*   **Visual Template Customization:** Allow non-technical users to change styles (fonts, margins, layout order) via a UI.
*   **Raw Source Editing (Advanced Mode):** Allow technical users to directly edit the generated LaTeX source code before compiling the final PDF.
*   **Live Preview:** Provide a side-by-side live preview of the PDF as the user makes changes to the data, styles, or raw code.

---

## 2. Architecture & Data Flow Updates

### Current Flow
Data (Vault) -> `generate_resume_pdf` (Injects data into static LaTeX string) -> `pdflatex` -> PDF returned.

### Proposed Flow
We will split the PDF generation into two distinct steps to allow interception and editing:
1.  **Data -> LaTeX Compilation:** `generate_latex_source(data, template_settings)` -> returns raw `.tex` string.
2.  **LaTeX -> PDF Compilation:** `compile_pdf(latex_string)` -> returns PDF file.

---

## 3. Step-by-Step Implementation

### Phase 1: Backend Refactoring & New Endpoints (FastAPI)
1.  **Extract LaTeX Generation:**
    *   Refactor `pdf/router.py` and `pdf/template_engine.py` to separate the LaTeX string generation from the `pdflatex` compilation step.
    *   Create a function `build_latex_source(request_data, template_config)` that returns a raw string.
2.  **Create New API Endpoints:**
    *   `POST /api/pdf/preview-latex`: Accepts resume data and returns the raw compiled `.tex` string (used to populate the code editor).
    *   `POST /api/pdf/compile-raw`: Accepts a raw `.tex` string (from the advanced editor) and runs it through `pdflatex`, returning the streaming `application/pdf`.

### Phase 2: Visual Template Engine (Backend & Frontend)
1.  **Backend Template Configurations:**
    *   Update the static LaTeX template to accept dynamic variables for styling (e.g., `\newcommand{\docfontsize}{11pt}`, `\newcommand{\docfontfamily}{sans-serif}`).
    *   Define a Pydantic schema `TemplateConfig` (font family, font size, accent color, section spacing).
2.  **Frontend Design Controls:**
    *   Create a `TemplateSettings.tsx` component in the Vault dashboard (e.g., a sidebar or a "Design" tab).
    *   Add UI controls (dropdowns, color pickers) for the configuration options.

### Phase 3: Advanced "Source Code" Editor (Frontend)
1.  **Integrate Code Editor:**
    *   Install `@monaco-editor/react` (the editor that powers VS Code) in the Next.js frontend.
    *   Create a `LaTeXEditor.tsx` component with syntax highlighting for LaTeX.
2.  **State Management:**
    *   Add a toggle switch: "Visual Editor" vs. "Advanced Mode (LaTeX)".
    *   When switching to Advanced Mode, fetch the raw `.tex` string from `/api/pdf/preview-latex` and populate the Monaco editor.
    *   *Note:* Warn the user that manual edits in Advanced Mode cannot be synced back to the visual Vault fields (one-way sync).

### Phase 4: Live PDF Preview Integration
1.  **PDF Viewer Component:**
    *   Use an `<iframe>` or `react-pdf` to display the generated PDF alongside the editor.
2.  **Debounced Compilation:**
    *   Implement a debounce (e.g., 1000ms) on user input (either in the Vault or in the Monaco editor).
    *   When the debounce triggers, send the data (or raw LaTeX) to the backend and update the PDF viewer blob URL silently.

---

## 4. Edge Cases & Considerations
*   **Security:** Ensure the backend `pdflatex` compilation process is isolated and sanitizes input (e.g., preventing shell escapes like `\write18` in user-submitted LaTeX). The `-no-shell-escape` flag must be strictly enforced.
*   **State Conflict:** If a user edits the raw LaTeX and then switches back to the Vault UI to change a job title, their custom LaTeX edits will be overwritten when the source is regenerated. A clear warning modal should be implemented when entering Advanced Mode.
