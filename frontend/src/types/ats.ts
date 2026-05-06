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
