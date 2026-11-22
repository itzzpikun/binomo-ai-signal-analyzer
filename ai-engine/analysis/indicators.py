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


def calculate_rsi_series(closes: np.ndarray, period: int = 14) -> np.ndarray:
    """Computes full RSI time series for divergence detection."""
    closes = np.array(closes, dtype=float)
    n = len(closes)
    rsi_arr = np.full(n, np.nan)
    if n < period + 1:
        return rsi_arr

    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    if avg_loss == 0:
        rsi_arr[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        rsi_arr[period] = 100.0 - (100.0 / (1.0 + rs))

    for i in range(period + 1, n):
        idx = i - 1
        avg_gain = (avg_gain * (period - 1) + gains[idx]) / period
        avg_loss = (avg_loss * (period - 1) + losses[idx]) / period
        if avg_loss == 0:
            rsi_arr[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi_arr[i] = 100.0 - (100.0 / (1.0 + rs))

    return rsi_arr


def calculate_divergence(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, lookback: int = 25) -> dict:
    """
    RSI Divergence Detection Engine.
    Bullish Divergence: Price Lower Low + RSI Higher Low -> 85%+ Reversal Setup.
    Bearish Divergence: Price Higher High + RSI Lower High -> 85%+ Reversal Setup.
    """
    if len(closes) < 30:
        return {"bullish_divergence": False, "bearish_divergence": False, "signal": "NONE", "score": 0.0}

    rsi_series = calculate_rsi_series(closes)
    sub_closes = closes[-lookback:]
    sub_rsi = rsi_series[-lookback:]
    sub_lows = lows[-lookback:]
    sub_highs = highs[-lookback:]

    # Find swing lows
    bull_div = False
    bear_div = False
    bull_score = 0.0
    bear_score = 0.0

    # Recent low vs prior low in lookback window
    mid = lookback // 2
    prior_low_idx = int(np.argmin(sub_lows[:mid]))
    recent_low_idx = mid + int(np.argmin(sub_lows[mid:]))

    prior_low_price = sub_lows[prior_low_idx]
    recent_low_price = sub_lows[recent_low_idx]

    prior_low_rsi = sub_rsi[prior_low_idx]
    recent_low_rsi = sub_rsi[recent_low_idx]

    # Bullish Divergence check (Price Lower Low, RSI Higher Low)
    if not np.isnan(prior_low_rsi) and not np.isnan(recent_low_rsi):
        if recent_low_price < prior_low_price and recent_low_rsi > (prior_low_rsi + 1.5):
            if recent_low_rsi <= 45.0:  # Valid only in lower RSI zone
                bull_div = True
                bull_score = 2.5

    # Find swing highs
    prior_high_idx = int(np.argmax(sub_highs[:mid]))
    recent_high_idx = mid + int(np.argmax(sub_highs[mid:]))

    prior_high_price = sub_highs[prior_high_idx]
    recent_high_price = sub_highs[recent_high_idx]

    prior_high_rsi = sub_rsi[prior_high_idx]
    recent_high_rsi = sub_rsi[recent_high_idx]

    # Bearish Divergence check (Price Higher High, RSI Lower High)
    if not np.isnan(prior_high_rsi) and not np.isnan(recent_high_rsi):
        if recent_high_price > prior_high_price and recent_high_rsi < (prior_high_rsi - 1.5):
            if recent_high_rsi >= 55.0:  # Valid only in upper RSI zone
                bear_div = True
                bear_score = 2.5

    signal = "BULLISH_DIVERGENCE" if bull_div else ("BEARISH_DIVERGENCE" if bear_div else "NONE")

    return {
        "bullish_divergence": bull_div,
        "bearish_divergence": bear_div,
        "signal": signal,
        "bull_score": bull_score,
        "bear_score": bear_score,
    }


def calculate_candle_exhaustion(candles: list[dict]) -> dict:
    """
    Consecutive Run Exhaustion Filter.
    Prevents buying at top of 4-5 consecutive green candles or selling at bottom of 4-5 red candles.
    """
    if len(candles) < 6:
        return {"run_count": 0, "run_direction": "NONE", "exhaustion_risk": False}

    recent = candles[-6:]
    colors = []
    for c in recent:
        cl = float(c.get("close", 0))
        op = float(c.get("open", 0))
        colors.append("GREEN" if cl >= op else "RED")

    # Count consecutive matching colors backwards from last candle
    target = colors[-1]
    count = 0
    for col in reversed(colors):
        if col == target:
            count += 1
        else:
            break

    # 4 or more consecutive candles = exhaustion danger
    is_exhaustion = count >= 4

    return {
        "run_count": count,
        "run_direction": target,
        "exhaustion_risk": is_exhaustion,
        "warning_en": f"{count} consecutive {target} candles printed. High risk of immediate pullback/pause candle." if is_exhaustion else "Healthy candle progression.",
        "warning_hi": f"{count} lagataar {target} candles ban chuki hain. Agli candle me pullback/pause hone ka high risk hai." if is_exhaustion else "Normal candle structure.",
    }


def calculate_macro_trend(closes: np.ndarray) -> dict:
    """
    Macro Higher-Timeframe Trend Filter (EMA 50 & EMA 200).
    Rule: Never trade against the macro trend.
    """
    n = len(closes)
    if n < 30:
        return {"trend": "NEUTRAL", "slope": 0.0, "strength": "WEAK"}

    ema50 = calculate_ema(closes, min(50, n))
    ema_macro = calculate_ema(closes, min(200, n)) if n >= 60 else calculate_ema(closes, min(100, n))

    last_close = float(closes[-1])

    if last_close > ema50 and ema50 > ema_macro:
        trend = "STRONG_BULLISH"
    elif last_close < ema50 and ema50 < ema_macro:
        trend = "STRONG_BEARISH"
    elif last_close > ema50:
        trend = "MILD_BULLISH"
    elif last_close < ema50:
        trend = "MILD_BEARISH"
    else:
        trend = "NEUTRAL"

    return {
        "trend": trend,
        "ema50": round(ema50, 5),
        "ema_macro": round(ema_macro, 5),
    }
