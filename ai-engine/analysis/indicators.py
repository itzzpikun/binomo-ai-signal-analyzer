"""
Technical Indicators — computed from scratch using numpy/pandas.
No ta-lib dependency.
"""
import numpy as np
import pandas as pd
from typing import Optional


def calculate_ema(closes: np.ndarray, period: int) -> float:
    """Exponential Moving Average — returns the latest EMA value."""
    if len(closes) < period:
        return float("nan")
    prices = pd.Series(closes, dtype=float)
    ema_series = prices.ewm(span=period, adjust=False).mean()
    return float(ema_series.iloc[-1])


def calculate_rsi(closes: np.ndarray, period: int = 14) -> float:
    """
    Relative Strength Index.
    Returns the latest RSI value (0-100).
    """
    closes = np.array(closes, dtype=float)
    if len(closes) < period + 1:
        return float("nan")

    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    # Wilder's smoothed average (exponential)
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    return float(100.0 - (100.0 / (1.0 + rs)))


def calculate_macd(closes: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9) -> dict:
    """
    MACD — Moving Average Convergence Divergence.
    Returns: {macd, signal, histogram}
    """
    closes = np.array(closes, dtype=float)
    if len(closes) < slow + signal:
        return {"macd": float("nan"), "signal": float("nan"), "histogram": float("nan")}

    prices = pd.Series(closes, dtype=float)
    ema_fast = prices.ewm(span=fast, adjust=False).mean()
    ema_slow = prices.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line

    return {
        "macd": float(macd_line.iloc[-1]),
        "signal": float(signal_line.iloc[-1]),
        "histogram": float(histogram.iloc[-1]),
    }


def calculate_bollinger_bands(closes: np.ndarray, period: int = 20, std_dev: float = 2.0) -> dict:
    """
    Bollinger Bands.
    Returns: {upper, middle, lower, width, percent_b}
    """
    closes = np.array(closes, dtype=float)
    if len(closes) < period:
        return {
            "upper": float("nan"),
            "middle": float("nan"),
            "lower": float("nan"),
            "width": float("nan"),
            "percent_b": float("nan"),
        }

    prices = pd.Series(closes, dtype=float)
    rolling_mean = prices.rolling(window=period).mean()
    rolling_std = prices.rolling(window=period).std(ddof=0)

    upper = rolling_mean + std_dev * rolling_std
    lower = rolling_mean - std_dev * rolling_std

    last_close = closes[-1]
    last_upper = float(upper.iloc[-1])
    last_lower = float(lower.iloc[-1])
    last_middle = float(rolling_mean.iloc[-1])

    band_width = last_upper - last_lower
    percent_b = ((last_close - last_lower) / band_width) if band_width != 0 else 0.5

    return {
        "upper": last_upper,
        "middle": last_middle,
        "lower": last_lower,
        "width": band_width,
        "percent_b": float(percent_b),
    }


def calculate_atr(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, period: int = 14) -> float:
    """
    Average True Range.
    Returns the latest ATR value.
    """
    highs = np.array(highs, dtype=float)
    lows = np.array(lows, dtype=float)
    closes = np.array(closes, dtype=float)

    if len(highs) < period + 1:
        return float("nan")

    # True Range = max(H-L, |H-prev_C|, |L-prev_C|)
    prev_closes = closes[:-1]
    curr_highs = highs[1:]
    curr_lows = lows[1:]

    hl = curr_highs - curr_lows
    hpc = np.abs(curr_highs - prev_closes)
    lpc = np.abs(curr_lows - prev_closes)
    tr = np.maximum(hl, np.maximum(hpc, lpc))

    # Wilder's ATR
    atr = np.mean(tr[:period])
    for i in range(period, len(tr)):
        atr = (atr * (period - 1) + tr[i]) / period

    return float(atr)


def calculate_stochastic(
    highs: np.ndarray,
    lows: np.ndarray,
    closes: np.ndarray,
    k: int = 14,
    d: int = 3,
) -> dict:
    """
    Stochastic Oscillator.
    Returns: {k, d}
    """
    highs = np.array(highs, dtype=float)
    lows = np.array(lows, dtype=float)
    closes = np.array(closes, dtype=float)

    if len(closes) < k + d:
        return {"k": float("nan"), "d": float("nan")}

    stoch_k_values = []
    for i in range(k - 1, len(closes)):
        window_high = np.max(highs[i - k + 1 : i + 1])
        window_low = np.min(lows[i - k + 1 : i + 1])
        denom = window_high - window_low
        if denom == 0:
            stoch_k_values.append(50.0)
        else:
            stoch_k_values.append(100.0 * (closes[i] - window_low) / denom)

    stoch_k_arr = np.array(stoch_k_values)
    if len(stoch_k_arr) < d:
        return {"k": float("nan"), "d": float("nan")}

    stoch_d_values = [np.mean(stoch_k_arr[max(0, i - d + 1) : i + 1]) for i in range(len(stoch_k_arr))]

    return {
        "k": float(stoch_k_arr[-1]),
        "d": float(stoch_d_values[-1]),
    }


def calculate_support_resistance(
    highs: np.ndarray,
    lows: np.ndarray,
    closes: np.ndarray,
    window: int = 10,
    max_levels: int = 5,
) -> dict:
    """
    Identify support and resistance levels using local min/max pivot points.
    Returns: {support_levels, resistance_levels}
    """
    highs = np.array(highs, dtype=float)
    lows = np.array(lows, dtype=float)
    closes = np.array(closes, dtype=float)

    if len(closes) < window * 2 + 1:
        return {"support_levels": [], "resistance_levels": []}

    resistance_prices = []
    support_prices = []

    for i in range(window, len(highs) - window):
        if highs[i] == np.max(highs[i - window : i + window + 1]):
            resistance_prices.append(float(highs[i]))
        if lows[i] == np.min(lows[i - window : i + window + 1]):
            support_prices.append(float(lows[i]))

    # Cluster levels within 0.2% proximity
    def cluster_levels(levels, tolerance: float = 0.002):
        if not levels:
            return []
        levels = sorted(set(levels))
        clusters = []
        cluster = [levels[0]]
        for lvl in levels[1:]:
            if (lvl - cluster[-1]) / max(abs(cluster[-1]), 1e-10) <= tolerance:
                cluster.append(lvl)
            else:
                clusters.append(np.mean(cluster))
                cluster = [lvl]
        clusters.append(np.mean(cluster))
        return clusters

    resistance_levels = sorted(cluster_levels(resistance_prices), reverse=True)[:max_levels]
    support_levels = sorted(cluster_levels(support_prices))[-max_levels:]

    return {
        "support_levels": [round(x, 6) for x in support_levels],
        "resistance_levels": [round(x, 6) for x in resistance_levels],
    }


def calculate_volume_analysis(volumes: np.ndarray, closes: np.ndarray, period: int = 20) -> dict:
    """
    Volume analysis: average volume, relative volume, and trend.
    Returns: {average_volume, relative_volume, trend, signal}
    """
    volumes = np.array(volumes, dtype=float)
    closes = np.array(closes, dtype=float)

    if len(volumes) < period:
        return {
            "average_volume": float("nan"),
            "relative_volume": float("nan"),
            "trend": "neutral",
            "signal": "neutral",
        }

    avg_vol = float(np.mean(volumes[-period:]))
    current_vol = float(volumes[-1])
    relative_vol = current_vol / avg_vol if avg_vol > 0 else 1.0

    # Price direction of last candle
    price_change = closes[-1] - closes[-2] if len(closes) >= 2 else 0.0

    if relative_vol > 1.5 and price_change > 0:
        trend = "bullish"
        signal = "bullish"
    elif relative_vol > 1.5 and price_change < 0:
        trend = "bearish"
        signal = "bearish"
    elif relative_vol < 0.5:
        trend = "low_volume"
        signal = "neutral"
    else:
        trend = "normal"
        signal = "neutral"

    return {
        "average_volume": round(avg_vol, 2),
        "relative_volume": round(relative_vol, 4),
        "trend": trend,
        "signal": signal,
    }


def calculate_adx(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, period: int = 5) -> dict:
    """
    Average Directional Index (ADX) with +DI and -DI.
    Binomo Guide Strategy #2 uses period=5 for fast binary options responsiveness.
    Returns: {adx, plus_di, minus_di}
    """
    highs = np.array(highs, dtype=float)
    lows = np.array(lows, dtype=float)
    closes = np.array(closes, dtype=float)

    if len(closes) < period * 2 + 1:
        return {"adx": float("nan"), "plus_di": float("nan"), "minus_di": float("nan")}

    prev_h = highs[:-1]
    prev_l = lows[:-1]
    prev_c = closes[:-1]
    curr_h = highs[1:]
    curr_l = lows[1:]

    tr = np.maximum(curr_h - curr_l, np.maximum(np.abs(curr_h - prev_c), np.abs(curr_l - prev_c)))
    up_move = curr_h - prev_h
    down_move = prev_l - curr_l
    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

    atr_smooth = np.zeros(len(tr))
    p_dm_smooth = np.zeros(len(tr))
    m_dm_smooth = np.zeros(len(tr))

    atr_smooth[period - 1] = np.mean(tr[:period])
    p_dm_smooth[period - 1] = np.mean(plus_dm[:period])
    m_dm_smooth[period - 1] = np.mean(minus_dm[:period])

    for i in range(period, len(tr)):
        atr_smooth[i] = (atr_smooth[i - 1] * (period - 1) + tr[i]) / period
        p_dm_smooth[i] = (p_dm_smooth[i - 1] * (period - 1) + plus_dm[i]) / period
        m_dm_smooth[i] = (m_dm_smooth[i - 1] * (period - 1) + minus_dm[i]) / period

    with np.errstate(divide="ignore", invalid="ignore"):
        p_di = np.where(atr_smooth > 0, 100.0 * (p_dm_smooth / atr_smooth), 0.0)
        m_di = np.where(atr_smooth > 0, 100.0 * (m_dm_smooth / atr_smooth), 0.0)
        di_sum = p_di + m_di
        dx = np.where(di_sum > 0, 100.0 * np.abs(p_di - m_di) / di_sum, 0.0)

    adx_arr = np.zeros(len(dx))
    adx_arr[period * 2 - 1] = np.mean(dx[period - 1 : period * 2 - 1])
    for i in range(period * 2, len(dx)):
        adx_arr[i] = (adx_arr[i - 1] * (period - 1) + dx[i]) / period

    return {
        "adx": round(float(adx_arr[-1]), 2),
        "plus_di": round(float(p_di[-1]), 2),
        "minus_di": round(float(m_di[-1]), 2),
    }


def calculate_awesome_oscillator(highs: np.ndarray, lows: np.ndarray) -> dict:
    """
    Awesome Oscillator (AO: 5, 34).
    Binomo Guide Strategy #3 (WTC).
    Returns: {ao, prev_ao, color: 'green'|'red'}
    """
    highs = np.array(highs, dtype=float)
    lows = np.array(lows, dtype=float)

    if len(highs) < 35:
        return {"ao": float("nan"), "prev_ao": float("nan"), "color": "neutral"}

    median = (highs + lows) / 2.0
    series = pd.Series(median)
    sma5 = series.rolling(5).mean()
    sma34 = series.rolling(34).mean()
    ao_series = sma5 - sma34

    curr_ao = float(ao_series.iloc[-1])
    prev_ao = float(ao_series.iloc[-2]) if len(ao_series) >= 2 else curr_ao
    color = "green" if curr_ao >= prev_ao else "red"

    return {
        "ao": round(curr_ao, 6),
        "prev_ao": round(prev_ao, 6),
        "color": color,
    }
