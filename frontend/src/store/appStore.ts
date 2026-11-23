import { create } from 'zustand';
import type { Signal, Candle, ConnectionStatus, TimeInterval } from '../types';

interface AppState {
  // Market
  selectedSymbol: string;
  selectedInterval: TimeInterval;
  currentPrice: number | null;
  candles: Candle[];
  dataAvailable: boolean;

  // Signal
  currentSignal: Signal | null;
  isAnalyzing: boolean;

  // Connection
  connectionStatus: ConnectionStatus;

  // Actions
  setSelectedSymbol: (symbol: string) => void;
  setSelectedInterval: (interval: TimeInterval) => void;
  setCurrentPrice: (price: number | null) => void;
  setCandles: (candles: Candle[]) => void;
  setDataAvailable: (available: boolean) => void;
  setCurrentSignal: (signal: Signal | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  resetSignal: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  selectedSymbol: 'Crypto IDX',
  selectedInterval: '1min',
  currentPrice: 6245.50,
  candles: [],
  dataAvailable: true,
  currentSignal: null,
  isAnalyzing: false,
  connectionStatus: 'connected',

  // Actions
  setSelectedSymbol: (symbol) =>
    set({ selectedSymbol: symbol, currentSignal: null, candles: [], currentPrice: null }),

  setSelectedInterval: (interval) =>
    set({ selectedInterval: interval, currentSignal: null, candles: [] }),

  setCurrentPrice: (price) => set({ currentPrice: price }),

  setCandles: (candles) => set({ candles }),

  setDataAvailable: (available) => set({ dataAvailable: available }),

  setCurrentSignal: (signal) => set({ currentSignal: signal }),

  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  resetSignal: () => set({ currentSignal: null, isAnalyzing: false }),
}));
