# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies:
# - texlive-latex-base and related for PDF generation
# - system libraries required by Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install Playwright browser (Chromium) and its local dependencies
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy project
COPY . /app/

# Expose the port the app runs on
EXPOSE 8000

# Command to run on startup: Run migrations then start the server
CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000
