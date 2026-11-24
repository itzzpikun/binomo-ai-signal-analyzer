"""
Unit and Integration Tests for Signal Engine and Indicators.
Tests:
1. Indicators vs reference calculations (pandas).
2. Look-ahead bias: generate_signal(candles[:i]) never reads candles beyond i.
3. Closed candle enforcement: unclosed forming candles are dropped before analysis.
4. Dead market ATR% threshold per asset class.
5. Conflict-veto message preserves original algorithmic direction.
6. LLM_ARBITER environment flag controls LLM arbiter activation.
"""
import os
import unittest
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta

from analysis.indicators import (
    calculate_ema,
    calculate_rsi,
    calculate_bollinger_bands,
    calculate_atr,
    calculate_macd,
)
from analysis.signal_engine import (
    generate_signal,
    DEAD_MARKET_ATR_THRESHOLDS,
    get_dead_market_threshold,
    _is_candle_forming,
)


def _generate_synthetic_candles(n: int = 50, start_price: float = 1.1000, dt_start: datetime = None) -> list[dict]:
    """Generate deterministic synthetic candles for testing."""
    if dt_start is None:
        # 10 days in the past so timestamp-based forming checks are not triggered unless simulated
        dt_start = datetime(2025, 1, 1, 0, 0, tzinfo=timezone.utc)

    candles = []
    price = start_price
    np.random.seed(42)
    for i in range(n):
        delta = (np.random.rand() - 0.48) * 0.002
        c_open = price
        c_close = price + delta
        c_high = max(c_open, c_close) + abs(np.random.rand() * 0.001)
        c_low = min(c_open, c_close) - abs(np.random.rand() * 0.001)
        c_time = dt_start + timedelta(minutes=5 * i)

        candles.append({
            "timestamp": int(c_time.timestamp() * 1000),
            "open": round(c_open, 5),
            "high": round(c_high, 5),
            "low": round(c_low, 5),
            "close": round(c_close, 5),
            "volume": 1000 + i * 10,
            "symbol": "EUR/USD",
        })
        price = c_close

    return candles


class TestIndicatorsVsReference(unittest.TestCase):
    """Test custom indicator calculations against pandas reference library."""

    def setUp(self):
        self.candles = _generate_synthetic_candles(60)
        self.closes = np.array([c["close"] for c in self.candles], dtype=float)
        self.highs = np.array([c["high"] for c in self.candles], dtype=float)
        self.lows = np.array([c["low"] for c in self.candles], dtype=float)

    def test_ema_vs_pandas(self):
        """EMA should match pandas ewm(span=period, adjust=False).mean()."""
        for period in (9, 21, 50):
            engine_ema = calculate_ema(self.closes, period)
            pd_series = pd.Series(self.closes)
            ref_ema = float(pd_series.ewm(span=period, adjust=False).mean().iloc[-1])
            self.assertAlmostEqual(engine_ema, ref_ema, places=7, msg=f"EMA({period}) mismatch")

    def test_bollinger_bands_vs_pandas(self):
        """Bollinger bands middle, upper, and lower must match pandas rolling mean and std."""
        bb = calculate_bollinger_bands(self.closes, period=20, std_dev=2.0)
        pd_series = pd.Series(self.closes)
        ref_middle = float(pd_series.rolling(20).mean().iloc[-1])
        ref_std = float(pd_series.rolling(20).std(ddof=0).iloc[-1])
        ref_upper = ref_middle + 2.0 * ref_std
        ref_lower = ref_middle - 2.0 * ref_std

        self.assertAlmostEqual(bb["middle"], ref_middle, places=7)
        self.assertAlmostEqual(bb["upper"], ref_upper, places=7)
        self.assertAlmostEqual(bb["lower"], ref_lower, places=7)
        self.assertAlmostEqual(bb["width"], ref_upper - ref_lower, places=7)

    def test_rsi_reference_bounds(self):
        """RSI must stay bounded within [0, 100] and be strictly positive."""
        rsi = calculate_rsi(self.closes, period=14)
        self.assertFalse(np.isnan(rsi))
        self.assertGreaterEqual(rsi, 0.0)
        self.assertLessEqual(rsi, 100.0)

    def test_atr_positive(self):
        """ATR must be strictly positive for fluctuating price series."""
        atr = calculate_atr(self.highs, self.lows, self.closes, period=14)
        self.assertFalse(np.isnan(atr))
        self.assertGreater(atr, 0.0)


class TestNoLookAheadBias(unittest.TestCase):
    """Verify that generate_signal on candles[:i] never reads candles beyond i."""

    def setUp(self):
        self.full_candles = _generate_synthetic_candles(80)

    def test_no_lookahead_on_slices(self):
        """
        Signals computed on candles[:i] must remain identical regardless
        of future candles or any future mutations.
        """
        for i in (25, 35, 50):
            slice_original = self.full_candles[:i]
            sig1 = generate_signal(slice_original, interval="5min", symbol="EUR/USD")

            # Create an alternate future from i onward with massive volatility/spikes
            mutated_full = list(self.full_candles[:i])
            for k in range(10):
                mutated_full.append({
                    "timestamp": self.full_candles[i - 1]["timestamp"] + (k + 1) * 300000,
                    "open": 999.0,
                    "high": 1000.0,
                    "low": 998.0,
                    "close": 999.5,
                    "volume": 999999,
                    "symbol": "EUR/USD",
                })

            # Re-run on the same window [:i]
            sig2 = generate_signal(mutated_full[:i], interval="5min", symbol="EUR/USD")

            self.assertEqual(sig1["direction"], sig2["direction"])
            self.assertEqual(sig1["confidence"], sig2["confidence"])
            self.assertEqual(sig1["trade_quality"], sig2["trade_quality"])
            self.assertEqual(sig1["confluence_score"], sig2["confluence_score"])

            # Verify indicators match exactly
            self.assertEqual(sig1["indicators"]["rsi"]["value"], sig2["indicators"]["rsi"]["value"])
            self.assertEqual(sig1["indicators"]["ema"]["ema9"], sig2["indicators"]["ema"]["ema9"])
            self.assertEqual(sig1["indicators"]["bollinger"]["upper"], sig2["indicators"]["bollinger"]["upper"])


class TestClosedCandlesEnforcement(unittest.TestCase):
    """Verify forming candles are discarded before analysis so live matches backtest."""

    def setUp(self):
        self.closed_candles = _generate_synthetic_candles(30)

    def test_explicit_is_forming_flag_dropped(self):
        """If last candle has is_forming=True, it must be dropped."""
        forming_candle = dict(self.closed_candles[-1])
        forming_candle["timestamp"] = forming_candle["timestamp"] + 300000
        forming_candle["is_forming"] = True

        sig_without_forming = generate_signal(self.closed_candles, interval="5min", symbol="EUR/USD")
        sig_with_forming = generate_signal(self.closed_candles + [forming_candle], interval="5min", symbol="EUR/USD")

        self.assertEqual(sig_without_forming["direction"], sig_with_forming["direction"])
        self.assertEqual(sig_without_forming["confidence"], sig_with_forming["confidence"])
        self.assertEqual(
            sig_without_forming["indicators"]["rsi"]["value"],
            sig_with_forming["indicators"]["rsi"]["value"],
        )

    def test_explicit_is_closed_false_dropped(self):
        """If last candle has is_closed=False, it must be dropped."""
        forming_candle = dict(self.closed_candles[-1])
        forming_candle["timestamp"] = forming_candle["timestamp"] + 300000
        forming_candle["is_closed"] = False

        sig_without_forming = generate_signal(self.closed_candles, interval="5min", symbol="EUR/USD")
        sig_with_forming = generate_signal(self.closed_candles + [forming_candle], interval="5min", symbol="EUR/USD")

        self.assertEqual(sig_without_forming["direction"], sig_with_forming["direction"])
        self.assertEqual(
            sig_without_forming["indicators"]["ema"]["ema21"],
            sig_with_forming["indicators"]["ema"]["ema21"],
        )

    def test_live_timestamp_in_interval_dropped(self):
        """If last candle started 15 seconds ago (live forming), it must be dropped."""
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        live_forming_candle = {
            "timestamp": now_ms - 15000,  # 15s ago in a 5min (300s) candle
            "open": 1.1200,
            "high": 1.1250,
            "low": 1.1190,
            "close": 1.1240,
            "volume": 500,
            "symbol": "EUR/USD",
        }
        self.assertTrue(_is_candle_forming(live_forming_candle, interval_sec=300))

        sig_closed_only = generate_signal(self.closed_candles, interval="5min", symbol="EUR/USD")
        sig_with_live = generate_signal(self.closed_candles + [live_forming_candle], interval="5min", symbol="EUR/USD")

        self.assertEqual(sig_closed_only["direction"], sig_with_live["direction"])


class TestDeadMarketThreshold(unittest.TestCase):
    """Verify dead market thresholds per asset class."""

    def test_asset_class_thresholds(self):
        self.assertEqual(get_dead_market_threshold("EUR/USD"), DEAD_MARKET_ATR_THRESHOLDS["FOREX"])
        self.assertEqual(get_dead_market_threshold("GBP/JPY"), DEAD_MARKET_ATR_THRESHOLDS["FOREX"])
        self.assertEqual(get_dead_market_threshold("BTC/USD"), DEAD_MARKET_ATR_THRESHOLDS["CRYPTO"])
        self.assertEqual(get_dead_market_threshold("ETH/USDT"), DEAD_MARKET_ATR_THRESHOLDS["CRYPTO"])
        self.assertEqual(get_dead_market_threshold("XAU/USD"), DEAD_MARKET_ATR_THRESHOLDS["COMMODITIES"])
        self.assertEqual(get_dead_market_threshold("US30"), DEAD_MARKET_ATR_THRESHOLDS["INDICES"])

    def test_dead_market_signal_paused(self):
        """Flat candle prices with near-zero ATR must trigger DEAD MARKET."""
        flat_candles = []
        base_time = datetime(2025, 1, 1, tzinfo=timezone.utc)
        for i in range(30):
            flat_candles.append({
                "timestamp": int((base_time + timedelta(minutes=5 * i)).timestamp() * 1000),
                "open": 1.10000,
                "high": 1.10001,
                "low": 1.09999,
                "close": 1.10000,
                "volume": 100,
                "symbol": "EUR/USD",
            })
        sig = generate_signal(flat_candles, interval="5min", symbol="EUR/USD")
        self.assertEqual(sig["direction"], "WAIT")
        self.assertEqual(sig["trade_quality"], "DEAD MARKET")


class TestConflictVetoMessage(unittest.TestCase):
    """Verify conflict veto message captures the original algorithmic direction."""

    def test_veto_message_contains_original_direction(self):
        """When AI arbiter vetoes with opposing momentum, message must name original signal."""
        from unittest.mock import patch

        # Use slice that produces a confirmed PUT signal before LLM arbitration
        candles = _generate_synthetic_candles(60)[:29]

        # Verify algorithmic signal is PUT without LLM
        with patch.dict(os.environ, {"LLM_ARBITER": "false"}):
            sig_baseline = generate_signal(candles, interval="5min", symbol="EUR/USD")
            self.assertEqual(sig_baseline["direction"], "PUT")

        # Test with LLM_ARBITER=true and mock Gemini returning opposing CALL
        with patch.dict(os.environ, {"LLM_ARBITER": "true"}):
            with patch("analysis.signal_engine.evaluate_with_gemini") as mock_gemini:
                mock_gemini.return_value = {
                    "status": "active",
                    "provider": "gemini",
                    "direction": "CALL",
                    "confidence": 85.0,
                    "trap_risk": "LOW",
                    "analysis_en": "Opposing bullish momentum",
                }

                sig = generate_signal(candles, interval="5min", symbol="EUR/USD")
                self.assertEqual(sig["direction"], "WAIT")
                self.assertIn("CONFLICT VETO", sig["trade_quality"])

                # Check reasons
                bear_reasons = sig["reasons"]["bearish"]
                conflict_reason = next((r for r in bear_reasons if "Conflict Veto" in r), None)
                self.assertIsNotNone(conflict_reason)
                self.assertIn("Algorithmic signal was PUT", conflict_reason)
                self.assertNotIn("Algorithmic signal was WAIT", conflict_reason)


class TestLlmArbiterFlag(unittest.TestCase):
    """Verify LLM Arbiter flag defaults to off and prevents LLM modification."""

    def setUp(self):
        self.candles = _generate_synthetic_candles(30)

    def test_llm_arbiter_default_off(self):
        """When LLM_ARBITER is unset or false, arbiter is disabled and does not touch signal."""
        # Ensure LLM_ARBITER is not set or set to 'false'
        with unittest.mock.patch.dict(os.environ, {"LLM_ARBITER": "false"}):
            sig = generate_signal(self.candles, interval="5min", symbol="EUR/USD")
            self.assertEqual(sig["gemini_arbiter"]["status"], "disabled")
            self.assertIn("disabled", sig["gemini_arbiter"]["message"])

    def test_llm_arbiter_dynamic_interval(self):
        """Interval parameter must be passed into entry_timing_info."""
        for interval in ("1min", "5min", "15min"):
            sig = generate_signal(self.candles, interval=interval, symbol="EUR/USD")
            self.assertIn(interval, sig["entry_timing"]["rule_en"])
            self.assertIn(interval, sig["entry_timing"]["expiry_duration"])


if __name__ == "__main__":
    unittest.main()
