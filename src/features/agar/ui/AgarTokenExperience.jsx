import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AGAR } from '../config/agarConfig';
import { useAgarMarketData } from '../market/useAgarMarketData';
import { useAgarBalance } from '../wallet/useAgarBalance';
import AgarTokenModal from './AgarTokenModal';
import { AgarTokenContext } from './AgarTokenContext';
import { useAuth } from '../../../context/AuthContext';
import { API_URL } from '../../../utils/apiBase';
import './agar.css';

const HIDDEN_ROUTES = new Set(['/game', '/slither-game', '/surviv-game']);

export default function AgarTokenExperience({ children, config = AGAR }) {
    const location = useLocation();
    const [modalOpen, setModalOpen] = useState(false);
    const [initialAction, setInitialAction] = useState('');
    const [publicConfig, setPublicConfig] = useState(null);
    const { user, token } = useAuth();

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const response = await fetch(`${API_URL}/api/agar/config`, { cache: 'no-store' });
                if (!response.ok) return;
                const payload = await response.json();
                if (active) setPublicConfig(payload);
            } catch {
                // Build-time configuration remains the safe Coming Soon fallback.
            }
        };
        load();
        const interval = window.setInterval(load, 30_000);
        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, []);

    const runtimeConfig = useMemo(() => ({
        ...config,
        enabled: publicConfig?.enabled ?? config.enabled,
        mint: publicConfig?.mint ?? config.mint,
        decimals: publicConfig?.decimals ?? config.decimals,
        name: publicConfig?.name ?? config.name,
        symbol: publicConfig?.symbol ?? config.symbol,
    }), [config, publicConfig]);
    const market = useAgarMarketData(runtimeConfig);
    const wallet = useAgarBalance(runtimeConfig, user?.depositAddress || '');

    const openAgarModal = useCallback(({ action = '' } = {}) => {
        setInitialAction(action);
        setModalOpen(true);
    }, []);
    const closeModal = useCallback(() => {
        setModalOpen(false);
        setInitialAction('');
    }, []);

    const contextValue = useMemo(() => ({
        openAgarModal,
        closeAgarModal: closeModal,
        snapshot: market.snapshot,
        marketLoading: market.loading,
        launchReady: market.launchReady,
        walletBalance: wallet.balance,
        balanceLoading: wallet.loading,
        refreshAgarBalance: wallet.refresh,
        config: runtimeConfig,
        publicConfig,
    }), [
        closeModal,
        market.launchReady,
        market.loading,
        market.snapshot,
        openAgarModal,
        publicConfig,
        runtimeConfig,
        wallet.balance,
        wallet.loading,
        wallet.refresh,
    ]);

    const modalHidden = HIDDEN_ROUTES.has(location.pathname);

    return (
        <AgarTokenContext.Provider value={contextValue}>
            {children}
            {!modalHidden && (
                <AgarTokenModal
                    open={modalOpen}
                    onClose={closeModal}
                    initialAction={initialAction}
                    snapshot={market.snapshot}
                    marketLoading={market.loading}
                    marketError={market.error}
                    walletBalance={wallet.balance}
                    balanceLoading={wallet.loading}
                    balanceError={wallet.error}
                    accountAddress={user?.depositAddress || ''}
                    accountSolBalance={Number(user?.balanceSol ?? user?.balance ?? 0) || 0}
                    accountSolPrice={Number(user?.solPrice) || 0}
                    authToken={token}
                    config={runtimeConfig}
                />
            )}
        </AgarTokenContext.Provider>
    );
}