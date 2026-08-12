import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Lobby from './pages/Lobby';
import PreGame from './pages/PreGame';
import Transactions from './pages/Transactions';
import Profile from './pages/Profile';
import Game from './game/agar/Game'; // Uppdaterad sökväg
import SlitherGame from './game/slither/SlitherGame'; // Nytt läge
const SurvivGame = lazy(() => import('./game/surviv/SurvivGame'));
const SlitherStudio = lazy(() => import('./game/slither/studio/SlitherStudio'));
const SlitherStudioRender = lazy(() => import('./game/slither/studio/SlitherStudioRender'));
import Gamemodes from './pages/Gamemodes';
import BRLobby from './pages/BRLobby';
import AdminDashboard from './pages/AdminDashboard';
import HowItWorks from './pages/HowItWorks';
import Faq from './pages/Faq';
import Rewards from './pages/Rewards';
import Tournaments from './pages/Tournaments';
import Shop from './pages/Shop';
import ReferralCapture from './components/ReferralCapture';
import AppLoadingScreen from './components/AppLoadingScreen';
import { AuthProvider, useAuth } from './context/AuthContext';

import { MIN_ENTRY_FEE } from './constants/economy';
import { hasUnlockedFreeTicket } from './utils/freeTicket';
import { isBattleRoyaleAvailable } from './constants/features';
import useSitePresence from './hooks/useSitePresence';
import AgarTokenExperience from './features/agar/ui/AgarTokenExperience';

function SitePresenceRunner() {
  useSitePresence();
  return null;
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

function hasStoredActiveGameSession() {
  if (typeof window === 'undefined') return false;
  // This is only a client-side route allowance. The game server remains the
  // source of truth and will only rejoin a real active match for this account.
  return ['agar', 'slither', 'competitive-slither', 'surviv'].includes(
    localStorage.getItem('current_game_mode') || ''
  );
}

function ArenaRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AppLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.freePlay) return children;
  if (isBattleRoyaleSession(!!user?.isAdmin)) return children;
  if (isTournamentSession()) return children;
  // Rejoining an existing match must not require another entry fee. In
  // particular, an active $2 Slither Arena game can leave the account below
  // the normal $5 route threshold after its original entry was reserved.
  if (hasStoredActiveGameSession()) return children;
  const hasFreeTicket = hasUnlockedFreeTicket(user);
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
    const hasFreeTicket = hasUnlockedFreeTicket(user);
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
  return (
    <Router>
            <AuthProvider>
              <SitePresenceRunner />
              <ReferralCapture />
              <AgarTokenExperience>
              <Routes>
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/lobby" element={<PrivateRoute><Lobby /></PrivateRoute>} />
                <Route path="/pre-game" element={<PreGame />} />
                <Route path="/game" element={<ArenaRoute><Game /></ArenaRoute>} />
                <Route path="/slither-game" element={<ArenaRoute><SlitherGame /></ArenaRoute>} />
                <Route
                  path="/studio/slither"
                  element={import.meta.env.DEV
                    ? <Suspense fallback={<AppLoadingScreen />}><SlitherStudio /></Suspense>
                    : <Navigate to="/pre-game" replace />}
                />
                <Route
                  path="/studio/slither/render"
                  element={import.meta.env.DEV
                    ? <Suspense fallback={<AppLoadingScreen />}><SlitherStudioRender /></Suspense>
                    : <Navigate to="/pre-game" replace />}
                />

                <Route path="/surviv-game" element={<ArenaRoute><Suspense fallback={<AppLoadingScreen />}><SurvivGame /></Suspense></ArenaRoute>} />
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
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/faq" element={<Faq />} />
                <Route path="/rewards" element={<PrivateRoute><Rewards /></PrivateRoute>} />
                <Route path="/shop" element={<PrivateRoute><Shop /></PrivateRoute>} />
                <Route path="/affiliate-program" element={<Navigate to="/rewards#affiliate-rewards" replace />} />
                <Route path="/affiliate" element={<Navigate to="/rewards#affiliate-rewards" replace />} />
                <Route path="/" element={<Navigate to="/pre-game" />} />
              </Routes>
              </AgarTokenExperience>
            </AuthProvider>
    </Router>
  );
}

export default App;
