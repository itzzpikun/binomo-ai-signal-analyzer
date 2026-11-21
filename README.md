# Binomo AI Signal Analyzer

A professional AI-powered market analysis platform for generating CALL/PUT/WAIT signals based on multi-indicator technical analysis.

> ⚠️ **RISK WARNING**: This tool provides technical analysis signals only. It does **not** guarantee profit or predict market movements with certainty. Trading involves significant risk of loss. Never trade with money you cannot afford to lose.

---

## Architecture

```
binomo-ai-analyzer/
├── frontend/        React 18 + Vite + TypeScript + Tailwind CSS
├── backend/         Node.js + Express + TypeScript + MongoDB
└── ai-engine/       Python 3.11 + Flask + numpy/pandas
```

## Tech Stack

| Layer        | Technology                                           |
|-------------|------------------------------------------------------|
| Frontend    | React 18, TypeScript, Vite, Tailwind CSS, TradingView Lightweight Charts |
| Backend     | Node.js 20, Express, TypeScript, MongoDB/Mongoose    |
| AI Engine   | Python 3.11, Flask, numpy, pandas                    |
| Market Data | [Twelve Data API](https://twelvedata.com) (real OHLCV) |
| Database    | MongoDB 7                                            |

---

## Quick Start

### 1. Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB 7+ (running locally or Atlas URI)
- Twelve Data API key (free tier available at https://twelvedata.com)

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env — add your TWELVE_DATA_API_KEY and MONGODB_URI
npm install
npm run dev
# Backend runs on http://localhost:5000
```

### 3. AI Engine Setup

```bash
cd ai-engine
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python app.py
# AI engine runs on http://localhost:8000
```

### 4. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/binomo_analyzer
TWELVE_DATA_API_KEY=your_key_here        # Required for live data
AI_ENGINE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### AI Engine (`ai-engine/.env`)

```env
PORT=8000
DEBUG=false
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
```

---

## API Endpoints

### Market Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/market/candles?symbol=EUR/USD&interval=5min` | OHLCV candles |
| GET | `/api/market/assets` | Supported asset list |
| GET | `/api/market/price?symbol=EUR/USD` | Current price |
| GET | `/api/market/status` | Data provider status |

### Signals

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signal/analyze` | Generate CALL/PUT/WAIT signal |
| GET | `/api/signal/history` | Signal history |
| POST | `/api/signal/verify` | Mark WIN/LOSS outcome |

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/backtest/run` | Walk-forward backtest |
| GET | `/api/performance/summary` | Verified accuracy stats |

### AI Engine (internal)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze` | Analyze OHLCV candles |
| POST | `/backtest` | Run backtest |
| GET | `/health` | Health check |

---

## Signal Generation Logic

The AI engine applies a **weighted multi-indicator scoring** system:

| Indicator | Weight | Signal Logic |
|-----------|--------|-------------|
| MACD | 2.0 | Bullish/bearish crossover |
| Candlestick Patterns | 2.0 | Hammer, Engulfing, Doji, etc. |
| RSI (14) | 1.5 | Oversold (<30) CALL, Overbought (>70) PUT |
| EMA Cross (9/21) | 1.5 | Golden/death cross |
| Support/Resistance | 1.5 | Price near key levels |
| Bollinger Bands | 1.0 | %B position |
| Trend Direction | 1.0 | EMA slope |

**Decision thresholds:**
- Weighted sum > **+2.5** → `CALL` ↑
- Weighted sum < **-2.5** → `PUT` ↓
- Otherwise → `WAIT` ⏸

**Confidence** = `abs(sum) / max_possible_sum × 100` — represents model scoring strength, **not** win probability.

---

## Supported Assets

| Category | Assets |
|----------|--------|
| **Forex** | EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD |
| **Crypto** | BTC/USD, ETH/USD, BNB/USD |
| **Commodities** | XAU/USD (Gold), XAG/USD (Silver), OIL/USD |
| **Indices** | US30 (Dow), NAS100 (Nasdaq), SPX500 (S&P 500) |

---

## Data Availability Policy

- **API key missing or invalid** → all endpoints return `{ "status": "DATA_UNAVAILABLE" }`
- **Frontend** shows "DATA UNAVAILABLE" banner and disables signal analysis
- **No synthetic/fake prices** are ever shown as real market data
- OTC prices on trading platforms may differ from live exchange prices

---

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Live chart + signal + indicators |
| Markets | `/markets` | All supported assets |
| Signal History | `/signals` | CALL/PUT/WAIT log with outcomes |
| Backtesting | `/backtesting` | Walk-forward strategy test |
| Performance | `/performance` | Verified accuracy statistics |
| AI Settings | `/settings` | Configure indicators & timeframe |

---

## Docker Deployment

```bash
# Start all services
docker compose up --build

# Services:
#   frontend  → http://localhost:3000
#   backend   → http://localhost:5000
#   ai-engine → http://localhost:8000
#   mongodb   → localhost:27017
```

---

## Production Build

```bash
# Frontend
cd frontend && npm run build    # outputs to frontend/dist/

# Backend
cd backend && npm run build     # outputs to backend/dist/
npm start

# AI Engine
cd ai-engine
gunicorn app:app --bind 0.0.0.0:8000 --workers 2
```

---

## Safety & Disclaimers

- ✅ No automatic trading — signals are informational only
- ✅ No guaranteed profit claims anywhere in the UI
- ✅ No fabricated live market data
- ✅ Accuracy statistics calculated from verified signals only
- ✅ WAIT returned when indicators conflict
- ✅ Risk warning shown on Dashboard and Performance pages
- ✅ Confidence score represents model strength, not win probability

---

*Built for educational and analytical purposes only. Always verify signals independently before making any trading decisions.*
