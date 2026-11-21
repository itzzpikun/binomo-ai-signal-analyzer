FROM python:3.11-slim

LABEL maintainer="Binomo AI Signal Analyzer"
LABEL description="Python Flask AI analysis engine — technical indicators + signal generation"

# Non-root user for security
RUN groupadd -r aiengine && useradd -r -g aiengine aiengine

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Ownership
RUN chown -R aiengine:aiengine /app
USER aiengine

EXPOSE 8000

ENV FLASK_ENV=production
ENV FLASK_PORT=8000
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120", "--access-logfile", "-", "app:app"]
