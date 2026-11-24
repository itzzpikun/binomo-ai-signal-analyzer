// ============================================================
// src/controllers/trade.controller.ts — Trade Log & Risk Controller
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { tradeService } from '../services/trade.service';

export const tradeController = {
  async logTrade(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { asset, direction, entry, expiry, stake, result, exitPrice, notes, source, signalId, time } = req.body;

      if (!asset || !direction || entry === undefined) {
        res.status(400).json({
          status: 'VALIDATION_ERROR',
          message: 'asset, direction (CALL/PUT), and entry price are required.',
        });
        return;
      }

      if (!['CALL', 'PUT'].includes(direction)) {
        res.status(400).json({
          status: 'VALIDATION_ERROR',
          message: 'direction must be either CALL or PUT.',
        });
        return;
      }

      const trade = await tradeService.logTrade({
        asset,
        direction,
        entry: Number(entry),
        expiry: expiry || '5min',
        stake: stake !== undefined ? Number(stake) : 10,
        result: result || 'PENDING',
        exitPrice: exitPrice !== undefined ? Number(exitPrice) : undefined,
        notes,
        source: source || 'manual',
        signalId,
        time,
      });

      res.status(201).json({
        status: 'OK',
        message: 'Trade logged successfully',
        trade,
      });
    } catch (err) {
      next(err);
    }
  },

  async getTrades(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 100;
      const asset = req.query['asset'] as string | undefined;

      const trades = await tradeService.getTrades(limit, asset);
      const riskStatus = await tradeService.computeRiskStatus();

      res.json({
        status: 'OK',
        count: trades.length,
        trades,
        riskStatus,
      });
    } catch (err) {
      next(err);
    }
  },

  async updateTrade(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tradeId = req.params['id'];
      const { result, exitPrice } = req.body;

      if (!result || !['WIN', 'LOSS', 'PENDING', 'TIE'].includes(result)) {
        res.status(400).json({
          status: 'VALIDATION_ERROR',
          message: 'result must be WIN, LOSS, PENDING, or TIE',
        });
        return;
      }

      const updated = await tradeService.updateTradeResult(
        tradeId,
        result,
        exitPrice !== undefined ? Number(exitPrice) : undefined
      );

      if (!updated) {
        res.status(404).json({
          status: 'NOT_FOUND',
          message: `Trade ${tradeId} not found`,
        });
        return;
      }

      res.json({
        status: 'OK',
        message: 'Trade updated successfully',
        trade: updated,
      });
    } catch (err) {
      next(err);
    }
  },

  async getRiskStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const riskStatus = await tradeService.computeRiskStatus();
      res.json({
        status: 'OK',
        riskStatus,
      });
    } catch (err) {
      next(err);
    }
  },
};

export default tradeController;
