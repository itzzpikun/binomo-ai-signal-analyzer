// ============================================================
// src/controllers/backtest.controller.ts
// Native Walk-Forward Historical Testing Engine (Zero Synthetic Candles)
// Phase 6 Requirements:
// - Genuine historical completed candles only (no look-ahead, no synthetic).
// - In-sample (70%) vs Out-of-sample (30%) partitioning.
// - Asset-specific payout rates.
// - Platform-standard Tie/Refund rule (close == open -> TIE, 0 PnL).
// - Comprehensive metrics: Total trades, Wins, Losses, Ties, Win Rate,
//   Break-even Win Rate, Expected Value (EV), Profit Factor, Max Drawdown,
//   Consecutive Losses, Wilson Score 95% Confidence Interval.
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import marketDataService, { getAssetSpec } from '../services/marketData.service';
import { analyzeCandlesNative } from '../services/nativeSignalEngine';
import type { BacktestRequest, OHLCCandle } from '../types';

function wilsonScoreInterval(wins: number, total: number): { lower: number; upper: number } {
  if (total <= 0) return { lower: 0, upper: 0 };
  const z = 1.96;
  const p = wins / total;
  const denom = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  const lower = Math.max(0, (centre - spread) / denom);
  const upper = Math.min(1, (centre + spread) / denom);
  return {
    lower: Math.round(lower * 1000) / 10,
    upper: Math.round(upper * 1000) / 10,
  };
}

export const backtestController = {
  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'VALIDATION_ERROR', errors: errors.array() });
      return;
    }

    const { symbol = 'EUR/USD', interval = '1min', startDate, endDate, minConfidence = 65 } =
      req.body as BacktestRequest & { minConfidence?: number };

    try {
      // 1. Fetch genuine historical completed candles from marketDataService
      const rawCandles = await marketDataService.getCandles(symbol, interval, 250);
      const allCandles = marketDataService.getCompletedCandlesOnly(rawCandles, interval);

      let filtered: OHLCCandle[] = [...allCandles];

      if (startDate && endDate) {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        const inRange = allCandles.filter((c) => {
          const t = new Date(c.timestamp).getTime();
          return t >= start && t <= end;
        });
        if (inRange.length >= 25) {
          filtered = inRange;
        }
      }

      if (filtered.length < 30) {
        res.status(422).json({
          status: 'DATA_UNAVAILABLE',
          message: `Only ${filtered.length} genuine completed candles available for ${symbol}. Need at least 30 historical candles for walk-forward validation.`,
        });
        return;
      }

      // 2. Realistic asset-specific payout
      const spec = getAssetSpec(symbol);
      const parsedPayout = parseFloat(spec.profit.replace('%', '')) / 100 || 0.80;
      const isOtc = spec.isOtc;

      // 3. Walk-Forward Simulation (strictly past data, zero look-ahead bias)
      // Partition into In-Sample (first 70%) and Out-of-Sample (last 30%)
      const splitIdx = Math.floor(filtered.length * 0.70);

      const trades: Array<{
        timestamp: string;
        direction: 'CALL' | 'PUT';
        confidence: number;
        entryPrice: number;
        exitPrice: number;
        outcome: 'WIN' | 'LOSS' | 'TIE';
        isOutOfSample: boolean;
        pnl: number;
      }> = [];

      const regimeStats: Record<string, { total: number; wins: number; losses: number; ties: number }> = {
        TRENDING: { total: 0, wins: 0, losses: 0, ties: 0 },
        RANGING: { total: 0, wins: 0, losses: 0, ties: 0 },
        VOLATILE: { total: 0, wins: 0, losses: 0, ties: 0 },
      };

      let cumulativePnl = 0;
      let peakPnl = 0;
      let maxDrawdown = 0;
      let consecutiveLosses = 0;
      let maxConsecutiveLosses = 0;

      let inSampleWins = 0;
      let inSampleTotal = 0;
      let outSampleWins = 0;
      let outSampleTotal = 0;

      const minLookback = 20;

      // Walk forward candle by candle
      for (let i = minLookback; i < filtered.length - 1; i++) {
        // Historical window strictly before decision
        const historySlice = filtered.slice(0, i + 1);
        const signal = analyzeCandlesNative(historySlice, symbol, interval);

        // Only evaluate signals that pass the institutional threshold
        if ((signal.direction === 'CALL' || signal.direction === 'PUT') && signal.confidence >= minConfidence) {
          const nextCandle = filtered[i + 1];
          const entryPrice = nextCandle.open;
          const exitPrice = nextCandle.close;

          const isTie = exitPrice === entryPrice;
          let isWin = false;

          if (!isTie) {
            if (signal.direction === 'CALL') {
              isWin = exitPrice > entryPrice;
            } else if (signal.direction === 'PUT') {
              isWin = exitPrice < entryPrice;
            }
          }

          const outcome: 'WIN' | 'LOSS' | 'TIE' = isTie ? 'TIE' : (isWin ? 'WIN' : 'LOSS');
          const pnl = outcome === 'WIN' ? parsedPayout * 100 : outcome === 'LOSS' ? -100 : 0;

          if (outcome === 'LOSS') {
            consecutiveLosses++;
            if (consecutiveLosses > maxConsecutiveLosses) {
              maxConsecutiveLosses = consecutiveLosses;
            }
          } else if (outcome === 'WIN') {
            consecutiveLosses = 0;
          }

          cumulativePnl += pnl;
          if (cumulativePnl > peakPnl) peakPnl = cumulativePnl;
          const dd = peakPnl - cumulativePnl;
          if (dd > maxDrawdown) maxDrawdown = dd;

          const isOos = i >= splitIdx;
          if (isOos) {
            outSampleTotal++;
            if (isWin) outSampleWins++;
          } else {
            inSampleTotal++;
            if (isWin) inSampleWins++;
          }

          const reg = signal.market_regime || 'TRENDING';
          if (!regimeStats[reg]) regimeStats[reg] = { total: 0, wins: 0, losses: 0, ties: 0 };
          regimeStats[reg].total++;
          if (outcome === 'WIN') regimeStats[reg].wins++;
          else if (outcome === 'LOSS') regimeStats[reg].losses++;
          else regimeStats[reg].ties++;

          trades.push({
            timestamp: nextCandle.timestamp,
            direction: signal.direction,
            confidence: signal.confidence,
            entryPrice,
            exitPrice,
            outcome,
            isOutOfSample: isOos,
            pnl,
          });
        }
      }

      const totalTrades = trades.length;
      const wins = trades.filter((t) => t.outcome === 'WIN').length;
      const losses = trades.filter((t) => t.outcome === 'LOSS').length;
      const ties = trades.filter((t) => t.outcome === 'TIE').length;
      const decisiveTrades = wins + losses;

      const winRate = decisiveTrades > 0 ? Math.round((wins / decisiveTrades) * 1000) / 10 : 0;
      const breakEvenRate = Math.round((1 / (1 + parsedPayout)) * 1000) / 10;

      const grossWins = wins * parsedPayout * 100;
      const grossLosses = losses * 100;
      const profitFactor = grossLosses > 0 ? Math.round((grossWins / grossLosses) * 100) / 100 : grossWins > 0 ? 9.99 : 1.0;

      // Expected Value ($ per $1 stake)
      const evPerTrade = decisiveTrades > 0
        ? Math.round(((wins / decisiveTrades) * parsedPayout - (losses / decisiveTrades) * 1.0) * 1000) / 1000
        : 0;

      const inSampleWinRate = inSampleTotal > 0 ? Math.round((inSampleWins / inSampleTotal) * 1000) / 10 : 0;
      const outSampleWinRate = outSampleTotal > 0 ? Math.round((outSampleWins / outSampleTotal) * 1000) / 10 : 0;

      const oosCi = wilsonScoreInterval(outSampleWins, outSampleTotal);

      res.json({
        status: 'OK',
        symbol,
        interval,
        isOtc,
        payoutRate: `${Math.round(parsedPayout * 100)}%`,
        candlesAnalyzed: filtered.length,
        result: {
          totalSignals: totalTrades,
          verifiedSignals: decisiveTrades,
          wins,
          losses,
          ties,
          accuracy: winRate,
          breakEvenWinRate: breakEvenRate,
          expectedValuePerTrade: evPerTrade,
          profitFactor,
          maxDrawdown: Math.round(maxDrawdown),
          maxConsecutiveLosses,
          inSample: {
            candles: splitIdx,
            trades: inSampleTotal,
            wins: inSampleWins,
            winRate: inSampleWinRate,
          },
          outOfSample: {
            candles: filtered.length - splitIdx,
            trades: outSampleTotal,
            wins: outSampleWins,
            winRate: outSampleWinRate,
            confidenceInterval95: oosCi,
          },
          performanceByRegime: {
            trending: {
              ...regimeStats['TRENDING'],
              winRate: (regimeStats['TRENDING'].wins + regimeStats['TRENDING'].losses) > 0
                ? Math.round((regimeStats['TRENDING'].wins / (regimeStats['TRENDING'].wins + regimeStats['TRENDING'].losses)) * 1000) / 10
                : 0,
            },
            ranging: {
              ...regimeStats['RANGING'],
              winRate: (regimeStats['RANGING'].wins + regimeStats['RANGING'].losses) > 0
                ? Math.round((regimeStats['RANGING'].wins / (regimeStats['RANGING'].wins + regimeStats['RANGING'].losses)) * 1000) / 10
                : 0,
            },
            volatile: {
              ...regimeStats['VOLATILE'],
              winRate: (regimeStats['VOLATILE'].wins + regimeStats['VOLATILE'].losses) > 0
                ? Math.round((regimeStats['VOLATILE'].wins / (regimeStats['VOLATILE'].wins + regimeStats['VOLATILE'].losses)) * 1000) / 10
                : 0,
            },
          },
          signals: trades.slice(-30).map((t) => ({
            timestamp: t.timestamp,
            direction: t.direction,
            confidence: t.confidence,
            outcome: t.outcome,
            pnl: t.pnl,
          })),
          disclaimer:
            'Past performance does not guarantee future results. Backtests use realistic walk-forward simulation with out-of-sample partitioning.',
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

export default backtestController;
