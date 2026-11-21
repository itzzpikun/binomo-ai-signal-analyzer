// ============================================================
// src/models/Candle.model.ts — OHLC candle cache model
// ============================================================
import mongoose, { Document, Schema } from 'mongoose';

export interface ICandle extends Document {
  symbol: string;
  interval: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  fetchedAt: Date;
}

const CandleSchema = new Schema<ICandle>({
  symbol: { type: String, required: true, uppercase: true, trim: true },
  interval: { type: String, required: true, enum: ['1min', '5min', '15min'] },
  timestamp: { type: Date, required: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number, default: 0 },
  fetchedAt: { type: Date, default: Date.now },
});

// Unique index to avoid duplicate candles
CandleSchema.index({ symbol: 1, interval: 1, timestamp: 1 }, { unique: true });
// TTL: auto-remove candles older than 24 hours
CandleSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 86400 });

export const Candle = mongoose.model<ICandle>('Candle', CandleSchema);
