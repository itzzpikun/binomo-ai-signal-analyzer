// ============================================================
// src/controllers/performance.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { Performance } from '../models/Performance.model';
import { Signal } from '../models/Signal.model';

export const performanceController = {
  async getSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Only count verified signals (WIN or LOSS)
      const records = await Performance.find().lean().exec();

      const totalVerified = records.reduce((sum, r) => sum + r.verifiedSignals, 0);
      const totalWins = records.reduce((sum, r) => sum + r.wins, 0);
      const overallAccuracy =
        totalVerified > 0 ? Math.round((totalWins / totalVerified) * 10000) / 100 : null;

      const bestAsset =
        records.length > 0
          ? records.reduce((best, r) =>
              r.verifiedSignals >= 5 && r.accuracy > best.accuracy ? r : best,
              records[0]
            )
          : null;

      // Per-symbol breakdown
      const bySymbol = records.map((r) => ({
        symbol: r.symbol,
        interval: r.interval,
        totalSignals: r.totalSignals,
        verifiedSignals: r.verifiedSignals,
        wins: r.wins,
        losses: r.losses,
        accuracy: r.verifiedSignals >= 5 ? r.accuracy : null, // only report if sample >= 5
        sufficientSample: r.verifiedSignals >= 5,
      }));

      res.json({
        status: 'OK',
        summary: {
          totalVerifiedSignals: totalVerified,
          overallAccuracy,
          bestAsset: bestAsset
            ? { symbol: bestAsset.symbol, interval: bestAsset.interval, accuracy: bestAsset.accuracy }
            : null,
        },
        bySymbol,
        warning:
          'Only verified signals are included. A small sample size may not be statistically significant.',
        disclaimer:
          'Past performance does not guarantee future results.',
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
      const records = await Performance.find({ symbol }).lean().exec();
      const signalCount = await Signal.countDocuments({ symbol, outcome: { $in: ['WIN', 'LOSS'] } });

      res.json({
        status: 'OK',
        symbol,
        verifiedSignalCount: signalCount,
        byInterval: records,
        warning: 'Only verified signals with WIN or LOSS outcome are counted.',
      });
    } catch (err) {
      next(err);
    }
  },
};

export default performanceController;
