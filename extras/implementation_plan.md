# ATS Score Feature — Implementation Plan

The user wants an **ATS (Applicant Tracking System) compatibility score** built into the **Preview Resume page (`ReviewWorkspace.tsx`)**. This allows the user to check the score of their *drafted/staged* resume against the job description, enabling them to make live edits and re-check the score before downloading the final PDF.

---

## How the Score Is Calculated

The score is computed on the **backend** using a deterministic, weighted rubric (no LLM call for the scoring itself, ensuring instant responses):

| Dimension | Weight | What's measured |
|---|---|---|
| **Keyword Match** | 40% | % of JD keywords found in the staged skills, experience bullets, and project descriptions |
| **Skills Coverage** | 25% | Candidate's staged skills vs. required skills extracted from the JD |
| **Title / Role Alignment** | 15% | Substring match between candidate's staged job titles and the target role |
| **Section Completeness** | 20% | Presence of summary, experience, education, projects, skills in the drafted resume |

Final score → 0–100. Displayed as a percentage with a letter grade (A / B / C / D / F) or a colored ring.

---

## User Flow

```
ReviewWorkspace (Preview Resume Page)
  ├─ [Left Panel] Editor fields
  ├─ [Right Panel] PDF Preview
  └─ [Top Bar] [Cancel] | [Check ATS Score] (NEW) | [Recompile] | [Download PDF]

User clicks [Check ATS Score]
  → POST /api/ats/score (sends the *staged* resume data + job description)
  → An inline ATS Score section expands at the top of the Left Editor Panel.
  → Shows:
       • Animated score ring + letter grade
       • 4 dimension bars (keyword, skills, title, completeness)
       • Matched keywords (green chips)
       • Missing keywords (red chips)
       • Suggested Keywords (clickable to automatically add to skills)
       • Suggested Job Titles (clickable to apply to Professional Summary or Experiences)
       • Improvement tips
  → A [×] close button hides the result.

The user can then click to add keywords or titles, or edit their experience bullets to include missing keywords. A red dot appears on the ATS Score button when relevant fields change, prompting a re-score.
```

---

## Implemented Changes

### Backend — `ai/ats_scorer.py`

A new self-contained scoring module:

- **`ATSScorer.score(staged_data, job_description) → ATSResult`**
- Reuses the existing **`KeywordExtractor`** to extract JD keywords via LLM.
- Reuses the existing **`SkillMatcher`** for skill intersection logic.
- Compiles the *staged* candidate corpus: staged skills + staged experience bullets + staged project bullets + staged profile summary.
- **Returns** a structured `ATSResult` dataclass:
  ```python
  overall_score: int       # 0-100
  keyword_score: int       # 0-100
  skill_score: int         # 0-100
  title_score: int         # 0-100
  completeness_score: int  # 0-100
  matched_keywords: List[str]
  missing_keywords: List[str]
  tips: List[str]
  suggested_titles: List[str]
  ```

---

### Backend — `main.py`

Added a new endpoint for ATS scoring:

#### `POST /api/ats/score`
- **Request body**:
  ```json
  {
    "job_input": "URL or raw job description text",
    "resume_data": {
      "profile": {...},
      "experiences": [...],
      "projects": [...],
      "educations": [...],
      "skills": [...]
    }
  }
  ```
- **Auth**: JWT required.
- If `job_input` is a URL, uses the scraper to fetch the text.
- Passes the `resume_data` and job text directly to `ATSScorer.score()`.
- Returns `ATSResult` as JSON.

---

### Frontend — `app/dashboard/page.tsx`

- Passes the `url` (the job description/URL state) down to `<ReviewWorkspace>` as a new prop: `targetJobInput={url}`.
- Re-renders PDF preview intelligently while keeping the dirty-state robust.

---

### Frontend — `components/vault/ReviewWorkspace.tsx`

1. **State:** Added `atsStatus` (`'idle' | 'loading' | 'error'`) and `atsResult` (`ATSResult | null`), plus `isAtsDirty` to track stale scores.
2. **Top Bar:** Added a **"Check ATS Score"** button next to the "Recompile" button, complete with a red indicator dot when relevant state (skills, bullets, summary) has changed.
3. **Left Editor Panel UI:** 
   - Render an inline ATS Score Panel at the top of the scrollable left pane.
   - **Interactive Keyword Suggestions:** Added a section allowing users to click missing keywords to directly add them to their Skills list.
   - **Interactive Title Suggestions:** Added a dropdown for users to seamlessly insert suggested titles into their "Professional Summary" or specific "Experience" entries.
4. **Logic:** Auto-runs ATS on component mount if a job description is provided.

---

### Frontend — `types/ats.ts`

Created a shared TypeScript type file:
```ts
export interface ATSResult {
  overall_score: number;
  keyword_score: number;
  skill_score: number;
  title_score: number;
  completeness_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  tips: string[];
  suggested_titles?: string[];
}
```
