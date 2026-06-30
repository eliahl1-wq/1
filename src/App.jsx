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
import SurvivGame from './game/surviv/SurvivGame';
import Gamemodes from './pages/Gamemodes';
import BRLobby from './pages/BRLobby';
import AdminDashboard from './pages/AdminDashboard';
import AdminSandbox from './pages/AdminSandbox';
import HowItWorks from './pages/HowItWorks';
import Faq from './pages/Faq';
import Rewards from './pages/Rewards';
import AppLoadingScreen from './components/AppLoadingScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { BraveWalletAdapter } from '@solana/wallet-adapter-brave';
import { WalletConnectWalletAdapter } from '@solana/wallet-adapter-walletconnect';
import '@solana/wallet-adapter-react-ui/styles.css';
import { MIN_ENTRY_FEE } from './constants/economy';
import { isBattleRoyaleAvailable } from './constants/features';
import useSitePresence from './hooks/useSitePresence';

function SitePresenceRunner() {
  useSitePresence();
  return null;
}

function buildWalletAdapters() {
  const adapters = [
    new WalletConnectWalletAdapter({
      network: WalletAdapterNetwork.Mainnet,
      options: {
        projectId: '8b2f78d206bbaec981376e03d9d15376',
        metadata: {
          name: 'AgarStake',
          description: 'Competitive Agar.io, Slither.io, and Surviv with Solana stakes.',
          url: 'https://www.agararena.space',
          icons: ['https://www.agararena.space/logo-512.png'],
        },
      },
    }),
    // Auto-detects Brave browser wallet via window.braveSolana
    new BraveWalletAdapter(),
  ];

  // Phantom extension only — not injected when only Brave wallet is present
  if (typeof window !== 'undefined' && window.phantom?.solana?.isPhantom) {
    adapters.push(new PhantomWalletAdapter());
  }

  return adapters;
}

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function isBattleRoyaleSession(isAdmin = false) {
  if (typeof window === 'undefined') return false;
  if (!isBattleRoyaleAvailable(isAdmin)) return false;
  const mode = localStorage.getItem('current_game_mode') || localStorage.getItem('selected_gamemode') || '';
  return mode.startsWith('br-');
}

function ArenaRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <AppLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.freePlay) return children;
  if (isBattleRoyaleSession(!!user?.isAdmin)) return children;
  if (user && (user.balanceUsd || (user.balanceSol * (user.solPrice || 57)) || 0) < MIN_ENTRY_FEE) return <Navigate to="/lobby" />;
  return children;
}

function PublicRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <AppLoadingScreen />;
  if (isAuthenticated) {
    const balanceUsd = user?.balanceUsd || (user?.balanceSol * (user?.solPrice || 57)) || 0;
    if (user?.freePlay || balanceUsd >= MIN_ENTRY_FEE) return <Navigate to="/pre-game" />;
    return <Navigate to="/lobby" />;
  }
  return children;
}

function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <AppLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!user?.isAdmin) return <Navigate to="/pre-game" />;
  return children;
}

function App() {
  // TIPS: Ersätt clusterApiUrl med din personliga RPC-länk från Helius för bättre stabilitet
  const endpoint = useMemo(() => 
    "https://mainnet.helius-rpc.com/?api-key=b83e640e-2370-4f65-bc06-efe5166084a4", []);

  const wallets = useMemo(() => buildWalletAdapters(), []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Router>
            <AuthProvider>
              <SitePresenceRunner />
              <Routes>
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/lobby" element={<PrivateRoute><Lobby /></PrivateRoute>} />
                <Route path="/pre-game" element={<PreGame />} />
                <Route path="/game" element={<ArenaRoute><Game /></ArenaRoute>} />
                <Route path="/slither-game" element={<ArenaRoute><SlitherGame /></ArenaRoute>} />
                <Route path="/surviv-game" element={<ArenaRoute><SurvivGame /></ArenaRoute>} />
                <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                <Route path="/gamemodes" element={<Gamemodes />} />
                <Route path="/agar" element={<PreGame />} />
                <Route path="/slither" element={<PreGame />} />
                <Route path="/surviv" element={<PreGame />} />
                <Route path="/br-lobby" element={<PrivateRoute><BRLobby /></PrivateRoute>} />
                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/admin/sandbox" element={<AdminRoute><AdminSandbox /></AdminRoute>} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/faq" element={<Faq />} />
                <Route path="/rewards" element={<PrivateRoute><Rewards /></PrivateRoute>} />
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