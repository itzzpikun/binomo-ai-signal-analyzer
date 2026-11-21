// ============================================================
// src/middleware/cors.ts — CORS configuration
// ============================================================
import cors from 'cors';
import ENV from '../config/env';

const allowedOrigins = [
  ENV.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: Origin '${origin}' not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 600,
});
