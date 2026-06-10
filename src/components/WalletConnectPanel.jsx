import React, { useCallback, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
    getConnectableWallets,
    getSuggestedInstalls,
    getWalletDisplay,
    shortAddress,
} from '../lib/walletUtils';

export default function WalletConnectPanel({ onStatusChange, compact = false }) {
    const { wallets, select, connect, disconnect, connected, connecting, publicKey, wallet } = useWallet();
    const [connectError, setConnectError] = useState('');
    const [activeName, setActiveName] = useState(null);

    const available = useMemo(() => getConnectableWallets(wallets), [wallets]);
    const installSuggestions = useMemo(() => getSuggestedInstalls(wallets), [wallets]);

    const notify = useCallback((msg) => {
        onStatusChange?.(msg);
    }, [onStatusChange]);

    const handleConnect = useCallback(async (walletName) => {
        setConnectError('');
        setActiveName(walletName);
        notify(`Opening ${getWalletDisplay(walletName).label}…`);
        try {
            select(walletName);
            await connect();
            notify('');
        } catch (err) {
            const msg = err?.message || 'Connection failed';
            if (msg.includes('User rejected') || msg.includes('rejected')) {
                setConnectError('Connection cancelled in wallet.');
            } else {
                setConnectError(msg);
            }
            notify('');
        } finally {
            setActiveName(null);
        }
    }, [select, connect, notify]);

    const handleDisconnect = useCallback(async () => {
        setConnectError('');
        try {
            await disconnect();
            notify('');
        } catch (err) {
            setConnectError(err?.message || 'Could not disconnect');
        }
    }, [disconnect, notify]);

    if (connected && publicKey) {
        const info = getWalletDisplay(wallet?.adapter?.name || 'Wallet');
        return (
            <div className={`wallet-connect-panel${compact ? ' compact' : ''}`}>
                <div className="wallet-connected-card">
                    <div className="wallet-connected-top">
                        <span className="wallet-connected-icon">{info.icon}</span>
                        <div className="wallet-connected-meta">
                            <span className="wallet-connected-label">Connected</span>
                            <span className="wallet-connected-name">{info.label}</span>
                        </div>
                        <span className="wallet-connected-badge">✓</span>
                    </div>
                    <div className="wallet-connected-address mono">
                        {shortAddress(publicKey, 6)}
                    </div>
                    <button type="button" className="wallet-change-btn" onClick={handleDisconnect}>
                        Change wallet
                    </button>
                </div>
                {connectError && <div className="wallet-connect-error">{connectError}</div>}
            </div>
        );
    }

    return (
        <div className={`wallet-connect-panel${compact ? ' compact' : ''}`}>
            <div className="wallet-connect-header">
                <span className="wallet-connect-step">1</span>
                <div>
                    <div className="wallet-connect-title">Connect your wallet</div>
                    <div className="wallet-connect-sub">
                        {available.length > 0
                            ? `${available.length} wallet${available.length === 1 ? '' : 's'} detected on this device`
                            : 'No wallet extension detected'}
                    </div>
                </div>
            </div>

            {available.length > 0 ? (
                <div className="wallet-picker-list">
                    {available.map(w => {
                        const info = getWalletDisplay(w.adapter.name);
                        const isLoading = connecting && activeName === w.adapter.name;
                        return (
                            <button
                                key={w.adapter.name}
                                type="button"
                                className="wallet-picker-item"
                                disabled={connecting}
                                onClick={() => handleConnect(w.adapter.name)}
                            >
                                <span className="wallet-picker-icon">{info.icon}</span>
                                <span className="wallet-picker-text">
                                    <span className="wallet-picker-name">{info.label}</span>
                                    <span className="wallet-picker-desc">{info.description}</span>
                                </span>
                                <span className="wallet-picker-action">
                                    {isLoading ? 'Connecting…' : 'Connect'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="wallet-none-detected">
                    Install a Solana wallet extension, or use the <strong>QR / Address</strong> tab to deposit manually.
                </div>
            )}

            {installSuggestions.length > 0 && (
                <div className="wallet-install-section">
                    <div className="wallet-install-label">Don't have a wallet?</div>
                    <div className="wallet-install-links">
                        {installSuggestions.map(name => {
                            const info = getWalletDisplay(name);
                            if (!info.installUrl) return null;
                            return (
                                <a
                                    key={name}
                                    href={info.installUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="wallet-install-link"
                                >
                                    {info.icon} Install {info.label}
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}

            {connectError && <div className="wallet-connect-error">{connectError}</div>}
        </div>
    );
}
