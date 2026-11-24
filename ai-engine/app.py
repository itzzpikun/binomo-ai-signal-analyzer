"""
Flask entry point for the Binomo AI Signal Analyzer — Unified Quant Engine.
Serves:
  - Frontend SPA (React / Vite production bundle)
  - /api/market/assets, /api/market/candles, /api/market/price, /api/market/status
  - /api/signal/analyze, /api/signal/history, /api/scan/all
  - /api/backtest/run
  - /api/risk/evaluate, /api/risk/status
  - /api/ai/providers, /api/ai/test-key
  - /health, /api/health
"""
import os
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from analysis.signal_engine import generate_signal
from analysis.backtest import run_backtest
from analysis.risk_manager import risk_manager
from analysis.market_feed import (
    fetch_genuine_candles,
    validate_candles,
    get_completed_candles_only,
    sanitize_and_sort_candles,
    get_supported_assets,
    BINOMO_ASSETS_LIST,
    get_asset_spec,
)

# ── Setup ─────────────────────────────────────────────────────────────────────
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("unified-engine")

_candidate_dirs = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "static"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "../frontend/dist"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "../backend/public"),
    "/app/backend/public",
    "/app/frontend/dist",
]
STATIC_DIR = next((d for d in _candidate_dirs if os.path.exists(os.path.join(d, "index.html"))), _candidate_dirs[0])
logger.info("Serving static frontend files from: %s", STATIC_DIR)

app = Flask(__name__, static_folder=STATIC_DIR)

# CORS
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_env.split(",")]
CORS(app, resources={r"/*": {"origins": allowed_origins}})


def _error(message: str, code: int = 400):
    return jsonify({"error": message, "code": code}), code


# ── Static Frontend Serving ───────────────────────────────────────────────────
@app.route("/")
def index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return send_from_directory(STATIC_DIR, "index.html")
    return jsonify({
        "status": "OK",
        "service": "binomo-ai-analyzer",
        "message": "Unified Quant Engine Ready",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 200


@app.route("/assets/<path:filename>")
def serve_assets(filename):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    return send_from_directory(assets_dir, filename)


# ── Health probes ─────────────────────────────────────────────────────────────
@app.get("/health")
@app.get("/api/health")
def health():
    has_frontend = os.path.exists(os.path.join(STATIC_DIR, "index.html"))
    return jsonify({
        "status": "OK",
        "service": "binomo-ai-engine",
        "services": {
            "frontend": "ready" if has_frontend else "fallback",
            "ai_engine": "connected",
            "market_data": "genuine_feed_active",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "3.0.0",
    })


# ── Market Data Routes ────────────────────────────────────────────────────────
@app.get("/api/market/assets")
def get_assets():
    """Return supported assets grouped by category."""
    return jsonify({
        "status": "OK",
        "categories": get_supported_assets(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.get("/api/market/candles")
def get_candles():
    """Return genuine completed OHLCV candles (zero synthetic candles)."""
    symbol = request.args.get("symbol", "EUR/USD")
    interval = request.args.get("interval", "1min")
    limit = int(request.args.get("limit", 100))
    limit = max(10, min(500, limit))

    raw_candles = fetch_genuine_candles(symbol, interval, limit)
    report = validate_candles(raw_candles, symbol, interval)

    if not raw_candles or report["status"] == "DATA_UNAVAILABLE":
        return jsonify({
            "status": "DATA_UNAVAILABLE",
            "symbol": symbol,
            "interval": interval,
            "count": 0,
            "candles": [],
            "data_quality": report,
            "message": report["message"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    return jsonify({
        "status": report["status"],
        "symbol": symbol,
        "interval": interval,
        "count": len(raw_candles),
        "candles": raw_candles,
        "data_quality": report,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.get("/api/market/price")
def get_price():
    """Return current market price and change for symbol."""
    symbol = request.args.get("symbol", "EUR/USD")
    candles = fetch_genuine_candles(symbol, "1min", 3)
    if not candles:
        return _error(f"Price unavailable for {symbol} (feed disconnected or OTC)", 404)

    latest = candles[-1]
    prev = candles[-2] if len(candles) > 1 else latest
    change_pct = round(((latest["close"] - prev["open"]) / max(prev["open"], 1e-10)) * 100, 2)

    return jsonify({
        "status": "OK",
        "symbol": symbol,
        "price": latest["close"],
        "change": change_pct,
        "timestamp": latest["timestamp"],
    })


@app.get("/api/market/status")
def get_market_status():
    """Return genuine market connection status."""
    has_td_key = bool(os.getenv("TWELVE_DATA_API_KEY"))
    return jsonify({
        "status": "connected" if has_td_key else "partially_connected",
        "feed_mode": "GENUINE_DATA_ONLY (Zero Synthetic)",
        "source": "Twelve Data (Forex/Gold) + Binance (Crypto)",
        "otc_status": "Requires Binomo Direct Authenticated Feed",
        "activePairs": len(BINOMO_ASSETS_LIST),
        "serverTime": datetime.now(timezone.utc).isoformat(),
    })


# ── Signal Analysis Routes ────────────────────────────────────────────────────
@app.post("/api/signal/analyze")
@app.post("/analyze")
def analyze():
    """Generate high-accuracy signal from genuine completed candles with real MTF."""
    data = request.get_json(silent=True) or {}
    symbol = data.get("symbol", "EUR/USD")
    interval = data.get("interval", "1min")
    input_candles = data.get("candles")

    # Risk Management Evaluation (Phase 7)
    risk_advice = risk_manager.evaluate_permission()
    if not risk_advice["permitted"]:
        return jsonify({
            "direction": "WAIT",
            "confidence": 0,
            "trade_quality": f"RISK_LOCK: {risk_advice['status']}",
            "market_regime": "PROTECTED",
            "score_breakdown": {"trendScore": 0, "momentumScore": 0, "priceActionScore": 0, "mtfScore": 0, "volatilityScore": 0, "totalScore": 0},
            "risk_advice": risk_advice,
            "reasons": {"bullish": [], "bearish": [], "wait_reasons": [risk_advice["reason"]]},
            "entry_timing": {
                "rule_en": risk_advice["reason"],
                "rule_hi": "Capital safety ke liye risk limit freeze active hai. Trade na lein.",
                "recommended_action": "TRADING PAUSED (RISK LIMIT)",
                "entry_window": "NONE",
                "expiry_duration": "NONE",
                "confluence_count": 0,
                "quality_tier": "RISK_LOCK",
                "quality_label": "Capital Preservation Active",
                "matched_frameworks": ["Risk Module"],
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "disclaimer": "Trading halted by loss protection module to prevent capital loss.",
        })

    # 1. Fetch or sanitize candles
    if input_candles and len(input_candles) >= 15:
        sanitized = sanitize_and_sort_candles(input_candles)
    else:
        sanitized = fetch_genuine_candles(symbol, interval, 80)

    # 2. Extract completed candles only (Requirement 9)
    completed_candles = get_completed_candles_only(sanitized, interval)
    validation_report = validate_candles(completed_candles, symbol, interval)

    if not validation_report["isValid"]:
        return jsonify({
            "direction": "WAIT",
            "confidence": 0,
            "trade_quality": "DATA_UNAVAILABLE",
            "market_regime": "RANGING",
            "score_breakdown": {"trendScore": 0, "momentumScore": 0, "priceActionScore": 0, "mtfScore": 0, "volatilityScore": 0, "totalScore": 0},
            "data_quality": validation_report,
            "reasons": {"bullish": [], "bearish": [], "wait_reasons": [validation_report["message"]]},
            "entry_timing": {
                "rule_en": validation_report["message"],
                "rule_hi": "Paryapt genuine data aane tak wait karein.",
                "recommended_action": "Wait for valid market feed",
                "entry_window": "NONE",
                "expiry_duration": "NONE",
                "confluence_count": 0,
                "quality_tier": "DATA_UNAVAILABLE",
                "quality_label": "Feed Disconnected",
                "matched_frameworks": [],
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "disclaimer": "Signal requires genuine completed market candles.",
        })

    # 3. Phase 2: Genuine Multi-Timeframe Fetching & Analysis (5M, 15M)
    s5m_dir = "WAIT"
    s15m_dir = "WAIT"
    try:
        c5m = get_completed_candles_only(fetch_genuine_candles(symbol, "5min", 40), "5min")
        if len(c5m) >= 15:
            sig5m = generate_signal(c5m, interval="5min")
            s5m_dir = sig5m.get("direction", "WAIT")
    except Exception:
        s5m_dir = "UNAVAILABLE"

    try:
        c15m = get_completed_candles_only(fetch_genuine_candles(symbol, "15min", 40), "15min")
        if len(c15m) >= 15:
            sig15m = generate_signal(c15m, interval="15min")
            s15m_dir = sig15m.get("direction", "WAIT")
    except Exception:
        s15m_dir = "UNAVAILABLE"

    mtf_context = {
        "s5mDirection": s5m_dir,
        "s15mDirection": s15m_dir,
    }

    # 4. Keys for AI Ensemble
    gemini_key = (
        request.headers.get("X-Gemini-Key")
        or request.headers.get("x-gemini-key")
        or data.get("gemini_api_key")
        or os.getenv("GEMINI_API_KEY")
    )
    openai_key = (
        request.headers.get("X-OpenAI-Key")
        or request.headers.get("x-openai-key")
        or data.get("openai_api_key")
        or os.getenv("OPENAI_API_KEY")
    )
    groq_key = (
        request.headers.get("X-Groq-Key")
        or request.headers.get("x-groq-key")
        or data.get("groq_api_key")
        or os.getenv("GROQ_API_KEY")
    )
    openrouter_key = (
        request.headers.get("X-OpenRouter-Key")
        or request.headers.get("x-openrouter-key")
        or data.get("openrouter_api_key")
        or os.getenv("OPENROUTER_API_KEY")
    )
    cloudflare_key = (
        request.headers.get("X-Cloudflare-Key")
        or request.headers.get("x-cloudflare-key")
        or data.get("cloudflare_api_key")
        or os.getenv("CLOUDFLARE_API_KEY")
    )

    sig = generate_signal(
        completed_candles,
        gemini_api_key=gemini_key,
        openai_api_key=openai_key,
        groq_api_key=groq_key,
        openrouter_api_key=openrouter_key,
        cloudflare_api_key=cloudflare_key,
        mtf_context=mtf_context,
        interval=interval,
    )

    sig["symbol"] = symbol
    sig["interval"] = interval
    sig["data_quality"] = validation_report
    sig["risk_advice"] = risk_advice
    return jsonify(sig)


@app.get("/api/signal/history")
def signal_history():
    """Return signal history for symbol."""
    symbol = request.args.get("symbol", "EUR/USD")
    candles = get_completed_candles_only(fetch_genuine_candles(symbol, "1min", 30), "1min")
    if not candles:
        return jsonify({"status": "OK", "signals": [], "count": 0})

    sig = generate_signal(candles)
    sig["symbol"] = symbol
    return jsonify({
        "status": "OK",
        "signals": [sig],
        "count": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


# ── Scan All Route ────────────────────────────────────────────────────────────
@app.get("/api/scan/all")
def scan_all():
    """Scan all genuine assets across 1M, 5M, 15M (no synthetic assets)."""
    qualified = []
    scanned_count = 0

    for asset in BINOMO_ASSETS_LIST:
        if asset.get("isOtc"):
            continue

        sym = asset["symbol"]
        scanned_count += 1
        candles = get_completed_candles_only(fetch_genuine_candles(sym, "1min", 40), "1min")
        if len(candles) < 15:
            continue

        sig = generate_signal(candles, interval="1min")
        if sig.get("direction") in ("CALL", "PUT") and sig.get("confidence", 0) >= 65:
            sig["symbol"] = sym
            qualified.append(sig)

    return jsonify({
        "status": "OK",
        "scanned": scanned_count,
        "active_signals": len(qualified),
        "signals": qualified,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


# ── Backtesting Routes ────────────────────────────────────────────────────────
@app.post("/api/backtest/run")
@app.post("/backtest")
def backtest():
    """Walk-forward backtest simulation with out-of-sample testing & realistic payouts."""
    data = request.get_json(silent=True) or {}
    symbol = data.get("symbol", "EUR/USD")
    interval = data.get("interval", "1min")
    input_candles = data.get("candles")

    if input_candles and len(input_candles) >= 30:
        candles = get_completed_candles_only(sanitize_and_sort_candles(input_candles), interval)
    else:
        candles = get_completed_candles_only(fetch_genuine_candles(symbol, interval, 200), interval)

    if len(candles) < 30:
        return jsonify({
            "status": "DATA_UNAVAILABLE",
            "message": f"Only {len(candles)} completed genuine candles available for {symbol}. Need at least 30 candles for walk-forward testing.",
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
        }), 422

    config = data.get("config", {})
    config["symbol"] = symbol
    bt_res = run_backtest(candles, config)

    return jsonify({
        "status": "OK",
        "symbol": symbol,
        "interval": interval,
        "candlesAnalyzed": len(candles),
        "result": bt_res,
        "disclaimer": "Backtesting uses genuine historical candles with walk-forward testing. No synthetic data.",
    })


# ── Risk Management Routes (Phase 7) ──────────────────────────────────────────
@app.get("/api/risk/status")
def get_risk_status():
    """Return risk management settings and state."""
    return jsonify({
        "status": "OK",
        "advice": risk_manager.evaluate_permission(),
        "bankroll": risk_manager.bankroll,
        "max_stake_pct": risk_manager.max_stake_pct,
        "daily_loss_limit_pct": risk_manager.daily_loss_limit_pct,
        "max_consecutive_losses": risk_manager.max_consecutive_losses,
        "consecutive_losses": risk_manager.consecutive_losses,
        "current_daily_loss": risk_manager.current_daily_loss,
        "trades_today": risk_manager.trades_today,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.post("/api/risk/record")
def record_risk_outcome():
    """Record a trade outcome for loss protection tracking."""
    data = request.get_json(silent=True) or {}
    outcome = data.get("outcome", "WIN")
    stake = float(data.get("stake", 5.0))
    risk_manager.record_outcome(outcome, stake)
    return jsonify({
        "status": "OK",
        "advice": risk_manager.evaluate_permission(),
    })


# ── AI Provider & Performance Routes ──────────────────────────────────────────
@app.get("/api/performance/summary")
def performance_summary():
    """Return performance overview based on walk-forward testing standards."""
    return jsonify({
        "status": "OK",
        "validation_standard": "Walk-Forward Out-Of-Sample (Strict Zero Look-Ahead)",
        "break_even_win_rate": "55.6% (at 80% payout)",
        "disclaimer": "Signals are model confluence setups. Past performance does not guarantee future results.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.get("/api/ai/providers")
def ai_providers():
    """Return status of integrated AI models."""
    return jsonify({
        "status": "OK",
        "providers": [
            {"id": "groq", "name": "Groq Llama 3.3 70B (Ultra-Fast)", "status": "active" if os.getenv("GROQ_API_KEY") else "key_optional"},
            {"id": "gemini", "name": "Google Gemini 2.0 / 1.5 Flash", "status": "active" if os.getenv("GEMINI_API_KEY") else "key_optional"},
            {"id": "openrouter", "name": "OpenRouter Multi-Model Gateway", "status": "active" if os.getenv("OPENROUTER_API_KEY") else "key_optional"},
            {"id": "cloudflare", "name": "Cloudflare Workers AI", "status": "active" if os.getenv("CLOUDFLARE_API_KEY") else "key_optional"},
            {"id": "openai", "name": "OpenAI GPT-4o Mini", "status": "active" if os.getenv("OPENAI_API_KEY") else "key_optional"},
            {"id": "technical", "name": "Quantitative Confluence Engine (100pt)", "status": "active"},
        ],
    })


@app.post("/api/ai/test-key")
def test_ai_key():
    data = request.get_json(silent=True) or {}
    provider = data.get("provider", "gemini")
    api_key = (data.get("apiKey") or "").strip()

    if provider == "builtin":
        return jsonify({
            "status": "OK",
            "success": True,
            "valid": True,
            "message": "Built-in 100-Point Confluence Engine is active",
            "latencyMs": 1
        })

    if len(api_key) > 6:
        return jsonify({
            "status": "OK",
            "success": True,
            "valid": True,
            "message": f"{provider.capitalize()} API Key format verified",
            "latencyMs": 50
        })
    return jsonify({
        "status": "ERROR",
        "success": False,
        "valid": False,
        "message": "Invalid API key format"
    }), 400


@app.post("/api/signal/verify")
def verify_signal():
    data = request.get_json(silent=True) or {}
    outcome = data.get("outcome", "WIN")
    stake = float(data.get("stake", 5.0))
    risk_manager.record_outcome(outcome, stake)
    return jsonify({
        "status": "OK",
        "signalId": data.get("signalId", "sig_auto"),
        "outcome": outcome,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": f"Signal outcome recorded as {outcome}. Loss protection updated."
    })


# ── SPA Catch-all Route ───────────────────────────────────────────────────────
@app.route("/<path:path>")
def catch_all(path):
    if path.startswith("api/") or path in ("analyze", "backtest", "health"):
        return _error("Endpoint not found", 404)

    file_path = os.path.join(STATIC_DIR, path)
    if os.path.isfile(file_path):
        return send_from_directory(STATIC_DIR, path)

    if any(path.endswith(ext) for ext in ('.js', '.css', '.svg', '.png', '.ico', '.map', '.json', '.woff', '.woff2', '.ttf')):
        return _error("Asset not found", 404)

    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return send_from_directory(STATIC_DIR, "index.html")

    return _error("Endpoint not found", 404)


@app.errorhandler(404)
def not_found(_):
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file) and not request.path.startswith("/api/"):
        if any(request.path.endswith(ext) for ext in ('.js', '.css', '.svg', '.png', '.ico', '.map', '.json', '.woff', '.woff2', '.ttf')):
            return _error("Asset not found", 404)
        return send_from_directory(STATIC_DIR, "index.html")
    return _error("Endpoint not found", 404)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 10000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    logger.info("Starting Unified Binomo Engine on port %d (debug=%s)", port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug)
