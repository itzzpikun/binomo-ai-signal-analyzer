// ============================================================
// src/controllers/performance.controller.ts — Verified Performance Stats
// Computes real stats from stored Trade Log & verified Signals.
// Never fabricates numbers. If sample is empty, returns 0s with a note.
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { tradeService } from '../services/trade.service';
import { Signal } from '../models/Signal.model';

export const performanceController = {
  async getSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await tradeService.getPerformanceSummary();

      res.json({
        status: 'OK',
        totalSignals: stats.totalSignals,
        verifiedSignals: stats.verifiedSignals,
        wins: stats.wins,
        losses: stats.losses,
        accuracy: stats.accuracy,
        bestAsset: stats.bestAsset,
        totalPnL: stats.totalPnL,
        profitFactor: stats.profitFactor,
        byAsset: stats.byAsset,
        byTimeframe: stats.byTimeframe,
        riskStatus: stats.riskStatus,
        summary: {
          totalVerifiedSignals: stats.verifiedSignals,
          overallAccuracy: stats.verifiedSignals > 0 ? stats.accuracy : null,
          bestAsset: stats.bestAsset,
        },
        note:
          stats.verifiedSignals === 0
            ? 'No verified trades recorded yet. Log trades to view computed real performance.'
            : 'All metrics computed directly from recorded trades.',
        warning:
          'Only verified trades are included. A small sample size (< 50) may not be statistically significant.',
        disclaimer: 'Past performance does not guarantee future results.',
      });
    } catch (err) {
      next(err);
    }
  },

  async getBySymbol(req: Request, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'VALIDATION_ERROR', errors: errors.array() });
      return;
    }

    const symbol = (req.params['symbol'] as string).toUpperCase();

    try {
      const trades = await tradeService.getTrades(200, symbol);
      const verified = trades.filter((t) => t.result === 'WIN' || t.result === 'LOSS');
      const wins = verified.filter((t) => t.result === 'WIN').length;
      const losses = verified.filter((t) => t.result === 'LOSS').length;
      const accuracy = verified.length > 0 ? Math.round((wins / verified.length) * 1000) / 10 : 0;
      const signalCount = await Signal.countDocuments({ symbol, outcome: { $in: ['WIN', 'LOSS'] } });

      res.json({
        status: 'OK',
        symbol,
        totalTrades: trades.length,
        verifiedTrades: verified.length,
        wins,
        losses,
        accuracy,
        verifiedSignalCount: signalCount,
        note: verified.length === 0 ? 'No verified trades recorded yet for this symbol.' : undefined,
      });
    } catch (err) {
      next(err);
    }
  },
};

export default performanceController;
