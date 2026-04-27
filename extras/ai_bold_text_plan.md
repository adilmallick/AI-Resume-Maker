# AI Bold Text Generation Implementation Plan

The goal is to instruct the AI pipeline to automatically highlight key technical skills and metrics using rich text tags so they stand out in the ATS and compile natively into the LaTeX PDF, while displaying correctly in the frontend TipTap editor.

## Proposed Changes

Because we recently updated the backend `sanitizer.py` to support HTML tags (like `<b>`), we simply need to update the AI's generation prompt to output these tags. Since the frontend uses TipTap, returning HTML tags (`<b>`) is safer than Markdown (`**`) because TipTap will natively parse and display the `<b>` tags as visually bold text immediately when the staged bullets load.

### 1. Update the AI Prompt Builder
**[MODIFY] `ai/prompt_builder.py`**
- We will modify the master prompt template within the `build()` method.
- **For TASK 3 (Experiences):**
  Add a specific bullet point to the formatting rules:
  `- IMPORTANT: Highlight key technical skills, tools, and metrics by wrapping them in HTML bold tags (e.g., "built with <b>AWS</b>", "reduced latency by <b>40%</b>").`
- **For TASK 4 (Projects):**
  Add a similar bullet point:
  `- IMPORTANT: Wrap all technical frameworks, languages, and key metrics in HTML bold tags (e.g., <b>React</b>, <b>Node.js</b>).`

### 2. Validation Check
**[NO CHANGE REQUIRED] `ai/validator.py`**
- The current `OutputValidator` only extracts the JSON structure and ensures the `bullets` arrays contain strings. It does not strip HTML or special characters, so the `<b>` tags will safely pass through to the frontend.

## Open Questions

> [!IMPORTANT]
> 1. Should we restrict the bolding *only* to technical skills (e.g., **Python**, **AWS**), or do you also want the AI to bold impressive metrics and numbers (e.g., **40% increase**, **$2M revenue**)? 
> 2. Are you okay with using `<b>` tags instead of `**`? (Using `<b>` ensures the TipTap editor on the frontend immediately renders it as bold text rather than showing the raw asterisks).

## Verification Plan

### Automated Tests
- Run a local generation test through Uvicorn using the `/generate-resume` endpoint.
- Verify the raw JSON output contains `<b>...</b>` around known skills.

### Manual Verification
- Submit a target job URL in the frontend Dashboard.
- Wait for the AI staging area to populate.
- Confirm that the skills in the Experience and Project bullet points visually appear **bold** in the TipTap editor.
- Click "Generate PDF" and verify the LaTeX compiles successfully with `\textbf{}` highlighting.
