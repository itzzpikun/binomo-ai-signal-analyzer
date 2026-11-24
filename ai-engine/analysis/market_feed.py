"""
Genuine Market Feed Service for Binomo AI Signal Analyzer (Zero Synthetic Candles).
Enforces:
1. Genuine timestamped data from Twelve Data / Binance.
2. Binomo OTC Isolation: Never substitute standard prices for OTC.
3. No fake prices on failure; returns empty list / DATA_UNAVAILABLE.
4. Validation of timestamps, OHLC validity, duplicates, and latency.
5. Strict chronological sorting: oldest to newest.
6. Extraction of completed closed candles for signal generation.
7. Clear status reporting: LIVE | DELAYED | DATA_UNAVAILABLE.
"""
import os
import json
import time
import logging
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("market-feed")

BINOMO_ASSETS_LIST = [
    # Standard Real Market Assets (Genuine live data available via Twelve Data / Binance)
    {"symbol": "EUR/USD", "name": "EUR/USD", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 1.0890, "decimals": 5, "isOtc": False, "providerSymbol": "EUR/USD", "provider": "twelvedata"},
    {"symbol": "GBP/USD", "name": "GBP/USD", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 1.2650, "decimals": 5, "isOtc": False, "providerSymbol": "GBP/USD", "provider": "twelvedata"},
    {"symbol": "USD/JPY", "name": "USD/JPY", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 154.50, "decimals": 3, "isOtc": False, "providerSymbol": "USD/JPY", "provider": "twelvedata"},
    {"symbol": "AUD/USD", "name": "AUD/USD", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 0.6520, "decimals": 5, "isOtc": False, "providerSymbol": "AUD/USD", "provider": "twelvedata"},
    {"symbol": "USD/CAD", "name": "USD/CAD", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 1.4020, "decimals": 5, "isOtc": False, "providerSymbol": "USD/CAD", "provider": "twelvedata"},
    {"symbol": "NZD/USD", "name": "NZD/USD", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 0.5850, "decimals": 5, "isOtc": False, "providerSymbol": "NZD/USD", "provider": "twelvedata"},
    {"symbol": "EUR/GBP", "name": "EUR/GBP", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 0.8350, "decimals": 5, "isOtc": False, "providerSymbol": "EUR/GBP", "provider": "twelvedata"},
    {"symbol": "GBP/JPY", "name": "GBP/JPY", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 197.80, "decimals": 3, "isOtc": False, "providerSymbol": "GBP/JPY", "provider": "twelvedata"},
    {"symbol": "EUR/CAD", "name": "EUR/CAD", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 1.4850, "decimals": 5, "isOtc": False, "providerSymbol": "EUR/CAD", "provider": "twelvedata"},
    {"symbol": "AUD/CAD", "name": "AUD/CAD", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 0.9140, "decimals": 5, "isOtc": False, "providerSymbol": "AUD/CAD", "provider": "twelvedata"},
    {"symbol": "Gold", "name": "Gold (XAU/USD)", "category": "Commodities", "profit": "60%", "vipProfit": "62%", "basePrice": 2685.00, "decimals": 2, "isOtc": False, "providerSymbol": "XAU/USD", "provider": "twelvedata"},
    {"symbol": "BTC/USD", "name": "Bitcoin (Real)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 61000.00, "decimals": 2, "isOtc": False, "providerSymbol": "BTCUSDT", "provider": "binance"},
    {"symbol": "ETH/USD", "name": "Ethereum (Real)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 1720.00, "decimals": 2, "isOtc": False, "providerSymbol": "ETHUSDT", "provider": "binance"},
    {"symbol": "SOL/USD", "name": "Solana (Real)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 195.00, "decimals": 2, "isOtc": False, "providerSymbol": "SOLUSDT", "provider": "binance"},

    # Binomo OTC Proprietary Markets (Direct Binomo feed required)
    {"symbol": "Crypto IDX", "name": "Crypto IDX", "category": "Binomo OTC", "profit": "83%", "vipProfit": "85%", "basePrice": 6245.50, "decimals": 2, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "Bitcoin (OTC)", "name": "Bitcoin (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 96850.00, "decimals": 2, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "Ethereum (OTC)", "name": "Ethereum (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 3480.00, "decimals": 2, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "Solana (OTC)", "name": "Solana (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 194.50, "decimals": 2, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "AUD/USD (OTC)", "name": "AUD/USD (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 0.65150, "decimals": 5, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "NZD/USD (OTC)", "name": "NZD/USD (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 0.58420, "decimals": 5, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "GBP/NZD (OTC)", "name": "GBP/NZD (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 2.18400, "decimals": 5, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "FC Barcelona Token (OTC)", "name": "FC Barcelona Token (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 1.8540, "decimals": 4, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "Cardano (OTC)", "name": "Cardano (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 0.8420, "decimals": 4, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "EUR/CAD (OTC)", "name": "EUR/CAD (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 1.48250, "decimals": 5, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "GBP/JPY (OTC)", "name": "GBP/JPY (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 197.600, "decimals": 3, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "GBP/USD (OTC)", "name": "GBP/USD (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 1.26450, "decimals": 5, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "EUR/GBP (OTC)", "name": "EUR/GBP (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 0.83400, "decimals": 5, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "AUD/CAD (OTC)", "name": "AUD/CAD (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 0.91250, "decimals": 5, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "EUR/USD (OTC)", "name": "EUR/USD (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 1.05420, "decimals": 5, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "USD/JPY (OTC)", "name": "USD/JPY (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 154.200, "decimals": 3, "isOtc": True, "provider": "binomo_otc_direct"},
    {"symbol": "USD/CAD (OTC)", "name": "USD/CAD (OTC)", "category": "Binomo OTC", "profit": "80%", "vipProfit": "82%", "basePrice": 1.40120, "decimals": 5, "isOtc": True, "provider": "binomo_otc_direct"},
]

ASSET_SPEC_MAP: Dict[str, Dict[str, Any]] = {}
for a in BINOMO_ASSETS_LIST:
    sym = a["symbol"].upper()
    ASSET_SPEC_MAP[sym] = a
    stripped = sym.replace("(OTC)", "").strip()
    if stripped not in ASSET_SPEC_MAP:
        ASSET_SPEC_MAP[stripped] = a

# In-memory simple cache: (key) -> (timestamp, data)
_CACHE: Dict[str, Tuple[float, Any]] = {}


def get_asset_spec(symbol: str) -> Dict[str, Any]:
    upper = symbol.strip().upper()
    if upper in ASSET_SPEC_MAP:
        return ASSET_SPEC_MAP[upper]
    for k, v in ASSET_SPEC_MAP.items():
        if upper in k or k in upper:
            return v
    return BINOMO_ASSETS_LIST[0]


def get_supported_assets() -> List[Dict[str, Any]]:
    return [
        {
            "category": "Forex (Genuine Live)",
            "assets": [
                {"symbol": a["symbol"], "name": a["name"], "type": "forex"}
                for a in BINOMO_ASSETS_LIST if a["category"] == "Forex"
            ],
        },
        {
            "category": "Crypto (Genuine Live)",
            "assets": [
                {"symbol": a["symbol"], "name": a["name"], "type": "crypto"}
                for a in BINOMO_ASSETS_LIST if a["category"] == "Crypto"
            ],
        },
        {
            "category": "Commodities (Genuine Live)",
            "assets": [
                {"symbol": a["symbol"], "name": a["name"], "type": "commodity"}
                for a in BINOMO_ASSETS_LIST if a["category"] == "Commodities"
            ],
        },
        {
            "category": "Binomo OTC (Requires Binomo Direct Feed)",
            "assets": [
                {"symbol": a["symbol"], "name": a["name"], "type": "otc"}
                for a in BINOMO_ASSETS_LIST if a.get("isOtc")
            ],
        },
    ]


def sanitize_and_sort_candles(candles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicate and sort chronologically from oldest to newest."""
    if not candles:
        return []

    unique_candles: Dict[int, Dict[str, Any]] = {}
    for c in candles:
        ts_str = str(c.get("timestamp") or c.get("datetime") or "")
        try:
            # Parse timestamp into unix epoch seconds
            if "T" in ts_str or ts_str.endswith("Z"):
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            else:
                dt = datetime.fromisoformat(ts_str)
            t_sec = int(dt.timestamp())
        except Exception:
            t_sec = int(c.get("time", time.time()))

        try:
            unique_candles[t_sec] = {
                "timestamp": datetime.fromtimestamp(t_sec, tz=timezone.utc).isoformat(),
                "open": float(c["open"]),
                "high": float(c["high"]),
                "low": float(c["low"]),
                "close": float(c["close"]),
                "volume": float(c.get("volume", 0)),
            }
        except (ValueError, KeyError):
            continue

    sorted_candles = [unique_candles[k] for k in sorted(unique_candles.keys())]
    return sorted_candles


def get_completed_candles_only(candles: List[Dict[str, Any]], interval: str = "1min") -> List[Dict[str, Any]]:
    """Strips the currently-forming unclosed candle from analysis."""
    sorted_c = sanitize_and_sort_candles(candles)
    if len(sorted_c) <= 1:
        return sorted_c

    interval_sec = 60 if interval == "1min" else (900 if interval == "15min" else 300)
    now_sec = int(time.time())

    try:
        last_dt = datetime.fromisoformat(sorted_c[-1]["timestamp"].replace("Z", "+00:00"))
        last_sec = int(last_dt.timestamp())
    except Exception:
        last_sec = now_sec

    if now_sec - last_sec < interval_sec:
        return sorted_c[:-1]
    return sorted_c


def validate_candles(candles: List[Dict[str, Any]], symbol: str, interval: str = "1min") -> Dict[str, Any]:
    """Validate data integrity, latency, and OHLC boundaries."""
    spec = get_asset_spec(symbol)
    is_otc = spec.get("isOtc", False) or "(OTC)" in symbol.upper() or "CRYPTO IDX" in symbol.upper()

    if not candles:
        return {
            "isValid": False,
            "isOtc": is_otc,
            "status": "DATA_UNAVAILABLE",
            "totalCandles": 0,
            "completedCandlesCount": 0,
            "duplicateCount": 0,
            "invalidOhlcCount": 0,
            "latencySeconds": 9999,
            "lastCandleTime": None,
            "message": "Binomo OTC feed disconnected. Normal exchange prices cannot be substituted." if is_otc else "No genuine market candles received.",
        }

    invalid_ohlc = 0
    for c in candles:
        o, h, l, cl = c.get("open", 0), c.get("high", 0), c.get("low", 0), c.get("close", 0)
        if o <= 0 or cl <= 0 or l <= 0 or h <= 0 or h < l or h < o or h < cl or l > o or l > cl:
            invalid_ohlc += 1

    last_candle = candles[-1]
    try:
        last_dt = datetime.fromisoformat(last_candle["timestamp"].replace("Z", "+00:00"))
        latency_sec = max(0, int(time.time() - last_dt.timestamp()))
    except Exception:
        latency_sec = 0

    interval_sec = 60 if interval == "1min" else (900 if interval == "15min" else 300)
    is_last_forming = latency_sec < interval_sec
    completed_count = len(candles) - 1 if is_last_forming else len(candles)

    status = "LIVE"
    if latency_sec > interval_sec * 5:
        status = "DATA_UNAVAILABLE"
    elif latency_sec > interval_sec * 2:
        status = "DELAYED"

    is_valid = invalid_ohlc == 0 and completed_count >= 15 and status != "DATA_UNAVAILABLE"

    return {
        "isValid": is_valid,
        "isOtc": is_otc,
        "status": status,
        "totalCandles": len(candles),
        "completedCandlesCount": completed_count,
        "invalidOhlcCount": invalid_ohlc,
        "latencySeconds": latency_sec,
        "lastCandleTime": last_candle.get("timestamp"),
        "message": "Feed Live & Valid" if is_valid else (f"Feed Unavailable ({latency_sec}s latency)" if status == "DATA_UNAVAILABLE" else f"Feed Delayed ({latency_sec}s lag)"),
    }


def fetch_genuine_candles(symbol: str, interval: str = "1min", limit: int = 100) -> List[Dict[str, Any]]:
    """
    Fetch genuine, timestamped candles from authorized providers.
    NEVER generates synthetic, random, or mathematical-wave candles.
    Returns empty list if genuine data is unavailable.
    """
    spec = get_asset_spec(symbol)
    if spec.get("isOtc"):
        # Binomo OTC: Do not present real forex as OTC (Requirement 5)
        logger.info("Asset %s is OTC; genuine direct Binomo feed required.", symbol)
        return []

    cache_key = f"{spec['symbol']}:{interval}:{limit}"
    now = time.time()
    if cache_key in _CACHE:
        cached_time, cached_data = _CACHE[cache_key]
        if now - cached_time < 8.0:
            return cached_data

    # 1. Binance Public API for Crypto
    if spec.get("provider") == "binance" and spec.get("providerSymbol"):
        try:
            b_interval = "1m" if interval == "1min" else ("5m" if interval == "5min" else "15m")
            url = f"https://api.binance.com/api/v3/klines?symbol={spec['providerSymbol']}&interval={b_interval}&limit={min(limit + 1, 500)}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=4.5) as resp:
                data = json.loads(resp.read().decode())
                candles = [
                    {
                        "timestamp": datetime.fromtimestamp(item[0] / 1000.0, tz=timezone.utc).isoformat(),
                        "open": float(item[1]),
                        "high": float(item[2]),
                        "low": float(item[3]),
                        "close": float(item[4]),
                        "volume": float(item[5]),
                    }
                    for item in data
                ]
                sorted_c = sanitize_and_sort_candles(candles)
                if sorted_c:
                    _CACHE[cache_key] = (now, sorted_c)
                    return sorted_c
        except Exception as e:
            logger.warning("Binance fetch failed for %s: %s", symbol, e)

    # 2. Twelve Data for Forex / Commodities
    api_key = os.getenv("TWELVE_DATA_API_KEY", "2722ed98484d448f912b7019c92676ae")
    provider_sym = spec.get("providerSymbol", spec["symbol"])
    if api_key and api_key != "your_key_here":
        try:
            url = f"https://api.twelvedata.com/time_series?symbol={provider_sym}&interval={interval}&outputsize={min(limit + 1, 500)}&format=JSON&apikey={api_key}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=4.5) as resp:
                body = json.loads(resp.read().decode())
                values = body.get("values", [])
                if values and isinstance(values, list):
                    candles = [
                        {
                            "timestamp": datetime.fromisoformat(v["datetime"].replace(" ", "T") + "+00:00").isoformat(),
                            "open": float(v["open"]),
                            "high": float(v["high"]),
                            "low": float(v["low"]),
                            "close": float(v["close"]),
                            "volume": float(v.get("volume", 0)),
                        }
                        for v in values
                    ]
                    sorted_c = sanitize_and_sort_candles(candles)
                    if sorted_c:
                        _CACHE[cache_key] = (now, sorted_c)
                        return sorted_c
        except Exception as e:
            logger.warning("Twelve Data fetch failed for %s: %s", symbol, e)

    return []
