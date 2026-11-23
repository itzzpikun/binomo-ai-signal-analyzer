import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';

const BinomoLoginModal: React.FC = () => {
  const {
    showLoginModal,
    setShowLoginModal,
    isBinomoLoggedIn,
    binomoEmail,
    binomoAccountType,
    binomoBalance,
    binomoCurrency,
    setBinomoLoggedIn,
    setBinomoAccountType,
    setBinomoCurrency,
  } = useAppStore();

  const [emailInput, setEmailInput] = useState(binomoEmail || '');
  const [passwordInput, setPasswordInput] = useState('••••••••');
  const [activeTab, setActiveTab] = useState<'login' | 'status'>('login');
  const [successMsg, setSuccessMsg] = useState('');

  if (!showLoginModal) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setBinomoLoggedIn(true, emailInput);
    setSuccessMsg('Successfully connected to Binomo Live Feed!');
    setTimeout(() => {
      setSuccessMsg('');
      setShowLoginModal(false);
    }, 900);
  };

  const handleQuickDemo = () => {
    setBinomoAccountType('demo');
    setBinomoLoggedIn(true, 'demo.trader@binomo.com');
    setSuccessMsg('Demo Account (₹65,000) Activated!');
    setTimeout(() => {
      setSuccessMsg('');
      setShowLoginModal(false);
    }, 800);
  };

  const handleLogout = () => {
    setBinomoLoggedIn(false);
    setSuccessMsg('Logged out from Binomo session');
    setTimeout(() => setSuccessMsg(''), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-gray-950 border border-yellow-500/30 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden relative">
        {/* Top Header with Binomo Yellow Accent */}
        <div className="bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 p-4 text-black flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-yellow-400 font-extrabold text-lg shadow-sm">
              B
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-wide leading-tight text-gray-950">
                BINOMO TRADING PLATFORM
              </h3>
              <p className="text-[11px] font-semibold text-gray-900 opacity-90">
                Live OTC Market Feed & AI Signal Engine
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLoginModal(false)}
            className="w-7 h-7 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center font-bold text-gray-900 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-gray-800 bg-gray-900/60 p-1.5 gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeTab === 'login'
                ? 'bg-yellow-500 text-black shadow-sm font-bold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            🔑 Binomo Login
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeTab === 'status'
                ? 'bg-yellow-500 text-black shadow-sm font-bold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            📊 Account & Status
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5">
          {successMsg && (
            <div className="mb-4 p-2.5 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs text-center font-semibold flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              {successMsg}
            </div>
          )}

          {activeTab === 'login' ? (
            <div>
              {/* Quick 1-Click Demo Login */}
              <button
                type="button"
                onClick={handleQuickDemo}
                className="w-full py-2.5 px-3 mb-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <span>⚡ 1-Click Instant Demo Access (₹65,000 Live)</span>
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-gray-800 w-full" />
                <span className="bg-gray-950 px-2 text-[11px] text-gray-500 uppercase font-semibold">
                  Or Sign In with Binomo Credentials
                </span>
                <div className="border-t border-gray-800 w-full" />
              </div>

              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                    Binomo Email / Phone
                  </label>
                  <input
                    type="text"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full bg-gray-900 border border-gray-700 focus:border-yellow-500 text-white text-xs sm:text-sm rounded-xl px-3 py-2.5 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-gray-900 border border-gray-700 focus:border-yellow-500 text-white text-xs sm:text-sm rounded-xl px-3 py-2.5 outline-none transition-colors"
                  />
                </div>

                {/* Account Type Selection */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-gray-400 font-semibold">Account:</span>
                  <button
                    type="button"
                    onClick={() => setBinomoAccountType('demo')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                      binomoAccountType === 'demo'
                        ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                        : 'border-gray-800 text-gray-400'
                    }`}
                  >
                    Demo (₹65,000)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBinomoAccountType('real')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                      binomoAccountType === 'real'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'border-gray-800 text-gray-400'
                    }`}
                  >
                    Real Account
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-xs sm:text-sm shadow-md shadow-yellow-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] mt-2"
                >
                  Connect & Stream Live Binomo Feed
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Account Status Card */}
              <div className="p-3.5 bg-gray-900 rounded-xl border border-gray-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Connection Status:</span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    🟢 Live Binomo Stream Active
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Active Account:</span>
                  <span className="font-semibold text-white capitalize">
                    {binomoAccountType} Account
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Available Balance:</span>
                  <span className="font-mono text-sm font-bold text-yellow-400">
                    {binomoCurrency} {binomoBalance.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Trader Email:</span>
                  <span className="font-mono text-gray-300 text-[11px]">{binomoEmail}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">VIP Payout Tier:</span>
                  <span className="text-emerald-400 font-bold">VIP 85% Active</span>
                </div>
              </div>

              {/* Currency Selector */}
              <div className="flex items-center justify-between bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                <span className="text-gray-400 font-medium">Display Currency:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setBinomoCurrency('₹')}
                    className={`px-2.5 py-1 rounded-lg font-bold ${
                      binomoCurrency === '₹'
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    INR (₹)
                  </button>
                  <button
                    onClick={() => setBinomoCurrency('$')}
                    className={`px-2.5 py-1 rounded-lg font-bold ${
                      binomoCurrency === '$'
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    USD ($)
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                {isBinomoLoggedIn && (
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-2 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-800 text-red-300 font-semibold"
                  >
                    Disconnect
                  </button>
                )}
                <a
                  href="https://binomo.com/trading"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold text-center flex items-center justify-center gap-1"
                >
                  <span>Open Binomo Web</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-gray-900/40 border-t border-gray-800/80 text-[10px] text-gray-500 flex items-center justify-between">
          <span>Binomo AI Engine v2.5</span>
          <span className="text-emerald-400 font-medium">All 26 OTC Assets Live</span>
        </div>
      </div>
    </div>
  );
};

export default BinomoLoginModal;
