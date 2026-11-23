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

  // Binomo Account & Login
  isBinomoLoggedIn: boolean;
  binomoEmail: string;
  binomoAccountType: 'demo' | 'real';
  binomoBalance: number;
  binomoCurrency: '₹' | '$';
  showLoginModal: boolean;

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

  // Binomo Account Actions
  setBinomoLoggedIn: (loggedIn: boolean, email?: string) => void;
  setBinomoAccountType: (type: 'demo' | 'real') => void;
  setBinomoBalance: (balance: number) => void;
  setBinomoCurrency: (curr: '₹' | '$') => void;
  setShowLoginModal: (show: boolean) => void;
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

  // Binomo Account defaults
  isBinomoLoggedIn: true,
  binomoEmail: 'demo.trader@binomo.com',
  binomoAccountType: 'demo',
  binomoBalance: 65000,
  binomoCurrency: '₹',
  showLoginModal: false,

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

  setBinomoLoggedIn: (loggedIn, email) =>
    set((state) => ({
      isBinomoLoggedIn: loggedIn,
      binomoEmail: email || state.binomoEmail,
      showLoginModal: false,
    })),

  setBinomoAccountType: (type) =>
    set((state) => ({
      binomoAccountType: type,
      binomoBalance: type === 'demo' ? (state.binomoCurrency === '₹' ? 65000 : 1000) : 0,
    })),

  setBinomoBalance: (balance) => set({ binomoBalance: balance }),

  setBinomoCurrency: (curr) =>
    set((state) => ({
      binomoCurrency: curr,
      binomoBalance: state.binomoAccountType === 'demo' ? (curr === '₹' ? 65000 : 1000) : 0,
    })),

  setShowLoginModal: (show) => set({ showLoginModal: show }),
}));
