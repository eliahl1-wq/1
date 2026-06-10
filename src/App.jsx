import React, { useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Lobby from './pages/Lobby';
import PreGame from './pages/PreGame';
import Transactions from './pages/Transactions';
import Profile from './pages/Profile';
import Game from './game/agar/Game'; // Uppdaterad sökväg
import SlitherGame from './game/slither/SlitherGame'; // Nytt läge
import Gamemodes from './pages/Gamemodes';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { BraveWalletAdapter } from '@solana/wallet-adapter-brave';

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function ArenaRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.freePlay) return children;
  if (user && (user.balanceUsd || (user.balanceSol * (user.solPrice || 57)) || 0) < 10) return <Navigate to="/lobby" />;
  return children;
}

function PublicRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) {
    const balanceUsd = user?.balanceUsd || (user?.balanceSol * (user?.solPrice || 57)) || 0;
    if (user?.freePlay || balanceUsd >= 10) return <Navigate to="/pre-game" />;
    return <Navigate to="/lobby" />;
  }
  return children;
}

function App() {
  // TIPS: Ersätt clusterApiUrl med din personliga RPC-länk från Helius för bättre stabilitet
  const endpoint = useMemo(() => 
    "https://mainnet.helius-rpc.com/?api-key=b83e640e-2370-4f65-bc06-efe5166084a4", []);

  const wallets = useMemo(
    () => [
      new BraveWalletAdapter(),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: WalletAdapterNetwork.Mainnet }),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
          <Router>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/lobby" element={<PrivateRoute><Lobby /></PrivateRoute>} />
                <Route path="/pre-game" element={<PreGame />} />
                <Route path="/game" element={<ArenaRoute><Game /></ArenaRoute>} />
                <Route path="/slither-game" element={<ArenaRoute><SlitherGame /></ArenaRoute>} />
                <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                <Route path="/gamemodes" element={<Gamemodes />} />
                {/* Pregame lobbyn är nu startsidan */}
                <Route path="/" element={<Navigate to="/pre-game" />} />
              </Routes>
            </AuthProvider>
          </Router>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;