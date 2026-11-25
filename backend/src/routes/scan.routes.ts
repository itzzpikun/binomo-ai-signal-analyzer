// ============================================================
// src/routes/scan.routes.ts — Multi-Asset Confluence Scanner
// Evaluates all assets with genuine technical indicators & AI engine.
// Returns real confluence_score, direction, confidence, and source attribution.
// ============================================================
import { Router, Request, Response } from 'express';
import marketDataService, { generateLiveBinomoCandles } from '../services/marketData.service';
import signalService from '../services/signal.service';
import type { OHLCCandle } from '../types';

const router = Router();

interface CachedScan {
  timestamp: number;
  data: any;
}

let scanCache: CachedScan | null = null;
const CACHE_TTL_MS = 12000; // 12-second cache to prevent redundant backend work

async function scanAsset(asset: {
  symbol: string;
  name: string;
  category: string;
  isOtc: boolean;
  source: 'real' | 'simulated';
}) {
  try {
    let candles: OHLCCandle[];
    let source: 'real' | 'simulated' = asset.source;

    if (asset.isOtc || marketDataService.isOtc(asset.symbol)) {
      candles = generateLiveBinomoCandles(asset.symbol, '5min', 40);
      source = 'simulated';
    } else {
      // Skip Twelve Data during bulk 89-asset scans so active chart keeps full quota;
      // marketDataService uses cached Twelve Data or real Yahoo Finance / Crypto feeds.
      candles = await marketDataService.getCandles(asset.symbol, '5min', 40, undefined, { skipTwelveData: true });
      source = candles[0]?.source || 'real';
    }

    if (!candles || candles.length < 15) {
      return {
        symbol: asset.symbol,
        name: asset.name,
        category: asset.category,
        isOtc: asset.isOtc,
        source: 'simulated',
        direction: 'WAIT',
        confidence: 0,
        confluence_score: 0,
        trade_quality: 'INSUFFICIENT DATA',
        reasons: { bullish: [], bearish: [], wait_reasons: ['Insufficient candles'] },
        timestamp: new Date().toISOString(),
      };
    }

    // Pass skipLlm=true for fast quantitative confluence scanning without burning OpenRouter quota
    const sig = await signalService.analyzeCandles(asset.symbol, '5min', candles, undefined, undefined, true);
    const confScore =
      typeof sig.confluence_score === 'number'
        ? sig.confluence_score
        : typeof (sig as any).signal?.confluence_score === 'number'
        ? (sig as any).signal.confluence_score
        : Math.round(sig.confidence || 0);

    return {
      symbol: asset.symbol,
      name: asset.name,
      category: asset.category,
      isOtc: asset.isOtc,
      source,
      direction: sig.direction,
      confidence: sig.confidence,
      confluence_score: confScore,
      trade_quality: sig.trade_quality,
      reasons: sig.reasons,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      symbol: asset.symbol,
      name: asset.name,
      category: asset.category,
      isOtc: asset.isOtc,
      source: asset.source,
      direction: 'WAIT',
      confidence: 0,
      confluence_score: 0,
      trade_quality: 'SCAN_ERROR',
      reasons: { bullish: [], bearish: [], wait_reasons: [(err as Error).message] },
      timestamp: new Date().toISOString(),
    };
  }
}

// Chunk helper to run tasks with concurrency control
async function runInChunks<T, R>(items: T[], chunkSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

// GET /api/scan/all
router.get('/all', async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (scanCache && now - scanCache.timestamp < CACHE_TTL_MS) {
      res.json(scanCache.data);
      return;
    }

    const assets = marketDataService.getAssetsList();
    // Scan in concurrent batches of 12
    const signals = await runInChunks(assets, 12, scanAsset);

    const highConfluenceSignals = signals.filter(
      (s) => (s.confluence_score >= 75 || s.confidence >= 75) && (s.direction === 'CALL' || s.direction === 'PUT')
    );

    const responsePayload = {
      status: 'OK',
      scanned: assets.length,
      highConfluenceCount: highConfluenceSignals.length,
      signals,
      timestamp: new Date().toISOString(),
    };

    scanCache = {
      timestamp: now,
      data: responsePayload,
    };

    res.json(responsePayload);
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: (err as Error).message });
  }
});

export default router;
