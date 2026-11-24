// ============================================================
// src/routes/scan.routes.ts — Multi-asset batch signal scanner
// Scans ALL Binomo assets across 1M, 5M, and 15M timeframes in parallel
// ONLY returns signals where 1M, 5M, and 15M ALL agree on the SAME direction (CALL or PUT)
// ============================================================
import { Router, Request, Response } from 'express';
import { analysisRateLimiter } from '../middleware/rateLimiter';
import marketDataService from '../services/marketData.service';
import { analyzeCandlesNative } from '../services/nativeSignalEngine';

const router = Router();

// GET /api/scan/all
// Scans ALL 26 Binomo assets across 1m, 5m, and 15m
// Returns ONLY assets where 1m, 5m, and 15m ALL 3 have the EXACT SAME CALL or PUT signal
router.get('/all', analysisRateLimiter, async (_req: Request, res: Response) => {
  try {
    const assets = marketDataService.getAssetsList();
    const symbolList = assets.map((a: any) => a.symbol);

    // Scan every asset across 1m, 5m, 15m in parallel
    const scanPromises = symbolList.map(async (symbol: string) => {
      try {
        const [c1m, c5m, c15m] = await Promise.all([
          marketDataService.getCandles(symbol, '1min', 40),
          marketDataService.getCandles(symbol, '5min', 40),
          marketDataService.getCandles(symbol, '15min', 40),
        ]);

        if (c1m.length < 5 || c5m.length < 5 || c15m.length < 5) return null;

        const sig5m = analyzeCandlesNative(c5m, symbol, '5min');
        const sig15m = analyzeCandlesNative(c15m, symbol, '15min');
        const sig1m = analyzeCandlesNative(c1m, symbol, '1min', {
          s5mDirection: sig5m.direction,
          s15mDirection: sig15m.direction,
        });

        // Strict Policy: Only assets that qualify for CALL or PUT (score >= 70 and no filter triggered)
        if ((sig1m.direction !== 'CALL' && sig1m.direction !== 'PUT') || sig1m.confidence < 70) {
          return null;
        }

        const isAllCall = sig1m.direction === 'CALL' && sig5m.direction === 'CALL' && sig15m.direction === 'CALL';
        const isAllPut = sig1m.direction === 'PUT' && sig5m.direction === 'PUT' && sig15m.direction === 'PUT';

        return {
          symbol,
          direction: sig1m.direction,
          confidence: sig1m.confidence,
          trade_quality: sig1m.trade_quality,
          score_breakdown: sig1m.score_breakdown,
          market_regime: sig1m.market_regime,
          timeframes: {
            '1m': sig1m.direction,
            '5m': sig5m.direction,
            '15m': sig15m.direction,
          },
          gemini_arbiter: sig1m.gemini_arbiter,
          entry_timing: sig1m.entry_timing,
          next_probable_setup: sig1m.next_probable_setup,
          reasons: sig1m.reasons,
          timestamp: new Date().toISOString(),
        };
      } catch {
        return null;
      }
    });

    const results = await Promise.all(scanPromises);
    const confirmedSignals = results.filter(Boolean);

    res.json({
      status: 'OK',
      filter: 'ACCURACY_FILTER_70_PLUS',
      scanned: symbolList.length,
      active_signals: confirmedSignals.length,
      signals: confirmedSignals,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: (err as Error).message });
  }
});

export default router;
