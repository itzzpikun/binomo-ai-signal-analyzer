import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, Time, LineData } from 'lightweight-charts';
import { useAppStore } from '../../store/appStore';
import type { Candle } from '../../types';
import TradingViewWidget from './TradingViewWidget';

const CHART_COLORS = {
  background: '#0a0f1d',
  text: '#94a3b8',
  grid: '#1e293b',
  border: '#334155',
  up: '#00b875', // Binomo vibrant green
  down: '#ff4757', // Binomo vivid red
  ema9: '#38bdf8',
  ema21: '#f59e0b',
  crosshair: '#64748b',
};

function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (data.length < period) return result;

  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  result[period - 1] = ema;

  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    result[i] = ema;
  }

  return result;
}

const CandlestickChart: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const hasFittedRef = useRef(false);
  const prevSymbolRef = useRef<string>('');

  const candles = useAppStore((s) => s.candles);
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const selectedInterval = useAppStore((s) => s.selectedInterval);
  const isSimulated = useAppStore((s) => s.isSimulated);

  // Active chart engine: Binomo Live Candles (Primary/Default) vs TradingView vs AI Pro Chart
  const [chartMode, setChartMode] = useState<'binomo' | 'tradingview' | 'ai'>('binomo');

  // Live hover candle details
  const [hoverData, setHoverData] = useState<{
    time?: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    change?: number;
  } | null>(null);

  // Candle countdown timer state
  const [candleSecondsRemaining, setCandleSecondsRemaining] = useState<number>(0);
  const [candleProgress, setCandleProgress] = useState<number>(0);

  // Calculate interval duration in seconds
  const intervalSeconds = selectedInterval === '1min' ? 60
    : selectedInterval === '15min' ? 900
    : 300; // default 5min

  // Real-time clock for candle close countdown
  useEffect(() => {
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now % intervalSeconds;
      const remaining = intervalSeconds - elapsed;
      setCandleSecondsRemaining(remaining);
      setCandleProgress(((intervalSeconds - remaining) / intervalSeconds) * 100);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [intervalSeconds]);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const initChart = useCallback(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.text,
        fontSize: 12,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid, style: 2 },
        horzLines: { color: CHART_COLORS.grid, style: 2 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: CHART_COLORS.crosshair,
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e293b',
        },
        horzLine: {
          color: CHART_COLORS.crosshair,
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e293b',
        },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        autoScale: true,
        scaleMargins: {
          top: 0.08,
          bottom: 0.08,
        },
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 14,
        minBarSpacing: 5,
        rightOffset: 6,
      },
      handleScroll: {
        horzTouchDrag: true,
        vertTouchDrag: false, // Prevents mobile touch freeze when scrolling page
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
        pinch: true,
        mouseWheel: true,
      },
      width: containerRef.current.clientWidth || 600,
      height: Math.max(containerRef.current.clientHeight || 0, 440),
    });

    chartRef.current = chart;

    // Candlestick series with smooth shadows and borders
    const candleSeries = chart.addCandlestickSeries({
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      borderUpColor: CHART_COLORS.up,
      borderDownColor: CHART_COLORS.down,
      wickUpColor: CHART_COLORS.up,
      wickDownColor: CHART_COLORS.down,
      priceLineVisible: true,
      lastValueVisible: true,
    });
    candleSeriesRef.current = candleSeries;

    // EMA9 line (visible in AI Pro mode)
    const ema9Series = chart.addLineSeries({
      color: CHART_COLORS.ema9,
      lineWidth: 2,
      title: 'EMA9',
      priceLineVisible: false,
      lastValueVisible: false,
      visible: chartMode === 'ai',
    });
    ema9SeriesRef.current = ema9Series;

    // EMA21 line (visible in AI Pro mode)
    const ema21Series = chart.addLineSeries({
      color: CHART_COLORS.ema21,
      lineWidth: 2,
      title: 'EMA21',
      priceLineVisible: false,
      lastValueVisible: false,
      visible: chartMode === 'ai',
    });
    ema21SeriesRef.current = ema21Series;

    // Interactive crosshair subscribe
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setHoverData(null);
        return;
      }
      const data = param.seriesData.get(candleSeries) as any;
      if (data && data.open !== undefined) {
        const change = ((data.close - data.open) / data.open) * 100;
        setHoverData({
          time: new Date((param.time as number) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          change,
        });
      }
    });
  }, []);

  const updateData = useCallback((data: Candle[]) => {
    if (!candleSeriesRef.current || !ema9SeriesRef.current || !ema21SeriesRef.current) return;
    if (!data.length) return;

    const sorted = [...data].sort((a, b) => a.time - b.time);

    // Strictly increasing deduplication required by lightweight-charts
    const uniqueSorted: Candle[] = [];
    let lastTime = -1;
    for (const c of sorted) {
      if (c.time > lastTime && !isNaN(c.open) && !isNaN(c.close)) {
        uniqueSorted.push(c);
        lastTime = c.time;
      }
    }

    if (!uniqueSorted.length) return;

    const candleData: CandlestickData<Time>[] = uniqueSorted.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(candleData);

    // Calculate EMAs
    const closes = uniqueSorted.map((c) => c.close);
    const ema9Values = calculateEMA(closes, 9);
    const ema21Values = calculateEMA(closes, 21);

    const ema9Data: LineData<Time>[] = uniqueSorted
      .map((c, i) => ({ time: c.time as Time, value: ema9Values[i] }))
      .filter((d) => d.value !== null) as LineData<Time>[];

    const ema21Data: LineData<Time>[] = uniqueSorted
      .map((c, i) => ({ time: c.time as Time, value: ema21Values[i] }))
      .filter((d) => d.value !== null) as LineData<Time>[];

    ema9SeriesRef.current.setData(ema9Data);
    ema21SeriesRef.current.setData(ema21Data);

    // Scroll to the most recent candles with optimal spacing so candles are bold and easy to read
    if (!hasFittedRef.current || prevSymbolRef.current !== selectedSymbol) {
      const total = uniqueSorted.length;
      if (total > 35) {
        chartRef.current?.timeScale().setVisibleLogicalRange({
          from: total - 35,
          to: total + 3,
        });
      } else {
        chartRef.current?.timeScale().fitContent();
      }
      hasFittedRef.current = true;
      prevSymbolRef.current = selectedSymbol;
    }
  }, [selectedSymbol]);

  useEffect(() => {
    initChart();
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [initChart]);

  useEffect(() => {
    updateData(candles);
  }, [candles, updateData]);

  // Handle switching chart modes without unmounting canvas
  useEffect(() => {
    if (ema9SeriesRef.current && ema21SeriesRef.current) {
      ema9SeriesRef.current.applyOptions({ visible: chartMode === 'ai' });
      ema21SeriesRef.current.applyOptions({ visible: chartMode === 'ai' });
    }
    if (chartMode !== 'tradingview' && chartRef.current && containerRef.current) {
      const w = containerRef.current.clientWidth || 600;
      const h = Math.max(containerRef.current.clientHeight || 0, 440);
      chartRef.current.applyOptions({ width: w, height: h });
      const total = candles.length;
      if (total > 35) {
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: total - 35,
          to: total + 3,
        });
      } else {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [chartMode, candles.length]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (chartRef.current) {
          const w = Math.floor(entry.contentRect.width);
          const h = Math.floor(entry.contentRect.height);
          if (w > 0 && h > 0) {
            chartRef.current.applyOptions({
              width: w,
              height: h,
            });
          }
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const candleChange = latestCandle ? ((latestCandle.close - latestCandle.open) / latestCandle.open) * 100 : 0;
  const isUp = candleChange >= 0;

  return (
    <div className="bg-gray-900/90 border border-gray-800 rounded-xl overflow-hidden flex flex-col h-full shadow-2xl backdrop-blur-sm">
      {/* Chart Top Header & Live Activity Bar */}
      <div className="px-2.5 sm:px-4 py-2 sm:py-2.5 border-b border-gray-800/80 bg-gray-950/60 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Symbol, View Switcher & Live Status */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-gray-100 font-bold tracking-wide text-sm sm:text-base">{selectedSymbol}</span>
            <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {selectedInterval}
            </span>
          </div>

          {/* Chart View Mode Switcher */}
          <div className="flex items-center gap-1 bg-gray-950 border border-gray-800 p-0.5 rounded-lg">
            <button
              onClick={() => setChartMode('binomo')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                chartMode === 'binomo'
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-md shadow-yellow-500/20'
                  : 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10'
              }`}
            >
              <span>🟡 Binomo Live Candles</span>
              <span className="text-[9px] bg-black/20 text-black px-1 rounded uppercase font-mono font-extrabold">LIVE</span>
            </button>
            <button
              onClick={() => setChartMode('tradingview')}
              className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                chartMode === 'tradingview'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              📈 TradingView
            </button>
            <button
              onClick={() => setChartMode('ai')}
              className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                chartMode === 'ai'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              📊 AI Confluence
            </button>
          </div>

          {/* Live Pulsing Dot / Simulated Warning Badge */}
          {isSimulated ? (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
              <span className="text-[10px] sm:text-[11px] font-bold">SIMULATED - NOT REAL PRICES</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span className="text-[10px] sm:text-[11px] font-medium text-emerald-400">LIVE FEED</span>
            </div>
          )}

          {/* Price Change */}
          {latestCandle && (
            <span className={`text-[11px] sm:text-xs font-mono font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {isUp ? '▲ +' : '▼ '}{candleChange.toFixed(3)}%
            </span>
          )}
        </div>

        {/* Live Candle Countdown & Next Trade Timing */}
        <div className="flex items-center gap-2 sm:gap-4 ml-auto">
          {/* Candle Close Countdown */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-gray-900 border border-gray-700/60 px-2 sm:px-3 py-1 rounded-lg">
            <span className="text-gray-400 text-[11px] sm:text-xs flex items-center gap-1">
              <span>⏱️</span>
              <span className="hidden sm:inline">Candle Closes:</span>
            </span>
            <span className="font-mono text-xs font-bold text-amber-400">
              {formatTime(candleSecondsRemaining)}
            </span>
            {/* Visual progress bar */}
            <div className="w-10 sm:w-12 h-1.5 bg-gray-800 rounded-full overflow-hidden hidden md:block">
              <div
                className="h-full bg-amber-400 transition-all duration-1000"
                style={{ width: `${candleProgress}%` }}
              />
            </div>
          </div>

          {/* EMA Indicators Legend */}
          {chartMode === 'ai' && (
            <div className="flex items-center gap-2 sm:gap-3 text-xs hidden sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-sky-400 inline-block rounded-full"></span>
                <span className="text-gray-400 text-[11px]">EMA 9</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-amber-400 inline-block rounded-full"></span>
                <span className="text-gray-400 text-[11px]">EMA 21</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* TradingView Widget Container — Kept in DOM, display toggled */}
      <div
        className="flex-1 w-full min-h-[440px] sm:min-h-[500px] lg:min-h-[560px] p-1"
        style={{ display: chartMode === 'tradingview' ? 'block' : 'none' }}
      >
        <TradingViewWidget symbol={selectedSymbol} interval={selectedInterval} />
      </div>

      {/* Lightweight Charts / Binomo Candlestick Canvas Container */}
      <div
        className="flex-1 w-full flex flex-col min-h-[440px] sm:min-h-[500px] lg:min-h-[560px]"
        style={{ display: chartMode !== 'tradingview' ? 'flex' : 'none' }}
      >
        {/* Binomo Live Candlestick HUD */}
        {chartMode === 'binomo' && latestCandle && (
          <div className="px-2.5 sm:px-3 py-1 bg-yellow-950/30 border-b border-yellow-500/20 flex items-center justify-between text-xs text-yellow-300 flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-yellow-400 flex items-center gap-1 text-[11px] sm:text-xs">
                <span>🟡</span>
                <span>Binomo Live Candlestick Feed</span>
              </span>
              <span className="text-[10px] sm:text-[11px] text-gray-300">
                • Body: {Math.round((Math.abs(latestCandle.close - latestCandle.open) / Math.max(latestCandle.high - latestCandle.low, 0.0001)) * 100)}%
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold">
                {latestCandle.close >= latestCandle.open ? '🟢 Bullish Action' : '🔴 Bearish Action'}
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-yellow-400 hidden sm:inline">
              Binomo Strategy #1 (EMA 8/21) & Candlestick Patterns
            </span>
          </div>
        )}

        {/* OHLC Interactive Status Bar */}
        <div className="px-2.5 sm:px-4 py-1 sm:py-1.5 bg-gray-950/50 border-b border-gray-800/40 flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-mono text-gray-400 overflow-x-auto">
          {hoverData ? (
            <>
              <span className="text-gray-500">{hoverData.time}</span>
              <span>O: <span className="text-gray-200">{hoverData.open?.toFixed(selectedSymbol.includes('USD') && !selectedSymbol.includes('BTC') ? 5 : 2)}</span></span>
              <span>H: <span className="text-gray-200">{hoverData.high?.toFixed(selectedSymbol.includes('USD') && !selectedSymbol.includes('BTC') ? 5 : 2)}</span></span>
              <span>L: <span className="text-gray-200">{hoverData.low?.toFixed(selectedSymbol.includes('USD') && !selectedSymbol.includes('BTC') ? 5 : 2)}</span></span>
              <span>C: <span className="text-gray-200">{hoverData.close?.toFixed(selectedSymbol.includes('USD') && !selectedSymbol.includes('BTC') ? 5 : 2)}</span></span>
              <span className={hoverData.change && hoverData.change >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {hoverData.change && hoverData.change >= 0 ? '+' : ''}{hoverData.change?.toFixed(3)}%
              </span>
            </>
          ) : latestCandle ? (
            <>
              <span className="text-gray-500 hidden sm:inline">Latest:</span>
              <span>O: <span className="text-gray-300">{latestCandle.open.toFixed(selectedSymbol.includes('USD') && !selectedSymbol.includes('BTC') ? 5 : 2)}</span></span>
              <span>H: <span className="text-gray-300">{latestCandle.high.toFixed(selectedSymbol.includes('USD') && !selectedSymbol.includes('BTC') ? 5 : 2)}</span></span>
              <span>L: <span className="text-gray-300">{latestCandle.low.toFixed(selectedSymbol.includes('USD') && !selectedSymbol.includes('BTC') ? 5 : 2)}</span></span>
              <span>C: <span className="text-gray-300">{latestCandle.close.toFixed(selectedSymbol.includes('USD') && !selectedSymbol.includes('BTC') ? 5 : 2)}</span></span>
              <span className={isUp ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                {isUp ? '+' : ''}{candleChange.toFixed(3)}%
              </span>
            </>
          ) : (
            <span className="text-gray-600">Tap or hover candles to inspect details</span>
          )}
        </div>

        {/* Lightweight Charts Canvas */}
        <div ref={containerRef} className="flex-1 w-full min-h-[400px] sm:min-h-[460px] lg:min-h-[510px]" />
      </div>
    </div>
  );
};

export default CandlestickChart;
