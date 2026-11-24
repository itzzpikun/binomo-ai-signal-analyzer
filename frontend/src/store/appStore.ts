import { create } from 'zustand';
import type { Signal, Candle, ConnectionStatus, TimeInterval } from '../types';

export interface SignalAlert {
  id: string;
  symbol: string;
  direction: 'CALL' | 'PUT' | 'WAIT';
  confidence: number;
  interval: string;
  timestamp: string;
  reasons: string[];
}

interface AppState {
  // Market
  selectedSymbol: string;
  selectedInterval: TimeInterval;
  currentPrice: number | null;
  candles: Candle[];
  dataAvailable: boolean;
  isSimulated: boolean;

  // Signal
  currentSignal: Signal | null;
  isAnalyzing: boolean;

  // Sound & Alerts
  soundEnabled: boolean;
  activeAlert: SignalAlert | null;

  // Connection
  connectionStatus: ConnectionStatus;

  // Actions
  setSelectedSymbol: (symbol: string) => void;
  setSelectedInterval: (interval: TimeInterval) => void;
  setCurrentPrice: (price: number | null) => void;
  setCandles: (candles: Candle[]) => void;
  setDataAvailable: (available: boolean) => void;
  setIsSimulated: (simulated: boolean) => void;
  setCurrentSignal: (signal: Signal | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setActiveAlert: (alert: SignalAlert | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  resetSignal: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  selectedSymbol: 'EUR/USD',
  selectedInterval: '5min',
  currentPrice: null,
  candles: [],
  dataAvailable: true,
  isSimulated: false,
  currentSignal: null,
  isAnalyzing: false,
  soundEnabled: typeof window !== 'undefined' ? localStorage.getItem('binomo_sound_alerts_enabled') !== 'false' : true,
  activeAlert: null,
  connectionStatus: 'disconnected',

  // Actions
  setSelectedSymbol: (symbol) => {
    const isSim = symbol.includes('OTC') || symbol === 'CRYPTO_IDX';
    set({ selectedSymbol: symbol, currentSignal: null, candles: [], currentPrice: null, isSimulated: isSim });
  },

  setSelectedInterval: (interval) =>
    set({ selectedInterval: interval, currentSignal: null, candles: [] }),

  setCurrentPrice: (price) => set({ currentPrice: price }),

  setCandles: (candles) => {
    const isSim = candles.length > 0 && candles.some((c) => c.source === 'simulated');
    set((state) => ({
      candles,
      isSimulated: isSim || state.selectedSymbol.includes('OTC') || state.selectedSymbol === 'CRYPTO_IDX',
    }));
  },

  setDataAvailable: (available) => set({ dataAvailable: available }),

  setIsSimulated: (simulated) => set({ isSimulated: simulated }),

  setCurrentSignal: (signal) => set({ currentSignal: signal }),

  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

  setSoundEnabled: (enabled) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('binomo_sound_alerts_enabled', String(enabled));
    }
    set({ soundEnabled: enabled });
  },

  setActiveAlert: (alert) => set({ activeAlert: alert }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  resetSignal: () => set({ currentSignal: null, isAnalyzing: false }),
}));
