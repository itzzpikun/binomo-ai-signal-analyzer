// ============================================================
// src/models/Signal.model.ts — Mongoose model for trade signals
// ============================================================
import mongoose, { Document, Schema } from 'mongoose';
import type { Direction, Outcome, SignalIndicators, SignalReasons } from '../types';

export interface ISignal extends Document {
  symbol: string;
  interval: string;
  timestamp: Date;
  direction: Direction;
  confidence: number;
  indicators: SignalIndicators;
  reasons: SignalReasons;
  outcome: Outcome | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SignalSchema = new Schema<ISignal>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    interval: { type: String, required: true, enum: ['1min', '5min', '15min'] },
    timestamp: { type: Date, required: true, index: true },
    direction: { type: String, required: true, enum: ['CALL', 'PUT', 'WAIT'] },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    indicators: { type: Schema.Types.Mixed, default: {} },
    reasons: {
      bullish: { type: [String], default: [] },
      bearish: { type: [String], default: [] },
    },
    outcome: { type: String, enum: ['WIN', 'LOSS', 'PENDING', null], default: null },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SignalSchema.index({ symbol: 1, timestamp: -1 });
SignalSchema.index({ outcome: 1, symbol: 1 });

export const Signal = mongoose.model<ISignal>('Signal', SignalSchema);
