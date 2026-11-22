"""
Signal Engine — Professional Confluence & Technical Analysis Engine.
Enhanced with official Binomo Candlestick Strategy Guide & Binomo Trader's Guide (WTC):
- 3 Setup Frameworks (Trend Pullback, S/R Reversal, Range Breakout & Retest)
- Strategy #1: EMA 8 / EMA 21 Trend System
- Strategy #2: EMA 28 + ADX 5 Directional Momentum
- Strategy #3: Awesome Oscillator (AO: 5, 34) Zero-Line Expansion
- 25+ Japanese Candlestick Patterns with Context-Aware Location Multipliers
- Exact Entry Timing Rules (Candle Open 10-15s, Fixed Expiry)
"""
import math
from datetime import datetime, timezone
from typing import Any, Optional

import numpy as np

from analysis.indicators import (
    calculate_rsi,
    calculate_macd,
    calculate_ema,
    calculate_bollinger_bands,
    calculate_support_resistance,
    calculate_atr,
    calculate_stochastic,
    calculate_volume_analysis,
    calculate_adx,
    calculate_awesome_oscillator,
)
from analysis.patterns import detect_patterns
from analysis.gemini_arbiter import evaluate_with_gemini

# ── Indicator Weights for High-Accuracy Binary Market Analysis ───────────────
WEIGHTS = {
    "trend_ema": 2.5,          # Trend direction is King (EMA 8, 21, 50)
    "binomo_strat1_ema8_21": 2.0,# Binomo Official Strategy #1 (EMA 8/21 cross)
    "binomo_strat2_adx": 1.5,   # Binomo Official Strategy #2 (EMA 28 + ADX 5)
    "binomo_strat3_ao": 1.5,    # Binomo Official Strategy #3 (Awesome Oscillator)
    "momentum_rsi": 2.0,       # Overbought/Oversold & momentum
    "macd": 2.0,               # Trend momentum & crossover
    "stochastic": 1.5,         # Precise oscillator timing
    "bollinger": 1.5,          # Volatility bounds & squeeze breakout
    "candlestick_patterns": 2.5,# Price action confirmations (with location context)
    "support_resistance": 2.0, # Key horizontal pivot levels
}

MIN_CANDLES = 20  # Minimum candle history required for analysis


def _score_rsi_advanced(closes: np.ndarray, rsi_val: float) -> tuple[float, str, list, list]:
    """Score RSI with momentum direction & divergence."""
    if math.isnan(rsi_val):
        return 0.0, "neutral", [], []

    prev_rsi = calculate_rsi(closes[:-1]) if len(closes) > 15 else rsi_val
    rsi_slope = rsi_val - prev_rsi

    bull_reasons, bear_reasons = [], []

    if rsi_val <= 30:
        if rsi_slope > 0:
            bull_reasons.append(f"RSI oversold ({rsi_val:.1f}) & turning upward (+1.0)")
            return 1.0, "oversold_reversal", bull_reasons, bear_reasons
        bull_reasons.append(f"RSI oversold at {rsi_val:.1f} — high reversal probability")
        return 0.8, "oversold", bull_reasons, bear_reasons

    if rsi_val >= 70:
        if rsi_slope < 0:
            bear_reasons.append(f"RSI overbought ({rsi_val:.1f}) & turning downward (-1.0)")
            return -1.0, "overbought_reversal", bull_reasons, bear_reasons
        bear_reasons.append(f"RSI overbought at {rsi_val:.1f} — high reversal probability")
        return -0.8, "overbought", bull_reasons, bear_reasons

    # Momentum zones (midline cross)
    if rsi_val > 52 and rsi_slope > 0.5:
        bull_reasons.append(f"RSI bullish momentum ({rsi_val:.1f}) rising above midline")
        return 0.6, "bullish_momentum", bull_reasons, bear_reasons

    if rsi_val < 48 and rsi_slope < -0.5:
        bear_reasons.append(f"RSI bearish momentum ({rsi_val:.1f}) falling below midline")
        return -0.6, "bearish_momentum", bull_reasons, bear_reasons

    return 0.0, "neutral", [], []


def _score_ema_advanced(closes: np.ndarray, ema9: float, ema21: float, ema50: float, close: float) -> tuple[float, str, list, list]:
    """Score multi-EMA structure (9, 21, 50)."""
    if any(math.isnan(x) for x in (ema9, ema21, ema50)):
        return 0.0, "neutral", [], []

    bull_reasons, bear_reasons = [], []

    # Trend alignment: 9 > 21 > 50
    if ema9 > ema21 > ema50:
        if close > ema9:
            bull_reasons.append("Strong Bullish EMA alignment (EMA9 > EMA21 > EMA50) with price above EMA9")
            return 1.0, "strong_bullish", bull_reasons, bear_reasons
        else:
            bull_reasons.append("Bullish EMA alignment with pullback to EMA9/21 (Dynamic Support)")
            return 0.8, "pullback_bullish", bull_reasons, bear_reasons

    if ema9 < ema21 < ema50:
        if close < ema9:
            bear_reasons.append("Strong Bearish EMA alignment (EMA9 < EMA21 < EMA50) with price below EMA9")
            return -1.0, "strong_bearish", bull_reasons, bear_reasons
        else:
            bear_reasons.append("Bearish EMA alignment with pullback to EMA9/21 (Dynamic Resistance)")
            return -0.8, "pullback_bearish", bull_reasons, bear_reasons

    # Golden cross / Death cross
    prev_ema9 = calculate_ema(closes[:-1], 9)
    prev_ema21 = calculate_ema(closes[:-1], 21)
    if not math.isnan(prev_ema9) and not math.isnan(prev_ema21):
        if prev_ema9 <= prev_ema21 and ema9 > ema21:
            bull_reasons.append("Recent EMA 9/21 Golden Cross (Fresh Bullish Shift)")
            return 0.85, "golden_cross", bull_reasons, bear_reasons
        if prev_ema9 >= prev_ema21 and ema9 < ema21:
            bear_reasons.append("Recent EMA 9/21 Death Cross (Fresh Bearish Shift)")
            return -0.85, "death_cross", bull_reasons, bear_reasons

    return 0.0, "neutral", [], []


def _score_binomo_strategy1(closes: np.ndarray, ema8: float, ema21: float, close: float) -> tuple[float, list, list, bool, bool]:
    """
    Binomo Guide Strategy #1: EMA 8 and EMA 21.
    UP: Price crosses EMA 21 upward, EMA 8 > EMA 21, Price > EMA 8.
    DOWN: Price crosses EMA 21 downward, EMA 8 < EMA 21, Price < EMA 8.
    """
    if math.isnan(ema8) or math.isnan(ema21):
        return 0.0, [], [], False, False

    bull_reasons, bear_reasons = [], []
    match_up = False
    match_down = False

    if ema8 > ema21 and close > ema8:
        bull_reasons.append("Binomo Strategy #1 Confirmed: EMA 8 > EMA 21 and Price is above EMA 8 (Bullish Trend)")
        match_up = True
        return 1.0, bull_reasons, bear_reasons, match_up, match_down

    if ema8 < ema21 and close < ema8:
        bear_reasons.append("Binomo Strategy #1 Confirmed: EMA 8 < EMA 21 and Price is below EMA 8 (Bearish Trend)")
        match_down = True
        return -1.0, bull_reasons, bear_reasons, match_up, match_down

    return 0.0, [], [], match_up, match_down


def _score_binomo_strategy2(close: float, ema28: float, adx_dict: dict) -> tuple[float, list, list, bool, bool]:
    """
    Binomo Guide Strategy #2: EMA 28 + ADX 5.
    UP: ADX +DI > -DI, ADX >= 18, price crosses / above EMA 28.
    DOWN: ADX -DI > +DI, ADX >= 18, price crosses / below EMA 28.
    """
    adx = adx_dict.get("adx", float("nan"))
    p_di = adx_dict.get("plus_di", float("nan"))
    m_di = adx_dict.get("minus_di", float("nan"))

    if any(math.isnan(x) for x in (adx, p_di, m_di, ema28)):
        return 0.0, [], [], False, False

    bull_reasons, bear_reasons = [], []
    match_up = False
    match_down = False

    if p_di > m_di and close > ema28:
        strength = 1.0 if adx >= 20 else 0.7
        bull_reasons.append(f"Binomo Strategy #2 (+DI={p_di:.1f} > -DI={m_di:.1f}, Price > EMA28, ADX={adx:.1f})")
        match_up = True
        return strength, bull_reasons, bear_reasons, match_up, match_down

    if m_di > p_di and close < ema28:
        strength = -1.0 if adx >= 20 else -0.7
        bear_reasons.append(f"Binomo Strategy #2 (-DI={m_di:.1f} > +DI={p_di:.1f}, Price < EMA28, ADX={adx:.1f})")
        match_down = True
        return strength, bull_reasons, bear_reasons, match_up, match_down

    return 0.0, [], [], match_up, match_down


def _score_binomo_strategy3(ao_dict: dict) -> tuple[float, list, list, bool, bool]:
    """
    Binomo Guide Strategy #3: Awesome Oscillator (AO: 5, 34).
    UP: AO > 0 and color is green (growing from zero line).
    DOWN: AO < 0 and color is red (declining below zero line).
    """
    ao = ao_dict.get("ao", float("nan"))
    color = ao_dict.get("color", "neutral")

    if math.isnan(ao):
        return 0.0, [], [], False, False

    bull_reasons, bear_reasons = [], []
    match_up = False
    match_down = False

    if ao > 0 and color == "green":
        bull_reasons.append("Binomo Strategy #3: Awesome Oscillator above 0 with expanding green bars (Bullish Momentum)")
        match_up = True
        return 1.0, bull_reasons, bear_reasons, match_up, match_down

    if ao < 0 and color == "red":
        bear_reasons.append("Binomo Strategy #3: Awesome Oscillator below 0 with declining red bars (Bearish Momentum)")
        match_down = True
        return -1.0, bull_reasons, bear_reasons, match_up, match_down

    return 0.0, [], [], match_up, match_down


def _score_macd_advanced(macd_dict: dict, closes: np.ndarray) -> tuple[float, str, list, list]:
    """Score MACD line, signal line, and histogram momentum."""
    macd = macd_dict["macd"]
    signal = macd_dict["signal"]
    hist = macd_dict["histogram"]

    if any(math.isnan(x) for x in (macd, signal, hist)):
        return 0.0, "none", [], []

    prev_macd = calculate_macd(closes[:-1])
    prev_hist = prev_macd.get("histogram", 0.0)
    hist_growing = abs(hist) > abs(prev_hist)

    bull_reasons, bear_reasons = [], []

    if macd > signal:
        if hist > 0 and hist_growing:
            bull_reasons.append(f"MACD bullish expansion (hist={hist:.6f} increasing)")
            return 1.0, "bullish_expansion", bull_reasons, bear_reasons
        bull_reasons.append("MACD above signal line (bullish posture)")
        return 0.6, "bullish", bull_reasons, bear_reasons

    if macd < signal:
        if hist < 0 and hist_growing:
            bear_reasons.append(f"MACD bearish expansion (hist={hist:.6f} decreasing)")
            return -1.0, "bearish_expansion", bull_reasons, bear_reasons
        bear_reasons.append("MACD below signal line (bearish posture)")
        return -0.6, "bearish", bull_reasons, bear_reasons

    return 0.0, "none", [], []


def _score_stochastic_advanced(stoch: dict) -> tuple[float, str, list, list]:
    """Score Stochastic %K and %D crossover."""
    k = stoch.get("k", float("nan"))
    d = stoch.get("d", float("nan"))

    if math.isnan(k) or math.isnan(d):
        return 0.0, "neutral", [], []

    bull_reasons, bear_reasons = [], []

    if k < 20 and d < 20:
        if k > d:
            bull_reasons.append(f"Stochastic oversold bullish crossover (K={k:.1f} > D={d:.1f})")
            return 1.0, "oversold_bullish_cross", bull_reasons, bear_reasons
        bull_reasons.append(f"Stochastic oversold (K={k:.1f})")
        return 0.7, "oversold", bull_reasons, bear_reasons

    if k > 80 and d > 80:
        if k < d:
            bear_reasons.append(f"Stochastic overbought bearish crossover (K={k:.1f} < D={d:.1f})")
            return -1.0, "overbought_bearish_cross", bull_reasons, bear_reasons
        bear_reasons.append(f"Stochastic overbought (K={k:.1f})")
        return -0.7, "overbought", bull_reasons, bear_reasons

    return 0.0, "neutral", [], []


def _score_bollinger_advanced(close: float, bb: dict, atr_val: float) -> tuple[float, str, list, list]:
    """Score Bollinger Bands position and breakout / squeeze."""
    if any(math.isnan(bb.get(k, float("nan"))) for k in ("upper", "lower", "percent_b")):
        return 0.0, "neutral", [], []

    pct_b = bb["percent_b"]
    width = bb.get("width", 0.0)

    bull_reasons, bear_reasons = [], []
    is_squeeze = not math.isnan(atr_val) and width < (atr_val * 1.5)

    if pct_b <= 0.05:
        bull_reasons.append("Price piercing Bollinger Lower Band — sharp bounce expected")
        return 1.0, "lower_band_bounce", bull_reasons, bear_reasons
    if pct_b >= 0.95:
        bear_reasons.append("Price piercing Bollinger Upper Band — sharp pullback expected")
        return -1.0, "upper_band_rejection", bull_reasons, bear_reasons

    if pct_b < 0.25:
        bull_reasons.append(f"Price near Bollinger lower boundary (%B={pct_b:.2f})")
        return 0.5, "near_lower", bull_reasons, bear_reasons
    if pct_b > 0.75:
        bear_reasons.append(f"Price near Bollinger upper boundary (%B={pct_b:.2f})")
        return -0.5, "near_upper", bull_reasons, bear_reasons

    if is_squeeze:
        return 0.0, "squeeze_consolidation", [], []

    return 0.0, "middle", [], []


def _score_sr_advanced(close: float, sr: dict) -> tuple[float, str, list, list]:
    """Score Support & Resistance proximity."""
    supports = sr.get("support_levels", [])
    resistances = sr.get("resistance_levels", [])

    nearest_support = max((s for s in supports if s <= close), default=None)
    nearest_resistance = min((r for r in resistances if r >= close), default=None)

    if nearest_support is None and nearest_resistance is None:
        return 0.0, "unknown", [], []

    tol = 0.0018  # 0.18% proximity
    bull_reasons, bear_reasons = [], []
    score = 0.0
    position = "middle"

    if nearest_support is not None and abs(close - nearest_support) / max(close, 1e-10) <= tol:
        score += 1.0
        position = "at_support"
        bull_reasons.append(f"Key horizontal Support test at {nearest_support:.5f}")

    if nearest_resistance is not None and abs(nearest_resistance - close) / max(close, 1e-10) <= tol:
        score -= 1.0
        position = "at_resistance"
        bear_reasons.append(f"Key horizontal Resistance test at {nearest_resistance:.5f}")

    return score, position, bull_reasons, bear_reasons


def _score_patterns_with_context(patterns: list, sr_pos: str, ema_sig: str) -> tuple[float, list, list]:
    """
    Score detected candlestick patterns with Context-Aware Location Multipliers (Guide Rule #1).
    Patterns at Support/Resistance or EMA Dynamic Pullbacks receive 1.5x - 2.0x weight.
    Patterns floating in mid-range with no level receive lower weight.
    """
    bull_score = 0.0
    bear_score = 0.0
    bull_reasons, bear_reasons = [], []

    at_support = (sr_pos == "at_support" or "pullback_bullish" in ema_sig)
    at_resistance = (sr_pos == "at_resistance" or "pullback_bearish" in ema_sig)

    for p in patterns:
        name = p["name"]
        ptype = p["type"]
        strength = p["strength"]

        # Context multiplier based on location
        if ptype == "bullish":
            multiplier = 1.6 if at_support else 0.8
            effective_strength = strength * multiplier
            bull_score += effective_strength
            loc_note = " (at Support/Pullback - High Context)" if at_support else ""
            bull_reasons.append(f"Candlestick: {name}{loc_note} — Bullish setup")
        elif ptype == "bearish":
            multiplier = 1.6 if at_resistance else 0.8
            effective_strength = strength * multiplier
            bear_score += effective_strength
            loc_note = " (at Resistance/Pullback - High Context)" if at_resistance else ""
            bear_reasons.append(f"Candlestick: {name}{loc_note} — Bearish setup")

    net = min(bull_score, 1.5) - min(bear_score, 1.5)
    return net, bull_reasons, bear_reasons


def generate_signal(
    candles: list[dict],
    gemini_api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
) -> dict:
    """
    Main signal generation function with Binomo Strategy Guide Confluence Matrix.

    Args:
        candles: list of OHLCV dicts with keys: open, high, low, close, volume, timestamp

    Returns:
        Enhanced Signal dict with direction, confidence, accurate entry timing, and indicators.
    """
    if len(candles) < MIN_CANDLES:
        return {
            "direction": "WAIT",
            "confidence": 0,
            "trade_quality": "INSUFFICIENT DATA",
            "reason": f"Need at least {MIN_CANDLES} candles to calculate indicators accurately.",
            "disclaimer": "Signal based on technical analysis only. Not financial advice.",
        }

    # ── Extract series arrays ───────────────────────────────────────────────────
    highs = np.array([c["high"] for c in candles], dtype=float)
    lows = np.array([c["low"] for c in candles], dtype=float)
    closes = np.array([c["close"] for c in candles], dtype=float)
    volumes = np.array([c.get("volume", 0) for c in candles], dtype=float)

    close = float(closes[-1])

    # ── Compute Indicators ─────────────────────────────────────────────────────
    rsi_val = calculate_rsi(closes)
    macd_dict = calculate_macd(closes)
    ema8 = calculate_ema(closes, 8)
    ema9 = calculate_ema(closes, 9)
    ema21 = calculate_ema(closes, 21)
    ema28 = calculate_ema(closes, 28)
    ema50 = calculate_ema(closes, 50) if len(closes) >= 50 else calculate_ema(closes, len(closes))
    bb = calculate_bollinger_bands(closes)
    sr = calculate_support_resistance(highs, lows, closes)
    atr_val = calculate_atr(highs, lows, closes)
    stoch = calculate_stochastic(highs, lows, closes)
    vol_analysis = calculate_volume_analysis(volumes, closes)
    adx_dict = calculate_adx(highs, lows, closes, period=5)
    ao_dict = calculate_awesome_oscillator(highs, lows)
    patterns = detect_patterns(candles[-15:])

    # ── Scoring Individual Components ──────────────────────────────────────────
    rsi_score, rsi_sig, rsi_bull, rsi_bear = _score_rsi_advanced(closes, rsi_val)
    ema_score, ema_sig, ema_bull, ema_bear = _score_ema_advanced(closes, ema9, ema21, ema50, close)
    strat1_score, strat1_bull, strat1_bear, s1_up, s1_down = _score_binomo_strategy1(closes, ema8, ema21, close)
    strat2_score, strat2_bull, strat2_bear, s2_up, s2_down = _score_binomo_strategy2(close, ema28, adx_dict)
    strat3_score, strat3_bull, strat3_bear, s3_up, s3_down = _score_binomo_strategy3(ao_dict)
    macd_score, macd_sig, macd_bull, macd_bear = _score_macd_advanced(macd_dict, closes)
    stoch_score, stoch_sig, stoch_bull, stoch_bear = _score_stochastic_advanced(stoch)
    bb_score, bb_sig, bb_bull, bb_bear = _score_bollinger_advanced(close, bb, atr_val)
    sr_score, sr_pos, sr_bull, sr_bear = _score_sr_advanced(close, sr)
    pattern_score, pat_bull, pat_bear = _score_patterns_with_context(patterns, sr_pos, ema_sig)

    all_bull_reasons = (
        rsi_bull + ema_bull + strat1_bull + strat2_bull + strat3_bull
        + macd_bull + stoch_bull + bb_bull + sr_bull + pat_bull
    )
    all_bear_reasons = (
        rsi_bear + ema_bear + strat1_bear + strat2_bear + strat3_bear
        + macd_bear + stoch_bear + bb_bear + sr_bear + pat_bear
    )

    # ── Confluence Count ───────────────────────────────────────────────────────
    bull_confirmations = sum(1 for s in [
        rsi_score > 0.3,
        ema_score > 0.4,
        strat1_score > 0.5,
        strat2_score > 0.5,
        strat3_score > 0.5,
        macd_score > 0.4,
        stoch_score > 0.4,
        bb_score > 0.3,
        sr_score > 0.4,
        pattern_score > 0.4,
    ] if s)

    bear_confirmations = sum(1 for s in [
        rsi_score < -0.3,
        ema_score < -0.4,
        strat1_score < -0.5,
        strat2_score < -0.5,
        strat3_score < -0.5,
        macd_score < -0.4,
        stoch_score < -0.4,
        bb_score < -0.3,
        sr_score < -0.4,
        pattern_score < -0.4,
    ] if s)

    # ── Weighted Sum Calculation ───────────────────────────────────────────────
    weighted_sum = (
        ema_score * WEIGHTS["trend_ema"]
        + strat1_score * WEIGHTS["binomo_strat1_ema8_21"]
        + strat2_score * WEIGHTS["binomo_strat2_adx"]
        + strat3_score * WEIGHTS["binomo_strat3_ao"]
        + rsi_score * WEIGHTS["momentum_rsi"]
        + macd_score * WEIGHTS["macd"]
        + stoch_score * WEIGHTS["stochastic"]
        + bb_score * WEIGHTS["bollinger"]
        + pattern_score * WEIGHTS["candlestick_patterns"]
        + sr_score * WEIGHTS["support_resistance"]
    )

    max_possible_weight = sum(WEIGHTS.values())  # 18.0

    # ── 3 SETUP FRAMEWORKS MATCHING (Binomo Strategy Guide Section 6) ──────────
    matched_frameworks = []

    # Framework A: Trend Pullback Setup
    has_pullback_up = (ema_score >= 0.7 or s1_up) and ("pullback" in ema_sig or abs(close - ema21) / max(close, 1e-10) <= 0.002) and pattern_score > 0.3
    has_pullback_down = (ema_score <= -0.7 or s1_down) and ("pullback" in ema_sig or abs(close - ema21) / max(close, 1e-10) <= 0.002) and pattern_score < -0.3
    if has_pullback_up:
        matched_frameworks.append("Framework A: Trend Pullback (EMA Bounce + Rejection Candle)")
    elif has_pullback_down:
        matched_frameworks.append("Framework A: Trend Pullback (EMA Dynamic Resistance Rejection)")

    # Framework B: Support / Resistance Reversal Setup
    has_sr_reversal_up = sr_pos == "at_support" and pattern_score > 0.4 and (rsi_score > 0.4 or stoch_score > 0.4)
    has_sr_reversal_down = sr_pos == "at_resistance" and pattern_score < -0.4 and (rsi_score < -0.4 or stoch_score < -0.4)
    if has_sr_reversal_up:
        matched_frameworks.append("Framework B: Support Reversal (Key Level Bounce + Bullish Pattern)")
    elif has_sr_reversal_down:
        matched_frameworks.append("Framework B: Resistance Reversal (Key Level Rejection + Bearish Pattern)")

    # Framework C: Range Breakout + Retest
    if bb_sig == "lower_band_bounce" and vol_analysis.get("relative_volume", 1.0) > 1.3:
        matched_frameworks.append("Framework C: Volatility Band Bounce (High Volume)")
    elif bb_sig == "upper_band_rejection" and vol_analysis.get("relative_volume", 1.0) > 1.3:
        matched_frameworks.append("Framework C: Volatility Band Rejection (High Volume)")

    # ── CONTRADICTION & NOISE FILTER ───────────────────────────────────────────
    has_strong_conflict = (bull_confirmations >= 3 and bear_confirmations >= 3)

    # ── TREND ALIGNMENT GATE ───────────────────────────────────────────────────
    trend_direction = 0  # +1 bull, -1 bear, 0 flat
    if ema_score >= 0.7 or (s1_up and s2_up):
        trend_direction = 1
    elif ema_score <= -0.7 or (s1_down and s2_down):
        trend_direction = -1

    # ── ATR VOLATILITY FILTER ─────────────────────────────────────────────────
    avg_price = float(np.mean(closes[-20:]))
    atr_pct = (atr_val / avg_price * 100) if not math.isnan(atr_val) and avg_price > 0 else 0
    is_dead_market = atr_pct < 0.002

    # ── PRICE ACTION MOMENTUM (Last 3 candles consistency) ───────────────────
    if len(closes) >= 4:
        last3_bull = sum(1 for i in range(-3, 0) if closes[i] > closes[i - 1])
        last3_bear = sum(1 for i in range(-3, 0) if closes[i] < closes[i - 1])
        pa_momentum = last3_bull - last3_bear
    else:
        pa_momentum = 0

    # ── ULTRA-STRICT DECISION MATRIX (High Precision) ─────────────────────────
    if is_dead_market:
        direction = "WAIT"
        trade_quality = "DEAD MARKET"
        quality_label = "Ultra-low volatility — Market flat, signals paused"
        all_bear_reasons.append("⚠️ ATR below threshold — low volatility consolidation")
    elif has_strong_conflict:
        direction = "WAIT"
        trade_quality = "CHOPPY / CONFLICTING"
        quality_label = "Indicator Conflict — Wait for Breakout"
        all_bear_reasons.append("⚠️ Conflicting signals: Trend vs Oscillator divergence")
    elif (
        (weighted_sum >= 5.0 and bull_confirmations >= 4 and trend_direction >= 0)
        or (has_pullback_up and bull_confirmations >= 3)
        or (has_sr_reversal_up and bull_confirmations >= 3)
    ):
        direction = "CALL"
        trade_quality = "A+ PREMIUM SETUP" if (len(matched_frameworks) > 0 and bull_confirmations >= 5) else "A HIGH CONFLUENCE"
        framework_tag = f" [{matched_frameworks[0]}]" if matched_frameworks else ""
        quality_label = f"High-Probability Bullish ({bull_confirmations}/10 Confluences){framework_tag}"
    elif (
        (weighted_sum <= -5.0 and bear_confirmations >= 4 and trend_direction <= 0)
        or (has_pullback_down and bear_confirmations >= 3)
        or (has_sr_reversal_down and bear_confirmations >= 3)
    ):
        direction = "PUT"
        trade_quality = "A+ PREMIUM SETUP" if (len(matched_frameworks) > 0 and bear_confirmations >= 5) else "A HIGH CONFLUENCE"
        framework_tag = f" [{matched_frameworks[0]}]" if matched_frameworks else ""
        quality_label = f"High-Probability Bearish ({bear_confirmations}/10 Confluences){framework_tag}"
    else:
        direction = "WAIT"
        trade_quality = "INSUFFICIENT CONFLUENCE"
        quality_label = "Consolidation / Weak Setup — Wait for clear confirmation"

    # ── COUNTER-TREND VETO ────────────────────────────────────────────────────
    if direction == "CALL" and trend_direction == -1 and not has_sr_reversal_up:
        direction = "WAIT"
        trade_quality = "COUNTER-TREND BLOCKED"
        quality_label = "Bullish signal blocked — Prevailing EMA trend is bearish"
        all_bear_reasons.append("🚫 Counter-trend entry vetoed (Guide Rule: Do not trade against main trend)")
    elif direction == "PUT" and trend_direction == 1 and not has_sr_reversal_down:
        direction = "WAIT"
        trade_quality = "COUNTER-TREND BLOCKED"
        quality_label = "Bearish signal blocked — Prevailing EMA trend is bullish"
        all_bull_reasons.append("🚫 Counter-trend entry vetoed (Guide Rule: Do not trade against main trend)")

    # ── Confidence Score Calculation ──────────────────────────────────────────
    confluence_count = max(bull_confirmations, bear_confirmations)
    base_confidence = (confluence_count / 10.0) * 100.0

    if direction == "WAIT":
        confidence = round(min(base_confidence, 42.0), 1)
    elif trade_quality == "A+ PREMIUM SETUP":
        confidence = round(min(max(base_confidence, 82.0), 94.0), 1)
    elif trade_quality == "A HIGH CONFLUENCE":
        confidence = round(min(max(base_confidence, 70.0), 81.0), 1)
    else:
        confidence = round(min(max(base_confidence, 60.0), 69.0), 1)

    # ── Gemini AI Arbiter Cross-Verification ──────────────────────────────────
    indicators_snapshot = {
        "rsi": {"value": round(rsi_val, 4) if not math.isnan(rsi_val) else None, "signal": rsi_sig},
        "ema": {"trend": ema_sig, "ema8": ema8, "ema21": ema21, "ema50": ema50},
        "adx": adx_dict,
        "awesome_oscillator": ao_dict,
        "bollinger": {"signal": bb_sig},
        "support_resistance": {"position": sr_pos},
    }

    initial_math_signal = {
        "direction": direction,
        "confidence": confidence,
        "trade_quality": trade_quality,
        "reasons": {"bullish": all_bull_reasons[:3], "bearish": all_bear_reasons[:3]},
    }

    gemini_result = evaluate_with_gemini(
        symbol=candles[-1].get("symbol", "EUR/USD") if candles else "EUR/USD",
        interval="5min",
        recent_candles=candles[-10:],
        indicators=indicators_snapshot,
        patterns=patterns,
        math_signal=initial_math_signal,
        gemini_key=gemini_api_key,
        openai_key=openai_api_key,
    )

    if gemini_result.get("status") == "active":
        gemini_dir = gemini_result.get("direction")
        gemini_conf = gemini_result.get("confidence", confidence)
        trap_risk = gemini_result.get("trap_risk", "LOW")
        provider_name = (
            "Gemini AI"
            if gemini_result.get("provider") == "gemini"
            else ("ChatGPT" if gemini_result.get("provider") == "openai" else "AI Arbiter")
        )

        if trap_risk == "HIGH" and direction != "WAIT":
            direction = "WAIT"
            trade_quality = f"{provider_name.upper()} TRAP VETO"
            all_bear_reasons.append(f"🤖 {provider_name} Trap Veto: {gemini_result.get('analysis_en')}")
        elif direction != "WAIT" and gemini_dir != "WAIT" and gemini_dir != direction:
            direction = "WAIT"
            trade_quality = f"{provider_name.upper()} CONFLICT VETO"
            all_bear_reasons.append(
                f"🤖 {provider_name} Conflict Veto: Algorithmic signal was {direction} but AI detected opposing momentum ({gemini_dir})."
            )
        elif direction != "WAIT" and gemini_dir == direction:
            confidence = round((confidence * 0.5) + (gemini_conf * 0.5), 1)
            trade_quality = f"AI CONFIRMED ({trade_quality})"
            all_bull_reasons.append(f"🤖 {provider_name}: {gemini_result.get('analysis_en')}")

    # ── Exact Entry Timing & Horizon Information ──────────────────────────────
    entry_timing_info = {
        "rule_en": "Enter trade at the OPEN of the NEXT 5-minute candle within the first 10-15 seconds.",
        "rule_hi": "Agli 5-minute candle shuru hote hi pehle 10-15 seconds me trade lein (Candle Open Entry).",
        "recommended_action": f"Take {direction} trade on next candle open" if direction != "WAIT" else "Wait. No confirmed tradeable setup at this moment.",
        "entry_window": "First 15 seconds of candle open (00:00 - 00:15)",
        "expiry_duration": "5 Minutes (Fixed M5 expiry)",
        "confluence_count": confluence_count,
        "quality_tier": trade_quality,
        "quality_label": quality_label,
        "matched_frameworks": matched_frameworks,
        "gemini_summary": gemini_result.get("analysis_hi") if gemini_result.get("status") == "active" else None,
    }

    supports = sr.get("support_levels", [])
    resistances = sr.get("resistance_levels", [])
    nearest_support = max((s for s in supports if s <= close), default=None)
    nearest_resistance = min((r for r in resistances if r >= close), default=None)

    return {
        "direction": direction,
        "confidence": confidence,
        "trade_quality": trade_quality,
        "entry_timing": entry_timing_info,
        "confluence_score": round((confluence_count / 10.0) * 100.0, 1),
        "gemini_arbiter": gemini_result,
        "indicators": {
            "rsi": {
                "value": round(rsi_val, 4) if not math.isnan(rsi_val) else None,
                "signal": rsi_sig,
            },
            "macd": {
                "macd": round(macd_dict["macd"], 6) if not math.isnan(macd_dict["macd"]) else None,
                "signal_line": round(macd_dict["signal"], 6) if not math.isnan(macd_dict["signal"]) else None,
                "histogram": round(macd_dict["histogram"], 6) if not math.isnan(macd_dict["histogram"]) else None,
                "crossover": macd_sig,
            },
            "ema": {
                "ema8": round(ema8, 6) if not math.isnan(ema8) else None,
                "ema9": round(ema9, 6) if not math.isnan(ema9) else None,
                "ema21": round(ema21, 6) if not math.isnan(ema21) else None,
                "ema28": round(ema28, 6) if not math.isnan(ema28) else None,
                "ema50": round(ema50, 6) if not math.isnan(ema50) else None,
                "trend": ema_sig,
            },
            "adx": adx_dict,
            "awesome_oscillator": ao_dict,
            "bollinger": {
                "upper": round(bb["upper"], 6) if not math.isnan(bb["upper"]) else None,
                "middle": round(bb["middle"], 6) if not math.isnan(bb["middle"]) else None,
                "lower": round(bb["lower"], 6) if not math.isnan(bb["lower"]) else None,
                "width": round(bb["width"], 6) if not math.isnan(bb["width"]) else None,
                "percent_b": round(bb["percent_b"], 4) if not math.isnan(bb["percent_b"]) else None,
                "signal": bb_sig,
            },
            "support_resistance": {
                "nearest_support": round(nearest_support, 6) if nearest_support is not None else None,
                "nearest_resistance": round(nearest_resistance, 6) if nearest_resistance is not None else None,
                "support_levels": sr.get("support_levels", []),
                "resistance_levels": sr.get("resistance_levels", []),
                "position": sr_pos,
            },
            "atr": round(atr_val, 6) if not math.isnan(atr_val) else None,
            "stochastic": {
                "k": round(stoch["k"], 4) if not math.isnan(stoch["k"]) else None,
                "d": round(stoch["d"], 4) if not math.isnan(stoch["d"]) else None,
                "signal": stoch_sig,
            },
            "volume": vol_analysis,
        },
        "patterns": patterns,
        "reasons": {
            "bullish": all_bull_reasons,
            "bearish": all_bear_reasons,
        },
        "analysis_horizon": "5 minutes",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "disclaimer": "Signal based on technical analysis confluence only. Never risk capital without money management.",
    }
