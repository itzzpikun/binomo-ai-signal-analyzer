// ============================================================
// src/services/signal.service.ts — Calls Python AI engine
// ============================================================
import axios, { AxiosError } from 'axios';
import ENV from '../config/env';
import { Signal, ISignal } from '../models/Signal.model';
import { Performance } from '../models/Performance.model';
import type { OHLCCandle, SignalResult, Direction, Outcome } from '../types';

export const signalService = {
  async analyzeCandles(
    symbol: string,
    interval: string,
    candles: OHLCCandle[]
  ): Promise<SignalResult> {
    try {
      const response = await axios.post(
        `${ENV.AI_ENGINE_URL}/analyze`,
        { symbol, interval, candles },
        { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
      );
      return response.data as SignalResult;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response) {
        throw Object.assign(
          new Error(`AI engine error ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`),
          { statusCode: 502, status: 'AI_ENGINE_ERROR' }
        );
      }
      throw Object.assign(
        new Error(`Cannot reach AI engine at ${ENV.AI_ENGINE_URL}: ${(err as Error).message}`),
        { statusCode: 503, status: 'AI_ENGINE_UNAVAILABLE' }
      );
    }
  },

  async saveSignal(
    symbol: string,
    interval: string,
    result: SignalResult
  ): Promise<ISignal> {
    const signal = new Signal({
      symbol: symbol.toUpperCase(),
      interval,
      timestamp: new Date(),
      direction: result.direction,
      confidence: result.confidence,
      indicators: result.indicators,
      reasons: result.reasons,
      outcome: null,
      verifiedAt: null,
    });
    await signal.save();

    // Update total signal count in performance
    await Performance.findOneAndUpdate(
      { symbol: symbol.toUpperCase(), interval },
      { $inc: { totalSignals: 1 }, $set: { updatedAt: new Date() } },
      { upsert: true, new: true }
    );

    return signal;
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
