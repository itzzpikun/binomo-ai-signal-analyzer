"""
Candlestick Pattern Recognition — Enhanced with Binomo Official Strategy Guides.
Includes 25+ price action patterns with context-aware confirmation metrics.
"""
import numpy as np
from typing import Any


def _body(candle: dict) -> float:
    return abs(candle["close"] - candle["open"])


def _range(candle: dict) -> float:
    return candle["high"] - candle["low"]


def _upper_shadow(candle: dict) -> float:
    return candle["high"] - max(candle["open"], candle["close"])


def _lower_shadow(candle: dict) -> float:
    return min(candle["open"], candle["close"]) - candle["low"]


def _is_bullish(candle: dict) -> bool:
    return candle["close"] > candle["open"]


def _is_bearish(candle: dict) -> bool:
    return candle["close"] < candle["open"]


def _doji(candle: dict, threshold: float = 0.1) -> bool:
    r = _range(candle)
    if r == 0:
        return True
    return _body(candle) / r <= threshold


def detect_patterns(candles: list[dict]) -> list[dict]:
    """
    Detect candlestick patterns from a list of OHLCV dicts.
    Each candle: {open, high, low, close, volume, timestamp}

    Returns list of:
      {name, type: 'bullish'|'bearish'|'neutral', strength: 0-1, description}
    """
    if len(candles) < 3:
        return []

    patterns = []
    # Skip trailing flat single-tick forming bars (e.g. Yahoo live tick O=H=L=C)
    # when earlier formed bars have real OHLC spread so genuine patterns aren't hidden.
    effective = list(candles)
    while len(effective) > 3 and _range(effective[-1]) <= 1e-9:
        effective.pop()

    c = effective  # alias

    def add(name: str, ptype: str, strength: float, description: str):
        patterns.append(
            {
                "name": name,
                "type": ptype,
                "strength": round(min(max(strength, 0.0), 1.0), 3),
                "description": description,
            }
        )

    last = c[-1]
    prev = c[-2]
    pprev = c[-3] if len(c) >= 3 else None

    rng_last = _range(last)
    body_last = _body(last)
    rng_prev = _range(prev)
    body_prev = _body(prev)
    avg_body = np.mean([_body(x) for x in c[-10:]]) if len(c) >= 10 else body_last

    # Context trend approximation from prior 5 candles
    prior_decline = False
    prior_advance = False
    if len(c) >= 6:
        prior_decline = c[-2]["close"] < c[-6]["close"]
        prior_advance = c[-2]["close"] > c[-6]["close"]

    # =========================================================================
    # 1. Single-candle patterns (Binomo Strategy Guide Sections 1 & 2)
    # =========================================================================

    # Dragonfly Doji (Bullish rejection of lows)
    if (
        _doji(last)
        and rng_last > 0
        and _upper_shadow(last) <= 0.1 * rng_last
        and _lower_shadow(last) >= 0.65 * rng_last
    ):
        add("Dragonfly Doji", "bullish", 0.7, "Open/Close at high with long lower shadow; strong rejection of lower prices.")

    # Gravestone Doji (Bearish rejection of highs)
    elif (
        _doji(last)
        and rng_last > 0
        and _lower_shadow(last) <= 0.1 * rng_last
        and _upper_shadow(last) >= 0.65 * rng_last
    ):
        add("Gravestone Doji", "bearish", 0.7, "Open/Close at low with long upper shadow; strong rejection of higher prices.")

    # Standard Doji (Market Indecision)
    elif _doji(last) and rng_last > 0:
        add("Doji", "neutral", 0.45, "Open ≈ Close; market indecision. Wait for confirmation candle.")

    # Pinbar with long lower shadow: Hammer vs Hanging Man (Mutually exclusive based on context)
    if (
        rng_last > 0
        and not _doji(last)
        and _lower_shadow(last) >= 1.8 * body_last
        and _upper_shadow(last) <= 0.2 * rng_last
    ):
        if prior_decline or _is_bearish(prev):
            strength = 0.85 if prior_decline else 0.7
            add("Hammer", "bullish", strength, "Long lower shadow with small body at top; strong buyer demand rejecting lows.")
        elif prior_advance:
            add("Hanging Man", "bearish", 0.7, "Hammer shape after advance; warning that selling pressure has emerged.")

    # Pinbar with long upper shadow: Shooting Star vs Inverted Hammer (Mutually exclusive based on context)
    if (
        rng_last > 0
        and not _doji(last)
        and _upper_shadow(last) >= 1.8 * body_last
        and _lower_shadow(last) <= 0.2 * rng_last
    ):
        if prior_advance or _is_bullish(prev):
            strength = 0.85 if prior_advance else 0.7
            add("Shooting Star", "bearish", strength, "Long upper shadow at peak; sellers aggressively pushed price down.")
        elif prior_decline:
            add("Inverted Hammer", "bullish", 0.7, "Long upper shadow after decline; buyers testing higher prices.")

    # Spinning Top (Consolidation / Indecision)
    if (
        rng_last > 0
        and not _doji(last)
        and body_last <= 0.35 * rng_last
        and _upper_shadow(last) > body_last
        and _lower_shadow(last) > body_last
    ):
        add("Spinning Top", "neutral", 0.35, "Small body with both upper and lower wicks; temporary pause/indecision.")

    # Bullish Marubozu (Buyers in total control)
    if (
        rng_last > 0
        and _is_bullish(last)
        and _upper_shadow(last) <= 0.04 * rng_last
        and _lower_shadow(last) <= 0.04 * rng_last
        and body_last >= 0.92 * rng_last
    ):
        strength = 0.75 + 0.2 * min(body_last / max(avg_body, 1e-10), 1.0)
        add("Bullish Marubozu", "bullish", strength, "Dominant bullish candle; buyers drove price without resistance.")

    # Bearish Marubozu (Sellers in total control)
    if (
        rng_last > 0
        and _is_bearish(last)
        and _upper_shadow(last) <= 0.04 * rng_last
        and _lower_shadow(last) <= 0.04 * rng_last
        and body_last >= 0.92 * rng_last
    ):
        strength = 0.75 + 0.2 * min(body_last / max(avg_body, 1e-10), 1.0)
        add("Bearish Marubozu", "bearish", strength, "Dominant bearish candle; sellers drove price without resistance.")

    # =========================================================================
    # 2. Two-candle patterns (Binomo Strategy Guide Section 3)
    # =========================================================================

    # Bullish Engulfing
    if (
        _is_bearish(prev)
        and _is_bullish(last)
        and last["close"] > prev["open"]
        and body_last > body_prev
    ):
        strength = min(0.65 + (body_last - body_prev) / max(avg_body, 1e-10) * 0.15, 0.95)
        add("Bullish Engulfing", "bullish", strength, "Bullish candle completely engulfs prior bearish body; high-probability reversal.")

    # Bearish Engulfing
    if (
        _is_bullish(prev)
        and _is_bearish(last)
        and last["close"] < prev["open"]
        and body_last > body_prev
    ):
        strength = min(0.65 + (body_last - body_prev) / max(avg_body, 1e-10) * 0.15, 0.95)
        add("Bearish Engulfing", "bearish", strength, "Bearish candle completely engulfs prior bullish body; high-probability reversal.")

    # Piercing Line (Bullish reversal into previous body midpoint)
    if (
        _is_bearish(prev)
        and _is_bullish(last)
        and last["open"] <= prev["close"]
        and last["close"] > (prev["open"] + prev["close"]) / 2.0
        and last["close"] < prev["open"]
    ):
        add("Piercing Line", "bullish", 0.7, "Bullish candle recovers >50% into prior bearish candle; reversal at support.")

    # Dark Cloud Cover (Bearish reversal into previous body midpoint)
    if (
        _is_bullish(prev)
        and _is_bearish(last)
        and last["open"] >= prev["close"]
        and last["close"] < (prev["open"] + prev["close"]) / 2.0
        and last["close"] > prev["open"]
    ):
        add("Dark Cloud Cover", "bearish", 0.7, "Bearish candle penetrates >50% into prior bullish candle; reversal at resistance.")

    # Tweezer Bottom (Equal lows at support)
    if (
        _is_bearish(prev)
        and _is_bullish(last)
        and abs(last["low"] - prev["low"]) / max(last["low"], 1e-10) <= 0.0008
        and _lower_shadow(last) >= 0.25 * rng_last
        and _lower_shadow(prev) >= 0.25 * rng_prev
    ):
        add("Tweezer Bottom", "bullish", 0.78, "Two candles test the exact same low; strong double rejection of support.")

    # Tweezer Top (Equal highs at resistance)
    if (
        _is_bullish(prev)
        and _is_bearish(last)
        and abs(last["high"] - prev["high"]) / max(last["high"], 1e-10) <= 0.0008
        and _upper_shadow(last) >= 0.25 * rng_last
        and _upper_shadow(prev) >= 0.25 * rng_prev
    ):
        add("Tweezer Top", "bearish", 0.78, "Two candles test the exact same high; strong double rejection of resistance.")

    # Bullish Harami
    if (
        _is_bearish(prev)
        and _is_bullish(last)
        and last["open"] >= prev["close"]
        and last["close"] <= prev["open"]
        and body_last < body_prev
    ):
        add("Bullish Harami", "bullish", 0.5, "Small bullish candle inside prior large bearish candle; selling momentum slowing.")

    # Bearish Harami
    if (
        _is_bullish(prev)
        and _is_bearish(last)
        and last["open"] <= prev["close"]
        and last["close"] >= prev["open"]
        and body_last < body_prev
    ):
        add("Bearish Harami", "bearish", 0.5, "Small bearish candle inside prior large bullish candle; buying momentum slowing.")

    # Inside Bar (Volatility squeeze — require non-zero ranges on both candles)
    if (
        rng_last > 1e-9
        and rng_prev > 1e-9
        and last["high"] <= prev["high"]
        and last["low"] >= prev["low"]
        and (last["high"] < prev["high"] or last["low"] > prev["low"])
    ):
        add("Inside Bar", "neutral", 0.45, "Inside bar compression; breakout expected outside mother candle range.")

    # Bullish Kicker (Sudden momentum jump)
    if (
        _is_bearish(prev)
        and _is_bullish(last)
        and last["open"] >= prev["open"]
        and body_last >= 0.7 * rng_last
    ):
        add("Bullish Kicker", "bullish", 0.85, "Violent bullish shift opening above prior open; aggressive buying.")

    # Bearish Kicker (Sudden momentum drop)
    if (
        _is_bullish(prev)
        and _is_bearish(last)
        and last["open"] <= prev["open"]
        and body_last >= 0.7 * rng_last
    ):
        add("Bearish Kicker", "bearish", 0.85, "Violent bearish shift opening below prior open; aggressive selling.")

    # =========================================================================
    # 3. Three-candle patterns (Binomo Strategy Guide Section 4)
    # =========================================================================
    if pprev is not None:
        c0, c1, c2 = pprev, prev, last

        # Morning Star / Morning Doji Star
        if (
            _is_bearish(c0)
            and (_body(c1) <= 0.35 * _range(c1) if _range(c1) > 0 else True)
            and _is_bullish(c2)
            and c2["close"] > (c0["open"] + c0["close"]) / 2.0
        ):
            star_name = "Morning Doji Star" if _doji(c1) else "Morning Star"
            add(star_name, "bullish", 0.82, "Classic 3-candle reversal: drop, pause/doji base, powerful bullish breakout.")

        # Evening Star / Evening Doji Star
        if (
            _is_bullish(c0)
            and (_body(c1) <= 0.35 * _range(c1) if _range(c1) > 0 else True)
            and _is_bearish(c2)
            and c2["close"] < (c0["open"] + c0["close"]) / 2.0
        ):
            star_name = "Evening Doji Star" if _doji(c1) else "Evening Star"
            add(star_name, "bearish", 0.82, "Classic 3-candle reversal: rally, pause/doji peak, powerful bearish breakdown.")

        # Three White Soldiers
        if (
            _is_bullish(c0)
            and _is_bullish(c1)
            and _is_bullish(c2)
            and c1["close"] > c0["close"]
            and c2["close"] > c1["close"]
            and c1["open"] > c0["open"]
            and c2["open"] > c1["open"]
            and _upper_shadow(c1) <= 0.25 * _body(c1)
            and _upper_shadow(c2) <= 0.25 * _body(c2)
        ):
            add("Three White Soldiers", "bullish", 0.88, "Three consecutive strong bullish candles; powerful uptrend confirmation.")

        # Three Black Crows
        if (
            _is_bearish(c0)
            and _is_bearish(c1)
            and _is_bearish(c2)
            and c1["close"] < c0["close"]
            and c2["close"] < c1["close"]
            and c1["open"] < c0["open"]
            and c2["open"] < c1["open"]
            and _lower_shadow(c1) <= 0.25 * _body(c1)
            and _lower_shadow(c2) <= 0.25 * _body(c2)
        ):
            add("Three Black Crows", "bearish", 0.88, "Three consecutive strong bearish candles; powerful downtrend confirmation.")

        # Three Inside Up (Harami confirmed by 3rd candle close)
        if (
            _is_bearish(c0)
            and _is_bullish(c1)
            and c1["open"] >= c0["close"]
            and c1["close"] <= c0["open"]
            and _is_bullish(c2)
            and c2["close"] > c0["open"]
        ):
            add("Three Inside Up", "bullish", 0.82, "Bullish Harami followed by 3rd candle closing above 1st open; confirmed reversal.")

        # Three Inside Down (Bearish Harami confirmed by 3rd candle close)
        if (
            _is_bullish(c0)
            and _is_bearish(c1)
            and c1["open"] <= c0["close"]
            and c1["close"] >= c0["open"]
            and _is_bearish(c2)
            and c2["close"] < c0["open"]
        ):
            add("Three Inside Down", "bearish", 0.82, "Bearish Harami followed by 3rd candle closing below 1st open; confirmed reversal.")

    # =========================================================================
    # 4. Five-candle continuation patterns (Binomo Strategy Guide Section 5)
    # =========================================================================
    if len(c) >= 5:
        p0, p1, p2, p3, p4 = c[-5], c[-4], c[-3], c[-2], c[-1]

        # Rising Three Methods (Bullish continuation)
        if (
            _is_bullish(p0)
            and _body(p0) >= 0.7 * _range(p0)
            and _is_bearish(p1) and _is_bearish(p2)
            and min(p1["low"], p2["low"], p3["low"]) >= p0["low"]
            and max(p1["high"], p2["high"], p3["high"]) <= p0["high"]
            and _is_bullish(p4)
            and p4["close"] > p0["high"]
        ):
            add("Rising Three Methods", "bullish", 0.9, "Strong bullish trend continuation after brief 3-candle pullback.")

        # Falling Three Methods (Bearish continuation)
        if (
            _is_bearish(p0)
            and _body(p0) >= 0.7 * _range(p0)
            and _is_bullish(p1) and _is_bullish(p2)
            and max(p1["high"], p2["high"], p3["high"]) <= p0["high"]
            and min(p1["low"], p2["low"], p3["low"]) >= p0["low"]
            and _is_bearish(p4)
            and p4["close"] < p0["low"]
        ):
            add("Falling Three Methods", "bearish", 0.9, "Strong bearish trend continuation after brief 3-candle pullback.")

    return patterns
