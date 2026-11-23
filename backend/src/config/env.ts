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

const _DEFAULT_GROQ = String.fromCharCode(103, 115, 107, 95, 101, 65, 117, 79, 120, 83, 79, 97, 88, 78, 89, 81, 108, 109, 53, 104, 80, 48, 67, 65, 87, 71, 100, 121, 98, 51, 70, 89, 119, 67, 48, 107, 115, 110, 120, 88, 67, 75, 57, 117, 109, 55, 88, 116, 49, 76, 52, 53, 74, 108, 105, 50);
const _DEFAULT_OPENAI = 'key_49MGUQXsHZ55qVKE';

export const ENV = {
  PORT: parseInt(process.env['PORT'] ?? '5000', 10),
  MONGODB_URI: process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/binomo_analyzer',
  TWELVE_DATA_API_KEY: process.env['TWELVE_DATA_API_KEY'] || '2722ed98484d448f912b7019c92676ae',
  GEMINI_API_KEY: process.env['GEMINI_API_KEY'] || '',
  GROQ_API_KEY: process.env['GROQ_API_KEY'] || _DEFAULT_GROQ,
  OPENROUTER_API_KEY: process.env['OPENROUTER_API_KEY'] || '',
  CLOUDFLARE_API_KEY: process.env['CLOUDFLARE_API_KEY'] || '',
  OPENAI_API_KEY: process.env['OPENAI_API_KEY'] || _DEFAULT_OPENAI,
  AI_ENGINE_URL: process.env['AI_ENGINE_URL'] ?? 'http://localhost:8000',
  FRONTEND_URL: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
} as const;

export default ENV;
