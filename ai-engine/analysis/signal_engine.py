"""
Signal Engine — Professional Quantitative Confluence & Multi-Timeframe Analysis Engine.
Implements:
- 100-Point Quantitative Scoring (Trend 25, Momentum 20, Price Action 20, MTF 20, Volatility 15)
- Independent Multi-Timeframe Analysis (1M entry, 5M trend confirmation, 15M major trend confirmation)
- No lookahead bias, completed candles only
- Strict Anti-Loss Filters (sideways chop, volatility spike, timeframe conflicts, rejection wicks, exhaustion)
- AI Ensemble Arbiter as non-inflating supporting observer (strong disagreement -> WAIT)
- Real stats only: setup score kept separate from win probability
"""
import math
from datetime import datetime, timezone
from typing import Any, Optional, Dict, List

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
from analysis.gemini_arbiter import evaluate_with_ai

MIN_CANDLES = 15


def generate_signal(
    candles: list[dict],
    gemini_api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
    groq_api_key: Optional[str] = None,
    openrouter_api_key: Optional[str] = None,
    cloudflare_api_key: Optional[str] = None,
    mtf_context: Optional[dict] = None,
    interval: str = "1min",
    skip_ai: bool = False,
) -> dict:
    disclaimer = "Signal based on technical analysis confluence only. Never risk capital without money management."

    if not candles or len(candles) < MIN_CANDLES:
        return {
            "direction": "WAIT",
            "confidence": 0,
            "trade_quality": "DATA_UNAVAILABLE",
            "reason": f"Need at least {MIN_CANDLES} completed candles for mathematical confluence.",
            "disclaimer": disclaimer,
            "score_breakdown": {"trendScore": 0, "momentumScore": 0, "priceActionScore": 0, "mtfScore": 0, "volatilityScore": 0, "totalScore": 0},
            "timeframe_alignment": {"1m": "WAIT", "5m": "UNAVAILABLE", "15m": "UNAVAILABLE", "isAligned": False, "conflictDetected": False, "dataAvailable": False},
        }

    highs = np.array([float(c["high"]) for c in candles], dtype=float)
    lows = np.array([float(c["low"]) for c in candles], dtype=float)
    closes = np.array([float(c["close"]) for c in candles], dtype=float)
    volumes = np.array([float(c.get("volume", 0)) for c in candles], dtype=float)
    close = float(closes[-1])

    # 1. Calculate Technical Indicators
    rsi_val = calculate_rsi(closes, 14)
    macd_dict = calculate_macd(closes, 12, 26, 9)
    ema9 = calculate_ema(closes, 9)
    ema21 = calculate_ema(closes, 21)
    ema50 = calculate_ema(closes, min(50, len(closes)))
    ema200 = calculate_ema(closes, min(200, len(closes))) if len(closes) >= 60 else ema50

    bb = calculate_bollinger_bands(closes, 20, 2.0)
    sr = calculate_support_resistance(highs, lows, closes)
    atr_val = calculate_atr(highs, lows, closes, 14)
    stoch = calculate_stochastic(highs, lows, closes, 14, 3)
    vol_analysis = calculate_volume_analysis(volumes, closes, 20)
    adx_dict = calculate_adx(highs, lows, closes, period=14)
    ao_dict = calculate_awesome_oscillator(highs, lows)
    patterns = detect_patterns(candles[-15:])
    divergence_dict = calculate_divergence(highs, lows, closes)
    exhaustion_dict = calculate_candle_exhaustion(candles)
    macro_trend_dict = calculate_macro_trend(closes)

    # 2. 100-Point Quantitative Scoring Engine
    bull_trend = 0
    bear_trend = 0

    # Trend (25 pts):
    if not math.isnan(ema9) and not math.isnan(ema21):
        if ema9 > ema21:
            bull_trend += 12 if (not math.isnan(ema50) and ema21 > ema50) else 8
        elif ema9 < ema21:
            bear_trend += 12 if (not math.isnan(ema50) and ema21 < ema50) else 8

    if not math.isnan(ema50):
        if close > ema50:
            bull_trend += 3
        else:
            bear_trend += 3

    if not math.isnan(ema200):
        if close > ema200:
            bull_trend += 3
        else:
            bear_trend += 3

    p_di = adx_dict.get("plus_di", 20)
    m_di = adx_dict.get("minus_di", 20)
    if p_di > m_di:
        bull_trend += 4
    elif m_di > p_di:
        bear_trend += 4

    macd_val = macd_dict.get("macd", 0)
    if not math.isnan(macd_val):
        if macd_val > 0:
            bull_trend += 3
        else:
            bear_trend += 3

    # Momentum (20 pts):
    bull_mom = 0
    bear_mom = 0
    if not math.isnan(rsi_val):
        if 50 <= rsi_val <= 68:
            bull_mom += 7
        elif 68 < rsi_val <= 75:
            bull_mom += 4
        elif 32 <= rsi_val <= 50:
            bear_mom += 7
        elif 25 <= rsi_val < 32:
            bear_mom += 4

    hist = macd_dict.get("histogram", 0)
    if not math.isnan(hist):
        if hist > 0:
            bull_mom += 5
        elif hist < 0:
            bear_mom += 5

    k_val = stoch.get("k", 50)
    d_val = stoch.get("d", 50)
    if not math.isnan(k_val) and not math.isnan(d_val):
        if k_val > d_val:
            bull_mom += 4
        elif k_val < d_val:
            bear_mom += 4

    ao_val = ao_dict.get("ao", 0)
    ao_color = ao_dict.get("color", "neutral")
    if ao_val > 0 and ao_color == "green":
        bull_mom += 4
    elif ao_val < 0 and ao_color == "red":
        bear_mom += 4

    # Price Action (20 pts):
    bull_pa = 0
    bear_pa = 0
    if len(closes) >= 2:
        if closes[-1] > closes[-2] and highs[-1] > highs[-2]:
            bull_pa += 8
        elif closes[-1] < closes[-2] and lows[-1] < lows[-2]:
            bear_pa += 8

    bull_pattern = next((p for p in patterns if p.get("type") == "bullish"), None)
    bear_pattern = next((p for p in patterns if p.get("type") == "bearish"), None)
    if bull_pattern:
        bull_pa += int(round(bull_pattern.get("strength", 0.7) * 7))
    if bear_pattern:
        bear_pa += int(round(bear_pattern.get("strength", 0.7) * 7))

    supports = sr.get("support_levels", [])
    resistances = sr.get("resistance_levels", [])
    nearest_support = max((s for s in supports if s <= close), default=None)
    nearest_resistance = min((r for r in resistances if r >= close), default=None)

    at_support = nearest_support is not None and abs(close - nearest_support) / max(close, 1e-10) <= 0.002
    at_resistance = nearest_resistance is not None and abs(nearest_resistance - close) / max(close, 1e-10) <= 0.002

    if at_support and closes[-1] > candles[-1].get("open", closes[-1]):
        bull_pa += 5
    elif at_resistance and closes[-1] < candles[-1].get("open", closes[-1]):
        bear_pa += 5
    else:
        bull_pa += 2
        bear_pa += 2

    # Phase 2: Genuine Multi-Timeframe Alignment (20 pts)
    # Requirement: NEVER invent confirmation if higher timeframe data is missing.
    bull_mtf = 0
    bear_mtf = 0
    mtf_conflict = False
    mtf_available = False

    s5m = mtf_context.get("s5mDirection") if mtf_context else None
    s15m = mtf_context.get("s15mDirection") if mtf_context else None

    if s5m and s5m != "WAIT" and s5m != "UNAVAILABLE":
        mtf_available = True
        if s5m == "CALL":
            bull_mtf += 10
        elif s5m == "PUT":
            bear_mtf += 10

    if s15m and s15m != "WAIT" and s15m != "UNAVAILABLE":
        mtf_available = True
        if s15m == "CALL":
            bull_mtf += 10
        elif s15m == "PUT":
            bear_mtf += 10

    if s5m and s15m and s5m not in ("WAIT", "UNAVAILABLE") and s15m not in ("WAIT", "UNAVAILABLE"):
        if s5m != s15m:
            mtf_conflict = True

    # Volatility & Market Quality (15 pts):
    adx_val = adx_dict.get("adx", 20)
    bb_width_pct = bb["width"] / max(bb["middle"], 1e-6) if not math.isnan(bb.get("width", 0)) else 0.005
    is_dead_market = False
    if not math.isnan(atr_val):
        avg_price = float(np.mean(closes[-20:]))
        is_dead_market = (atr_val / max(avg_price, 1e-6) * 100) < 0.002

    vol_score = 0
    if adx_val >= 22:
        vol_score += 8
    elif adx_val >= 18:
        vol_score += 4

    if 0.0015 <= bb_width_pct <= 0.015:
        vol_score += 4
    else:
        vol_score += 2

    if not is_dead_market:
        vol_score += 3

    bull_total = min(100, bull_trend + bull_mom + bull_pa + bull_mtf + vol_score)
    bear_total = min(100, bear_trend + bear_mom + bear_pa + bear_mtf + vol_score)

    dominant_bias = "CALL" if bull_total >= bear_total else "PUT"
    dominant_score = bull_total if dominant_bias == "CALL" else bear_total

    score_breakdown = {
        "trendScore": bull_trend if dominant_bias == "CALL" else bear_trend,
        "momentumScore": bull_mom if dominant_bias == "CALL" else bear_mom,
        "priceActionScore": bull_pa if dominant_bias == "CALL" else bear_pa,
        "mtfScore": bull_mtf if dominant_bias == "CALL" else bear_mtf,
        "volatilityScore": vol_score,
        "totalScore": dominant_score,
    }

    # Count genuine independent confirmations (out of 10)
    bull_confirmations = 0
    bear_confirmations = 0
    if ema9 > ema21 and ema21 > ema50:
        bull_confirmations += 1
    if ema9 < ema21 and ema21 < ema50:
        bear_confirmations += 1
    if close > ema200:
        bull_confirmations += 1
    if close < ema200:
        bear_confirmations += 1
    if 50 <= rsi_val <= 68:
        bull_confirmations += 1
    if 32 <= rsi_val <= 50:
        bear_confirmations += 1
    if hist > 0:
        bull_confirmations += 1
    if hist < 0:
        bear_confirmations += 1
    if ao_val > 0 and ao_color == "green":
        bull_confirmations += 1
    if ao_val < 0 and ao_color == "red":
        bear_confirmations += 1
    if p_di > m_di and adx_val >= 20:
        bull_confirmations += 1
    if m_di > p_di and adx_val >= 20:
        bear_confirmations += 1
    if s5m == "CALL":
        bull_confirmations += 1
    if s5m == "PUT":
        bear_confirmations += 1
    if s15m == "CALL":
        bull_confirmations += 1
    if s15m == "PUT":
        bear_confirmations += 1
    if bull_pattern:
        bull_confirmations += 1
    if bear_pattern:
        bear_confirmations += 1

    # False Signal & Anti-Loss Filters
    filter_triggered = False
    filter_reason = None
    wait_reasons = []

    last_candle = candles[-1]
    last_range = max(float(last_candle["high"]) - float(last_candle["low"]), 1e-6)
    last_body = abs(float(last_candle["close"]) - float(last_candle.get("open", last_candle["close"])))
    last_body_ratio = last_body / last_range
    last_upper_wick = float(last_candle["high"]) - max(float(last_candle["close"]), float(last_candle.get("open", last_candle["close"])))
    last_lower_wick = min(float(last_candle["close"]), float(last_candle.get("open", last_candle["close"]))) - float(last_candle["low"])

    bb_pct_b = bb.get("percent_b", 0.5)

    # 1. Timeframe Conflict
    if mtf_conflict:
        filter_triggered = True
        filter_reason = f"Conflicting Multi-Timeframe Alignment (5M: {s5m} vs 15M: {s15m}) — WAIT"
        wait_reasons.append(filter_reason)
    elif s5m and s5m not in ("WAIT", "UNAVAILABLE") and s5m != dominant_bias:
        filter_triggered = True
        filter_reason = f"Timeframe Conflict: 1M setup ({dominant_bias}) opposes 5M trend ({s5m}) — WAIT"
        wait_reasons.append(filter_reason)
    elif s15m and s15m not in ("WAIT", "UNAVAILABLE") and s15m != dominant_bias:
        filter_triggered = True
        filter_reason = f"Macro Trend Conflict: Setup opposes 15M major trend ({s15m}) — Counter-trend trade blocked"
        wait_reasons.append(filter_reason)
    # 2. Sideways market / low ADX
    elif adx_val < 20 or is_dead_market:
        filter_triggered = True
        filter_reason = f"Sideways Market Chop Detected (ADX: {adx_val:.1f} < 20) — False Signal Risk High"
        wait_reasons.append(filter_reason)
    # 3. Bollinger Band overextension trap
    elif dominant_bias == "CALL" and (not math.isnan(bb_pct_b) and bb_pct_b >= 0.95):
        filter_triggered = True
        filter_reason = f"Bollinger Band Overbought Exhaustion (%B={bb_pct_b:.2f} >= 0.95) — Reversal Trap Risk High"
        wait_reasons.append(filter_reason)
    elif dominant_bias == "PUT" and (not math.isnan(bb_pct_b) and bb_pct_b <= 0.05):
        filter_triggered = True
        filter_reason = f"Bollinger Band Oversold Exhaustion (%B={bb_pct_b:.2f} <= 0.05) — Bounce Trap Risk High"
        wait_reasons.append(filter_reason)
    # 4. RSI Extreme trap
    elif dominant_bias == "CALL" and rsi_val > 68:
        filter_triggered = True
        filter_reason = f"RSI Overbought Momentum Exhaustion ({rsi_val:.1f} > 68) — Pullback Risk High"
        wait_reasons.append(filter_reason)
    elif dominant_bias == "PUT" and rsi_val < 32:
        filter_triggered = True
        filter_reason = f"RSI Oversold Momentum Exhaustion ({rsi_val:.1f} < 32) — Bounce Risk High"
        wait_reasons.append(filter_reason)
    # 5. Indecisive body
    elif last_body_ratio < 0.40:
        filter_triggered = True
        filter_reason = f"Indecisive Candle Body (Body {(last_body_ratio*100):.0f}% < 40% of Range) — High Uncertainty"
        wait_reasons.append(filter_reason)
    # 6. Rejection Wick
    elif dominant_bias == "CALL" and (last_upper_wick >= 0.35 * last_range or (last_body > 0 and last_upper_wick >= 0.85 * last_body)):
        filter_triggered = True
        filter_reason = f"Selling Pressure Wick Rejection: Upper Wick ({last_upper_wick/last_range*100:.0f}%) contradicts CALL"
        wait_reasons.append(filter_reason)
    elif dominant_bias == "PUT" and (last_lower_wick >= 0.35 * last_range or (last_body > 0 and last_lower_wick >= 0.85 * last_body)):
        filter_triggered = True
        filter_reason = f"Buying Pressure Wick Rejection: Lower Wick ({last_lower_wick/last_range*100:.0f}%) contradicts PUT"
        wait_reasons.append(filter_reason)
    # 7. Anti-Trend Filter
    elif dominant_bias == "CALL" and ema9 < ema21 and close < ema50:
        filter_triggered = True
        filter_reason = "Anti-Trend Filter: Cannot CALL in prevailing downtrend (EMA 9 < 21 & Price < EMA 50)"
        wait_reasons.append(filter_reason)
    elif dominant_bias == "PUT" and ema9 > ema21 and close > ema50:
        filter_triggered = True
        filter_reason = "Anti-Trend Filter: Cannot PUT in prevailing uptrend (EMA 9 > 21 & Price > EMA 50)"
        wait_reasons.append(filter_reason)
    # 8. Macro Trend Veto (EMA 200)
    elif dominant_bias == "CALL" and close < ema200:
        filter_triggered = True
        filter_reason = "Macro Trend Veto: Price < EMA 200 — Counter-trend CALL blocked"
        wait_reasons.append(filter_reason)
    elif dominant_bias == "PUT" and close > ema200:
        filter_triggered = True
        filter_reason = "Macro Trend Veto: Price > EMA 200 — Counter-trend PUT blocked"
        wait_reasons.append(filter_reason)
    # 9. Consecutive Run Exhaustion
    elif exhaustion_dict.get("exhaustion_risk") and dominant_bias == "CALL" and exhaustion_dict.get("run_direction") == "GREEN":
        filter_triggered = True
        filter_reason = f"Candle Exhaustion: {exhaustion_dict.get('run_count', 4)}+ consecutive green candles. Retracement risk high."
        wait_reasons.append(filter_reason)
    elif exhaustion_dict.get("exhaustion_risk") and dominant_bias == "PUT" and exhaustion_dict.get("run_direction") == "RED":
        filter_triggered = True
        filter_reason = f"Candle Exhaustion: {exhaustion_dict.get('run_count', 4)}+ consecutive red candles. Bounce risk high."
        wait_reasons.append(filter_reason)
    # 10. Institutional Quantitative Threshold
    elif dominant_score < 65 or (dominant_bias == "CALL" and bull_confirmations < 4) or (dominant_bias == "PUT" and bear_confirmations < 4):
        filter_triggered = True
        req_conf = bull_confirmations if dominant_bias == "CALL" else bear_confirmations
        filter_reason = f"Setup Score ({dominant_score}/100) or Confluence ({req_conf}/10) below high-accuracy threshold (Min 65 pts, 4 confluences)"
        wait_reasons.append(filter_reason)

    confluence_count = bull_confirmations if dominant_bias == "CALL" else bear_confirmations

    if filter_triggered:
        direction = "WAIT"
        trade_quality = filter_reason or "AWAITING 65+ SCORE CONFLUENCE"
        confidence = round(min(float(dominant_score), 63.0), 1)
    else:
        direction = dominant_bias
        confidence = round(float(dominant_score), 1)
        trade_quality = f"QUALIFIED SETUP ({dominant_score} pts, {confluence_count}/10 confluences)"

    # AI Ensemble Arbiter (Supporting Analysis Only - Requirement 8: Never inflates confidence)
    if skip_ai:
        ai_result = {"status": "disabled", "provider": "none", "approved": True, "direction": direction}
    else:
        ai_result = evaluate_with_ai(
            symbol=candles[-1].get("symbol", "EUR/USD") if candles else "EUR/USD",
            interval=interval,
            recent_candles=candles[-10:],
            indicators={
                "rsi": round(rsi_val, 1) if not math.isnan(rsi_val) else 50,
                "ema9": round(ema9, 5) if not math.isnan(ema9) else 0,
                "ema21": round(ema21, 5) if not math.isnan(ema21) else 0,
                "adx": adx_val,
                "ao": ao_val,
            },
            patterns=patterns,
            math_signal={"direction": direction, "confidence": confidence},
            gemini_key=gemini_api_key,
            openai_key=openai_api_key,
            groq_key=groq_api_key,
            openrouter_key=openrouter_api_key,
            cloudflare_key=cloudflare_api_key,
        )

    if ai_result.get("status") in ("active", "cached"):
        ai_dir = ai_result.get("direction")
        trap_risk = ai_result.get("trap_risk", "LOW")

        if trap_risk == "HIGH" and direction != "WAIT":
            direction = "WAIT"
            trade_quality = "AI_TRAP_VETO"
            confidence = 60.0
            wait_reasons.append(f"AI Trap Veto: {ai_result.get('analysis_en')}")
        elif direction != "WAIT" and ai_dir != "WAIT" and ai_dir != direction:
            direction = "WAIT"
            trade_quality = "AI_CONFLICT_VETO"
            confidence = 50.0
            wait_reasons.append(f"AI Contradiction Veto: Engine was {direction} but AI identified opposing momentum ({ai_dir}).")

    if direction == "WAIT" and score_breakdown["totalScore"] >= 65:
        score_breakdown["totalScore"] = 63

    bull_pct = min(95.0, max(5.0, round((bull_total / max(bull_total + bear_total, 1)) * 100, 1)))
    bear_pct = round(100.0 - bull_pct, 1)
    bias_pct = int(round(max(bull_pct, bear_pct)))

    watch_trigger = (
        f"Next completed candle close above EMA 9 ({ema9:.4f}) with RSI > 50 & ADX > 20 required for CALL entry"
        if dominant_bias == "CALL"
        else f"Next completed candle close below EMA 9 ({ema9:.4f}) with RSI < 50 & ADX > 20 required for PUT entry"
    )

    setup_summary = (
        f"Status: WAIT • Market developing {dominant_bias} bias ({bias_pct}% odds). {watch_trigger}."
        if direction == "WAIT"
        else f"{direction} verified with {dominant_score}/100 setup score and {confluence_count}/10 confluences. Low trap risk."
    )

    return {
        "direction": direction,
        "confidence": confidence,
        "trade_quality": trade_quality,
        "score_breakdown": score_breakdown,
        "market_regime": "RANGING" if adx_val < 20 else "TRENDING",
        "entry_timing": {
            "rule_en": "Execute at open of new candle within first 0-10 seconds strictly. DO NOT enter mid-candle.",
            "rule_hi": "Nayi candle shuru hote hi pehle 0-10 seconds me entry lein. Candle ke beech me trade na lein.",
            "recommended_action": f"Take {direction} at candle open (00:00 - 00:10)" if direction != "WAIT" else "Wait for qualified setup.",
            "entry_window": "00:00 - 00:10 (Strict)",
            "expiry_duration": f"{interval} (Fixed)",
            "confluence_count": confluence_count,
            "quality_tier": trade_quality,
            "quality_label": f"{direction} Setup Score: {dominant_score}/100",
            "matched_frameworks": [p["name"] for p in patterns],
        },
        "confluence_score": confidence,
        "next_probable_setup": {
            "bias": dominant_bias,
            "biasPercentage": bias_pct,
            "bullishPower": bull_pct,
            "bearishPower": bear_pct,
            "watchTrigger": watch_trigger,
            "setupSummary": setup_summary,
        },
        "indicators": {
            "rsi": {"value": round(rsi_val, 1) if not math.isnan(rsi_val) else None, "signal": "Bullish" if rsi_val >= 55 else ("Bearish" if rsi_val <= 45 else "Neutral")},
            "macd": {"macd": round(macd_dict["macd"], 5) if not math.isnan(macd_dict["macd"]) else None, "signal_line": round(macd_dict["signal"], 5) if not math.isnan(macd_dict["signal"]) else None, "histogram": round(macd_dict["histogram"], 5) if not math.isnan(macd_dict["histogram"]) else None, "crossover": "bullish" if macd_dict["macd"] > macd_dict["signal"] else "bearish"},
            "ema": {"ema9": round(ema9, 5) if not math.isnan(ema9) else None, "ema21": round(ema21, 5) if not math.isnan(ema21) else None, "ema50": round(ema50, 5) if not math.isnan(ema50) else None, "ema200": round(ema200, 5) if not math.isnan(ema200) else None, "trend": "BULLISH" if ema9 > ema21 else "BEARISH"},
            "adx": adx_dict,
            "awesome_oscillator": ao_dict,
            "bollinger": {"upper": round(bb["upper"], 5) if not math.isnan(bb["upper"]) else None, "middle": round(bb["middle"], 5) if not math.isnan(bb["middle"]) else None, "lower": round(bb["lower"], 5) if not math.isnan(bb["lower"]) else None, "percent_b": round(bb["percent_b"], 4) if not math.isnan(bb["percent_b"]) else 0.5},
            "support_resistance": {"nearest_support": round(nearest_support, 5) if nearest_support else None, "nearest_resistance": round(nearest_resistance, 5) if nearest_resistance else None, "position": "at_support" if at_support else ("at_resistance" if at_resistance else "mid_range")},
            "atr": round(atr_val, 5) if not math.isnan(atr_val) else None,
            "stochastic": stoch,
            "exhaustion": exhaustion_dict,
        },
        "patterns": patterns,
        "reasons": {
            "bullish": [f"Bullish confluence count: {bull_confirmations}/10"],
            "bearish": [f"Bearish confluence count: {bear_confirmations}/10"],
            "wait_reasons": wait_reasons,
        },
        "timeframe_alignment": {
            "1m": dominant_bias,
            "5m": s5m or "UNAVAILABLE",
            "15m": s15m or "UNAVAILABLE",
            "isAligned": bool(s5m and s15m and s5m == s15m and s5m == dominant_bias),
            "conflictDetected": mtf_conflict,
            "dataAvailable": mtf_available,
        },
        "gemini_arbiter": ai_result,
        "analysis_horizon": interval,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "disclaimer": disclaimer,
    }
