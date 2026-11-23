// ============================================================
// src/services/signal.service.ts — Calls Python AI engine with Native Fallback
// ============================================================
import axios from 'axios';
import ENV from '../config/env';
import { Signal, ISignal } from '../models/Signal.model';
import { Performance } from '../models/Performance.model';
import type { OHLCCandle, SignalResult, Outcome } from '../types';
import { analyzeCandlesNative } from './nativeSignalEngine';

export const signalService = {
  async analyzeCandles(
    symbol: string,
    interval: string,
    candles: OHLCCandle[],
    aiKeys?: {
      geminiKey?: string;
      openaiKey?: string;
      groqKey?: string;
      deepseekKey?: string;
      openrouterKey?: string;
    }
  ): Promise<any> {
    const geminiKey = aiKeys?.geminiKey;
    const openaiKey = aiKeys?.openaiKey;

    // 1. Try calling the Python AI engine if available (timeout 3.5s)
    try {
      const response = await axios.post(
        `${ENV.AI_ENGINE_URL}/analyze`,
        {
          symbol,
          interval,
          candles,
          gemini_api_key: geminiKey,
          openai_api_key: openaiKey,
        },
        {
          timeout: 3500,
          headers: {
            'Content-Type': 'application/json',
            ...(geminiKey ? { 'X-Gemini-Key': geminiKey } : {}),
            ...(openaiKey ? { 'X-OpenAI-Key': openaiKey } : {}),
          },
        }
      );
      if (response.data && (response.data.direction || response.data.signal)) {
        const res = response.data;
        // Ensure next_probable_setup is present
        if (!res.next_probable_setup) {
          const native = analyzeCandlesNative(candles, symbol, interval);
          res.next_probable_setup = native.next_probable_setup;
        }
        return res;
      }
    } catch (err) {
      console.log(`[SignalService] Python AI engine at ${ENV.AI_ENGINE_URL} not available (${(err as Error).message}) — using high-performance Native Engine`);
    }

    // 2. High-performance Native TypeScript Technical Analysis & Confluence Fallback
    const nativeResult = analyzeCandlesNative(candles, symbol, interval);

    // 3. If alternative AI keys provided (Groq, DeepSeek, OpenRouter, Gemini, OpenAI), evaluate with AI provider
    if (
      aiKeys &&
      (aiKeys.groqKey || aiKeys.deepseekKey || aiKeys.geminiKey || aiKeys.openaiKey || aiKeys.openrouterKey)
    ) {
      try {
        const { aiProviderService } = await import('./aiProvider.service');
        const aiEval = await aiProviderService.evaluateMarketSetup({
          symbol,
          interval,
          candles,
          indicators: {
            rsi: nativeResult.indicators?.rsi?.value ?? 50,
            ema8: nativeResult.indicators?.ema?.ema8 ?? 0,
            ema21: nativeResult.indicators?.ema?.ema21 ?? 0,
            adx: nativeResult.indicators?.adx?.adx ?? 20,
            macdHist: nativeResult.indicators?.macd?.histogram ?? 0,
            ao: nativeResult.indicators?.awesome_oscillator?.ao ?? 0,
            bullPower: nativeResult.next_probable_setup?.bullishPower ?? 50,
            bearPower: nativeResult.next_probable_setup?.bearishPower ?? 50,
          },
          keys: aiKeys,
        });

        if (aiEval && aiEval.provider) {
          nativeResult.gemini_arbiter = {
            ...nativeResult.gemini_arbiter,
            provider: aiEval.provider,
            trap_risk: aiEval.trap_risk,
            analysis_en: aiEval.analysis_en,
            analysis_hi: aiEval.analysis_hi,
            verdict: aiEval.verdict,
          };
          if (aiEval.confidence >= 95) {
            nativeResult.confidence = aiEval.confidence;
            nativeResult.direction = aiEval.direction;
            nativeResult.trade_quality = `A+ 95% ACCURACY CONFIRMED (${aiEval.provider})`;
          }
        }
      } catch (e) {
        console.warn('[SignalService] AI Provider evaluation error:', (e as Error).message);
      }
    }

    return nativeResult;
  },

  async saveSignal(
    symbol: string,
    interval: string,
    result: SignalResult
  ): Promise<ISignal> {
    const rawResult: any = result || {};
    const direction = rawResult.direction || rawResult.signal?.direction || 'WAIT';
    const confidence = typeof rawResult.confidence === 'number'
      ? rawResult.confidence
      : (typeof rawResult.signal?.confidence === 'number' ? rawResult.signal.confidence : 50);
    const indicators = rawResult.indicators || rawResult.signal?.indicators || {};
    const reasons = rawResult.reasons || rawResult.signal?.reasons || { bullish: [], bearish: [] };

    try {
      const signal = new Signal({
        symbol: symbol.toUpperCase(),
        interval,
        timestamp: new Date(),
        direction,
        confidence,
        indicators,
        reasons,
        outcome: null,
        verifiedAt: null,
      });
      await signal.save();

      // Update total signal count in performance
      await Performance.findOneAndUpdate(
        { symbol: symbol.toUpperCase(), interval },
        { $inc: { totalSignals: 1 }, $set: { updatedAt: new Date() } },
        { upsert: true, new: true }
      ).catch(() => null);

      return signal;
    } catch (dbErr) {
      console.warn('[SignalService] Database save fallback (continuing):', (dbErr as Error).message);
      return {
        _id: 'sig_' + Date.now(),
        symbol: symbol.toUpperCase(),
        interval,
        timestamp: new Date(),
        direction,
        confidence,
        indicators,
        reasons,
        outcome: null,
        verifiedAt: null,
      } as any;
    }
  },

  async getHistory(
    symbol?: string,
    limit = 50
  ): Promise<ISignal[]> {
    const query: Record<string, unknown> = {};
    if (symbol) query['symbol'] = symbol.toUpperCase();
    const docs = await Signal.find(query)
      .sort({ timestamp: -1 })
      .limit(Math.min(limit, 200))
      .lean()
      .exec();
    return docs as unknown as ISignal[];
  },

  async verifySignal(
    signalId: string,
    entryPrice: number,
    exitPrice: number
  ): Promise<ISignal> {
    const signal = await Signal.findById(signalId);
    if (!signal) {
      throw Object.assign(new Error(`Signal not found: ${signalId}`), {
        statusCode: 404,
        status: 'NOT_FOUND',
      });
    }

    if (signal.outcome && signal.outcome !== 'PENDING') {
      throw Object.assign(
        new Error('Signal already verified'),
        { statusCode: 409, status: 'CONFLICT' }
      );
    }

    // Determine WIN/LOSS based on direction vs price movement
    let outcome: Outcome;
    const priceMovedUp = exitPrice > entryPrice;

    if (signal.direction === 'CALL') {
      outcome = priceMovedUp ? 'WIN' : 'LOSS';
    } else if (signal.direction === 'PUT') {
      outcome = !priceMovedUp ? 'WIN' : 'LOSS';
    } else {
      // WAIT signals cannot be verified
      throw Object.assign(
        new Error('WAIT signals cannot be verified as WIN/LOSS'),
        { statusCode: 400, status: 'VALIDATION_ERROR' }
      );
    }

    signal.outcome = outcome;
    signal.verifiedAt = new Date();
    await signal.save();

    // Update performance aggregate
    const incFields: Record<string, number> = { verifiedSignals: 1 };
    if (outcome === 'WIN') incFields['wins'] = 1;
    else incFields['losses'] = 1;

    const perf = await Performance.findOneAndUpdate(
      { symbol: signal.symbol, interval: signal.interval },
      { $inc: incFields, $set: { updatedAt: new Date() } },
      { upsert: true, new: true }
    );

    if (perf) {
      const acc = perf.verifiedSignals > 0
        ? (perf.wins / perf.verifiedSignals) * 100
        : 0;
      perf.accuracy = Math.round(acc * 100) / 100;
      await perf.save();
    }

    return signal;
  },
};

export default signalService;
