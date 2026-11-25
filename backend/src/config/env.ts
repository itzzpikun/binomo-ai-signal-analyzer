// ============================================================
// src/config/env.ts — Environment configuration
// ============================================================
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requireEnv(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export const ENV = {
  PORT: parseInt(process.env['PORT'] ?? '5000', 10),
  MONGODB_URI: process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/binomo_analyzer',
  TWELVE_DATA_API_KEY: '68d13d3465434ad8a40d7db1eda9b8a8',
  OPENROUTER_API_KEY: process.env['OPENROUTER_API_KEY'] || '',
  OPENROUTER_MODEL: process.env['OPENROUTER_MODEL'] || 'openrouter/free',
  AI_ENGINE_URL: process.env['AI_ENGINE_URL'] ?? 'http://localhost:8000',
  FRONTEND_URL: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
} as const;

export default ENV;
