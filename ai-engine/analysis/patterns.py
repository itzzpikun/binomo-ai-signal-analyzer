"""
Candlestick Pattern Recognition.
All patterns are detected from raw OHLCV candle data.
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
    c = candles  # alias

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
    avg_body = np.mean([_body(x) for x in c[-10:]]) if len(c) >= 10 else body_last

    # ----- Single-candle patterns -----

    # Doji
    if _doji(last) and rng_last > 0:
        add("Doji", "neutral", 0.5, "Open ≈ Close; market indecision.")

    # Hammer (bullish reversal in downtrend)
    if (
        rng_last > 0
        and not _doji(last)
        and _lower_shadow(last) >= 2 * body_last
        and _upper_shadow(last) <= 0.1 * rng_last
        and _is_bullish(last)
    ):
        strength = min(0.5 + (_lower_shadow(last) / rng_last) * 0.5, 1.0)
        add("Hammer", "bullish", strength, "Long lower shadow with small body; potential bullish reversal.")

    # Shooting Star (bearish reversal)
    if (
        rng_last > 0
        and not _doji(last)
        and _upper_shadow(last) >= 2 * body_last
        and _lower_shadow(last) <= 0.1 * rng_last
        and _is_bearish(last)
    ):
        strength = min(0.5 + (_upper_shadow(last) / rng_last) * 0.5, 1.0)
        add("Shooting Star", "bearish", strength, "Long upper shadow; potential bearish reversal.")

    # Spinning Top
    if (
        rng_last > 0
        and not _doji(last)
        and body_last <= 0.3 * rng_last
        and _upper_shadow(last) > body_last
        and _lower_shadow(last) > body_last
    ):
        add("Spinning Top", "neutral", 0.3, "Small body with both shadows; indecision.")

    # Bullish Marubozu
    if (
        rng_last > 0
        and _is_bullish(last)
        and _upper_shadow(last) <= 0.02 * rng_last
        and _lower_shadow(last) <= 0.02 * rng_last
        and body_last >= 0.95 * rng_last
    ):
        strength = 0.7 + 0.3 * min(body_last / max(avg_body, 1e-10), 1.0)
        add("Bullish Marubozu", "bullish", strength, "Full-bodied bullish candle; strong buying pressure.")

    # Bearish Marubozu
    if (
        rng_last > 0
        and _is_bearish(last)
        and _upper_shadow(last) <= 0.02 * rng_last
        and _lower_shadow(last) <= 0.02 * rng_last
        and body_last >= 0.95 * rng_last
    ):
        strength = 0.7 + 0.3 * min(body_last / max(avg_body, 1e-10), 1.0)
        add("Bearish Marubozu", "bearish", strength, "Full-bodied bearish candle; strong selling pressure.")

    # ----- Two-candle patterns -----

    # Bullish Engulfing
    if (
        _is_bearish(prev)
        and _is_bullish(last)
        and last["open"] < prev["close"]
        and last["close"] > prev["open"]
        and body_last > _body(prev)
    ):
        strength = min(0.6 + (body_last - _body(prev)) / max(avg_body, 1e-10) * 0.1, 1.0)
        add("Bullish Engulfing", "bullish", strength, "Bullish candle engulfs prior bearish; reversal signal.")

    # Bearish Engulfing
    if (
        _is_bullish(prev)
        and _is_bearish(last)
        and last["open"] > prev["close"]
        and last["close"] < prev["open"]
        and body_last > _body(prev)
    ):
        strength = min(0.6 + (body_last - _body(prev)) / max(avg_body, 1e-10) * 0.1, 1.0)
        add("Bearish Engulfing", "bearish", strength, "Bearish candle engulfs prior bullish; reversal signal.")

    # Bullish Harami
    if (
        _is_bearish(prev)
        and _is_bullish(last)
        and last["open"] > prev["close"]
        and last["close"] < prev["open"]
        and body_last < _body(prev)
    ):
        add("Bullish Harami", "bullish", 0.45, "Small bullish inside prior bearish; possible reversal.")

    # Bearish Harami
    if (
        _is_bullish(prev)
        and _is_bearish(last)
        and last["open"] < prev["close"]
        and last["close"] > prev["open"]
        and body_last < _body(prev)
    ):
        add("Bearish Harami", "bearish", 0.45, "Small bearish inside prior bullish; possible reversal.")

    # ----- Three-candle patterns -----
    if pprev is not None:
        c0, c1, c2 = pprev, prev, last

        # Morning Star (bullish reversal)
        if (
            _is_bearish(c0)
            and _body(c1) <= 0.3 * _range(c1) if _range(c1) > 0 else False
            and _is_bullish(c2)
            and c2["close"] > (c0["open"] + c0["close"]) / 2
        ):
            add("Morning Star", "bullish", 0.75, "Three-candle bullish reversal; gap + small mid + strong close.")

        # Evening Star (bearish reversal)
        if (
            _is_bullish(c0)
            and (_body(c1) <= 0.3 * _range(c1) if _range(c1) > 0 else False)
            and _is_bearish(c2)
            and c2["close"] < (c0["open"] + c0["close"]) / 2
        ):
            add("Evening Star", "bearish", 0.75, "Three-candle bearish reversal; gap + small mid + strong fall.")

        # Three White Soldiers
        if (
            _is_bullish(c0)
            and _is_bullish(c1)
            and _is_bullish(c2)
            and c1["close"] > c0["close"]
            and c2["close"] > c1["close"]
            and c1["open"] > c0["open"]
            and c2["open"] > c1["open"]
            and _upper_shadow(c0) <= 0.2 * _body(c0)
            and _upper_shadow(c1) <= 0.2 * _body(c1)
            and _upper_shadow(c2) <= 0.2 * _body(c2)
        ):
            add("Three White Soldiers", "bullish", 0.85, "Three consecutive strong bullish candles; powerful uptrend.")

        # Three Black Crows
        if (
            _is_bearish(c0)
            and _is_bearish(c1)
            and _is_bearish(c2)
            and c1["close"] < c0["close"]
            and c2["close"] < c1["close"]
            and c1["open"] < c0["open"]
            and c2["open"] < c1["open"]
            and _lower_shadow(c0) <= 0.2 * _body(c0)
            and _lower_shadow(c1) <= 0.2 * _body(c1)
            and _lower_shadow(c2) <= 0.2 * _body(c2)
        ):
            add("Three Black Crows", "bearish", 0.85, "Three consecutive strong bearish candles; powerful downtrend.")

    return patterns
