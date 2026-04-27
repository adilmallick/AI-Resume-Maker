# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Tell Playwright where to store browsers inside the container
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install ALL system dependencies in a single layer:
#   - texlive packages for pdflatex PDF generation
#   - Chromium runtime libs (replaces `playwright install-deps` which
#     fails on slim due to unavailable font packages like ttf-unifont)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # ── LaTeX / PDF ───────────────────────────────────────
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    # ── Chromium system libraries ─────────────────────────
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    # ── Fonts (available in Debian slim) ─────────────────
    fonts-liberation \
    fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium browser binary only
# (system deps already installed above — skip install-deps)
RUN playwright install chromium

# Copy project
COPY . /app/

# Expose the port the app runs on
EXPOSE 8000

# Command to run on startup: Run migrations then start the server
CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000
