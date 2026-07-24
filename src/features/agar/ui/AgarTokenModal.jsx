import React, { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
    AGAR,
    buildAgarExternalUrl,
    isAgarLaunchReady,
} from '../config/agarConfig';
import { executeAgarSwap } from '../swap/agarSwap';
import AgarLogo from './AgarLogo';

const DETAIL_METRICS = [
    ['Price', 'price'],
    ['FDV', 'fdv'],
    ['Market Cap', 'marketCap'],
    ['Liquidity', 'liquidity'],
    ['Holders', 'holders'],
    ['24h Volume', 'volume24h'],
];

function formatMetric(key, value, launchReady, comingSoon) {
    if (!launchReady) return comingSoon;
    if (!Number.isFinite(value)) return '--';
    if (key === 'holders') return new Intl.NumberFormat('en-US').format(value);
    if (key === 'price' && value > 0 && value < 0.01) {
        return `$${value.toLocaleString('en-US', { maximumSignificantDigits: 5 })}`;
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: value >= 1_000 ? 'compact' : 'standard',
        maximumFractionDigits: value >= 1 ? 2 : 6,
    }).format(value);
}

function ExternalLink({ href, children }) {
    if (!href) {
        return (
            <button type="button" className="agar-modal__link" disabled>
                {children}
            </button>
        );
    }
    return (
        <a className="agar-modal__link" href={href} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    );
}

export default function AgarTokenModal({
    open,
    onClose,
    snapshot,
    marketLoading,
    marketError,
    walletBalance,
    balanceLoading,
    balanceError,
    config = AGAR,
}) {
    const wallet = useWallet();
    const { connection } = useConnection();
    const [notice, setNotice] = useState('');
    const launchReady = isAgarLaunchReady(config);

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.body.classList.add('agar-modal-open');
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.classList.remove('agar-modal-open');
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [onClose, open]);

    useEffect(() => {
        if (open) setNotice('');
    }, [open]);

    if (!open) return null;

    const handleTrade = async (side) => {
        if (!launchReady) {
            setNotice(config.messages.notLaunched);
            return;
        }
        if (!wallet.connected) {
            setNotice('Connect a wallet before swapping AGAR.');
            return;
        }
        try {
            setNotice(`Preparing ${side.toLowerCase()}…`);
            await executeAgarSwap({ side, wallet, connection, config });
            setNotice('');
        } catch (error) {
            setNotice(error.message || 'AGAR swaps are unavailable.');
        }
    };

    const copyContract = async () => {
        if (!launchReady) {
            setNotice(config.messages.notLaunched);
            return;
        }
        try {
            await navigator.clipboard.writeText(config.mint);
            setNotice('Contract address copied.');
        } catch {
            setNotice('Could not copy the contract address.');
        }
    };

    const chartUrl = buildAgarExternalUrl(config.marketData.chartUrl, config);
    const axiomUrl = buildAgarExternalUrl(config.links.axiom, config);
    const dexScreenerUrl = buildAgarExternalUrl(config.links.dexScreener, config);
    const birdeyeUrl = buildAgarExternalUrl(config.links.birdeye, config);

    return (
        <div className="agar-modal-backdrop" role="presentation" onMouseDown={onClose}>
            <section
                className="agar-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="agar-modal-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="agar-modal__header">
                    <div className="agar-modal__identity">
                        <AgarLogo size={48} config={config} />
                        <div>
                            <span className="agar-modal__eyebrow">AgarStake ecosystem</span>
                            <h2 id="agar-modal-title">
                                {config.name}
                                <span>{config.symbol}</span>
                            </h2>
                        </div>
                    </div>
                    <button type="button" className="agar-modal__close" onClick={onClose} aria-label="Close AGAR details">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                    </button>
                </header>

                <div className="agar-modal__body">
                    <div className="agar-modal__chart">
                        <div className="agar-modal__chart-topline">
                            <span>Chart</span>
                            <span>{launchReady && marketLoading ? 'Loading…' : launchReady ? 'Live' : config.messages.comingSoon}</span>
                        </div>
                        {launchReady && chartUrl ? (
                            <iframe
                                className="agar-modal__chart-frame"
                                src={chartUrl}
                                title={`${config.symbol} live chart`}
                                loading="lazy"
                                referrerPolicy="strict-origin-when-cross-origin"
                            />
                        ) : (
                            <div className="agar-modal__chart-placeholder">
                                <div className="agar-modal__chart-grid" aria-hidden="true" />
                                <svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-hidden="true">
                                    <path d="M0 190 C70 178 90 142 155 155 S250 118 315 130 S415 66 480 82 S595 28 700 42" />
                                </svg>
                                <strong>{config.messages.comingSoon}</strong>
                                <span>{config.symbol} / USD</span>
                            </div>
                        )}
                    </div>

                    <aside className="agar-modal__trade-panel">
                        <div className="agar-modal__wallet-row">
                            <span>AGAR Balance</span>
                            <strong>
                                {wallet.connected
                                    ? `${balanceLoading ? '…' : walletBalance.toLocaleString('en-US', { maximumFractionDigits: config.decimals })} ${config.symbol}`
                                    : `0 ${config.symbol}`}
                            </strong>
                        </div>
                        {!wallet.connected && <WalletMultiButton />}
                        {balanceError && launchReady && <span className="agar-modal__micro-status">{balanceError}</span>}

                        <div className="agar-modal__trade-placeholder">
                            <span>You pay</span>
                            <div>
                                <strong>--</strong>
                                <span>Token</span>
                            </div>
                        </div>
                        <div className="agar-modal__trade-placeholder">
                            <span>You receive</span>
                            <div>
                                <strong>--</strong>
                                <span>{config.symbol}</span>
                            </div>
                        </div>

                        <div className="agar-modal__trade-actions">
                            <button type="button" className="agar-modal__trade agar-modal__trade--buy" onClick={() => handleTrade('BUY')}>
                                Buy {config.symbol}
                            </button>
                            <button type="button" className="agar-modal__trade agar-modal__trade--sell" onClick={() => handleTrade('SELL')}>
                                Sell {config.symbol}
                            </button>
                        </div>

                        {notice && <div className="agar-modal__notice" role="status">{notice}</div>}
                    </aside>

                    <div className="agar-modal__stats">
                        {DETAIL_METRICS.map(([label, key]) => (
                            <div className="agar-modal__stat" key={key}>
                                <span>{label}</span>
                                <strong>{formatMetric(key, snapshot[key], launchReady, config.messages.comingSoon)}</strong>
                            </div>
                        ))}
                    </div>

                    <div className="agar-modal__links">
                        <button type="button" className="agar-modal__link" onClick={copyContract}>
                            Copy contract
                        </button>
                        <ExternalLink href={axiomUrl}>View on Axiom</ExternalLink>
                        <ExternalLink href={dexScreenerUrl}>View on DexScreener</ExternalLink>
                        <ExternalLink href={birdeyeUrl}>View on Birdeye</ExternalLink>
                    </div>

                    {marketError && launchReady && <div className="agar-modal__provider-status">{marketError}</div>}
                    {!launchReady && (
                        <div className="agar-modal__launch-note">
                            <span className="agar-modal__launch-dot" />
                            Contract not configured · All AGAR features remain disabled
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
