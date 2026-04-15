"""
pdf/generator.py
────────────────
Compiles a LaTeX source string into a PDF using ``pdflatex``.

Security & sandboxing guarantees
──────────────────────────────────
* ``-no-shell-escape``  — shell commands inside TeX source are disabled.
* ``-interaction=nonstopmode`` — never waits for user input.
* All files are written to a per-call ``tempfile.TemporaryDirectory`` that is
  automatically cleaned up on success **and** failure.
* A hard 15-second ``timeout`` is enforced via ``subprocess.run``.
* No network calls, no persistent filesystem writes.
* Designed to work inside a read-only Docker container (only /tmp is written).

Thread safety
─────────────
Each call gets its own isolated temporary directory; there is no shared
mutable state at module level.
"""

import logging
import os
import subprocess
import tempfile
import shutil
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────
PDFLATEX_TIMEOUT_SECONDS: int = 15
PDFLATEX_BINARY: str = shutil.which("pdflatex") or shutil.which("pdflatex", path="/Library/TeX/texbin") or "pdflatex"

# pdflatex is run twice to resolve page-number / reference cross-links.
# For a resume this is usually unnecessary, but costs very little extra time
# and prevents the occasional blank-page bug with titlesec/hyperref.
_PDFLATEX_RUNS: int = 2


@dataclass(frozen=True)
class CompilationError(Exception):
    """
    Raised when pdflatex exits with a non-zero status or the PDF is absent.

    Attributes:
        returncode: Exit code returned by the pdflatex process.
        stdout:     Captured standard output.
        stderr:     Captured standard error.
        message:    Human-readable summary.
    """

    returncode: int
    stdout: str
    stderr: str
    message: str

    def __str__(self) -> str:  # pragma: no cover
        return self.message


def compile_latex(latex_source: str) -> bytes:
    """
    Compile *latex_source* into a PDF and return its raw bytes.

    The compilation happens entirely inside a temporary directory that is
    deleted when this function returns — on both the happy path and on error.

    Args:
        latex_source: Complete, valid LaTeX document source.

    Returns:
        Raw PDF bytes ready to be streamed to the client.

    Raises:
        CompilationError: If pdflatex fails or the output PDF is missing.
        FileNotFoundError: If ``pdflatex`` is not installed / not on PATH.
    """
    with tempfile.TemporaryDirectory(prefix="resume_pdf_") as tmpdir:
        tex_path = Path(tmpdir) / "resume.tex"
        pdf_path = Path(tmpdir) / "resume.pdf"

        # Write the LaTeX source (UTF-8 so international chars survive)
        tex_path.write_text(latex_source, encoding="utf-8")

        # Build the pdflatex command.
        # -halt-on-error  → exit immediately on the first LaTeX error instead
        #                   of trying to continue; combined with nonstopmode
        #                   this gives us a reliable non-zero exit code.
        cmd = [
            PDFLATEX_BINARY,
            "-interaction=nonstopmode",
            "-no-shell-escape",
            "-halt-on-error",
            "-output-directory", tmpdir,
            str(tex_path),
        ]

        # Build the environment — inherit PATH but strip anything that could
        # allow shell expansion or network access from within TeX.
        env = _build_safe_env(tmpdir)

        for run_index in range(1, _PDFLATEX_RUNS + 1):
            logger.info("pdflatex run %d/%d", run_index, _PDFLATEX_RUNS)
            result = _run_pdflatex(cmd, tmpdir, env)

            if result.returncode != 0:
                stdout = result.stdout or ""
                stderr = result.stderr or ""
                # Surface the last meaningful error line from pdflatex output
                error_hint = _extract_error_hint(stdout)
                logger.error(
                    "pdflatex failed (run %d, rc=%d): %s",
                    run_index,
                    result.returncode,
                    error_hint,
                )
                raise CompilationError(
                    returncode=result.returncode,
                    stdout=stdout,
                    stderr=stderr,
                    message=f"LaTeX compilation failed: {error_hint}",
                )

        if not pdf_path.exists():
            raise CompilationError(
                returncode=0,
                stdout="",
                stderr="",
                message="pdflatex exited cleanly but the PDF file was not created.",
            )

        pdf_bytes = pdf_path.read_bytes()
        logger.info("PDF compiled successfully (%d bytes)", len(pdf_bytes))
        return pdf_bytes


# ── Internal helpers ───────────────────────────────────────────────────────

def _run_pdflatex(
    cmd: list[str],
    cwd: str,
    env: dict[str, str],
) -> subprocess.CompletedProcess:
    """
    Execute the pdflatex command with a hard wall-clock timeout.

    ``subprocess.TimeoutExpired`` is intentionally allowed to propagate so
    the router can catch it and return an appropriate HTTP 500.
    """
    return subprocess.run(
        cmd,
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        timeout=PDFLATEX_TIMEOUT_SECONDS,
    )


def _build_safe_env(output_dir: str) -> dict[str, str]:
    """
    Build a minimal environment for pdflatex.

    We keep PATH and TEXMFHOME (needed by TeX Live / MiKTeX to find its
    package tree) but strip everything else to reduce the attack surface.
    Docker containers typically only have the essentials anyway.
    """
    safe_env: dict[str, str] = {}

    for key in ("PATH", "HOME", "TEXMFHOME", "TEXMFCNF", "TMPDIR", "TMP", "TEMP"):
        value = os.environ.get(key)
        if value:
            safe_env[key] = value

    # Add common macOS pdflatex paths to PATH to ensure pdflatex can locate its dependencies
    current_path = safe_env.get("PATH", "")
    paths = current_path.split(os.pathsep) if current_path else []
    for p in ("/Library/TeX/texbin", "/usr/texbin"):
        if p not in paths:
            paths.append(p)
    safe_env["PATH"] = os.pathsep.join(paths)

    # Point TeX's aux-file output to our temp dir (belt-and-suspenders)
    safe_env["TEXMFOUTPUT"] = output_dir

    return safe_env


def _extract_error_hint(stdout: str) -> str:
    """
    Extract the first ``! …`` error line from pdflatex stdout.

    pdflatex signals errors with lines that start with ``!``.
    We surface the first one as the human-readable hint.
    """
    for line in stdout.splitlines():
        stripped = line.strip()
        if stripped.startswith("!"):
            return stripped
    return "Unknown LaTeX error — check server logs for full output."
