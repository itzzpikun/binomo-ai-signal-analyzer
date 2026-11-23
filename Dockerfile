# Single-service Dockerfile: Python Flask serves frontend + API
FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── Python runtime ──
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY ai-engine/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python application code
COPY ai-engine/ ./

# Copy built frontend into static/
COPY --from=frontend-builder /build/dist/ ./static/

# Environment
ENV PORT=10000

EXPOSE 10000

# Start with gunicorn for production reliability
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-10000} --workers 2 --timeout 120 --access-logfile - app:app"]
