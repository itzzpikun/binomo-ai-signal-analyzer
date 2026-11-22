// ============================================================
// src/controllers/signal.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import signalService from '../services/signal.service';
import type { OHLCCandle } from '../types';

export const signalController = {
  async analyze(req: Request, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'VALIDATION_ERROR', errors: errors.array() });
      return;
    }

    const { symbol, interval, candles } = req.body as {
      symbol: string;
      interval: string;
      candles: OHLCCandle[];
    };

    try {
      const sanitizedCandles: OHLCCandle[] = (candles || []).map((c: any) => ({
        timestamp: c.timestamp || (c.time ? new Date(c.time * 1000).toISOString() : new Date().toISOString()),
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseFloat(c.volume || '0'),
      }));

      const geminiKey =
        (req.headers['x-gemini-key'] as string) ||
        (req.body as any).gemini_api_key ||
        process.env.GEMINI_API_KEY;
      const openaiKey =
        (req.headers['x-openai-key'] as string) ||
        (req.body as any).openai_api_key ||
        process.env.OPENAI_API_KEY;

      const result = await signalService.analyzeCandles(
        symbol,
        interval,
        sanitizedCandles,
        geminiKey,
        openaiKey
      );
      const saved = await signalService.saveSignal(symbol, interval, result);
      res.status(201).json({
        status: 'OK',
        signalId: saved._id,
        symbol,
        interval,
        timestamp: saved.timestamp,
        signal: result,
        disclaimer:
          'This signal is for informational purposes only and does not constitute financial advice.',
      });
    } catch (err) {
      const e = err as Error & { status?: string; statusCode?: number };
      if (e.status === 'AI_ENGINE_ERROR' || e.status === 'AI_ENGINE_UNAVAILABLE') {
        res.status(e.statusCode ?? 502).json({ status: e.status, message: e.message });
        return;
      }
      next(err);
    }
  },

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'VALIDATION_ERROR', errors: errors.array() });
      return;
    }

    const symbol = req.query['symbol'] as string | undefined;
    const limit = parseInt((req.query['limit'] as string) || '50', 10);

    try {
      const signals = await signalService.getHistory(symbol, limit);
      res.json({ status: 'OK', count: signals.length, signals });
    } catch (err) {
      next(err);
    }
  },

  async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'VALIDATION_ERROR', errors: errors.array() });
      return;
    }

    const { signalId, entryPrice, exitPrice } = req.body as {
      signalId: string;
      entryPrice: number;
      exitPrice: number;
    };

    try {
      const signal = await signalService.verifySignal(signalId, entryPrice, exitPrice);
      res.json({
        status: 'OK',
        signalId: signal._id,
        outcome: signal.outcome,
        verifiedAt: signal.verifiedAt,
      });
    } catch (err) {
      const e = err as Error & { status?: string; statusCode?: number };
      if (e.status === 'NOT_FOUND') {
        res.status(404).json({ status: 'NOT_FOUND', message: e.message });
        return;
      }
      if (e.status === 'CONFLICT' || e.status === 'VALIDATION_ERROR') {
        res.status(e.statusCode ?? 400).json({ status: e.status, message: e.message });
        return;
      }
      next(err);
    }
  },
};

export default signalController;
