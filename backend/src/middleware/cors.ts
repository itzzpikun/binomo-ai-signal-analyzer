// ============================================================
// src/middleware/cors.ts — CORS configuration
// ============================================================
import cors from 'cors';
import ENV from '../config/env';

const allowedOrigins = [
  ENV.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5001',
  'http://127.0.0.1:5173',
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    // Explicitly allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow any localhost / 127.0.0.1 port
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    // Allow hostc tunnels (*.hostc.app)
    if (/^https?:\/\/[a-z0-9-]+\.hostc\.app$/.test(origin)) {
      return callback(null, true);
    }

    // Allow render deployments (*.onrender.com)
    if (/^https?:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin)) {
      return callback(null, true);
    }

    // Permissive for development / mobile hotspot access
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 600,
});
