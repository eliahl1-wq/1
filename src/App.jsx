import React, { useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Lobby from './pages/Lobby';
import PreGame from './pages/PreGame';
import Transactions from './pages/Transactions';
import Profile from './pages/Profile';
import Game from './game/Game'; // Importera ditt nya spel
import { AuthProvider, useAuth } from './context/AuthContext';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { WalletConnectWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function ArenaRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user && (user.balance || 0) < 0) return <Navigate to="/lobby" />;
  return children;
}

function PublicRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) {
    return (user?.balance || 0) >= 0 ? <Navigate to="/pre-game" /> : <Navigate to="/lobby" />;
  }
  return children;
}

function App() {
  // TIPS: Ersätt clusterApiUrl med din personliga RPC-länk från Helius för bättre stabilitet
  const endpoint = useMemo(() => 
    "https://mainnet.helius-rpc.com/?api-key=b83e640e-2370-4f65-bc06-efe5166084a4", []);

  const wallets = useMemo(
    () => [
      // Genom att lägga till denna manuellt dyker WalletConnect upp igen
      new WalletConnectWalletAdapter({ 
        network: WalletAdapterNetwork.Mainnet, 
        options: { 
          projectId: '8b2f78d206bbaec981376e03d9d15376',
          metadata: {
            name: 'AgarStake',
            description: 'Stake SOL and dominate the arena in this high-stakes agar clone.',
            url: 'https://www.agararena.space',
            icons: ['https://www.agararena.space/vite.svg']
          }
        } 
      }),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Router>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/lobby" element={<PrivateRoute><Lobby /></PrivateRoute>} />
                <Route path="/pre-game" element={<PreGame />} />
                <Route path="/game" element={<ArenaRoute><Game /></ArenaRoute>} />
                <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                {/* Pregame lobbyn är nu startsidan */}
                <Route path="/" element={<Navigate to="/pre-game" />} />
              </Routes>
            </AuthProvider>
          </Router>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;