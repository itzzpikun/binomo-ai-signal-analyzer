// ============================================================
// src/controllers/market.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import marketDataService from '../services/marketData.service';
import { getDatabaseStatus } from '../config/database';

export const marketController = {
  async getCandles(req: Request, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'VALIDATION_ERROR', errors: errors.array() });
      return;
    }

    const symbol = (req.query['symbol'] as string) || 'EUR/USD';
    const interval = (req.query['interval'] as string) || '5min';
    const outputsize = parseInt((req.query['outputsize'] as string) || '100', 10);
    const customKey =
      (req.headers['x-market-key'] as string) ||
      (req.query['apikey'] as string) ||
      (req.query['api_key'] as string);

    try {
      const candles = await marketDataService.getCandles(symbol, interval, outputsize, customKey);
      const isSimulated = marketDataService.isOtc(symbol) || (candles.length > 0 && candles.some((c) => c.source === 'simulated'));
      const source: 'real' | 'simulated' = isSimulated ? 'simulated' : 'real';

      res.json({
        status: 'OK',
        symbol,
        interval,
        source,
        count: candles.length,
        candles,
      });
    } catch (err) {
      const e = err as Error & { status?: string; statusCode?: number };
      if (e.status === 'DATA_UNAVAILABLE') {
        res.status(e.statusCode ?? 503).json({ status: 'DATA_UNAVAILABLE', message: e.message });
        return;
      }
      next(err);
    }
  },

  async getAssets(_req: Request, res: Response): Promise<void> {
    const assets = marketDataService.getSupportedAssets();
    res.json({ status: 'OK', categories: assets });
  },

  async getPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'VALIDATION_ERROR', errors: errors.array() });
      return;
    }

    const symbol = req.query['symbol'] as string;
    const customKey =
      (req.headers['x-market-key'] as string) ||
      (req.query['apikey'] as string) ||
      (req.query['api_key'] as string);

    try {
      const price = await marketDataService.getCurrentPrice(symbol, customKey);
      const isSimulated = marketDataService.isOtc(symbol);
      res.json({
        status: 'OK',
        symbol,
        price,
        source: isSimulated ? 'simulated' : 'real',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const e = err as Error & { status?: string; statusCode?: number };
      if (e.status === 'DATA_UNAVAILABLE') {
        res.status(e.statusCode ?? 503).json({ status: 'DATA_UNAVAILABLE', message: e.message });
        return;
      }
      next(err);
    }
  },

  async getStatus(_req: Request, res: Response): Promise<void> {
    const detailedStatus = await marketDataService.getDetailedStatus();
    const dbStatus = getDatabaseStatus();
    res.json({
      status: 'OK',
      ...detailedStatus,
      database: dbStatus,
      timestamp: new Date().toISOString(),
    });
  },
};

export default marketController;
