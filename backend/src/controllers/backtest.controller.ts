// ============================================================
// src/controllers/backtest.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import axios, { AxiosError } from 'axios';
import marketDataService from '../services/marketData.service';
import ENV from '../config/env';
import type { BacktestRequest, BacktestResult } from '../types';

export const backtestController = {
  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'VALIDATION_ERROR', errors: errors.array() });
      return;
    }

    const { symbol, interval, startDate, endDate, indicators } =
      req.body as BacktestRequest;

    try {
      // Fetch historical candles from Twelve Data
      const allCandles = await marketDataService.getCandles(symbol, interval, 300);

      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();

      // Filter candles in date range (no look-ahead: order is oldest-first after reverse)
      let filtered = allCandles
        .filter((c) => {
          const t = new Date(c.timestamp).getTime();
          return t >= start && t <= end;
        })
        .reverse();

      if (filtered.length < 10) {
        // Fall back to all available historical candles if date range filter yielded fewer than 10
        filtered = [...allCandles].reverse();
      }

      if (filtered.length < 10) {
        res.status(422).json({
          status: 'INSUFFICIENT_DATA',
          message: `Only ${filtered.length} candles found for ${symbol} in the requested date range. Need at least 10.`,
        });
        return;
      }

      // Build walk-forward windows: for each candle at index i, only use candles[0..i]
      // We send the full slice to the Python engine which performs walk-forward internally
      const response = await axios.post(
        `${ENV.AI_ENGINE_URL}/backtest`,
        {
          symbol,
          interval,
          candles: filtered,
          indicators,
          walkForward: true, // signal to Python engine: no look-ahead
        },
        { timeout: 120_000 }
      );

      const result = response.data as BacktestResult;

      res.json({
        status: 'OK',
        symbol,
        interval,
        startDate,
        endDate,
        candlesAnalyzed: filtered.length,
        result: {
          ...result,
          disclaimer:
            'Past performance does not guarantee future results. Backtests are simulated and may not reflect live trading conditions.',
        },
      });
    } catch (err) {
      const e = err as Error & { status?: string; statusCode?: number };

      if (e.status === 'DATA_UNAVAILABLE') {
        res.status(e.statusCode ?? 503).json({ status: 'DATA_UNAVAILABLE', message: e.message });
        return;
      }

      const axiosErr = err as AxiosError;
      if (axiosErr.isAxiosError) {
        if (axiosErr.code === 'ECONNREFUSED') {
          res.status(503).json({
            status: 'AI_ENGINE_UNAVAILABLE',
            message: `Cannot reach AI engine at ${ENV.AI_ENGINE_URL}. Ensure the Python service is running.`,
          });
          return;
        }
        res.status(502).json({
          status: 'AI_ENGINE_ERROR',
          message: `AI engine returned error: ${JSON.stringify(axiosErr.response?.data)}`,
        });
        return;
      }

      next(err);
    }
  },
};

export default backtestController;
