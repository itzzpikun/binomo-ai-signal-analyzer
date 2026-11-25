// ============================================================
// src/controllers/signal.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import signalService from '../services/signal.service';
import marketDataService from '../services/marketData.service';
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
      const isSimulated =
        (req.body as any).source === 'simulated' ||
        marketDataService.isOtc(symbol) ||
        (Array.isArray(candles) && candles.some((c: any) => c.source === 'simulated'));

      const sanitizedCandles: OHLCCandle[] = (candles || []).map((c: any) => ({
        timestamp: c.timestamp || (c.time ? new Date(c.time * 1000).toISOString() : new Date().toISOString()),
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseFloat(c.volume || '0'),
        source: isSimulated ? 'simulated' : (c.source || 'real'),
      }));

      const openrouterKey =
        (req.headers['x-openrouter-key'] as string) ||
        (req.body as any).openrouter_api_key ||
        process.env.OPENROUTER_API_KEY ||
        undefined;
      const openrouterModel =
        (req.headers['x-openrouter-model'] as string) ||
        (req.body as any).openrouter_model ||
        process.env.OPENROUTER_MODEL ||
        undefined;

      const result = await signalService.analyzeCandles(
        symbol,
        interval,
        sanitizedCandles,
        openrouterKey,
        openrouterModel,
        false
      );

      let rawResult: any = result || {};
      if (typeof rawResult === 'string') {
        try {
          rawResult = JSON.parse(rawResult.replace(/:\s*(?:NaN|-?Infinity)\b/g, ': null'));
        } catch {
          rawResult = {};
        }
      }
      const finalSignal: any = {
        ...rawResult,
        source: isSimulated ? 'simulated' : 'real',
        direction: rawResult.direction || rawResult.signal?.direction || 'WAIT',
        confidence: typeof rawResult.confidence === 'number'
          ? rawResult.confidence
          : (typeof rawResult.signal?.confidence === 'number' ? rawResult.signal.confidence : 50),
        confluence_score: typeof rawResult.confluence_score === 'number'
          ? rawResult.confluence_score
          : (typeof rawResult.signal?.confluence_score === 'number' ? rawResult.signal.confluence_score : 0),
        indicators: rawResult.indicators || rawResult.signal?.indicators || {},
        reasons: rawResult.reasons || rawResult.signal?.reasons || { bullish: [], bearish: [] },
      };

      const saved = await signalService.saveSignal(symbol, interval, finalSignal);
      res.status(200).json({
        status: 'OK',
        signalId: saved._id,
        symbol,
        interval,
        source: isSimulated ? 'simulated' : 'real',
        timestamp: saved.timestamp,
        signal: finalSignal,
        disclaimer: isSimulated
          ? 'Simulated OTC market data. Technical analysis computed for educational and analysis purposes.'
          : 'This signal is for informational purposes only and does not constitute financial advice.',
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
      const sanitizedSignals = signals.map((s: any) => ({
        ...s,
        source: s.source || (marketDataService.isOtc(s.symbol) ? 'simulated' : 'real'),
      }));
      res.json({ status: 'OK', count: sanitizedSignals.length, signals: sanitizedSignals });
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
