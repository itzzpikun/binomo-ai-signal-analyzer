"""
Flask entry point for the Binomo AI Signal Analyzer — AI Engine.
Exposes:
  POST /analyze   → signal generation
  POST /backtest  → walk-forward backtesting
  GET  /health    → liveness probe
"""
import os
import logging
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

from analysis.signal_engine import generate_signal
from analysis.backtest import run_backtest
from utils.validators import (
    validate_analyze_request,
    validate_backtest_request,
    ValidationError,
)

# ── Setup ─────────────────────────────────────────────────────────────────────
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("ai-engine")

app = Flask(__name__)

# CORS — allow configurable origins
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_env.split(",")]
CORS(app, resources={r"/*": {"origins": allowed_origins}})


# ── Error helpers ──────────────────────────────────────────────────────────────
def _error(message: str, code: int = 400):
    return jsonify({"error": message, "code": code}), code


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Liveness probe."""
    return jsonify(
        {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "binomo-ai-engine",
            "version": "1.0.0",
        }
    )


@app.post("/analyze")
def analyze():
    """
    Generate a CALL/PUT/WAIT signal from submitted OHLCV candles.

    Request body:
        {
            "symbol":   "EUR/USD",
            "interval": "5min",
            "candles":  [ {open, high, low, close, volume, timestamp}, ... ]
        }

    Response: signal dict (see signal_engine.generate_signal)
    """
    data = request.get_json(silent=True)
    if data is None:
        return _error("Request body must be valid JSON with Content-Type: application/json")

    try:
        cleaned = validate_analyze_request(data)
    except ValidationError as exc:
        return _error(exc.message, exc.code)

    logger.info(
        "Analyzing %s/%s with %d candles",
        cleaned["symbol"],
        cleaned["interval"],
        len(cleaned["candles"]),
    )

    sym_upper = cleaned["symbol"].upper()
    is_simulated = (
        data.get("source") == "simulated"
        or sym_upper.endswith("(OTC)")
        or sym_upper in ("CRYPTO_IDX", "CRYPTO IDX")
        or any(c.get("source") == "simulated" for c in cleaned["candles"])
    )
    if is_simulated:
        logger.info("Simulated data detected for %s — locking direction to WAIT", cleaned["symbol"])
        return jsonify({
            "symbol": cleaned["symbol"],
            "interval": cleaned["interval"],
            "source": "simulated",
            "direction": "WAIT",
            "confidence": 0,
            "trade_quality": "SIMULATED DATA",
            "indicators": {},
            "reasons": {
                "bullish": [],
                "bearish": [],
                "wait_reasons": ["Simulated data"],
            },
            "entry_timing": {
                "rule_en": "Trading disabled: Simulated data",
                "rule_hi": "सौदा अक्षम: डेटा सिम्युलेटेड है",
                "recommended_action": "WAIT",
            },
            "confluence_score": 0,
        })

    gemini_key = (
        request.headers.get("X-Gemini-Key")
        or data.get("gemini_api_key")
        or os.getenv("GEMINI_API_KEY")
    )
    openai_key = (
        request.headers.get("X-OpenAI-Key")
        or data.get("openai_api_key")
        or os.getenv("OPENAI_API_KEY")
    )

    try:
        signal = generate_signal(
            cleaned["candles"],
            interval=cleaned.get("interval", "5min"),
            symbol=cleaned.get("symbol", "EUR/USD"),
            gemini_api_key=gemini_key,
            openai_api_key=openai_key,
        )
    except Exception as exc:
        logger.exception("Signal generation failed")
        return _error(f"Analysis failed: {str(exc)}", 500)

    signal["symbol"] = cleaned["symbol"]
    signal["interval"] = cleaned["interval"]
    return jsonify(signal)


@app.post("/backtest")
def backtest():
    """
    Run walk-forward backtest on submitted candle history.

    Request body:
        {
            "symbol":   "EUR/USD",
            "interval": "5min",
            "candles":  [ ... ],
            "config":   { "min_confidence": 40, "step": 1 }  (optional)
        }

    Response: backtest result dict (see backtest.run_backtest)
    """
    data = request.get_json(silent=True)
    if data is None:
        return _error("Request body must be valid JSON with Content-Type: application/json")

    try:
        cleaned = validate_backtest_request(data)
    except ValidationError as exc:
        return _error(exc.message, exc.code)

    logger.info(
        "Backtesting %s/%s with %d candles",
        cleaned["symbol"],
        cleaned["interval"],
        len(cleaned["candles"]),
    )

    try:
        result = run_backtest(cleaned["candles"], cleaned.get("config", {}))
    except Exception as exc:
        logger.exception("Backtest failed")
        return _error(f"Backtest failed: {str(exc)}", 500)

    result["symbol"] = cleaned["symbol"]
    result["interval"] = cleaned["interval"]
    result["disclaimer"] = (
        "Past performance does not guarantee future results. "
        "Signal based on technical analysis only. Not financial advice."
    )
    return jsonify(result)


@app.get("/api/scan/all")
def scan_all():
    """
    Multi-asset scan. Simulated / OTC assets always return direction WAIT with reason 'Simulated data'.
    """
    from analysis.market_feed import ASSET_SPECS
    signals = []
    for sym, spec in ASSET_SPECS.items():
        if spec.get("isOtc", False):
            signals.append({
                "symbol": sym,
                "source": "simulated",
                "direction": "WAIT",
                "confidence": 0,
                "trade_quality": "SIMULATED DATA",
                "reasons": {
                    "bullish": [],
                    "bearish": [],
                    "wait_reasons": ["Simulated data"],
                },
                "status": "no real data available",
            })
    return jsonify({
        "status": "OK",
        "scanned": len(ASSET_SPECS),
        "signals": signals,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })



# ── 404 / 405 handlers ────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(_):
    return _error("Endpoint not found", 404)


@app.errorhandler(405)
def method_not_allowed(_):
    return _error("Method not allowed", 405)


@app.errorhandler(500)
def internal_error(_):
    return _error("Internal server error", 500)


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 8000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    logger.info("Starting AI Engine on port %d (debug=%s)", port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug)
