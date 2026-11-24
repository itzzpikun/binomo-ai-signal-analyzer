"""
Loss Protection & Capital Preservation System for AI Engine (Phase 7).
Enforces:
1. Max stake: 0.5% of trading bankroll per trade.
2. Daily loss limit: 2% of bankroll.
3. Max consecutive losses: 3 -> triggers cooling-off period.
4. Freeze trade generation to WAIT when risk thresholds breached.
5. Strict Anti-Martingale & Anti-Revenge enforcement.
"""
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional


class RiskManager:
    def __init__(self, bankroll: float = 1000.0):
        self.bankroll = bankroll
        self.max_stake_pct = 0.5  # 0.5%
        self.daily_loss_limit_pct = 2.0  # 2.0%
        self.max_consecutive_losses = 3
        self.cooldown_minutes = 30

        self.current_daily_loss = 0.0
        self.consecutive_losses = 0
        self.cooldown_until = 0.0
        self.trades_today = 0
        self.wins_today = 0
        self.losses_today = 0

    def evaluate_permission(self) -> Dict[str, Any]:
        now = time.time()
        max_allowed_stake = round((self.bankroll * self.max_stake_pct) / 100.0, 2)
        max_daily_loss = round((self.bankroll * self.daily_loss_limit_pct) / 100.0, 2)

        anti_martingale = "STRICT ANTI-MARTINGALE POLICY: Never double your stake after a loss. Keep stake flat at 0.5% of bankroll."

        if self.current_daily_loss >= max_daily_loss:
            return {
                "permitted": False,
                "status": "DAILY_LIMIT_HALT",
                "recommended_stake": 0.0,
                "max_stake": max_allowed_stake,
                "reason": f"Daily loss limit ({self.daily_loss_limit_pct}% / ${max_daily_loss:.2f}) reached. Capital protection active.",
                "anti_martingale": anti_martingale,
            }

        if now < self.cooldown_until:
            rem_sec = int(self.cooldown_until - now)
            return {
                "permitted": False,
                "status": "COOLDOWN_ACTIVE",
                "recommended_stake": 0.0,
                "max_stake": max_allowed_stake,
                "cooldown_remaining_seconds": rem_sec,
                "reason": f"Cooldown active ({rem_sec}s remaining) following {self.max_consecutive_losses} consecutive losses.",
                "anti_martingale": anti_martingale,
            }

        return {
            "permitted": True,
            "status": "PERMITTED",
            "recommended_stake": max_allowed_stake,
            "max_stake": max_allowed_stake,
            "reason": f"Trade permitted under capital protection rules (0.5% stake: ${max_allowed_stake:.2f}).",
            "anti_martingale": anti_martingale,
        }

    def record_outcome(self, outcome: str, stake: float):
        self.trades_today += 1
        if outcome == "WIN":
            self.wins_today += 1
            self.consecutive_losses = 0
        elif outcome == "LOSS":
            self.losses_today += 1
            self.consecutive_losses += 1
            self.current_daily_loss += stake
            if self.consecutive_losses >= self.max_consecutive_losses:
                self.cooldown_until = time.time() + (self.cooldown_minutes * 60)

    def reset_daily(self):
        self.current_daily_loss = 0.0
        self.consecutive_losses = 0
        self.cooldown_until = 0.0
        self.trades_today = 0
        self.wins_today = 0
        self.losses_today = 0

    def get_state(self) -> Dict[str, Any]:
        return {
            "currentDailyLoss": self.current_daily_loss,
            "consecutiveLosses": self.consecutive_losses,
            "isDailyLimitBreached": self.current_daily_loss >= (self.bankroll * self.daily_loss_limit_pct / 100.0),
            "isCooldownActive": time.time() < self.cooldown_until,
            "tradesTodayCount": self.trades_today,
            "dailyWins": self.wins_today,
            "dailyLosses": self.losses_today,
        }

    def get_settings(self) -> Dict[str, Any]:
        return {
            "bankroll": self.bankroll,
            "maxStakePercentage": self.max_stake_pct,
            "dailyLossLimitPercentage": self.daily_loss_limit_pct,
            "maxConsecutiveLosses": self.max_consecutive_losses,
            "cooldownMinutes": self.cooldown_minutes,
        }

    def update_settings(self, partial: Dict[str, Any]):
        if "bankroll" in partial:
            self.bankroll = max(10.0, float(partial["bankroll"]))
        if "maxStakePercentage" in partial:
            self.max_stake_pct = min(5.0, max(0.1, float(partial["maxStakePercentage"])))
        if "dailyLossLimitPercentage" in partial:
            self.daily_loss_limit_pct = min(20.0, max(0.5, float(partial["dailyLossLimitPercentage"])))
        if "maxConsecutiveLosses" in partial:
            self.max_consecutive_losses = min(10, max(1, int(partial["maxConsecutiveLosses"])))
        if "cooldownMinutes" in partial:
            self.cooldown_minutes = min(120, max(5, int(partial["cooldownMinutes"])))


risk_manager = RiskManager()
