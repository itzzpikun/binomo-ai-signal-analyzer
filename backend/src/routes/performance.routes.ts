// ============================================================
// src/routes/performance.routes.ts
// ============================================================
import { Router } from 'express';
import { param } from 'express-validator';
import performanceController from '../controllers/performance.controller';
import { isValidSymbol } from '../services/marketData.service';

const router = Router();

// GET /api/performance/summary
router.get('/summary', performanceController.getSummary.bind(performanceController));

// GET /api/performance/:symbol
router.get(
  '/:symbol',
  [
    param('symbol')
      .isString()
      .trim()
      .custom((val) => {
        if (!isValidSymbol(val)) {
          throw new Error(`Unsupported symbol: ${val}`);
        }
        return true;
      }),
  ],
  performanceController.getBySymbol.bind(performanceController)
);

export default router;
