// ============================================================
// src/models/Trade.model.ts — Mongoose model for Trade Logs
// Stores real execution records (time, asset, direction, entry, expiry, stake, result)
// ============================================================
import mongoose, { Document, Schema } from 'mongoose';

export type TradeResult = 'WIN' | 'LOSS' | 'PENDING' | 'TIE';

export interface ITrade extends Document {
  time: Date;
  asset: string;
  direction: 'CALL' | 'PUT';
  entry: number;
  expiry: string;
  stake: number;
  result: TradeResult;
  exitPrice?: number;
  pnl?: number;
  notes?: string;
  source?: 'real' | 'manual' | 'signal';
  signalId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TradeSchema = new Schema<ITrade>(
  {
    time: { type: Date, required: true, default: Date.now, index: true },
    asset: { type: String, required: true, uppercase: true, trim: true, index: true },
    direction: { type: String, required: true, enum: ['CALL', 'PUT'] },
    entry: { type: Number, required: true },
    expiry: { type: String, required: true, default: '5min' },
    stake: { type: Number, required: true, default: 10, min: 0.1 },
    result: { type: String, required: true, enum: ['WIN', 'LOSS', 'PENDING', 'TIE'], default: 'PENDING', index: true },
    exitPrice: { type: Number },
    pnl: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    source: { type: String, enum: ['real', 'manual', 'signal'], default: 'manual' },
    signalId: { type: String, trim: true },
  },
  { timestamps: true }
);

TradeSchema.index({ time: -1 });
TradeSchema.index({ asset: 1, time: -1 });
TradeSchema.index({ result: 1, time: -1 });

export const Trade = mongoose.model<ITrade>('Trade', TradeSchema);
