import { SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletConnectWalletAdapter } from "@solana/wallet-adapter-walletconnect";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";

import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

// Import your new components
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Lobby from "./pages/Lobby";
import Background from "./components/Background";

const endpoint =
  "https://mainnet.helius-rpc.com/?api-key=7d768414-9186-4fca-9443-9f445c44dc77";

export default function App() {
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),

    new SolflareWalletAdapter(),

    new WalletConnectWalletAdapter({
      network: "mainnet-beta",
      options: {
        projectId: "8b2f78d206bbaec981376e03d9d15376",
      },
    }),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider featuredWallets={3}>
          <AuthProvider>
            <Router>
              <Background />
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route 
                  path="/lobby" 
                  element={
                    <ProtectedRoute>
                      <Lobby />
                    </ProtectedRoute>
                  } 
                />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Router>
          </AuthProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}