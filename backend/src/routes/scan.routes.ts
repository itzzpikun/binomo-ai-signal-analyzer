// ============================================================
// src/routes/scan.routes.ts — Multi-asset batch signal scanner
// ============================================================
import { Router, Request, Response } from 'express';
import { analysisRateLimiter } from '../middleware/rateLimiter';
import marketDataService from '../services/marketData.service';
import { analyzeCandlesNative } from '../services/nativeSignalEngine';

const router = Router();

// GET /api/scan/all?interval=1min
// Scans ALL Binomo assets in parallel, returns only CALL/PUT signals
router.get('/all', analysisRateLimiter, async (req: Request, res: Response) => {
  const interval = (req.query['interval'] as string) || '1min';

  try {
    const assets = marketDataService.getAssetsList();
    const symbolList = assets.map((a: any) => a.symbol);

    // Scan every asset in parallel (all in-process, ~1-3ms each)
    const scanPromises = symbolList.map(async (symbol: string) => {
      try {
        const candleResult = await marketDataService.getCandles(symbol, interval, 50);
        const rawArr: any[] = Array.isArray(candleResult)
          ? candleResult
          : Array.isArray((candleResult as any)?.candles)
          ? (candleResult as any).candles
          : [];

        if (rawArr.length < 5) return null;

        const mapped = rawArr.map((c: any) => ({
          timestamp: c.timestamp || c.datetime || new Date().toISOString(),
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
          volume: parseFloat(c.volume || '0'),
        }));

        const signal = analyzeCandlesNative(mapped, symbol, interval);

        // Only return actionable signals (CALL/PUT)
        if (signal.direction === 'CALL' || signal.direction === 'PUT') {
          return {
            symbol,
            direction: signal.direction,
            confidence: signal.confidence,
            trade_quality: signal.trade_quality,
            entry_timing: signal.entry_timing,
            next_probable_setup: signal.next_probable_setup,
            reasons: {
              bullish: (signal.reasons.bullish || []).slice(0, 3),
              bearish: (signal.reasons.bearish || []).slice(0, 3),
            },
            timestamp: signal.timestamp,
          };
        }
        return null;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(scanPromises);
    const activeSignals = results.filter(Boolean);

    res.json({
      status: 'OK',
      scanned: symbolList.length,
      active_signals: activeSignals.length,
      signals: activeSignals,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: (err as Error).message });
  }
});

export default router;
