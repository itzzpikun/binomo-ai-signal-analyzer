import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Markets from './pages/Markets';
import SignalHistory from './pages/SignalHistory';
import Backtesting from './pages/Backtesting';
import Performance from './pages/Performance';
import AISettings from './pages/AISettings';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/markets"     element={<Markets />} />
          <Route path="/signals"     element={<SignalHistory />} />
          <Route path="/backtesting" element={<Backtesting />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/settings"    element={<AISettings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
