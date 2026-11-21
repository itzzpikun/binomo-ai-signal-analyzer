// ============================================================
// src/models/Performance.model.ts — Aggregated accuracy model
// ============================================================
import mongoose, { Document, Schema } from 'mongoose';

export interface IPerformance extends Document {
  symbol: string;
  interval: string;
  totalSignals: number;
  verifiedSignals: number;
  wins: number;
  losses: number;
  accuracy: number;
  updatedAt: Date;
}

const PerformanceSchema = new Schema<IPerformance>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true },
    interval: { type: String, required: true, enum: ['1min', '5min', '15min'] },
    totalSignals: { type: Number, default: 0 },
    verifiedSignals: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 }, // percentage 0-100
  },
  { timestamps: true }
);

PerformanceSchema.index({ symbol: 1, interval: 1 }, { unique: true });

export const Performance = mongoose.model<IPerformance>('Performance', PerformanceSchema);
