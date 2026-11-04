import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import PreGame from './pages/PreGame';
import { loadAgarGame, loadSlitherGame, loadSurvivGame } from './game/gameModules.js';
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Lobby = lazy(() => import('./pages/Lobby'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Profile = lazy(() => import('./pages/Profile'));
const Game = lazy(loadAgarGame);
const SlitherGame = lazy(loadSlitherGame);
const SurvivGame = lazy(loadSurvivGame);
const SlitherStudio = lazy(() => import('./game/slither/studio/SlitherStudio'));
const SlitherStudioRender = lazy(() => import('./game/slither/studio/SlitherStudioRender'));
const Gamemodes = lazy(() => import('./pages/Gamemodes'));
const BRLobby = lazy(() => import('./pages/BRLobby'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Faq = lazy(() => import('./pages/Faq'));
const Rewards = lazy(() => import('./pages/Rewards'));
const Tournaments = lazy(() => import('./pages/Tournaments'));
const Shop = lazy(() => import('./pages/Shop'));
import ReferralCapture from './components/ReferralCapture';
import AppLoadingScreen from './components/AppLoadingScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ServerReadinessProvider, ServerUpdateBanner } from './context/ServerReadinessContext';

import { MIN_ENTRY_FEE } from './constants/economy';
import { hasUnlockedFreeTicket } from './utils/freeTicket';
import { isBattleRoyaleAvailable } from './constants/features';
import useSitePresence from './hooks/useSitePresence';
import AgarTokenExperience from './features/agar/ui/AgarTokenExperience';
import { isPublicFreeModeEnabled } from './utils/freeMode';
import { applyRouteSeoPolicy } from './utils/seo';

function RouteSeoPolicy() {
  const { pathname } = useLocation();

  useEffect(() => {
    applyRouteSeoPolicy(pathname);
  }, [pathname]);

  return null;
}

function SitePresenceRunner() {
  useSitePresence();
  return null;
}

function LazyPage({ children }) {
  return <Suspense fallback={<AppLoadingScreen />}>{children}</Suspense>;
}

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <AppLoadingScreen />;
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function isBattleRoyaleSession(isAdmin = false) {
  if (typeof window === 'undefined') return false;
  const mode = localStorage.getItem('current_game_mode') || localStorage.getItem('selected_gamemode') || '';
  return mode.startsWith('br-') && isBattleRoyaleAvailable(isAdmin, mode);
}

function isTournamentSession() {
  if (typeof window === 'undefined') return false;
  const mode = localStorage.getItem('current_game_mode') || localStorage.getItem('selected_gamemode') || '';
  return (mode === 'tournament-slither' || mode === 'tournament-agar')
    && !!localStorage.getItem('current_tournament_id');
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
  if (isPublicFreeModeEnabled()) return children;
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
    return <Navigate to="/" />;
  }
  return children;
}

function AdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <AppLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!user?.isAdmin) return <Navigate to="/" />;
  return children;
}

function App() {
  return (
    <Router>
      <ServerReadinessProvider>
            <ServerUpdateBanner />
            <RouteSeoPolicy />
            <AuthProvider>
              <SitePresenceRunner />
              <ReferralCapture />
              <AgarTokenExperience>
              <Routes>
                <Route path="/login" element={<PublicRoute><LazyPage><LoginPage /></LazyPage></PublicRoute>} />
                <Route path="/register" element={<LazyPage><RegisterPage /></LazyPage>} />
                <Route path="/verify-email" element={<LazyPage><VerifyEmail /></LazyPage>} />
                <Route path="/lobby" element={<PrivateRoute><LazyPage><Lobby /></LazyPage></PrivateRoute>} />
                <Route path="/pre-game" element={<PreGame />} />
                <Route path="/game" element={<ArenaRoute><Suspense fallback={<AppLoadingScreen />}><Game /></Suspense></ArenaRoute>} />
                <Route path="/slither-game" element={<ArenaRoute><Suspense fallback={<AppLoadingScreen />}><SlitherGame /></Suspense></ArenaRoute>} />
                <Route
                  path="/studio/slither"
                  element={import.meta.env.DEV
                    ? <Suspense fallback={<AppLoadingScreen />}><SlitherStudio /></Suspense>
                    : <Navigate to="/" replace />}
                />
                <Route
                  path="/studio/slither/render"
                  element={import.meta.env.DEV
                    ? <Suspense fallback={<AppLoadingScreen />}><SlitherStudioRender /></Suspense>
                    : <Navigate to="/" replace />}
                />

                <Route path="/surviv-game" element={<ArenaRoute><Suspense fallback={<AppLoadingScreen />}><SurvivGame /></Suspense></ArenaRoute>} />
                <Route path="/transactions" element={<PrivateRoute><LazyPage><Transactions /></LazyPage></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><LazyPage><Profile /></LazyPage></PrivateRoute>} />
                <Route path="/gamemodes" element={<LazyPage><Gamemodes /></LazyPage>} />
                <Route path="/agar" element={<PreGame />} />
                <Route path="/slither" element={<PreGame />} />
                <Route path="/tournaments" element={<LazyPage><Tournaments /></LazyPage>} />
                <Route path="/tournaments/:tournamentId/lobby" element={<PrivateRoute><PreGame /></PrivateRoute>} />
                <Route path="/surviv" element={<PreGame />} />
                <Route path="/br-lobby" element={<PrivateRoute><LazyPage><BRLobby /></LazyPage></PrivateRoute>} />
                <Route path="/surviv-battle-royale" element={<PreGame />} />
                <Route path="/admin" element={<AdminRoute><Suspense fallback={<AppLoadingScreen />}><AdminDashboard /></Suspense></AdminRoute>} />
                <Route path="/how-it-works" element={<LazyPage><HowItWorks /></LazyPage>} />
                <Route path="/faq" element={<LazyPage><Faq /></LazyPage>} />
                <Route path="/rewards" element={<PrivateRoute><LazyPage><Rewards /></LazyPage></PrivateRoute>} />
                <Route path="/shop" element={<PrivateRoute><LazyPage><Shop /></LazyPage></PrivateRoute>} />
                <Route path="/affiliate-program" element={<Navigate to="/rewards#affiliate-rewards" replace />} />
                <Route path="/affiliate" element={<Navigate to="/rewards#affiliate-rewards" replace />} />
                <Route path="/" element={<PreGame />} />
              </Routes>
              </AgarTokenExperience>
            </AuthProvider>
      </ServerReadinessProvider>
    </Router>
  );
}

export default App;
