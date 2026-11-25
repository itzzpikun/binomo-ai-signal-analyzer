FROM node:20-bookworm-slim

# Install Python 3 and venv
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all project files
COPY . .

# Setup Python AI Engine in virtual environment
RUN python3 -m venv /app/ai-engine/venv && \
    /app/ai-engine/venv/bin/pip install --no-cache-dir -r /app/ai-engine/requirements.txt

# Install frontend dependencies and build production static files
RUN cd /app/frontend && npm install && npm run build

# Install backend dependencies, sync fresh frontend build, and build TypeScript server
RUN cd /app/backend && npm install && rm -rf public dist/public && cp -r /app/frontend/dist public && npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5001
ENV AI_ENGINE_URL=http://127.0.0.1:8000
ENV TWELVE_DATA_API_KEY=68d13d3465434ad8a40d7db1eda9b8a8
ENV LLM_ARBITER=true
ENV OPENROUTER_API_KEY=""
ENV OPENROUTER_MODEL=openrouter/free

EXPOSE 5001

# Start Python AI Engine on 8000 and Express Backend (which serves Frontend & API) on 5001
CMD ["sh", "-c", "/app/ai-engine/venv/bin/python3 /app/ai-engine/app.py & cd /app/backend && npm start"]
