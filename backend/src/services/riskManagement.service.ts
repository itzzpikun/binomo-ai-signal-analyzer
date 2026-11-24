// ============================================================
// src/services/riskManagement.service.ts
// Loss Protection & Capital Preservation System (Phase 7)
// Enforces:
// 1. Max stake: 0.5% of trading bankroll per trade.
// 2. Daily loss limit: 2% of bankroll.
// 3. Max consecutive losses: 3 -> triggers 30-minute cooling-off period.
// 4. Signal freeze: halts CALL/PUT generation into WAIT when limits are breached.
// 5. Anti-Martingale / Anti-Revenge protection: Strictly forbids doubling stakes.
// 6. Analysis-only: never executes automatic trades.
// ============================================================

export interface RiskSettings {
  bankroll: number;              // Total available trading balance (e.g. $1000)
  maxStakePercentage: number;    // Default 0.5%
  dailyLossLimitPercentage: number; // Default 2.0%
  maxConsecutiveLosses: number;  // Default 3
  cooldownMinutes: number;       // Default 30 min cooldown
}

export interface RiskState {
  currentDailyLoss: number;
  consecutiveLosses: number;
  isDailyLimitBreached: boolean;
  isCooldownActive: boolean;
  cooldownUntil: string | null;
  tradesTodayCount: number;
  dailyWins: number;
  dailyLosses: number;
  lastUpdated: string;
}

export interface TradeRiskAdvice {
  isTradePermitted: boolean;
  status: 'PERMITTED' | 'DAILY_LIMIT_HALT' | 'COOLDOWN_ACTIVE';
  recommendedStake: number;
  maxAllowedStake: number;
  reason: string;
  cooldownRemainingSeconds: number;
  antiMartingaleWarning: string;
}

class RiskManagementService {
  private settings: RiskSettings = {
    bankroll: 1000,
    maxStakePercentage: 0.5, // 0.5%
    dailyLossLimitPercentage: 2.0, // 2.0%
    maxConsecutiveLosses: 3,
    cooldownMinutes: 30,
  };

  private state: RiskState = {
    currentDailyLoss: 0,
    consecutiveLosses: 0,
    isDailyLimitBreached: false,
    isCooldownActive: false,
    cooldownUntil: null,
    tradesTodayCount: 0,
    dailyWins: 0,
    dailyLosses: 0,
    lastUpdated: new Date().toISOString(),
  };

  public getSettings(): RiskSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<RiskSettings>): RiskSettings {
    this.settings = {
      ...this.settings,
      ...partial,
      bankroll: Math.max(10, partial.bankroll ?? this.settings.bankroll),
      maxStakePercentage: Math.min(5.0, Math.max(0.1, partial.maxStakePercentage ?? this.settings.maxStakePercentage)),
      dailyLossLimitPercentage: Math.min(20.0, Math.max(0.5, partial.dailyLossLimitPercentage ?? this.settings.dailyLossLimitPercentage)),
      maxConsecutiveLosses: Math.min(10, Math.max(1, partial.maxConsecutiveLosses ?? this.settings.maxConsecutiveLosses)),
      cooldownMinutes: Math.min(120, Math.max(5, partial.cooldownMinutes ?? this.settings.cooldownMinutes)),
    };
    return this.getSettings();
  }

  public getState(): RiskState {
    this.checkCooldownExpiry();
    return { ...this.state };
  }

  private checkCooldownExpiry(): void {
    if (this.state.isCooldownActive && this.state.cooldownUntil) {
      const untilMs = new Date(this.state.cooldownUntil).getTime();
      if (Date.now() >= untilMs) {
        this.state.isCooldownActive = false;
        this.state.cooldownUntil = null;
        this.state.consecutiveLosses = 0;
      }
    }
  }

  /**
   * Evaluate whether a trade is permitted under institutional risk rules.
   */
  public evaluateTradePermission(): TradeRiskAdvice {
    this.checkCooldownExpiry();

    const maxAllowedStake = (this.settings.bankroll * this.settings.maxStakePercentage) / 100.0;
    const maxDailyLossAmount = (this.settings.bankroll * this.settings.dailyLossLimitPercentage) / 100.0;

    const antiMartingaleWarning =
      'STRICT ANTI-MARTINGALE POLICY: Never double your stake after a loss. Always keep your stake flat at 0.5% of bankroll.';

    // 1. Check daily loss limit
    if (this.state.currentDailyLoss >= maxDailyLossAmount) {
      this.state.isDailyLimitBreached = true;
      return {
        isTradePermitted: false,
        status: 'DAILY_LIMIT_HALT',
        recommendedStake: 0,
        maxAllowedStake,
        reason: `Daily loss limit of ${this.settings.dailyLossLimitPercentage}% ($${maxDailyLossAmount.toFixed(2)}) reached. Trading halted until tomorrow to protect capital.`,
        cooldownRemainingSeconds: 0,
        antiMartingaleWarning,
      };
    }

    // 2. Check cooldown from consecutive losses
    if (this.state.isCooldownActive && this.state.cooldownUntil) {
      const remainingMs = Math.max(0, new Date(this.state.cooldownUntil).getTime() - Date.now());
      const remainingSec = Math.floor(remainingMs / 1000);
      return {
        isTradePermitted: false,
        status: 'COOLDOWN_ACTIVE',
        recommendedStake: 0,
        maxAllowedStake,
        reason: `Loss protection active: ${this.settings.maxConsecutiveLosses} consecutive losses triggered a ${this.settings.cooldownMinutes}-minute cooling-off period.`,
        cooldownRemainingSeconds: remainingSec,
        antiMartingaleWarning,
      };
    }

    return {
      isTradePermitted: true,
      status: 'PERMITTED',
      recommendedStake: Math.round(maxAllowedStake * 100) / 100,
      maxAllowedStake: Math.round(maxAllowedStake * 100) / 100,
      reason: `Trade permitted within risk boundaries (0.5% max stake: $${maxAllowedStake.toFixed(2)}).`,
      cooldownRemainingSeconds: 0,
      antiMartingaleWarning,
    };
  }

  /**
   * Record trade outcome to track drawdowns and consecutive losses.
   */
  public recordTradeOutcome(outcome: 'WIN' | 'LOSS' | 'TIE', stakeAmount: number): RiskState {
    this.state.tradesTodayCount++;
    this.state.lastUpdated = new Date().toISOString();

    if (outcome === 'WIN') {
      this.state.dailyWins++;
      this.state.consecutiveLosses = 0;
    } else if (outcome === 'LOSS') {
      this.state.dailyLosses++;
      this.state.consecutiveLosses++;
      this.state.currentDailyLoss += stakeAmount;

      // Check consecutive losses limit
      if (this.state.consecutiveLosses >= this.settings.maxConsecutiveLosses) {
        this.state.isCooldownActive = true;
        this.state.cooldownUntil = new Date(Date.now() + this.settings.cooldownMinutes * 60 * 1000).toISOString();
      }

      // Check daily loss limit
      const maxDailyLossAmount = (this.settings.bankroll * this.settings.dailyLossLimitPercentage) / 100.0;
      if (this.state.currentDailyLoss >= maxDailyLossAmount) {
        this.state.isDailyLimitBreached = true;
      }
    }

    return this.getState();
  }

  public resetDailyStats(): RiskState {
    this.state = {
      currentDailyLoss: 0,
      consecutiveLosses: 0,
      isDailyLimitBreached: false,
      isCooldownActive: false,
      cooldownUntil: null,
      tradesTodayCount: 0,
      dailyWins: 0,
      dailyLosses: 0,
      lastUpdated: new Date().toISOString(),
    };
    return this.getState();
  }
}

export const riskManagementService = new RiskManagementService();
export default riskManagementService;
