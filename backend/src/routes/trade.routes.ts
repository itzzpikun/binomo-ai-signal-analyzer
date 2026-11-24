// ============================================================
// src/routes/trade.routes.ts — Trade Log & Risk API Routes
// ============================================================
import { Router } from 'express';
import { tradeController } from '../controllers/trade.controller';

const router = Router();

// GET /api/trades — fetch recent trade logs & risk status
router.get('/', tradeController.getTrades.bind(tradeController));

// POST /api/trades — log a new trade
router.post('/', tradeController.logTrade.bind(tradeController));

// PATCH /api/trades/:id — update a trade outcome
router.patch('/:id', tradeController.updateTrade.bind(tradeController));

// GET /api/trades/risk-status — get current negative expectancy and daily loss limits
router.get('/risk-status', tradeController.getRiskStatus.bind(tradeController));

export default router;
