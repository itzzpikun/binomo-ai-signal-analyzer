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
    calculate_divergence,
    calculate_candle_exhaustion,
    calculate_macro_trend,
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
    groq_api_key: Optional[str] = None,
    openrouter_api_key: Optional[str] = None,
    cloudflare_api_key: Optional[str] = None,
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
    divergence_dict = calculate_divergence(highs, lows, closes)
    exhaustion_dict = calculate_candle_exhaustion(candles)
    macro_trend_dict = calculate_macro_trend(closes)

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

    if divergence_dict.get("bullish_divergence"):
        all_bull_reasons.insert(0, "🌟 Bullish RSI Divergence: Price Lower Low vs RSI Higher Low (High-Probability Reversal)")
    if divergence_dict.get("bearish_divergence"):
        all_bear_reasons.insert(0, "🌟 Bearish RSI Divergence: Price Higher High vs RSI Lower High (High-Probability Reversal)")

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
        divergence_dict.get("bullish_divergence", False),
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
        divergence_dict.get("bearish_divergence", False),
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

    # ── 100-POINT QUANTITATIVE SCORING ENGINE ─────────────────────────────────
    # Trend (25 pts)
    bull_trend = (12 if ema9 > ema21 and ema21 > ema50 else 8 if ema9 > ema21 else 0) + (8 if close > ema50 else 0) + (5 if macd_dict["macd"] > 0 else 0)
    bear_trend = (12 if ema9 < ema21 and ema21 < ema50 else 8 if ema9 < ema21 else 0) + (8 if close < ema50 else 0) + (5 if macd_dict["macd"] < 0 else 0)

    # Momentum (20 pts)
    bull_mom = (7 if 50 <= rsi_val <= 68 else 4 if 68 < rsi_val <= 75 else 0) + (6 if macd_dict["histogram"] > 0 else 0) + (7 if stoch_score > 0.4 else 0)
    bear_mom = (7 if 32 <= rsi_val <= 50 else 4 if 25 <= rsi_val < 32 else 0) + (6 if macd_dict["histogram"] < 0 else 0) + (7 if stoch_score < -0.4 else 0)

    # Price Action (20 pts)
    bull_pa = (8 if closes[-1] > closes[-2] and highs[-1] > highs[-2] else 0) + (7 if pattern_score > 0.4 else 0) + (5 if sr_pos == "at_support" else 2)
    bear_pa = (8 if closes[-1] < closes[-2] and lows[-1] < lows[-2] else 0) + (7 if pattern_score < -0.4 else 0) + (5 if sr_pos == "at_resistance" else 2)

    # Strategies / Confluence (20 pts)
    bull_strat = (10 if s1_up else 0) + (5 if s2_up else 0) + (5 if s3_up else 0)
    bear_strat = (10 if s1_down else 0) + (5 if s2_down else 0) + (5 if s3_down else 0)

    # Volatility / Market Quality (15 pts)
    adx_val = adx_dict.get("adx", 20)
    bb_width_pct = bb["width"] / max(bb["middle"], 1e-6)
    vol_score = (8 if adx_val >= 22 else 4 if adx_val >= 18 else 0) + (4 if 0.0015 <= bb_width_pct <= 0.015 else 2) + (3 if not is_dead_market else 0)

    bull_total = min(100, bull_trend + bull_mom + bull_pa + bull_strat + vol_score)
    bear_total = min(100, bear_trend + bear_mom + bear_pa + bear_strat + vol_score)

    dominant_bias = "CALL" if bull_total >= bear_total else "PUT"
    dominant_score = bull_total if dominant_bias == "CALL" else bear_total

    # ── ANTI-LOSS FILTERS (Strict Veto to WAIT) ───────────────────────────────
    filter_triggered = False
    filter_reason = None

    last_body = abs(closes[-1] - candles[-1].get("open", closes[-1]))
    last_upper_wick = highs[-1] - max(closes[-1], candles[-1].get("open", closes[-1]))
    last_lower_wick = min(closes[-1], candles[-1].get("open", closes[-1])) - lows[-1]

    # Filter 1: Dead Market / Sideways Chop / Balanced Contradiction
    if is_dead_market:
        filter_triggered = True
        filter_reason = "Low Volatility Dead Market (ATR too low) — Risk High"
        all_bear_reasons.append(filter_reason)
    elif adx_val < 22:
        filter_triggered = True
        filter_reason = f"Sideways Market Chop Detected (ADX: {adx_val:.1f} < 22) — False Signal Risk High"
        all_bear_reasons.append("⚠️ Sideways consolidation chop: ADX < 22")
    elif has_strong_conflict and abs(bull_confirmations - bear_confirmations) <= 1:
        filter_triggered = True
        filter_reason = f"Contradictory Market Signals Detected ({bull_confirmations} Bulls vs {bear_confirmations} Bears) — WAIT"
        all_bear_reasons.append(filter_reason)

    # Filter 2: Anti-Trend Veto (Never trade counter to prevailing EMA trend)
    elif dominant_bias == "CALL" and (ema9 < ema21 and close < ema50) and not divergence_dict.get("bullish_divergence"):
        filter_triggered = True
        filter_reason = "Anti-Trend Filter: Cannot CALL in strong downtrend (EMA 9 < 21 & Price < EMA 50)"
        all_bear_reasons.append(filter_reason)

    elif dominant_bias == "PUT" and (ema9 > ema21 and close > ema50) and not divergence_dict.get("bearish_divergence"):
        filter_triggered = True
        filter_reason = "Anti-Trend Filter: Cannot PUT in strong uptrend (EMA 9 > 21 & Price > EMA 50)"
        all_bull_reasons.append(filter_reason)

    # Filter 3: Consecutive Candle Run Exhaustion
    elif exhaustion_dict.get("exhaustion_risk") and dominant_bias == "CALL" and exhaustion_dict.get("run_direction") == "GREEN":
        filter_triggered = True
        filter_reason = f"Candle Exhaustion: {exhaustion_dict.get('run_count', 4)}+ consecutive green candles. Retracement risk high. WAIT."
        all_bear_reasons.append(filter_reason)

    elif exhaustion_dict.get("exhaustion_risk") and dominant_bias == "PUT" and exhaustion_dict.get("run_direction") == "RED":
        filter_triggered = True
        filter_reason = f"Candle Exhaustion: {exhaustion_dict.get('run_count', 4)}+ consecutive red candles. Bounce risk high. WAIT."
        all_bull_reasons.append(filter_reason)

    # Filter 4: S/R Wick Rejection
    elif dominant_bias == "CALL" and sr_pos == "at_resistance" and last_upper_wick > 1.8 * max(last_body, 1e-6):
        filter_triggered = True
        filter_reason = "Upper Wick Rejection near Resistance Level — High Rejection Risk"
        all_bear_reasons.append(filter_reason)

    elif dominant_bias == "PUT" and sr_pos == "at_support" and last_lower_wick > 1.8 * max(last_body, 1e-6):
        filter_triggered = True
        filter_reason = "Lower Wick Rejection near Support Level — High Rejection Risk"
        all_bull_reasons.append(filter_reason)

    # Filter 5: Strict 70%+ Quantitative Threshold & Min 3 Confirmations
    elif dominant_score < 70 or (dominant_bias == "CALL" and bull_confirmations < 3) or (dominant_bias == "PUT" and bear_confirmations < 3):
        filter_triggered = True
        filter_reason = f"Setup Score ({dominant_score}/100) is below the minimum 70-point quantitative threshold"
        if dominant_bias == "CALL":
            all_bear_reasons.append(filter_reason)
        else:
            all_bull_reasons.append(filter_reason)

    # ── DECISION OUTCOME ───────────────────────────────────────────────────────
    confluence_count = max(bull_confirmations, bear_confirmations)

    if filter_triggered:
        direction = "WAIT"
        trade_quality = filter_reason or "AWAITING 70+ SCORE CONFLUENCE"
        quality_label = f"Trade Paused: {trade_quality}"
        confidence = round(min(float(dominant_score), 65.0), 1)
    else:
        direction = dominant_bias
        confidence = round(min(max(float(dominant_score), 70.0), 96.0), 1)
        if dominant_score >= 85 and len(matched_frameworks) > 0:
            trade_quality = "A+ PREMIUM SETUP"
            framework_tag = f" [{matched_frameworks[0]}]"
            quality_label = f"High-Probability {direction} ({dominant_score}/100 Score, {confluence_count}/10 Confluences){framework_tag}"
        else:
            trade_quality = f"QUALIFIED SETUP ({dominant_score} pts)"
            quality_label = f"Confirmed {direction} ({dominant_score}/100 Score, {confluence_count}/10 Confluences)"

    # ── Gemini AI Arbiter Cross-Verification ──────────────────────────────────
    indicators_snapshot = {
        "rsi": {"value": round(rsi_val, 4) if not math.isnan(rsi_val) else None, "signal": rsi_sig},
        "ema": {"trend": ema_sig, "ema8": ema8, "ema21": ema21, "ema50": ema50},
        "adx": adx_dict,
        "awesome_oscillator": ao_dict,
        "bollinger": {"signal": bb_sig},
        "support_resistance": {"position": sr_pos},
        "divergence": divergence_dict,
        "exhaustion": exhaustion_dict,
        "macro_trend": macro_trend_dict,
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
        groq_key=groq_api_key,
        openrouter_key=openrouter_api_key,
        cloudflare_key=cloudflare_api_key,
    )

    if gemini_result.get("status") == "active":
        gemini_dir = gemini_result.get("direction")
        gemini_conf = gemini_result.get("confidence", confidence)
        trap_risk = gemini_result.get("trap_risk", "LOW")
        prov = gemini_result.get("provider", "ai")
        provider_name = (
            "Groq AI" if prov == "groq"
            else "Gemini AI" if prov == "gemini"
            else "OpenRouter" if prov == "openrouter"
            else "ChatGPT" if prov == "openai"
            else "Cloudflare AI" if prov == "cloudflare"
            else "AI Arbiter"
        )

        if trap_risk == "HIGH" and direction != "WAIT":
            direction = "WAIT"
            trade_quality = f"{provider_name.upper()} TRAP VETO"
            confidence = 65.0
            quality_label = f"Trade Paused: {trade_quality}"
            all_bear_reasons.append(f"🤖 {provider_name} Trap Veto: {gemini_result.get('analysis_en')}")
        elif direction != "WAIT" and gemini_dir != "WAIT" and gemini_dir != direction:
            direction = "WAIT"
            trade_quality = f"{provider_name.upper()} CONFLICT VETO"
            confidence = 50.0
            quality_label = f"Trade Paused: {trade_quality}"
            all_bear_reasons.append(
                f"🤖 {provider_name} Conflict Veto: Algorithmic signal was {direction} but AI detected opposing momentum ({gemini_dir})."
            )
        elif direction != "WAIT" and gemini_dir == direction:
            confidence = round(max(confidence, (confidence * 0.5) + (gemini_conf * 0.5)), 1)
            trade_quality = f"AI CONFIRMED ({trade_quality})"
            all_bull_reasons.append(f"🤖 {provider_name}: {gemini_result.get('analysis_en')}")

    # Enforce strict 70%+ cutoff on final confidence
    if direction == "WAIT" and confidence >= 70:
        confidence = 65.0
    elif direction != "WAIT" and confidence < 70:
        direction = "WAIT"
        trade_quality = f"AWAITING 70+ SCORE CONFLUENCE ({confidence}/100)"
        quality_label = f"Trade Paused: {trade_quality}"
        confidence = 65.0

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

    # ── Next Probable Setup Calculation ───────────────────────────────────────
    raw_bull_pct = round((bull_total / max(bull_total + bear_total, 1)) * 100, 1)
    bull_pct = min(95.0, max(5.0, raw_bull_pct))
    bear_pct = round(100.0 - bull_pct, 1)
    probable_bias = dominant_bias
    bias_pct = int(round(max(bull_pct, bear_pct)))
    watch_trigger = (
        f"Agli candle EMA 9 ({ema9:.2f}) ke upar RSI > 50 & ADX > 22 ke sath close hone par confirmed CALL entry banegi"
        if probable_bias == "CALL"
        else f"Agli candle EMA 9 ({ema9:.2f}) ke niche RSI < 50 & ADX > 22 ke sath close hone par confirmed PUT entry banegi"
    )
    setup_summary = (
        f"Status: WAIT • Market developing {dominant_bias} bias ({bias_pct}% power). {watch_trigger}."
        if direction == "WAIT"
        else f"Strong {direction} momentum active ({bias_pct}%). {watch_trigger}."
    )
    next_probable_setup = {
        "bias": probable_bias,
        "biasPercentage": bias_pct,
        "bullishPower": bull_pct,
        "bearishPower": bear_pct,
        "watchTrigger": watch_trigger,
        "setupSummary": setup_summary,
    }

    return {
        "direction": direction,
        "confidence": confidence,
        "trade_quality": trade_quality,
        "entry_timing": entry_timing_info,
        "confluence_score": round((confluence_count / 10.0) * 100.0, 1),
        "next_probable_setup": next_probable_setup,
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
            "divergence": divergence_dict,
            "exhaustion": exhaustion_dict,
            "macro_trend": macro_trend_dict,
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
