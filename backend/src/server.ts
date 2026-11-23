// ============================================================
// src/server.ts — Main application entry point
// ============================================================
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import http from 'http';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import express from 'express';
import helmet from 'helmet';
import ENV from './config/env';
import { connectDatabase } from './config/database';
import { corsMiddleware } from './middleware/cors';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { WebSocketService } from './services/websocket.service';

import marketRoutes from './routes/market.routes';
import signalRoutes from './routes/signal.routes';
import scanRoutes from './routes/scan.routes';
import backtestRoutes from './routes/backtest.routes';
import performanceRoutes from './routes/performance.routes';
import aiRoutes from './routes/ai.routes';

async function ensureAiEngine(): Promise<void> {
  try {
    const res = await fetch(`${ENV.AI_ENGINE_URL}/health`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    if (res && res.ok) {
      console.log('[AI Engine] Connected at', ENV.AI_ENGINE_URL);
      return;
    }
  } catch {}

  const candidates = [
    path.resolve(__dirname, '../../ai-engine/app.py'),
    path.resolve(process.cwd(), 'ai-engine/app.py'),
    path.resolve(process.cwd(), '../ai-engine/app.py'),
  ];
  const appPy = candidates.find((c) => fs.existsSync(c));
  if (!appPy) {
    console.warn('[AI Engine] app.py not found in candidate paths:', candidates);
    return;
  }

  const venvPy = path.join(path.dirname(appPy), 'venv/bin/python3');
  const pyCmd = fs.existsSync(venvPy) ? venvPy : 'python3';

  console.log(`[AI Engine] Spawning: ${pyCmd} ${appPy}`);
  try {
    const proc = spawn(pyCmd, [appPy], {
      stdio: 'inherit',
      env: { ...process.env, PORT: '8000' },
      detached: false,
    });
    proc.on('error', (err) => console.error('[AI Engine] Spawn failed:', err.message));
  } catch (err) {
    console.error('[AI Engine] Execution error:', (err as Error).message);
  }
}

async function bootstrap(): Promise<void> {
  // Ensure Python AI Engine is running
  await ensureAiEngine();

  // ── Express app ──────────────────────────────────────────
  const app = express();

  // Security headers
  app.use(helmet({
    crossOriginEmbedderPolicy: false, // allow chart assets
    contentSecurityPolicy: false,     // frontend manages CSP
  }));

  // CORS
  app.use(corsMiddleware);

  // Body parsing
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Global rate limiting
  app.use(rateLimiter);

  // Trust proxy (for rate limit IP detection behind load balancers)
  app.set('trust proxy', 1);

  // ── Determine Frontend Distribution Directory ───────────
  const candidatePaths = [
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, './public'),
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'dist/public'),
  ];
  const frontendDist = candidatePaths.find((p) => fs.existsSync(path.join(p, 'index.html')));

  // ── Enhanced Health check ────────────────────────────────
  app.get('/health', async (_req, res) => {
    let aiStatus = 'disconnected';
    try {
      const aiRes = await fetch(`${ENV.AI_ENGINE_URL}/health`, { signal: AbortSignal.timeout(1500) }).catch(() => null);
      if (aiRes && aiRes.ok) aiStatus = 'connected';
    } catch {}

    res.json({
      status: 'OK',
      uptime: process.uptime(),
      env: ENV.NODE_ENV,
      services: {
        frontend: frontendDist ? 'ready' : 'fallback',
        ai_engine: aiStatus,
        market_data: 'connected',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ── API Routes ────────────────────────────────────────────
  app.use('/api/market', marketRoutes);
  app.use('/api/signal', signalRoutes);
  app.use('/api/scan', scanRoutes);
  app.use('/api/backtest', backtestRoutes);
  app.use('/api/performance', performanceRoutes);
  app.use('/api/ai', aiRoutes);

  // ── Serve Frontend Static Assets ──────────────────────────
  if (frontendDist) {
    console.log('[Frontend] Serving static production files from:', frontendDist);
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/health')) {
        return next();
      }
      if (req.path.match(/\.(js|css|svg|png|ico|map|json|woff2?|ttf)$/i)) {
        return res.status(404).send('Asset not found');
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    console.warn('[Frontend] Static frontend not found. Fallback mode enabled.');
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/health')) {
        return next();
      }
      res.send(`<!DOCTYPE html><html><head><title>Binomo AI Signal Analyzer</title><meta http-equiv="refresh" content="5"></head><body style="background:#0b0e14;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>🚀 Binomo AI Analyzer Starting...</h2><p style="color:#94a3b8">Initializing market feed and indicators. Auto-reloading in 5s...</p></div></body></html>`);
    });
  }

  // ── 404 & Error handlers ─────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  // ── HTTP Server ───────────────────────────────────────────
  const server = http.createServer(app);

  // ── WebSocket ─────────────────────────────────────────────
  const wsService = new WebSocketService(server);

  // ── Listen immediately so Render health checks succeed without delay ──
  server.listen(ENV.PORT, () => {
    console.log(`\n🚀 Binomo AI Analyzer backend running`);
    console.log(`   HTTP  → http://localhost:${ENV.PORT}`);
    console.log(`   WS    → ws://localhost:${ENV.PORT}/ws`);
    console.log(`   Env   → ${ENV.NODE_ENV}\n`);
  });

  // ── MongoDB (async, non-blocking) ─────────────────────────
  connectDatabase().catch((err) => {
    console.error('[Startup] MongoDB connection failed — continuing without DB:', (err as Error).message);
  });

  // ── Graceful shutdown ─────────────────────────────────────
  const shutdown = (signal: string) => {
    console.log(`\n[${signal}] Shutting down...`);
    wsService.shutdown();
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('[Fatal] Uncaught exception:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Fatal] Unhandled promise rejection:', reason);
    process.exit(1);
  });
}

bootstrap();
