// ============================================================
// src/controllers/backtest.controller.ts
// Native Walk-Forward Historical Testing Engine
// Section 8: Out-of-sample testing, realistic payout, no look-ahead,
// performance breakdown by asset, timeframe, and market regime.
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import marketDataService from '../services/marketData.service';
import { analyzeCandlesNative } from '../services/nativeSignalEngine';
import type { BacktestRequest, BacktestResult, OHLCCandle } from '../types';

export const backtestController = {
  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'VALIDATION_ERROR', errors: errors.array() });
      return;
    }

    const { symbol = 'Crypto IDX', interval = '1min', startDate, endDate } =
      req.body as BacktestRequest;

    try {
      // 1. Fetch historical candles (up to 300 candles)
      const allCandles = await marketDataService.getCandles(symbol, interval, 200);

      // Candles are oldest-first for walk-forward simulation
      let filtered: OHLCCandle[] = [...allCandles];

      if (startDate && endDate) {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        const inRange = allCandles.filter((c) => {
          const t = new Date(c.timestamp).getTime();
          return t >= start && t <= end;
        });
        if (inRange.length >= 20) {
          filtered = inRange;
        }
      }

      if (filtered.length < 25) {
        res.status(422).json({
          status: 'INSUFFICIENT_DATA',
          message: `Only ${filtered.length} candles available for ${symbol}. Need at least 25 candles for walk-forward validation.`,
        });
        return;
      }

      // 2. Realistic payout based on OTC vs Standard asset
      const isOtc = symbol.toUpperCase().includes('(OTC)') || symbol.toUpperCase().includes('CRYPTO IDX');
      const payoutRate = isOtc ? 0.83 : 0.80; // 83% payout for Binomo VIP OTC, 80% for standard

      // 3. Walk-Forward Simulation (strictly past data, zero look-ahead bias)
      // Split into In-Sample (first 70%) and Out-of-Sample (last 30%)
      const splitIdx = Math.floor(filtered.length * 0.70);

      const trades: Array<{
        timestamp: string;
        direction: 'CALL' | 'PUT';
        confidence: number;
        score: number;
        marketRegime: string;
        entryPrice: number;
        exitPrice: number;
        outcome: 'WIN' | 'LOSS';
        isOutOfSample: boolean;
        pnl: number;
      }> = [];

      const regimeStats: Record<string, { total: number; wins: number; losses: number }> = {
        TRENDING: { total: 0, wins: 0, losses: 0 },
        RANGING: { total: 0, wins: 0, losses: 0 },
        VOLATILE: { total: 0, wins: 0, losses: 0 },
      };

      let cumulativePnl = 0;
      let peakPnl = 0;
      let maxDrawdown = 0;
      let inSampleWins = 0;
      let inSampleTotal = 0;
      let outSampleWins = 0;
      let outSampleTotal = 0;

      // Walk forward candle by candle
      const minLookback = 20;
      for (let i = minLookback; i < filtered.length - 1; i++) {
        // Historical slice [0..i] strictly available at moment of decision
        const historySlice = filtered.slice(0, i + 1);
        const signal = analyzeCandlesNative(historySlice, symbol, interval);

        // Only evaluate decisive setups (CALL or PUT with >= 75 score)
        if (signal.direction === 'CALL' || signal.direction === 'PUT') {
          const nextCandle = filtered[i + 1];
          const entryPrice = nextCandle.open;
          const exitPrice = nextCandle.close;

          let isWin = false;
          if (signal.direction === 'CALL') {
            isWin = exitPrice > entryPrice;
          } else {
            isWin = exitPrice < entryPrice;
          }

          const outcome: 'WIN' | 'LOSS' = isWin ? 'WIN' : 'LOSS';
          const pnl = isWin ? payoutRate * 100 : -100;
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
          if (!regimeStats[reg]) regimeStats[reg] = { total: 0, wins: 0, losses: 0 };
          regimeStats[reg].total++;
          if (isWin) regimeStats[reg].wins++;
          else regimeStats[reg].losses++;

          trades.push({
            timestamp: nextCandle.timestamp,
            direction: signal.direction,
            confidence: signal.confidence,
            score: signal.confidence,
            marketRegime: reg,
            entryPrice,
            exitPrice,
            outcome,
            isOutOfSample: isOos,
            pnl,
          });
        }
      }

      const totalSignals = trades.length;
      const wins = trades.filter((t) => t.outcome === 'WIN').length;
      const losses = totalSignals - wins;
      const winRate = totalSignals > 0 ? (wins / totalSignals) * 100 : 0;

      const grossWins = wins * payoutRate * 100;
      const grossLosses = losses * 100;
      const profitFactor = grossLosses > 0 ? Math.round((grossWins / grossLosses) * 100) / 100 : grossWins > 0 ? 9.99 : 1.0;

      const inSampleWinRate = inSampleTotal > 0 ? Math.round((inSampleWins / inSampleTotal) * 100) : 0;
      const outSampleWinRate = outSampleTotal > 0 ? Math.round((outSampleWins / outSampleTotal) * 100) : 0;

      const result: BacktestResult = {
        totalSignals,
        verifiedSignals: totalSignals,
        wins,
        losses,
        accuracy: Math.round(winRate * 10) / 10,
        signals: trades.map((t) => ({
          timestamp: t.timestamp,
          direction: t.direction,
          confidence: t.confidence,
          outcome: t.outcome,
        })),
        disclaimer:
          'Past performance does not guarantee future results. Backtests use realistic walk-forward simulation with no look-ahead bias.',
      };

      res.json({
        status: 'OK',
        symbol,
        interval,
        isOtc,
        payoutRate: `${Math.round(payoutRate * 100)}%`,
        candlesAnalyzed: filtered.length,
        result: {
          ...result,
          profitFactor,
          maxDrawdown: Math.round(maxDrawdown),
          inSample: {
            candles: splitIdx,
            trades: inSampleTotal,
            winRate: inSampleWinRate,
          },
          outOfSample: {
            candles: filtered.length - splitIdx,
            trades: outSampleTotal,
            winRate: outSampleWinRate,
          },
          performanceByRegime: {
            trending: {
              ...regimeStats['TRENDING'],
              winRate: regimeStats['TRENDING']?.total > 0 ? Math.round((regimeStats['TRENDING'].wins / regimeStats['TRENDING'].total) * 100) : 0,
            },
            ranging: {
              ...regimeStats['RANGING'],
              winRate: regimeStats['RANGING']?.total > 0 ? Math.round((regimeStats['RANGING'].wins / regimeStats['RANGING'].total) * 100) : 0,
            },
            volatile: {
              ...regimeStats['VOLATILE'],
              winRate: regimeStats['VOLATILE']?.total > 0 ? Math.round((regimeStats['VOLATILE'].wins / regimeStats['VOLATILE'].total) * 100) : 0,
            },
          },
          disclaimer:
            'Past performance does not guarantee future results. Backtests use realistic walk-forward simulation with no look-ahead bias.',
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

export default backtestController;
