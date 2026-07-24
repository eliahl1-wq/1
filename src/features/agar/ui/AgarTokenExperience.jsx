import React, { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AGAR } from '../config/agarConfig';
import { useAgarMarketData } from '../market/useAgarMarketData';
import { useAgarBalance } from '../wallet/useAgarBalance';
import AgarTokenCard from './AgarTokenCard';
import AgarTokenModal from './AgarTokenModal';
import './agar.css';

const HIDDEN_ROUTES = new Set(['/game', '/slither-game', '/surviv-game']);

export default function AgarTokenExperience({ config = AGAR }) {
    const location = useLocation();
    const [modalOpen, setModalOpen] = useState(false);
    const closeModal = useCallback(() => setModalOpen(false), []);
    const market = useAgarMarketData(config);
    const wallet = useAgarBalance(config);

    if (HIDDEN_ROUTES.has(location.pathname)) return null;

    return (
        <>
            <div className={`agar-token-float${location.pathname === '/pre-game' ? ' agar-token-float--pregame' : ''}`}>
                <AgarTokenCard
                    snapshot={market.snapshot}
                    walletConnected={wallet.connected}
                    walletBalance={wallet.balance}
                    balanceLoading={wallet.loading}
                    onOpen={() => setModalOpen(true)}
                    config={config}
                />
            </div>
            <AgarTokenModal
                open={modalOpen}
                onClose={closeModal}
                snapshot={market.snapshot}
                marketLoading={market.loading}
                marketError={market.error}
                walletBalance={wallet.balance}
                balanceLoading={wallet.loading}
                balanceError={wallet.error}
                config={config}
            />
        </>
    );
}
