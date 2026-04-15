"""
tests/test_pdf_pipeline.py
──────────────────────────
Smoke-tests for all modules in the pdf/ package.
Run with: .venv/bin/python tests/test_pdf_pipeline.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from pdf.sanitizer import sanitize, sanitize_bullet_list
from pdf.template_engine import render_template
from pdf.router import router

def test_sanitizer():
    # Basic special-character escaping
    assert sanitize("Hello & World")       == r"Hello \& World",         "& failed"
    assert sanitize("50% done")            == r"50\% done",              "% failed"
    assert sanitize("price $10")           == r"price \$10",             "$ failed"
    assert sanitize("file_name")           == r"file\_name",             "_ failed"
    assert sanitize("key#1")               == r"key\#1",                 "# failed"
    assert sanitize("{block}")             == r"\{block\}",              "{} failed"
    assert sanitize("x~y")                == r"x\textasciitilde{}y",    "~ failed"
    assert sanitize("x^2")                == r"x\textasciicircum{}2",   "^ failed"
    # Backslash must be escaped FIRST (no double-escaping)
    assert sanitize("back\\slash")        == r"back\textbackslash{}slash", "\\ failed"
    # Edge cases
    assert sanitize(None) == ""
    assert sanitize("")   == ""
    assert sanitize("   ") == "   "
    print("  PASS  sanitize()")

def test_bullet_list():
    items   = ["Led team of 5 engineers", "Increased revenue by 30%", "  "]
    result  = sanitize_bullet_list(items)
    assert r"\item Led team of 5 engineers" in result, "bullet 1 missing"
    assert r"\item Increased revenue by 30\%" in result, "bullet 2 (sanitized) missing"
    # Blank/whitespace-only items should be stripped
    assert result.count(r"\item") == 2, f"expected 2 items, got: {result}"
    print("  PASS  sanitize_bullet_list()")

def test_template_render():
    data = {
        "CANDIDATE_NAME":     "Jane Doe",
        "CANDIDATE_EMAIL":    "jane@example.com",
        "CANDIDATE_PHONE":    "+1 555-1234",
        "CANDIDATE_LOCATION": "NYC",
        "SUMMARY":            "Experienced engineer.",
        "JOB_TITLE":          "Senior Engineer",
        "JOB_DATE_RANGE":     "2020-Present",
        "COMPANY_NAME":       "Acme Corp",
        "JOB_LOCATION":       "Remote",
        "EXPERIENCE_POINTS":  r"\item Built scalable APIs",
        "SKILLS_LIST":        "Python, FastAPI",
        "DEGREE":             "BSc CS",
        "EDUCATION_DATE_RANGE": "2016-2020",
        "INSTITUTION":        "MIT",
    }
    rendered = render_template(data)

    # All placeholders should be replaced
    assert "{{CANDIDATE_NAME}}"  not in rendered, "CANDIDATE_NAME placeholder not replaced"
    assert "{{EXPERIENCE_POINTS}}" not in rendered, "EXPERIENCE_POINTS not replaced"
    # Values should be present
    assert "Jane Doe" in rendered, "Name not in output"
    assert r"\item Built scalable APIs" in rendered, "Bullet not in output"
    # Template caching: second call should return same content
    rendered2 = render_template(data)
    assert rendered == rendered2, "Cache inconsistency"
    print("  PASS  render_template()")

def test_unknown_placeholder_ignored():
    """Keys not in ALLOWED_PLACEHOLDERS should be silently ignored (no injection)."""
    data = {
        "CANDIDATE_NAME": "Test User",
        "INJECTED_KEY": r"\write18{rm -rf /}",   # attempted injection via unknown key
    }
    from pdf.template_engine import ALLOWED_PLACEHOLDERS
    assert "INJECTED_KEY" not in ALLOWED_PLACEHOLDERS, "INJECTED_KEY should not be allowed"
    rendered = render_template(data)
    assert r"\write18" not in rendered, "Injection made it into output!"
    print("  PASS  unknown placeholder ignored")

def test_router_registered():
    paths = [r.path for r in router.routes]
    assert "/generate-resume-pdf" in paths, f"Route missing. Got: {paths}"
    print("  PASS  router has /generate-resume-pdf")

if __name__ == "__main__":
    print("Running pdf pipeline smoke tests...\n")
    test_sanitizer()
    test_bullet_list()
    test_template_render()
    test_unknown_placeholder_ignored()
    test_router_registered()
    print("\nAll tests passed.")
