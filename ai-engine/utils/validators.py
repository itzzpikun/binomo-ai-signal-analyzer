"""
Input validation helpers for Flask request bodies.
"""
from typing import Any


REQUIRED_CANDLE_KEYS = {"open", "high", "low", "close", "volume"}


class ValidationError(Exception):
    """Raised when request data fails validation."""
    def __init__(self, message: str, code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code


def _validate_number(value: Any, field: str, positive: bool = False) -> float:
    """Assert value is a finite number, optionally > 0."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        raise ValidationError(f"Field '{field}' must be a number, got: {value!r}")
    if v != v:  # NaN check
        raise ValidationError(f"Field '{field}' must be a finite number, got NaN")
    if positive and v < 0:
        raise ValidationError(f"Field '{field}' must be non-negative, got {v}")
    return v


def validate_candle(candle: Any, index: int) -> dict:
    """Validate a single OHLCV candle dict."""
    if not isinstance(candle, dict):
        raise ValidationError(f"Candle at index {index} must be an object, got {type(candle).__name__}")

    for key in REQUIRED_CANDLE_KEYS:
        if key not in candle:
            raise ValidationError(f"Candle at index {index} is missing required field '{key}'")

    o = _validate_number(candle["open"], f"candle[{index}].open")
    h = _validate_number(candle["high"], f"candle[{index}].high")
    l = _validate_number(candle["low"], f"candle[{index}].low")
    c = _validate_number(candle["close"], f"candle[{index}].close")
    vol = _validate_number(candle["volume"], f"candle[{index}].volume", positive=True)

    if h < l:
        raise ValidationError(f"Candle at index {index}: high ({h}) < low ({l})")
    if o < l or o > h:
        raise ValidationError(f"Candle at index {index}: open ({o}) outside [low, high]")
    if c < l or c > h:
        raise ValidationError(f"Candle at index {index}: close ({c}) outside [low, high]")

    return {
        "open": o,
        "high": h,
        "low": l,
        "close": c,
        "volume": vol,
        "timestamp": candle.get("timestamp", ""),
    }


def validate_analyze_request(data: Any) -> dict:
    """
    Validate POST /analyze request body.
    Returns cleaned dict: {symbol, interval, candles}
    """
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")

    symbol = data.get("symbol")
    if not symbol or not isinstance(symbol, str):
        raise ValidationError("Field 'symbol' is required and must be a string")

    interval = data.get("interval", "5min")
    if not isinstance(interval, str):
        raise ValidationError("Field 'interval' must be a string")

    raw_candles = data.get("candles")
    if not isinstance(raw_candles, list):
        raise ValidationError("Field 'candles' is required and must be an array")
    if len(raw_candles) == 0:
        raise ValidationError("Field 'candles' must not be empty")

    candles = [validate_candle(c, i) for i, c in enumerate(raw_candles)]

    return {"symbol": symbol.strip(), "interval": interval.strip(), "candles": candles}


def validate_backtest_request(data: Any) -> dict:
    """
    Validate POST /backtest request body.
    Returns cleaned dict: {symbol, interval, candles, config}
    """
    base = validate_analyze_request(data)

    config = data.get("config", {})
    if not isinstance(config, dict):
        raise ValidationError("Field 'config' must be an object if provided")

    # Validate optional config fields
    if "min_confidence" in config:
        mc = _validate_number(config["min_confidence"], "config.min_confidence")
        if not (0 <= mc <= 100):
            raise ValidationError("config.min_confidence must be between 0 and 100")
        config["min_confidence"] = mc

    if "step" in config:
        step = _validate_number(config["step"], "config.step")
        if step < 1:
            raise ValidationError("config.step must be >= 1")
        config["step"] = int(step)

    base["config"] = config
    return base
