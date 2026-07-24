import React, { useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AGAR } from '../config/agarConfig';
import { useAgarMarketData } from '../market/useAgarMarketData';
import { useAgarBalance } from '../wallet/useAgarBalance';
import AgarTokenModal from './AgarTokenModal';
import { AgarTokenContext } from './AgarTokenContext';
import { useAuth } from '../../../context/AuthContext';
import './agar.css';

const HIDDEN_ROUTES = new Set(['/game', '/slither-game', '/surviv-game']);

export default function AgarTokenExperience({ children, config = AGAR }) {
    const location = useLocation();
    const [modalOpen, setModalOpen] = useState(false);
    const [initialAction, setInitialAction] = useState('');
    const { user, token } = useAuth();
    const market = useAgarMarketData(config);
    const wallet = useAgarBalance(config, user?.depositAddress || '');

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
    }), [
        closeModal,
        market.launchReady,
        market.loading,
        market.snapshot,
        openAgarModal,
        wallet.balance,
        wallet.loading,
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
                    config={config}
                />
            )}
        </AgarTokenContext.Provider>
    );
}
