"""
Market Feed Service for Binomo AI Signal Analyzer.
Provides simulated candle generation for OTC assets and offline backtesting.
Every simulated candle is explicitly tagged with source: "simulated".
"""
import math
import time
from datetime import datetime, timezone
from typing import Dict, Any, List

# Asset configurations for simulation
ASSET_SPECS: Dict[str, Dict[str, Any]] = {
    "CRYPTO_IDX": {"basePrice": 6245.50, "decimals": 2, "volatility": 0.0035, "isOtc": True},
    "CRYPTO IDX": {"basePrice": 6245.50, "decimals": 2, "volatility": 0.0035, "isOtc": True},
    "EUR/USD": {"basePrice": 1.0850, "decimals": 5, "volatility": 0.0015, "isOtc": False},
    "GBP/USD": {"basePrice": 1.2650, "decimals": 5, "volatility": 0.0018, "isOtc": False},
    "USD/JPY": {"basePrice": 154.50, "decimals": 3, "volatility": 0.0020, "isOtc": False},
    "USD/CHF": {"basePrice": 0.8850, "decimals": 5, "volatility": 0.0015, "isOtc": False},
    "AUD/USD": {"basePrice": 0.6520, "decimals": 5, "volatility": 0.0018, "isOtc": False},
    "USD/CAD": {"basePrice": 1.4020, "decimals": 5, "volatility": 0.0016, "isOtc": False},
    "NZD/USD": {"basePrice": 0.5850, "decimals": 5, "volatility": 0.0018, "isOtc": False},
    "EUR/GBP": {"basePrice": 0.8350, "decimals": 5, "volatility": 0.0014, "isOtc": False},
    "GBP/JPY": {"basePrice": 197.80, "decimals": 3, "volatility": 0.0025, "isOtc": False},
    "EUR/CAD": {"basePrice": 1.4850, "decimals": 5, "volatility": 0.0018, "isOtc": False},
    "AUD/CAD": {"basePrice": 0.9140, "decimals": 5, "volatility": 0.0018, "isOtc": False},
    "XAU/USD": {"basePrice": 2685.00, "decimals": 2, "volatility": 0.0040, "isOtc": False},
    "XAG/USD": {"basePrice": 31.20, "decimals": 3, "volatility": 0.0050, "isOtc": False},
    "US30": {"basePrice": 43800.00, "decimals": 2, "volatility": 0.0025, "isOtc": False},
    "NAS100": {"basePrice": 20850.00, "decimals": 2, "volatility": 0.0035, "isOtc": False},
    "SPX500": {"basePrice": 5950.00, "decimals": 2, "volatility": 0.0025, "isOtc": False},
    "BTC/USD": {"basePrice": 96500.00, "decimals": 2, "volatility": 0.0045, "isOtc": False},
    "ETH/USD": {"basePrice": 3450.00, "decimals": 2, "volatility": 0.0050, "isOtc": False},
    "BNB/USD": {"basePrice": 650.00, "decimals": 2, "volatility": 0.0040, "isOtc": False},
    "SOL/USD": {"basePrice": 195.00, "decimals": 2, "volatility": 0.0060, "isOtc": False},
    "EUR/USD (OTC)": {"basePrice": 1.0850, "decimals": 5, "volatility": 0.0025, "isOtc": True},
    "GBP/USD (OTC)": {"basePrice": 1.2650, "decimals": 5, "volatility": 0.0028, "isOtc": True},
    "USD/JPY (OTC)": {"basePrice": 154.50, "decimals": 3, "volatility": 0.0025, "isOtc": True},
    "AUD/CAD (OTC)": {"basePrice": 0.9140, "decimals": 5, "volatility": 0.0025, "isOtc": True},
    "BTC/USD (OTC)": {"basePrice": 96500.00, "decimals": 2, "volatility": 0.0050, "isOtc": True},
}

DEFAULT_SPEC = {"basePrice": 100.0, "decimals": 2, "volatility": 0.0025, "isOtc": True}


def pseudo_hash(n: float) -> float:
    """Deterministic pseudo-random value between 0 and 1."""
    x = math.sin(n) * 43758.5453123
    return x - math.floor(x)


def generate_candles(symbol: str, interval: str = "1min", limit: int = 100) -> List[Dict[str, Any]]:
    """
    Generate synthetic/simulated candles.
    Explicitly adds `source: "simulated"` to every candle response.
    """
    sym = symbol.upper()
    spec = ASSET_SPECS.get(sym, DEFAULT_SPEC)
    interval_seconds = 60 if interval == "1min" else (900 if interval == "15min" else 300)

    now_sec = int(time.time())
    current_slot_sec = (now_sec // interval_seconds) * interval_seconds

    slots = [current_slot_sec - i * interval_seconds for i in range(limit - 1, -1, -1)]

    asset_seed = sum(ord(c) for c in sym)
    volatility = spec["volatility"]
    decimals = spec["decimals"]

    current_price = spec["basePrice"] * (1 + (pseudo_hash(asset_seed) - 0.5) * 0.05)
    candles: List[Dict[str, Any]] = []

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
            "source": "simulated",
        })
        current_price = c

    return candles
