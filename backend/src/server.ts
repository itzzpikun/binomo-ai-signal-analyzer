// ============================================================
// src/server.ts — Main application entry point
// ============================================================
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import http from 'http';
import path from 'path';
import fs from 'fs';
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
import backtestRoutes from './routes/backtest.routes';
import performanceRoutes from './routes/performance.routes';

async function bootstrap(): Promise<void> {
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

  // ── Health check (no auth, no rate limit) ────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', uptime: process.uptime(), env: ENV.NODE_ENV });
  });

  // ── API Routes ────────────────────────────────────────────
  app.use('/api/market', marketRoutes);
  app.use('/api/signal', signalRoutes);
  app.use('/api/backtest', backtestRoutes);
  app.use('/api/performance', performanceRoutes);

  // ── 404 & Error handlers ─────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  // ── HTTP Server ───────────────────────────────────────────
  const server = http.createServer(app);

  // ── WebSocket ─────────────────────────────────────────────
  const wsService = new WebSocketService(server);

  // ── MongoDB ───────────────────────────────────────────────
  try {
    await connectDatabase();
  } catch (err) {
    console.error('[Startup] MongoDB connection failed — continuing without DB (some features will error)');
    console.error((err as Error).message);
  }

  // ── Listen ────────────────────────────────────────────────
  server.listen(ENV.PORT, () => {
    console.log(`\n🚀 Binomo AI Analyzer backend running`);
    console.log(`   HTTP  → http://localhost:${ENV.PORT}`);
    console.log(`   WS    → ws://localhost:${ENV.PORT}/ws`);
    console.log(`   Env   → ${ENV.NODE_ENV}\n`);
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
