"""
pdf/sanitizer.py
────────────────
Escapes LaTeX special characters in any user- or AI-generated string.

Characters that must be escaped (and their LaTeX equivalents):
  &  →  \\&
  %  →  \\%
  $  →  \\$
  #  →  \\#
  _  →  \\_
  {  →  \\{
  }  →  \\}
  ~  →  \\textasciitilde{}
  ^  →  \\textasciicircum{}
  \\  →  \\textbackslash{}

Implementation note
───────────────────
A *single-pass* ``re.sub`` is used so that replacement strings are never
re-scanned by subsequent rules.  A naive sequential ``str.replace`` approach
would double-escape the ``{`` and ``}`` braces introduced by, e.g.,
``\\textbackslash{}``.
"""

import re
from typing import Union


# Maps each special character to its LaTeX escape sequence.
_CHAR_MAP: dict[str, str] = {
    "\\":  r"\textbackslash{}",
    "&":   r"\&",
    "%":   r"\%",
    "$":   r"\$",
    "#":   r"\#",
    "_":   r"\_",
    "{":   r"\{",
    "}":   r"\}",
    "~":   r"\textasciitilde{}",
    "^":   r"\textasciicircum{}",
}

# Compile once at import time — order doesn't matter because re.sub is
# single-pass: every input character is matched at most once.
_ESCAPE_RE = re.compile(
    "[" + re.escape("".join(_CHAR_MAP.keys())) + "]"
)


def _replace_char(match: re.Match) -> str:  # type: ignore[type-arg]
    return _CHAR_MAP[match.group(0)]


def sanitize(text: Union[str, None]) -> str:
    """
    Escape all LaTeX special characters in *text*.

    Uses a single-pass regex substitution to prevent double-escaping.

    Args:
        text: Raw string from user / AI output.

    Returns:
        LaTeX-safe string, or an empty string when *text* is None / empty.
    """
    if not text:
        return ""
    return _ESCAPE_RE.sub(_replace_char, str(text))


def sanitize_bullet_list(items: list[str]) -> str:
    r"""
    Convert a list of plain-text strings into LaTeX ``\item`` lines.

    Each item is individually sanitized before wrapping.

    Args:
        items: A list of bullet text strings.

    Returns:
        Multi-line string of ``\item …`` entries ready for an
        ``itemize`` environment.

    Example::

        >>> sanitize_bullet_list(["Led team of 5", "Increased revenue by 30%"])
        '\\item Led team of 5\n\\item Increased revenue by 30\\%'
    """
    if not items:
        return r"\item No experience points provided."

    lines = [rf"\item {sanitize(item.strip())}" for item in items if item.strip()]
    return "\n".join(lines)
