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
  if (user && (user.balance || 0) < 10) return <Navigate to="/lobby" />;
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/lobby" /> : children;
}

function App() {
  // Byter till 'devnet' för gratis testning. För mainnet i framtiden bör du skaffa en privat RPC (t.ex. från Helius) för att slippa 403-fel.
  const endpoint = useMemo(() => clusterApiUrl('devnet'), []);

  const wallets = useMemo(
    () => [
      // Genom att lägga till denna manuellt dyker WalletConnect upp igen
      new WalletConnectWalletAdapter({ network: 'devnet', options: { projectId: '8b2f78d206bbaec981376e03d9d15376' } }),
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
                <Route path="/pre-game" element={<PrivateRoute><PreGame /></PrivateRoute>} />
                <Route path="/game" element={<ArenaRoute><Game /></ArenaRoute>} />
                <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                {/* Skicka till lobby som standard - den sköter redirect till login om det behövs */}
                <Route path="/" element={<Navigate to="/lobby" />} />
              </Routes>
            </AuthProvider>
          </Router>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;