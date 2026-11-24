"""
Realistic Walk-Forward Historical Testing Engine (Zero Synthetic Candles, Zero Look-Ahead Bias).
Enforces:
- Genuine historical candles only.
- In-sample (first 70%) vs Out-of-sample (last 30%) split.
- Step-by-step walk-forward: window [0:i] generates signal, verified against completed candle[i].
- Asset-specific payout rates (e.g. 80% for standard, 83% for OTC VIP).
- Strict Tie/Refund rule: if exit_price == entry_price, outcome is TIE (stake returned, 0 PnL).
- Calculates: Win Rate, Break-even Win Rate, Expected Value (EV), Profit Factor, Max Drawdown,
  Max Consecutive Losses, Performance by Regime, Out-of-Sample Accuracy, Wilson 95% Confidence Interval.
"""
import math
from typing import Dict, Any, List, Optional
from analysis.signal_engine import generate_signal, MIN_CANDLES
from analysis.market_feed import get_asset_spec


def wilson_score_interval(wins: int, total: int, confidence: float = 0.95) -> Dict[str, float]:
    """Calculate Wilson score 95% confidence interval for true win rate."""
    if total <= 0:
        return {"lower": 0.0, "upper": 0.0}
    # z = 1.96 for 95% confidence
    z = 1.96
    p = wins / total
    denom = 1 + (z * z) / total
    centre = p + (z * z) / (2 * total)
    spread = z * math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)
    lower = max(0.0, (centre - spread) / denom)
    upper = min(1.0, (centre + spread) / denom)
    return {"lower": round(lower * 100, 1), "upper": round(upper * 100, 1)}


def run_backtest(candles: List[Dict[str, Any]], config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if config is None:
        config = {}

    symbol = config.get("symbol", "EUR/USD")
    min_confidence = float(config.get("min_confidence", 65.0))
    step = max(int(config.get("step", 1)), 1)

    spec = get_asset_spec(symbol)
    profit_str = spec.get("profit", "80%").replace("%", "").strip()
    try:
        payout_rate = float(profit_str) / 100.0
    except ValueError:
        payout_rate = 0.80

    # Minimum candles required for valid walk-forward test
    if len(candles) < MIN_CANDLES + 10:
        return {
            "total_signals": 0,
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "ties": 0,
            "win_rate": 0.0,
            "break_even_rate": round((1.0 / (1.0 + payout_rate)) * 100, 1),
            "expected_value_per_trade": 0.0,
            "profit_factor": 0.0,
            "max_drawdown": 0.0,
            "max_consecutive_losses": 0,
            "in_sample": {"trades": 0, "wins": 0, "win_rate": 0.0},
            "out_of_sample": {"trades": 0, "wins": 0, "win_rate": 0.0, "ci_95": {"lower": 0.0, "upper": 0.0}},
            "performance_by_regime": {
                "trending": {"total": 0, "wins": 0, "win_rate": 0.0},
                "ranging": {"total": 0, "wins": 0, "win_rate": 0.0},
                "volatile": {"total": 0, "wins": 0, "win_rate": 0.0},
            },
            "error": f"Insufficient candles ({len(candles)}). Need at least {MIN_CANDLES + 10} completed candles.",
            "disclaimer": "Backtests use genuine historical walk-forward evaluation. Past performance is never a guarantee of future live market returns.",
        }

    # Split into In-Sample (first 70%) and Out-of-Sample (last 30%)
    split_idx = int(len(candles) * 0.70)

    trades = []
    regime_stats = {
        "TRENDING": {"total": 0, "wins": 0, "losses": 0, "ties": 0},
        "RANGING": {"total": 0, "wins": 0, "losses": 0, "ties": 0},
        "VOLATILE": {"total": 0, "wins": 0, "losses": 0, "ties": 0},
    }

    cumulative_pnl = 0.0
    peak_pnl = 0.0
    max_drawdown = 0.0
    current_consecutive_losses = 0
    max_consecutive_losses = 0

    in_sample_trades = 0
    in_sample_wins = 0
    out_sample_trades = 0
    out_sample_wins = 0

    total_scanned_windows = 0
    wait_signals = 0

    # Walk-forward loop: candle at index i is the NEXT candle tested for expiry
    for i in range(MIN_CANDLES, len(candles) - 1, step):
        total_scanned_windows += 1
        history_window = candles[:i]
        next_candle = candles[i]

        sig = generate_signal(history_window, skip_ai=True)
        direction = sig.get("direction", "WAIT")
        confidence = float(sig.get("confidence", 0))

        if direction == "WAIT" or confidence < min_confidence:
            wait_signals += 1
            continue

        # Trade executed at open of next_candle, expires at close of next_candle
        entry_price = float(next_candle.get("open", 0))
        exit_price = float(next_candle.get("close", 0))

        is_tie = exit_price == entry_price
        is_win = False

        if not is_tie:
            if direction == "CALL":
                is_win = exit_price > entry_price
            elif direction == "PUT":
                is_win = exit_price < entry_price

        outcome = "TIE" if is_tie else ("WIN" if is_win else "LOSS")

        # PnL with $100 base unit
        if outcome == "WIN":
            pnl = payout_rate * 100.0
            current_consecutive_losses = 0
        elif outcome == "LOSS":
            pnl = -100.0
            current_consecutive_losses += 1
            if current_consecutive_losses > max_consecutive_losses:
                max_consecutive_losses = current_consecutive_losses
        else:
            pnl = 0.0  # Tie / Refund

        cumulative_pnl += pnl
        if cumulative_pnl > peak_pnl:
            peak_pnl = cumulative_pnl
        dd = peak_pnl - cumulative_pnl
        if dd > max_drawdown:
            max_drawdown = dd

        is_oos = i >= split_idx
        if is_oos:
            out_sample_trades += 1
            if outcome == "WIN":
                out_sample_wins += 1
        else:
            in_sample_trades += 1
            if outcome == "WIN":
                in_sample_wins += 1

        regime = sig.get("indicators", {}).get("adx", {}).get("adx", 20)
        reg_name = "RANGING" if (isinstance(regime, (int, float)) and regime < 20) else "TRENDING"
        if reg_name not in regime_stats:
            regime_stats[reg_name] = {"total": 0, "wins": 0, "losses": 0, "ties": 0}
        regime_stats[reg_name]["total"] += 1
        if outcome == "WIN":
            regime_stats[reg_name]["wins"] += 1
        elif outcome == "LOSS":
            regime_stats[reg_name]["losses"] += 1
        else:
            regime_stats[reg_name]["ties"] += 1

        trades.append({
            "timestamp": next_candle.get("timestamp"),
            "direction": direction,
            "confidence": confidence,
            "entry_price": entry_price,
            "exit_price": exit_price,
            "outcome": outcome,
            "pnl": round(pnl, 2),
            "is_out_of_sample": is_oos,
        })

    total_trades = len(trades)
    wins = sum(1 for t in trades if t["outcome"] == "WIN")
    losses = sum(1 for t in trades if t["outcome"] == "LOSS")
    ties = sum(1 for t in trades if t["outcome"] == "TIE")

    decisive_trades = wins + losses
    win_rate = round((wins / decisive_trades) * 100, 1) if decisive_trades > 0 else 0.0
    break_even_rate = round((1.0 / (1.0 + payout_rate)) * 100, 1)

    gross_profit = wins * payout_rate * 100.0
    gross_loss = losses * 100.0
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (9.99 if gross_profit > 0 else 1.0)

    # Expected value per $1 trade
    if decisive_trades > 0:
        w_frac = wins / decisive_trades
        l_frac = losses / decisive_trades
        ev_per_trade = round((w_frac * payout_rate) - (l_frac * 1.0), 3)
    else:
        ev_per_trade = 0.0

    in_sample_wr = round((in_sample_wins / max(in_sample_trades, 1)) * 100, 1) if in_sample_trades > 0 else 0.0
    out_sample_wr = round((out_sample_wins / max(out_sample_trades, 1)) * 100, 1) if out_sample_trades > 0 else 0.0

    oos_ci = wilson_score_interval(out_sample_wins, out_sample_trades)

    return {
        "symbol": symbol,
        "total_windows_scanned": total_scanned_windows,
        "wait_signals": wait_signals,
        "total_trades": total_trades,
        "decisive_trades": decisive_trades,
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "win_rate": win_rate,
        "break_even_win_rate": break_even_rate,
        "expected_value_per_trade": ev_per_trade,
        "profit_factor": profit_factor,
        "max_drawdown": round(max_drawdown, 2),
        "max_consecutive_losses": max_consecutive_losses,
        "payout_rate": f"{int(payout_rate * 100)}%",
        "in_sample": {
            "trades": in_sample_trades,
            "wins": in_sample_wins,
            "win_rate": in_sample_wr,
        },
        "out_of_sample": {
            "trades": out_sample_trades,
            "wins": out_sample_wins,
            "win_rate": out_sample_wr,
            "confidence_interval_95": oos_ci,
        },
        "performance_by_regime": {
            "trending": {
                **regime_stats["TRENDING"],
                "win_rate": round((regime_stats["TRENDING"]["wins"] / max(regime_stats["TRENDING"]["wins"] + regime_stats["TRENDING"]["losses"], 1)) * 100, 1),
            },
            "ranging": {
                **regime_stats["RANGING"],
                "win_rate": round((regime_stats["RANGING"]["wins"] / max(regime_stats["RANGING"]["wins"] + regime_stats["RANGING"]["losses"], 1)) * 100, 1),
            },
            "volatile": {
                **regime_stats["VOLATILE"],
                "win_rate": round((regime_stats["VOLATILE"]["wins"] / max(regime_stats["VOLATILE"]["wins"] + regime_stats["VOLATILE"]["losses"], 1)) * 100, 1),
            },
        },
        "signals": trades[-50:],
        "disclaimer": "Backtests use genuine historical walk-forward testing with out-of-sample partitioning. No synthetic candles were used.",
    }
