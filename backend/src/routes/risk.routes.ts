// ============================================================
// src/routes/risk.routes.ts
// Loss Protection & Risk Management Routes (Phase 7)
// ============================================================
import { Router, Request, Response } from 'express';
import riskManagementService from '../services/riskManagement.service';

const router = Router();

// GET /api/risk/status
router.get('/status', (_req: Request, res: Response) => {
  const settings = riskManagementService.getSettings();
  const state = riskManagementService.getState();
  const advice = riskManagementService.evaluateTradePermission();

  res.json({
    status: 'OK',
    settings,
    state,
    advice,
  });
});

// POST /api/risk/settings
router.post('/settings', (req: Request, res: Response) => {
  const updated = riskManagementService.updateSettings(req.body || {});
  const advice = riskManagementService.evaluateTradePermission();

  res.json({
    status: 'OK',
    settings: updated,
    advice,
  });
});

// POST /api/risk/record
router.post('/record', (req: Request, res: Response) => {
  const { outcome = 'WIN', stake = 5 } = req.body || {};
  const state = riskManagementService.recordTradeOutcome(outcome, Number(stake));
  const advice = riskManagementService.evaluateTradePermission();

  res.json({
    status: 'OK',
    state,
    advice,
  });
});

// POST /api/risk/reset
router.post('/reset', (_req: Request, res: Response) => {
  const state = riskManagementService.resetDailyStats();
  const advice = riskManagementService.evaluateTradePermission();

  res.json({
    status: 'OK',
    state,
    advice,
  });
});

export default router;
