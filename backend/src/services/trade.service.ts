// ============================================================
// src/services/trade.service.ts — Trade Log & Risk Management Service
// Computes real statistical performance, expectancy over last 50 trades,
// and daily loss limits (3 losses or -5% drawdown).
// ============================================================
import { Trade, ITrade, TradeResult } from '../models/Trade.model';

export interface CreateTradeDTO {
  time?: Date | string;
  asset: string;
  direction: 'CALL' | 'PUT';
  entry: number;
  expiry?: string;
  stake?: number;
  result?: TradeResult;
  exitPrice?: number;
  notes?: string;
  source?: 'real' | 'manual' | 'signal';
  signalId?: string;
}

export interface RiskStatus {
  negativeExpectancy: {
    active: boolean;
    sampleSize: number;
    winRate: number;
    expectancyPerTrade: number;
    message?: string;
  };
  dailyLimit: {
    active: boolean;
    lossesToday: number;
    pnlToday: number;
    pnlTodayPct: number;
    reason?: string;
    message?: string;
  };
}

export interface PerformanceStats {
  totalSignals: number;
  verifiedSignals: number;
  wins: number;
  losses: number;
  accuracy: number;
  bestAsset: string | null;
  totalPnL: number;
  profitFactor: number;
  byAsset: Array<{
    symbol: string;
    totalSignals: number;
    verifiedSignals: number;
    wins: number;
    losses: number;
    accuracy: number;
    pnl: number;
  }>;
  byTimeframe: Array<{
    interval: string;
    totalSignals: number;
    verifiedSignals: number;
    accuracy: number;
  }>;
  riskStatus: RiskStatus;
}

// In-memory fallback if MongoDB is not reachable
const inMemoryTrades: any[] = [];

class TradeService {
  private calculatePnL(stake: number, result: TradeResult): number {
    if (result === 'WIN') {
      return Math.round(stake * 0.85 * 100) / 100; // Standard 85% binary options payout
    }
    if (result === 'LOSS') {
      return -Math.round(stake * 100) / 100;
    }
    return 0; // PENDING or TIE
  }

  async logTrade(dto: CreateTradeDTO): Promise<ITrade> {
    const time = dto.time ? new Date(dto.time) : new Date();
    const stake = dto.stake && dto.stake > 0 ? dto.stake : 10;
    const result: TradeResult = dto.result || 'PENDING';
    const pnl = this.calculatePnL(stake, result);

    const tradeData = {
      time,
      asset: dto.asset.toUpperCase().trim(),
      direction: dto.direction,
      entry: dto.entry,
      expiry: dto.expiry || '5min',
      stake,
      result,
      exitPrice: dto.exitPrice,
      pnl,
      notes: dto.notes,
      source: dto.source || 'manual',
      signalId: dto.signalId,
    };

    try {
      const trade = new Trade(tradeData);
      const saved = await trade.save();
      inMemoryTrades.unshift(saved.toObject());
      return saved;
    } catch {
      // Fallback in-memory
      const fallback = {
        _id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        ...tradeData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryTrades.unshift(fallback);
      return fallback as unknown as ITrade;
    }
  }

  async updateTradeResult(tradeId: string, result: TradeResult, exitPrice?: number): Promise<ITrade | null> {
    try {
      const trade = await Trade.findById(tradeId);
      if (trade) {
        trade.result = result;
        if (exitPrice !== undefined) trade.exitPrice = exitPrice;
        trade.pnl = this.calculatePnL(trade.stake, result);
        const updated = await trade.save();

        const idx = inMemoryTrades.findIndex((t) => String(t._id) === String(tradeId));
        if (idx >= 0) inMemoryTrades[idx] = updated.toObject();
        return updated;
      }
    } catch {
      // Fallback check in memory
    }

    const memTrade = inMemoryTrades.find((t) => String(t._id) === String(tradeId));
    if (memTrade) {
      memTrade.result = result;
      if (exitPrice !== undefined) memTrade.exitPrice = exitPrice;
      memTrade.pnl = this.calculatePnL(memTrade.stake, result);
      memTrade.updatedAt = new Date();
      return memTrade as unknown as ITrade;
    }

    return null;
  }

  async getTrades(limit = 100, asset?: string): Promise<ITrade[]> {
    const query: any = {};
    if (asset) query.asset = asset.toUpperCase().trim();

    try {
      const trades = await Trade.find(query).sort({ time: -1 }).limit(limit).lean().exec();
      if (trades.length > 0) return trades as unknown as ITrade[];
    } catch {
      // Use fallback
    }

    let filtered = inMemoryTrades;
    if (asset) {
      filtered = filtered.filter((t) => t.asset === asset.toUpperCase().trim());
    }
    return filtered.slice(0, limit) as unknown as ITrade[];
  }

  async computeRiskStatus(): Promise<RiskStatus> {
    let allTrades: any[] = [];
    try {
      allTrades = await Trade.find().sort({ time: -1 }).limit(200).lean().exec();
    } catch {
      allTrades = inMemoryTrades;
    }
    if (allTrades.length === 0) allTrades = inMemoryTrades;

    // ── 1. Check Negative Expectancy over the last 50 closed trades ─────────
    const closedTrades = allTrades.filter((t) => t.result === 'WIN' || t.result === 'LOSS');
    const last50 = closedTrades.slice(0, 50);

    let negativeExpActive = false;
    let winRate50 = 0;
    let expectancy = 0;
    let expMessage: string | undefined = undefined;

    if (last50.length >= 5) {
      const wins = last50.filter((t) => t.result === 'WIN');
      const losses = last50.filter((t) => t.result === 'LOSS');

      winRate50 = wins.length / last50.length;
      const totalWinPnl = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const totalLossPnl = losses.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0);

      const avgWin = wins.length > 0 ? totalWinPnl / wins.length : 0;
      const avgLoss = losses.length > 0 ? totalLossPnl / losses.length : 0;

      // Expectancy formula: (Win% * AvgWin) - (Loss% * AvgLoss)
      expectancy = winRate50 * avgWin - (1 - winRate50) * avgLoss;
      expectancy = Math.round(expectancy * 100) / 100;

      if (expectancy < 0) {
        negativeExpActive = true;
        expMessage = `⚠️ Negative Expectancy Warning: The last ${last50.length} trades have negative statistical expectancy (${expectancy < 0 ? '-$' + Math.abs(expectancy).toFixed(2) : '$0.00'} per trade at ${Math.round(winRate50 * 100)}% win-rate). Current edge is negative; pause trading to preserve capital.`;
      }
    }

    // ── 2. Check Daily Limit (3 losses or -5% drawdown) ────────────────────
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

    const todayTrades = closedTrades.filter((t) => new Date(t.time) >= startOfToday);
    const lossesToday = todayTrades.filter((t) => t.result === 'LOSS').length;
    const pnlToday = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    // Standard assumed bankroll of $1000 or 100x average stake
    const assumedBankroll = 1000;
    const pnlTodayPct = Math.round((pnlToday / assumedBankroll) * 10000) / 100;

    let dailyLimitHit = false;
    let dailyReason: string | undefined = undefined;
    let dailyMessage: string | undefined = undefined;

    if (lossesToday >= 3) {
      dailyLimitHit = true;
      dailyReason = '3 losses hit today';
      dailyMessage = `🛑 Daily Risk Limit Hit: 3 losses reached today (${lossesToday} losses, P&L: ${pnlToday >= 0 ? '+$' : '-$'}${Math.abs(pnlToday).toFixed(2)}). Trading is halted for today to avoid revenge trading and capital drawdown.`;
    } else if (pnlTodayPct <= -5.0) {
      dailyLimitHit = true;
      dailyReason = '-5% daily drawdown hit';
      dailyMessage = `🛑 Daily Risk Limit Hit: -5% drawdown limit reached today (${pnlTodayPct.toFixed(1)}% / ${pnlToday < 0 ? '-$' + Math.abs(pnlToday).toFixed(2) : '$0.00'}). Trading is halted for today to preserve capital.`;
    }

    return {
      negativeExpectancy: {
        active: negativeExpActive,
        sampleSize: last50.length,
        winRate: Math.round(winRate50 * 100),
        expectancyPerTrade: expectancy,
        message: expMessage,
      },
      dailyLimit: {
        active: dailyLimitHit,
        lossesToday,
        pnlToday: Math.round(pnlToday * 100) / 100,
        pnlTodayPct,
        reason: dailyReason,
        message: dailyMessage,
      },
    };
  }

  async getPerformanceSummary(): Promise<PerformanceStats> {
    const riskStatus = await this.computeRiskStatus();

    let trades: any[] = [];
    try {
      trades = await Trade.find().lean().exec();
    } catch {
      trades = inMemoryTrades;
    }
    if (trades.length === 0) trades = inMemoryTrades;

    const totalSignals = trades.length;
    const verified = trades.filter((t) => t.result === 'WIN' || t.result === 'LOSS');
    const wins = verified.filter((t) => t.result === 'WIN').length;
    const losses = verified.filter((t) => t.result === 'LOSS').length;
    const verifiedSignals = verified.length;

    const accuracy = verifiedSignals > 0 ? Math.round((wins / verifiedSignals) * 1000) / 10 : 0;
    const totalPnL = Math.round(verified.reduce((sum, t) => sum + (t.pnl || 0), 0) * 100) / 100;

    const grossProfit = verified.filter((t) => t.result === 'WIN').reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(verified.filter((t) => t.result === 'LOSS').reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? 99.0 : 0;

    // By asset breakdown
    const assetMap = new Map<string, { total: number; verified: number; wins: number; losses: number; pnl: number }>();
    for (const t of trades) {
      const sym = t.asset || 'EUR/USD';
      if (!assetMap.has(sym)) {
        assetMap.set(sym, { total: 0, verified: 0, wins: 0, losses: 0, pnl: 0 });
      }
      const item = assetMap.get(sym)!;
      item.total++;
      if (t.result === 'WIN') {
        item.verified++;
        item.wins++;
        item.pnl += t.pnl || 0;
      } else if (t.result === 'LOSS') {
        item.verified++;
        item.losses++;
        item.pnl += t.pnl || 0;
      }
    }

    const byAsset = Array.from(assetMap.entries()).map(([symbol, stat]) => ({
      symbol,
      totalSignals: stat.total,
      verifiedSignals: stat.verified,
      wins: stat.wins,
      losses: stat.losses,
      accuracy: stat.verified > 0 ? Math.round((stat.wins / stat.verified) * 1000) / 10 : 0,
      pnl: Math.round(stat.pnl * 100) / 100,
    }));

    // Best asset: only report if verified >= 5, otherwise null
    const validAssets = byAsset.filter((a) => a.verifiedSignals >= 5);
    const bestAsset = validAssets.length > 0 ? validAssets.reduce((b, a) => (a.accuracy > b.accuracy ? a : b)).symbol : null;

    // By timeframe
    const tfMap = new Map<string, { total: number; verified: number; wins: number }>();
    for (const t of trades) {
      const interval = t.expiry || '5min';
      if (!tfMap.has(interval)) tfMap.set(interval, { total: 0, verified: 0, wins: 0 });
      const stat = tfMap.get(interval)!;
      stat.total++;
      if (t.result === 'WIN' || t.result === 'LOSS') {
        stat.verified++;
        if (t.result === 'WIN') stat.wins++;
      }
    }

    const byTimeframe = Array.from(tfMap.entries()).map(([interval, stat]) => ({
      interval,
      totalSignals: stat.total,
      verifiedSignals: stat.verified,
      accuracy: stat.verified > 0 ? Math.round((stat.wins / stat.verified) * 1000) / 10 : 0,
    }));

    return {
      totalSignals,
      verifiedSignals,
      wins,
      losses,
      accuracy,
      bestAsset,
      totalPnL,
      profitFactor,
      byAsset,
      byTimeframe,
      riskStatus,
    };
  }
}

export const tradeService = new TradeService();
export default tradeService;
