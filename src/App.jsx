import React, { useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import Tournaments from './pages/Tournaments';
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

const SOLANA_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL?.trim()
  || 'https://api.mainnet.solana.com';

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
          url: 'https://agararena.space',
          icons: ['https://agararena.space/logo-512.png'],
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

function isTournamentSession() {
  if (typeof window === 'undefined') return false;
  const mode = localStorage.getItem('current_game_mode') || localStorage.getItem('selected_gamemode') || '';
  return mode === 'tournament-slither' && !!localStorage.getItem('current_tournament_id');
}

function ArenaRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AppLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.freePlay) return children;
  if (isBattleRoyaleSession(!!user?.isAdmin)) return children;
  if (isTournamentSession()) return children;
  const hasFreeTicket = user?.hasFreeTicket && !user?.freeTicketUsed;
  // The server consumes the ticket during join, so the auth refresh can set freeTicketUsed before the game route renders.
  const hasFreeTicketSession = location.state?.useFreeTicket === true
    || (typeof window !== 'undefined' && localStorage.getItem('use_free_ticket') === 'true');
  if (user && !hasFreeTicket && !hasFreeTicketSession && (user.balanceUsd || (user.balanceSol * (user.solPrice || 57)) || 0) < MIN_ENTRY_FEE) return <Navigate to="/lobby" />;
  return children;
}

function PublicRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <AppLoadingScreen />;
  if (isAuthenticated) {
    const balanceUsd = user?.balanceUsd || (user?.balanceSol * (user?.solPrice || 57)) || 0;
    const hasFreeTicket = user?.hasFreeTicket && !user?.freeTicketUsed;
    if (user?.freePlay || hasFreeTicket || balanceUsd >= MIN_ENTRY_FEE) return <Navigate to="/pre-game" />;
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
  const endpoint = useMemo(() => SOLANA_RPC_URL, []);

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
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/tournaments/:tournamentId/lobby" element={<PrivateRoute><PreGame /></PrivateRoute>} />
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