"""
Walk-forward backtesting — no look-ahead bias.
For each index i (starting from MIN_CANDLES), use candles[0:i]
to generate a signal, then verify against candle[i] direction.
"""
from datetime import datetime, timezone
from typing import Any, Optional

from analysis.signal_engine import generate_signal, MIN_CANDLES


def run_backtest(candles: list, config: Optional[dict] = None) -> dict:
    """
    Walk-forward backtesting with no look-ahead bias.

    For every eligible window position:
      - Use candles[0:i] to generate signal (past data only)
      - Use candles[i] (next candle) to verify: if CALL and close > open → WIN, etc.

    Args:
        candles: list of OHLCV dicts sorted chronologically (oldest first)
        config:  optional dict with keys:
                   min_confidence (float, default 0): only count signals above this
                   step (int, default 1): step between windows (1 = every candle)

    Returns:
        {
            total_signals, call_signals, put_signals, wait_signals,
            verified, accuracy, equity_curve, signal_log
        }
    """
    if config is None:
        config = {}

    min_confidence = float(config.get("min_confidence", 0))
    step = max(int(config.get("step", 1)), 1)

    if len(candles) < MIN_CANDLES + 1:
        return {
            "total_signals": 0,
            "call_signals": 0,
            "put_signals": 0,
            "wait_signals": 0,
            "verified": 0,
            "accuracy": None,
            "equity_curve": [],
            "signal_log": [],
            "error": "Insufficient candles for backtesting",
        }

    total_signals = 0
    call_signals = 0
    put_signals = 0
    wait_signals = 0
    wins = 0
    losses = 0
    signal_log: list[dict] = []
    equity = 1000.0  # Arbitrary starting equity
    equity_curve: list[dict] = []

    # Walk-forward: i is the index of the NEXT (future) candle used for verification
    for i in range(MIN_CANDLES, len(candles) - 1, step):
        window = candles[:i]
        next_candle = candles[i]

        result = generate_signal(window)
        direction = result.get("direction", "WAIT")
        confidence = result.get("confidence", 0)

        total_signals += 1

        if direction == "CALL":
            call_signals += 1
        elif direction == "PUT":
            put_signals += 1
        else:
            wait_signals += 1

        # Only verify CALL/PUT signals above min_confidence
        outcome = "WAIT"
        if direction in ("CALL", "PUT") and confidence >= min_confidence:
            # Verify: next candle actual direction
            actual_bullish = next_candle["close"] > next_candle["open"]

            if direction == "CALL" and actual_bullish:
                wins += 1
                outcome = "WIN"
                equity *= 1.02  # Simplified +2% per win
            elif direction == "PUT" and not actual_bullish:
                wins += 1
                outcome = "WIN"
                equity *= 1.02
            else:
                losses += 1
                outcome = "LOSS"
                equity *= 0.98  # Simplified -2% per loss

        ts = next_candle.get("timestamp", "")
        signal_log.append(
            {
                "timestamp": ts,
                "direction": direction,
                "confidence": confidence,
                "outcome": outcome,
            }
        )
        equity_curve.append({"timestamp": ts, "equity": round(equity, 4)})

    verified = wins + losses
    accuracy = round(wins / verified * 100.0, 2) if verified > 0 else None

    return {
        "total_signals": total_signals,
        "call_signals": call_signals,
        "put_signals": put_signals,
        "wait_signals": wait_signals,
        "verified": verified,
        "accuracy": accuracy,
        "equity_curve": equity_curve,
        "signal_log": signal_log,
    }
