"""
AI Senior Technical Arbiter & Confirmation Layer (Google Gemini & OpenAI ChatGPT).
Provides LLM-powered market regime analysis, false-breakout/trap detection,
and cross-verification of mathematical confluence signals.
Uses standard Python urllib with zero external dependencies.
"""
import os
import json
import logging
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

logger = logging.getLogger("ai-arbiter")

# Simple memory cache to prevent duplicate AI calls within the same candle
_CACHE: Dict[str, Any] = {}


def evaluate_with_ai(
    symbol: str,
    interval: str,
    recent_candles: list[dict],
    indicators: dict,
    patterns: list[dict],
    math_signal: dict,
    gemini_key: Optional[str] = None,
    openai_key: Optional[str] = None,
) -> dict:
    """
    Evaluates trading setup using Google Gemini or OpenAI ChatGPT.

    Returns dict:
      {
        "status": "active" | "disabled" | "fallback" | "cached",
        "provider": "gemini" | "openai" | "none",
        "approved": bool,
        "direction": "CALL" | "PUT" | "WAIT",
        "confidence": int (0-100),
        "trap_risk": "LOW" | "MEDIUM" | "HIGH",
        "analysis_en": str,
        "analysis_hi": str,
        "verdict": str
      }
    """
    g_key = (gemini_key or os.getenv("GEMINI_API_KEY", "")).strip()
    o_key = (openai_key or os.getenv("OPENAI_API_KEY", "")).strip()

    if not g_key and not o_key:
        return {
            "status": "disabled",
            "provider": "none",
            "approved": True,
            "direction": math_signal.get("direction", "WAIT"),
            "confidence": math_signal.get("confidence", 0),
            "trap_risk": "UNKNOWN",
            "analysis_en": "Pure Mathematical Confluence Mode active. (Set free Gemini API Key for AI double-confirmation).",
            "analysis_hi": "Pure Mathematical Confluence Mode active hai. (AI double-confirmation ke liye free Gemini API Key add karein).",
            "verdict": "Mathematical Confluence Mode",
        }

    # Cache check based on last candle timestamp + direction
    last_candle_ts = recent_candles[-1].get("timestamp", "") if recent_candles else ""
    cache_key = f"{symbol}:{interval}:{last_candle_ts}:{math_signal.get('direction', 'WAIT')}:{bool(g_key)}:{bool(o_key)}"
    if cache_key in _CACHE:
        cached = dict(_CACHE[cache_key])
        cached["status"] = "cached"
        return cached

    # Prepare compact market context for fast prompt tokenization
    formatted_candles = []
    for c in recent_candles[-6:]:
        o = float(c.get("open", 0))
        h = float(c.get("high", 0))
        l = float(c.get("low", 0))
        cl = float(c.get("close", 0))
        body_pct = round(abs(cl - o) / max(h - l, 1e-6) * 100, 1)
        direction = "GREEN" if cl >= o else "RED"
        formatted_candles.append({
            "dir": direction,
            "open": o,
            "close": cl,
            "high": h,
            "low": l,
            "body_pct": body_pct
        })

    compact_indicators = {
        "rsi": indicators.get("rsi", {}).get("value"),
        "rsi_signal": indicators.get("rsi", {}).get("signal"),
        "ema_trend": indicators.get("ema", {}).get("trend"),
        "ema8": indicators.get("ema", {}).get("ema8"),
        "ema21": indicators.get("ema", {}).get("ema21"),
        "ema50": indicators.get("ema", {}).get("ema50"),
        "adx": indicators.get("adx", {}).get("adx"),
        "plus_di": indicators.get("adx", {}).get("plus_di"),
        "minus_di": indicators.get("adx", {}).get("minus_di"),
        "awesome_oscillator": indicators.get("awesome_oscillator", {}).get("color"),
        "bollinger_signal": indicators.get("bollinger", {}).get("signal"),
        "sr_position": indicators.get("support_resistance", {}).get("position"),
    }

    pat_names = [p.get("name") for p in patterns] if patterns else []

    prompt = f"""You are an elite quantitative technical trader and risk manager specializing in Binomo 5-minute binary options.
Review the algorithmic mathematical signal and determine if this is an authentic high-probability setup or a trap (e.g., exhaustion, consolidation chop, or counter-trend trap).

MARKET SNAPSHOT:
- Asset: {symbol}
- Interval: {interval}
- Last 6 Candles: {json.dumps(formatted_candles)}
- Core Indicators: {json.dumps(compact_indicators)}
- Candlestick Patterns: {pat_names}
- Algorithmic Signal: Direction={math_signal.get('direction')}, Confidence={math_signal.get('confidence')}%, Quality={math_signal.get('trade_quality')}
- Key Reasons: {math_signal.get('reasons', {})}

CRITERIA:
1. Approve CALL only if momentum, trend alignment, and price action agree without imminent resistance exhaustion.
2. Approve PUT only if momentum, trend alignment, and price action agree without imminent support exhaustion.
3. If market is choppy, in an indecisive range, or oscillators contradict prevailing trend, set direction to WAIT.
4. Assess trap_risk: 'LOW', 'MEDIUM', or 'HIGH'.

Respond in STRICT JSON with keys:
{{
  "approved": boolean,
  "ai_direction": "CALL" | "PUT" | "WAIT",
  "ai_confidence": number (0-100),
  "trap_risk": "LOW" | "MEDIUM" | "HIGH",
  "analysis_en": "Concise 1-2 sentence professional trading rationale.",
  "analysis_hi": "Concise 1-sentence Hindi rationale for the trader.",
  "verdict": "VERIFIED_CALL" | "VERIFIED_PUT" | "AVOID_TRAP" | "WAIT_CHOP"
}}"""

    # 1. Try Google Gemini if key provided
    if g_key:
        models_to_try = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"]
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={g_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.15,
                    "responseMimeType": "application/json",
                },
            }
            try:
                data_bytes = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=data_bytes,
                    headers={"Content-Type": "application/json", "User-Agent": "BinomoAIEngine/1.0"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=3.5) as response:
                    resp_data = json.loads(response.read().decode("utf-8"))
                    candidates = resp_data.get("candidates", [])
                    if candidates:
                        raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                        parsed = json.loads(raw_text)

                        result = {
                            "status": "active",
                            "provider": "gemini",
                            "model": model,
                            "approved": bool(parsed.get("approved", True)),
                            "direction": str(parsed.get("ai_direction", math_signal.get("direction", "WAIT"))).upper(),
                            "confidence": int(parsed.get("ai_confidence", math_signal.get("confidence", 70))),
                            "trap_risk": str(parsed.get("trap_risk", "LOW")),
                            "analysis_en": str(parsed.get("analysis_en", "Gemini confirmation verified.")),
                            "analysis_hi": str(parsed.get("analysis_hi", "Gemini AI ne signal verify kiya hai.")),
                            "verdict": str(parsed.get("verdict", "VERIFIED")),
                        }

                        _CACHE[cache_key] = result
                        if len(_CACHE) > 50:
                            _CACHE.pop(next(iter(_CACHE)))
                        return result
            except Exception as e:
                logger.warning("Gemini model %s call failed (%s)", model, str(e))
                continue

    # 2. Try OpenAI ChatGPT if key provided
    if o_key:
        url = "https://api.openai.com/v1/chat/completions"
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "You are an elite quantitative technical trader and risk manager specializing in Binomo 5-minute binary options."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.15,
            "response_format": {"type": "json_object"}
        }
        try:
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data_bytes,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {o_key}",
                    "User-Agent": "BinomoAIEngine/1.0"
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=3.5) as response:
                resp_data = json.loads(response.read().decode("utf-8"))
                choices = resp_data.get("choices", [])
                if choices:
                    raw_text = choices[0].get("message", {}).get("content", "{}")
                    parsed = json.loads(raw_text)

                    result = {
                        "status": "active",
                        "provider": "openai",
                        "model": "gpt-4o-mini",
                        "approved": bool(parsed.get("approved", True)),
                        "direction": str(parsed.get("ai_direction", math_signal.get("direction", "WAIT"))).upper(),
                        "confidence": int(parsed.get("ai_confidence", math_signal.get("confidence", 70))),
                        "trap_risk": str(parsed.get("trap_risk", "LOW")),
                        "analysis_en": str(parsed.get("analysis_en", "ChatGPT confirmation verified.")),
                        "analysis_hi": str(parsed.get("analysis_hi", "ChatGPT AI ne signal verify kiya hai.")),
                        "verdict": str(parsed.get("verdict", "VERIFIED")),
                    }

                    _CACHE[cache_key] = result
                    if len(_CACHE) > 50:
                        _CACHE.pop(next(iter(_CACHE)))
                    return result
        except Exception as e:
            logger.warning("OpenAI API call failed (%s)", str(e))

    return {
        "status": "fallback",
        "provider": "fallback",
        "approved": True,
        "direction": math_signal.get("direction", "WAIT"),
        "confidence": math_signal.get("confidence", 0),
        "trap_risk": "LOW",
        "analysis_en": "Mathematical confluence active (AI fallback mode).",
        "analysis_hi": "Mathematical confluence active (AI backup mode).",
        "verdict": "Mathematical Engine Verified",
    }


# Backwards compatibility alias
evaluate_with_gemini = evaluate_with_ai
