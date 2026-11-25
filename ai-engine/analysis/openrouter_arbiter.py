"""
OpenRouter AI Analysis & Prediction Layer (Sole LLM Provider).
Analyzes OHLCV candles and technical indicators using OpenRouter API
to provide UP (CALL) / DOWN (PUT) / WAIT directional confirmation,
trap detection, and trader explanations in English and Hinglish.
Uses Python standard library urllib with zero external dependencies.
"""
import os
import re
import json
import time
import logging
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

logger = logging.getLogger("openrouter-arbiter")

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Default fallback order for OpenRouter free/configured models
DEFAULT_OPENROUTER_MODELS = [
    "openrouter/free",
    "nvidia/nemotron-3.5-lightning:free",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
]

# Memory cache: cache_key -> {"ts": float, "result": dict}
_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_TTL_SECONDS = 300  # Reuse same candle analysis up to 5 minutes

# Short cooldown after rate-limit / transient failure to avoid hammering OpenRouter on 5s polling
_ERROR_BACKOFF: Dict[str, Dict[str, Any]] = {}
_BACKOFF_SECONDS = 25


def _extract_json(raw_text: str) -> Optional[dict]:
    """Parse JSON object cleanly even if wrapped in markdown code fences."""
    if not raw_text:
        return None
    text = raw_text.strip()
    # Strip markdown ```json ... ``` fences if present
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL | re.IGNORECASE)
    if fence_match:
        text = fence_match.group(1)
    else:
        brace_match = re.search(r"\{.*\}", text, re.DOTALL)
        if brace_match:
            text = brace_match.group(0)
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def _normalize_direction(val: Any) -> str:
    s = str(val or "").strip().upper()
    if s in ("CALL", "UP", "BUY", "HIGHER", "GREEN"):
        return "CALL"
    if s in ("PUT", "DOWN", "SELL", "LOWER", "RED"):
        return "PUT"
    return "WAIT"


def evaluate_with_openrouter(
    symbol: str,
    interval: str,
    recent_candles: list[dict],
    indicators: dict,
    patterns: list[dict],
    math_signal: dict,
    openrouter_key: Optional[str] = None,
    model: Optional[str] = None,
) -> dict:
    """
    Evaluates trading setup using OpenRouter API exclusively.

    Returns dict:
      {
        "status": "active" | "disabled" | "fallback" | "cached",
        "provider": "openrouter" | "fallback" | "none",
        "model": str,
        "approved": bool,
        "direction": "CALL" | "PUT" | "WAIT",
        "confidence": int (0-100),
        "trap_risk": "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN",
        "analysis_en": str,
        "analysis_hi": str,
        "verdict": str,
        "error": Optional[str],
      }
    """
    api_key = (openrouter_key or os.getenv("OPENROUTER_API_KEY", "")).strip()
    preferred_model = (model or os.getenv("OPENROUTER_MODEL", "")).strip()

    if not api_key:
        return {
            "status": "disabled",
            "provider": "none",
            "model": preferred_model or DEFAULT_OPENROUTER_MODELS[0],
            "approved": True,
            "direction": math_signal.get("direction", "WAIT"),
            "confidence": math_signal.get("confidence", 0),
            "trap_risk": "UNKNOWN",
            "analysis_en": "OpenRouter API key not configured. Add OPENROUTER_API_KEY in AI Setup tab or server env.",
            "analysis_hi": "OpenRouter API key set nahi hai. AI Setup tab ya server env me key add karein.",
            "verdict": "OpenRouter Key Required",
        }

    now = time.time()
    last_candle_ts = str(recent_candles[-1].get("timestamp", "")) if recent_candles else ""
    cache_key = f"{symbol}:{interval}:{last_candle_ts}:{math_signal.get('direction', 'WAIT')}:{preferred_model}:{api_key[-6:]}"

    cached_entry = _CACHE.get(cache_key)
    if cached_entry and (now - cached_entry["ts"]) < _CACHE_TTL_SECONDS:
        cached = dict(cached_entry["result"])
        cached["status"] = "cached"
        return cached

    # Backoff key per key+symbol so 5s polling doesn't flood upstream on 429/404
    backoff_key = f"{symbol}:{interval}:{api_key[-6:]}"
    backoff_entry = _ERROR_BACKOFF.get(backoff_key)
    if backoff_entry and (now - backoff_entry["ts"]) < _BACKOFF_SECONDS:
        return {
            "status": "fallback",
            "provider": "fallback",
            "model": preferred_model or DEFAULT_OPENROUTER_MODELS[0],
            "approved": True,
            "direction": math_signal.get("direction", "WAIT"),
            "confidence": math_signal.get("confidence", 0),
            "trap_risk": "LOW",
            "analysis_en": f"Quantitative UP/DOWN active while OpenRouter cools down ({backoff_entry['reason']}).",
            "analysis_hi": f"OpenRouter temporary limit pe hai ({backoff_entry['reason']}), quantitative signal active hai.",
            "verdict": "Mathematical Engine Fallback",
            "error": backoff_entry["reason"],
        }

    # Build compact OHLCV context from last 8 closed candles
    formatted_candles = []
    for c in recent_candles[-8:]:
        o = float(c.get("open", 0))
        h = float(c.get("high", 0))
        l = float(c.get("low", 0))
        cl = float(c.get("close", 0))
        body_pct = round(abs(cl - o) / max(h - l, 1e-6) * 100, 1)
        direction_str = "GREEN(UP)" if cl >= o else "RED(DOWN)"
        formatted_candles.append({
            "dir": direction_str,
            "o": o,
            "h": h,
            "l": l,
            "c": cl,
            "body_pct": body_pct,
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
        "rsi_divergence": indicators.get("divergence", {}).get("signal", "NONE"),
        "consecutive_run": f"{indicators.get('exhaustion', {}).get('run_count', 0)} {indicators.get('exhaustion', {}).get('run_direction', '')}".strip(),
        "macro_trend": indicators.get("macro_trend", {}).get("trend", "NEUTRAL"),
    }

    pat_names = [p.get("name") for p in patterns] if patterns else []

    prompt = (
        f"Analyze {symbol} ({interval}) for the NEXT candle UP (CALL) or DOWN (PUT) direction.\n"
        f"Last 8 closed candles: {json.dumps(formatted_candles)}\n"
        f"Technical indicators: {json.dumps(compact_indicators)}\n"
        f"Candlestick patterns: {json.dumps(pat_names)}\n"
        f"Quant score summary: Direction={math_signal.get('direction')}, "
        f"Confidence={math_signal.get('confidence')}%, Quality={math_signal.get('trade_quality')}\n"
        f"Reasons: {json.dumps(math_signal.get('reasons', {}))}\n\n"
        "Instructions:\n"
        "1. Predict UP -> 'CALL', DOWN -> 'PUT', or 'WAIT' ONLY if completely flat/unclear.\n"
        "2. Base decision strictly on trend (EMA8/21/50), momentum (RSI/AO/ADX), S/R rejection wicks, and candle bodies.\n"
        "3. Assess trap_risk as LOW, MEDIUM, or HIGH.\n"
        "4. Return STRICT JSON ONLY (no markdown):\n"
        '{"approved": true, "ai_direction": "CALL"|"PUT"|"WAIT", "ai_confidence": 0-100, '
        '"trap_risk": "LOW"|"MEDIUM"|"HIGH", '
        '"analysis_en": "1-2 sentence technical rationale.", '
        '"analysis_hi": "1 concise Hinglish sentence explaining UP/DOWN prediction.", '
        '"verdict": "UP_CALL"|"DOWN_PUT"|"AVOID_TRAP"|"WAIT_CHOP"}'
    )

    models_to_try = []
    if preferred_model:
        models_to_try.append(preferred_model)
    for m in DEFAULT_OPENROUTER_MODELS:
        if m not in models_to_try:
            models_to_try.append(m)

    last_error = "OpenRouter unavailable"

    for m_id in models_to_try:
        payload = {
            "model": m_id,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an expert technical chart analyst providing UP (CALL) / DOWN (PUT) / WAIT "
                        "predictions from OHLCV candles and indicators. Always reply in strict valid JSON only."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.15,
            "max_tokens": 260,
        }
        try:
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                OPENROUTER_API_URL,
                data=data_bytes,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                    "HTTP-Referer": os.getenv(
                        "FRONTEND_URL",
                        "https://binomo-ai-signal-analyzer-8szu.onrender.com",
                    ),
                    "X-Title": "Binomo AI Signal Analyzer",
                    "User-Agent": "BinomoAIEngine/2.0",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=12) as response:
                resp_data = json.loads(response.read().decode("utf-8"))
                choices = resp_data.get("choices", [])
                if not choices:
                    last_error = "Empty choices from OpenRouter"
                    continue

                raw_text = choices[0].get("message", {}).get("content", "")
                parsed = _extract_json(raw_text)
                if not parsed:
                    last_error = "Non-JSON response from OpenRouter model"
                    logger.warning("OpenRouter model %s returned non-JSON: %s", m_id, raw_text[:180])
                    continue

                used_model = str(resp_data.get("model") or m_id)
                ai_dir = _normalize_direction(parsed.get("ai_direction") or parsed.get("direction"))
                try:
                    ai_conf = int(max(0, min(100, float(parsed.get("ai_confidence", math_signal.get("confidence", 70))))))
                except (TypeError, ValueError):
                    ai_conf = int(math_signal.get("confidence", 70) or 70)

                trap_risk = str(parsed.get("trap_risk", "LOW")).upper()
                if trap_risk not in ("LOW", "MEDIUM", "HIGH"):
                    trap_risk = "LOW"

                result = {
                    "status": "active",
                    "provider": "openrouter",
                    "model": used_model,
                    "approved": bool(parsed.get("approved", ai_dir != "WAIT")),
                    "direction": ai_dir,
                    "confidence": ai_conf,
                    "trap_risk": trap_risk,
                    "analysis_en": str(parsed.get("analysis_en", f"OpenRouter ({used_model}) analysis: {ai_dir}.")),
                    "analysis_hi": str(parsed.get("analysis_hi", f"OpenRouter AI ke hisab se {ai_dir} direction strong hai.")),
                    "verdict": str(parsed.get("verdict", f"OPENROUTER_{ai_dir}")),
                }

                _CACHE[cache_key] = {"ts": now, "result": result}
                if len(_CACHE) > 100:
                    _CACHE.pop(next(iter(_CACHE)))
                _ERROR_BACKOFF.pop(backoff_key, None)
                return result

        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode("utf-8", errors="ignore")
            except Exception:
                pass
            if e.code == 401:
                last_error = "Invalid OpenRouter API key (401)"
                logger.warning("OpenRouter 401 unauthorized")
                break  # No point trying other models with invalid key
            if e.code == 402:
                last_error = "Insufficient credits for paid model (402)"
            elif e.code == 404 and "ZDR violation" in err_body:
                last_error = "OpenRouter account ZDR privacy guardrail excludes free endpoint (check openrouter.ai/settings/privacy)"
            elif e.code == 429:
                last_error = "OpenRouter upstream rate limit (429)"
            else:
                last_error = f"OpenRouter HTTP {e.code}"
            logger.warning("OpenRouter model %s failed (%s): %s", m_id, last_error, err_body[:180])
            continue
        except Exception as e:
            last_error = f"OpenRouter request error: {str(e)}"
            logger.warning("OpenRouter model %s error: %s", m_id, str(e))
            continue

    _ERROR_BACKOFF[backoff_key] = {"ts": now, "reason": last_error}
    if len(_ERROR_BACKOFF) > 100:
        _ERROR_BACKOFF.pop(next(iter(_ERROR_BACKOFF)))

    return {
        "status": "fallback",
        "provider": "fallback",
        "model": preferred_model or DEFAULT_OPENROUTER_MODELS[0],
        "approved": True,
        "direction": math_signal.get("direction", "WAIT"),
        "confidence": math_signal.get("confidence", 0),
        "trap_risk": "LOW",
        "analysis_en": f"Quantitative UP/DOWN engine active ({last_error}).",
        "analysis_hi": f"OpenRouter temporary unavailable ({last_error}) — technical engine chal raha hai.",
        "verdict": "Quantitative Engine Verified",
        "error": last_error,
    }
