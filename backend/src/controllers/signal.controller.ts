// ============================================================
// src/controllers/signal.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import signalService from '../services/signal.service';
import type { OHLCCandle } from '../types';

export const signalController = {
  async analyze(req: Request, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'VALIDATION_ERROR', errors: errors.array() });
      return;
    }

    const { symbol, interval, candles } = req.body as {
      symbol: string;
      interval: string;
      candles: OHLCCandle[];
    };

    try {
      const sanitizedCandles: OHLCCandle[] = (candles || []).map((c: any) => ({
        timestamp: c.timestamp || (c.time ? new Date(c.time * 1000).toISOString() : new Date().toISOString()),
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseFloat(c.volume || '0'),
      }));

      const geminiKey =
        (req.headers['x-gemini-key'] as string) ||
        (req.body as any).gemini_api_key ||
        process.env.GEMINI_API_KEY;
      const openaiKey =
        (req.headers['x-openai-key'] as string) ||
        (req.body as any).openai_api_key ||
        process.env.OPENAI_API_KEY;
      const groqKey =
        (req.headers['x-groq-key'] as string) ||
        (req.body as any).groq_api_key ||
        process.env.GROQ_API_KEY;
      const deepseekKey =
        (req.headers['x-deepseek-key'] as string) ||
        (req.body as any).deepseek_api_key ||
        process.env.DEEPSEEK_API_KEY;
      const openrouterKey =
        (req.headers['x-openrouter-key'] as string) ||
        (req.body as any).openrouter_api_key ||
        process.env.OPENROUTER_API_KEY;

      // 1. Real-time data feed validation (Phase 1)
      const marketDataService = (await import('../services/marketData.service')).default;
      const validationReport = marketDataService.validateCandles(sanitizedCandles, symbol, interval);

      // Extract completed candles only (Phase 1 Requirement 9)
      const completedCandles = marketDataService.getCompletedCandlesOnly(sanitizedCandles, interval);

      // 2. Multi-Timeframe Confirmation (1M, 5M, 15M) (Phase 2)
      let s5mDir: 'CALL' | 'PUT' | 'WAIT' = 'WAIT';
      let s15mDir: 'CALL' | 'PUT' | 'WAIT' = 'WAIT';
      try {
        const [c5m, c15m] = await Promise.all([
          marketDataService.getCandles(symbol, '5min', 40),
          marketDataService.getCandles(symbol, '15min', 40),
        ]);
        const comp5m = marketDataService.getCompletedCandlesOnly(c5m, '5min');
        const comp15m = marketDataService.getCompletedCandlesOnly(c15m, '15min');
        const { analyzeCandlesNative } = await import('../services/nativeSignalEngine');
        const s5m = analyzeCandlesNative(comp5m, symbol, '5min');
        const s15m = analyzeCandlesNative(comp15m, symbol, '15min');
        s5mDir = s5m.direction;
        s15mDir = s15m.direction;
      } catch {}

      // 3. Quantitative 100-Point Scoring Engine (Phase 3 & 4)
      const { analyzeCandlesNative } = await import('../services/nativeSignalEngine');
      const nativeSignal = analyzeCandlesNative(completedCandles, symbol, interval, {
        s5mDirection: s5mDir,
        s15mDirection: s15mDir,
      });

      // 4. Loss Protection Check (Phase 7)
      const riskService = (await import('../services/riskManagement.service')).default;
      const riskAdvice = riskService.evaluateTradePermission();

      const finalSignal: any = {
        ...nativeSignal,
        data_quality: validationReport,
        risk_advice: riskAdvice,
        timeframe_alignment: {
          '1m': nativeSignal.direction === 'WAIT' ? nativeSignal.next_probable_setup?.bias || 'WAIT' : nativeSignal.direction,
          '5m': s5mDir,
          '15m': s15mDir,
          isAligned: s5mDir === s15mDir && s5mDir !== 'WAIT',
          conflictDetected: (s5mDir === 'CALL' && s15mDir === 'PUT') || (s5mDir === 'PUT' && s15mDir === 'CALL'),
        },
      };

      // If feed is stale or corrupted: strictly WAIT (Phase 1)
      if (!validationReport.isValid) {
        finalSignal.direction = 'WAIT';
        finalSignal.trade_quality = validationReport.message;
        finalSignal.reasons.wait_reasons = [validationReport.message];
      }

      // If risk limits triggered (daily loss limit or consecutive losses cooldown) (Phase 7)
      if (!riskAdvice.isTradePermitted) {
        finalSignal.direction = 'WAIT';
        finalSignal.trade_quality = riskAdvice.status;
        finalSignal.reasons.wait_reasons = [
          ...(finalSignal.reasons.wait_reasons || []),
          riskAdvice.reason,
        ];
      }

      // 4. Smart AI Ensemble (Section 3)
      if (geminiKey || openaiKey || groqKey || deepseekKey || openrouterKey) {
        try {
          const { aiProviderService } = await import('../services/aiProvider.service');
          const aiEval = await aiProviderService.evaluateMarketSetup({
            symbol,
            interval,
            technicalDirection: finalSignal.direction,
            technicalScore: finalSignal.confidence,
            candles: sanitizedCandles,
            indicators: {
              rsi: finalSignal.indicators?.rsi?.value ?? 50,
              ema8: finalSignal.indicators?.ema?.ema9 ?? 0,
              ema21: finalSignal.indicators?.ema?.ema21 ?? 0,
              adx: finalSignal.indicators?.adx?.adx ?? 20,
              macdHist: finalSignal.indicators?.macd?.histogram ?? 0,
              ao: 0,
              bullPower: finalSignal.next_probable_setup?.bullishPower ?? 50,
              bearPower: finalSignal.next_probable_setup?.bearishPower ?? 50,
            },
            keys: { geminiKey, openaiKey, groqKey, deepseekKey, openrouterKey },
          });

          if (aiEval) {
            finalSignal.gemini_arbiter = {
              provider: aiEval.provider,
              trap_risk: aiEval.trap_risk,
              analysis_en: aiEval.analysis_en,
              analysis_hi: aiEval.analysis_hi,
              verdict: aiEval.verdict,
              contradiction_detected: aiEval.contradiction_detected,
              models: aiEval.models,
            };

            // Reject contradictory predictions (Section 3)
            if (aiEval.contradiction_detected) {
              finalSignal.direction = 'WAIT';
              finalSignal.trade_quality = 'AI_CONTRADICTION_REJECTED';
              finalSignal.reasons.wait_reasons = [
                ...(finalSignal.reasons.wait_reasons || []),
                aiEval.analysis_en,
              ];
            } else if (aiEval.direction === 'WAIT') {
              finalSignal.direction = 'WAIT';
              finalSignal.trade_quality = 'AI_ARBITER_WAIT';
            }
          }
        } catch {}
      }

      const saved = await signalService.saveSignal(symbol, interval, finalSignal);
      res.status(200).json({
        status: 'OK',
        signalId: saved._id,
        symbol,
        interval,
        timestamp: saved.timestamp,
        signal: finalSignal,
        disclaimer:
          'This signal is for informational purposes only and does not constitute financial advice.',
      });
    } catch (err) {
      const e = err as Error & { status?: string; statusCode?: number };
      if (e.status === 'AI_ENGINE_ERROR' || e.status === 'AI_ENGINE_UNAVAILABLE') {
        res.status(e.statusCode ?? 502).json({ status: e.status, message: e.message });
        return;
      }
      next(err);
    }
  },

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'VALIDATION_ERROR', errors: errors.array() });
      return;
    }

    const symbol = req.query['symbol'] as string | undefined;
    const limit = parseInt((req.query['limit'] as string) || '50', 10);

    try {
      const signals = await signalService.getHistory(symbol, limit);
      res.json({ status: 'OK', count: signals.length, signals });
    } catch (err) {
      next(err);
    }
  },

  async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'VALIDATION_ERROR', errors: errors.array() });
      return;
    }

    const { signalId, entryPrice, exitPrice } = req.body as {
      signalId: string;
      entryPrice: number;
      exitPrice: number;
    };

    try {
      const signal = await signalService.verifySignal(signalId, entryPrice, exitPrice);
      res.json({
        status: 'OK',
        signalId: signal._id,
        outcome: signal.outcome,
        verifiedAt: signal.verifiedAt,
      });
    } catch (err) {
      const e = err as Error & { status?: string; statusCode?: number };
      if (e.status === 'NOT_FOUND') {
        res.status(404).json({ status: 'NOT_FOUND', message: e.message });
        return;
      }
      if (e.status === 'CONFLICT' || e.status === 'VALIDATION_ERROR') {
        res.status(e.statusCode ?? 400).json({ status: e.status, message: e.message });
        return;
      }
      next(err);
    }
  },
};

export default signalController;
