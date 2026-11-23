"""
Market Feed Generator & Validator for Binomo OTC and Global Assets.
Replicates the native TypeScript market feed engine in pure Python.
"""
import math
import time
from datetime import datetime, timezone
from typing import Dict, Any, List

BINOMO_ASSETS_LIST = [
    {"symbol": "Crypto IDX", "name": "Crypto IDX", "category": "Crypto", "profit": "83%", "vipProfit": "85%", "basePrice": 6245.50, "decimals": 2, "volatility": 0.0018},
    {"symbol": "Bitcoin (OTC)", "name": "Bitcoin (OTC)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 96850.00, "decimals": 2, "volatility": 0.0015},
    {"symbol": "Ethereum (OTC)", "name": "Ethereum (OTC)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 3480.00, "decimals": 2, "volatility": 0.0020},
    {"symbol": "Solana (OTC)", "name": "Solana (OTC)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 194.50, "decimals": 2, "volatility": 0.0025},
    {"symbol": "AUD/USD (OTC)", "name": "AUD/USD (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 0.65150, "decimals": 5, "volatility": 0.0008},
    {"symbol": "NZD/USD (OTC)", "name": "NZD/USD (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 0.58420, "decimals": 5, "volatility": 0.0008},
    {"symbol": "GBP/NZD (OTC)", "name": "GBP/NZD (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 2.18400, "decimals": 5, "volatility": 0.0009},
    {"symbol": "Gold", "name": "Gold", "category": "Commodities", "profit": "60%", "vipProfit": "62%", "basePrice": 2684.50, "decimals": 2, "volatility": 0.0012},
    {"symbol": "FC Barcelona Token (OTC)", "name": "FC Barcelona Token (OTC)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 1.8540, "decimals": 4, "volatility": 0.0035},
    {"symbol": "Cardano (OTC)", "name": "Cardano (OTC)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 0.8420, "decimals": 4, "volatility": 0.0028},
    {"symbol": "EUR/CAD (OTC)", "name": "EUR/CAD (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 1.48250, "decimals": 5, "volatility": 0.0008},
    {"symbol": "GBP/JPY (OTC)", "name": "GBP/JPY (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 197.600, "decimals": 3, "volatility": 0.0010},
    {"symbol": "GBP/USD (OTC)", "name": "GBP/USD (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 1.26450, "decimals": 5, "volatility": 0.0008},
    {"symbol": "EUR/GBP (OTC)", "name": "EUR/GBP (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 0.83400, "decimals": 5, "volatility": 0.0007},
    {"symbol": "AUD/CAD (OTC)", "name": "AUD/CAD (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 0.91250, "decimals": 5, "volatility": 0.0008},
    {"symbol": "EUR/USD (OTC)", "name": "EUR/USD (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 1.05420, "decimals": 5, "volatility": 0.0007},
    {"symbol": "USD/JPY (OTC)", "name": "USD/JPY (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 154.200, "decimals": 3, "volatility": 0.0009},
    {"symbol": "USD/CAD (OTC)", "name": "USD/CAD (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 1.40120, "decimals": 5, "volatility": 0.0008},
    {"symbol": "Kusama (OTC)", "name": "Kusama (OTC)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 24.85, "decimals": 2, "volatility": 0.0030},
    {"symbol": "Aave (OTC)", "name": "Aave (OTC)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 198.40, "decimals": 2, "volatility": 0.0025},
    {"symbol": "Chainlink (OTC)", "name": "Chainlink (OTC)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 16.85, "decimals": 2, "volatility": 0.0022},
    {"symbol": "GBP/CHF (OTC)", "name": "GBP/CHF (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 1.12150, "decimals": 5, "volatility": 0.0008},
    {"symbol": "Bitcoin Cash (OTC)", "name": "Bitcoin Cash (OTC)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 495.20, "decimals": 2, "volatility": 0.0022},
    {"symbol": "Uniswap (OTC)", "name": "Uniswap (OTC)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 10.45, "decimals": 2, "volatility": 0.0025},
    {"symbol": "CHF/JPY (OTC)", "name": "CHF/JPY (OTC)", "category": "Forex", "profit": "80%", "vipProfit": "82%", "basePrice": 174.500, "decimals": 3, "volatility": 0.0009},
    {"symbol": "Pancake Swap (OTC)", "name": "Pancake Swap (OTC)", "category": "Crypto", "profit": "80%", "vipProfit": "82%", "basePrice": 2.42, "decimals": 4, "volatility": 0.0032},
]

ASSET_SPEC_MAP: Dict[str, Dict[str, Any]] = {}
for asset in BINOMO_ASSETS_LIST:
    sym = asset["symbol"].upper()
    ASSET_SPEC_MAP[sym] = asset
    stripped = sym.replace("(OTC)", "").strip()
    if stripped not in ASSET_SPEC_MAP:
        ASSET_SPEC_MAP[stripped] = asset
    clean = sym.replace("/", "_").replace(" ", "_").replace("(", "").replace(")", "")
    if clean not in ASSET_SPEC_MAP:
        ASSET_SPEC_MAP[clean] = asset

# Default mappings
if "EUR/USD" not in ASSET_SPEC_MAP:
    ASSET_SPEC_MAP["EUR/USD"] = ASSET_SPEC_MAP.get("EUR/USD (OTC)", BINOMO_ASSETS_LIST[15])
if "CRYPTO_IDX" not in ASSET_SPEC_MAP:
    ASSET_SPEC_MAP["CRYPTO_IDX"] = BINOMO_ASSETS_LIST[0]


def pseudo_hash(val: float) -> float:
    x = math.sin(val) * 43758.5453123
    return x - math.floor(x)


def get_supported_assets():
    return [
        {
            "category": "Binomo OTC",
            "assets": [
                {"symbol": a["symbol"], "name": a["name"], "type": a["category"].lower()}
                for a in BINOMO_ASSETS_LIST
            ],
        },
        {
            "category": "Crypto",
            "assets": [
                {"symbol": a["symbol"], "name": a["name"], "type": "crypto"}
                for a in BINOMO_ASSETS_LIST
                if a["category"] == "Crypto"
            ],
        },
        {
            "category": "Forex",
            "assets": [
                {"symbol": a["symbol"], "name": a["name"], "type": "forex"}
                for a in BINOMO_ASSETS_LIST
                if a["category"] == "Forex"
            ],
        },
    ]


def generate_candles(symbol: str, interval: str = "1min", limit: int = 100) -> List[Dict[str, Any]]:
    spec = ASSET_SPEC_MAP.get(symbol.upper(), BINOMO_ASSETS_LIST[0])
    interval_seconds = 60 if interval == "1min" else (900 if interval == "15min" else 300)

    now_sec = int(time.time())
    current_slot_sec = (now_sec // interval_seconds) * interval_seconds

    slots = []
    for i in range(limit - 1, -1, -1):
        slots.append(current_slot_sec - i * interval_seconds)

    asset_seed = sum(ord(c) for c in spec["symbol"])
    volatility = spec["volatility"]
    decimals = spec["decimals"]

    current_price = spec["basePrice"] * (1 + (pseudo_hash(asset_seed) - 0.5) * 0.05)
    candles = []

    for slot_time in slots:
        slot_seed = slot_time / interval_seconds + asset_seed * 1000

        wave1 = math.sin(slot_seed * 0.12) * volatility * 1.5
        wave2 = math.cos(slot_seed * 0.035) * volatility * 2.2
        noise = (pseudo_hash(slot_seed) - 0.495) * volatility * 2.0
        return_pct = wave1 + wave2 + noise

        o = current_price
        c = o * (1 + return_pct)

        wick_up = abs(pseudo_hash(slot_seed * 1.3)) * volatility * 1.4
        wick_down = abs(pseudo_hash(slot_seed * 1.7)) * volatility * 1.4

        h = max(o, c) * (1 + wick_up)
        l = min(o, c) * (1 - wick_down)
        vol = int(100 + pseudo_hash(slot_seed * 2.1) * 1500)

        candles.append({
            "timestamp": datetime.fromtimestamp(slot_time, tz=timezone.utc).isoformat(),
            "open": round(o, decimals),
            "high": round(h, decimals),
            "low": round(l, decimals),
            "close": round(c, decimals),
            "volume": vol,
        })
        current_price = c

    # Smooth the live open candle
    if candles:
        last = candles[-1]
        target_close = last["close"]
        seconds_in_candle = now_sec % interval_seconds
        progress = min(1.0, max(0.15, seconds_in_candle / interval_seconds))
        smooth_close = last["open"] + (target_close - last["open"]) * progress
        micro_drift = math.sin(now_sec / 8.0) * (volatility * 0.05)
        live_close = smooth_close * (1 + micro_drift)

        last["close"] = round(live_close, decimals)
        last["high"] = round(max(last["high"], last["close"], last["open"]), decimals)
        last["low"] = round(min(last["low"], last["close"], last["open"]), decimals)

    return candles
