// ============================================================
// src/routes/scan.routes.ts — Multi-asset scanner
// Returns WAIT with reason "Simulated data" for simulated / OTC assets
// ============================================================
import { Router, Request, Response } from 'express';
import marketDataService from '../services/marketData.service';
import signalService from '../services/signal.service';

const router = Router();

// GET /api/scan/all
router.get('/all', async (_req: Request, res: Response) => {
  try {
    const assets = marketDataService.getAssetsList();

    const scanPromises = assets.map(async (asset) => {
      // 1. Simulated / OTC assets ALWAYS return direction WAIT with reason "Simulated data"
      if (asset.isOtc || asset.source === 'simulated' || marketDataService.isOtc(asset.symbol)) {
        return {
          symbol: asset.symbol,
          source: 'simulated',
          direction: 'WAIT',
          confidence: 0,
          trade_quality: 'SIMULATED DATA',
          status: 'no real data available',
          reasons: {
            bullish: [],
            bearish: [],
            wait_reasons: ['Simulated data'],
          },
          timestamp: new Date().toISOString(),
        };
      }

      // 2. Real assets: Attempt to fetch real candles
      try {
        const candles = await marketDataService.getCandles(asset.symbol, '5min', 40);
        if (!candles || candles.length < 15 || candles.some((c) => c.source === 'simulated')) {
          return {
            symbol: asset.symbol,
            source: 'simulated',
            direction: 'WAIT',
            confidence: 0,
            trade_quality: 'SIMULATED DATA',
            status: 'Simulated data',
            reasons: {
              bullish: [],
              bearish: [],
              wait_reasons: ['Simulated data'],
            },
            timestamp: new Date().toISOString(),
          };
        }

        // Analyze genuine candles with AI engine
        const sig = await signalService.analyzeCandles(asset.symbol, '5min', candles);
        return {
          symbol: asset.symbol,
          source: 'real',
          direction: sig.direction,
          confidence: sig.confidence,
          trade_quality: sig.trade_quality,
          reasons: sig.reasons,
          timestamp: new Date().toISOString(),
        };
      } catch {
        return {
          symbol: asset.symbol,
          source: 'real',
          direction: 'WAIT',
          confidence: 0,
          status: 'DATA_UNAVAILABLE',
          reasons: {
            bullish: [],
            bearish: [],
            wait_reasons: ['Market data currently unavailable'],
          },
          timestamp: new Date().toISOString(),
        };
      }
    });

    const results = await Promise.all(scanPromises);

    res.json({
      status: 'OK',
      scanned: assets.length,
      signals: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: (err as Error).message });
  }
});

export default router;
