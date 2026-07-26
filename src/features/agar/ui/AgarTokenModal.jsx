import React, { useEffect, useState } from 'react';
import {
    AGAR,
    buildAgarExternalUrl,
    isAgarLaunchReady,
} from '../config/agarConfig';
import { executeAgarSwap } from '../swap/agarSwap';
import AgarLogo from './AgarLogo';
import AgarPriceChart from './AgarPriceChart';

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

function shortAddress(address) {
    if (!address) return 'Not available';
    return `${address.slice(0, 5)}…${address.slice(-5)}`;
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
    initialAction = '',
    snapshot,
    marketLoading,
    marketError,
    walletBalance,
    balanceLoading,
    balanceError,
    accountAddress,
    accountSolBalance,
    accountSolPrice,
    authToken,
    config = AGAR,
}) {
    const [notice, setNotice] = useState('');
    const [tradeSide, setTradeSide] = useState(initialAction === 'SELL' ? 'SELL' : 'BUY');
    const [tradeAmount, setTradeAmount] = useState('');
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
        if (!open) return;
        setTradeSide(initialAction === 'SELL' ? 'SELL' : 'BUY');
        setTradeAmount('');
        setNotice(initialAction && !launchReady ? config.messages.notLaunched : '');
    }, [config.messages.notLaunched, initialAction, launchReady, open]);

    if (!open) return null;

    const handleTrade = async (side) => {
        if (!launchReady) {
            setNotice(config.messages.notLaunched);
            return;
        }
        if (!accountAddress || !authToken) {
            setNotice('Your AgarStake account wallet is not available.');
            return;
        }
        const parsedAmount = Number(tradeAmount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            setNotice(`Enter a valid ${side === 'BUY' ? 'SOL' : config.symbol} amount.`);
            return;
        }
        try {
            setNotice(`Preparing ${side.toLowerCase()}…`);
            await executeAgarSwap({
                side,
                amount: parsedAmount,
                accountAddress,
                authToken,
                config,
            });
            setNotice('Swap submitted.');
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

    const parsedTradeAmount = Number(tradeAmount);
    const agarPrice = Number(snapshot.price);
    const solPrice = Number(accountSolPrice);
    const estimatedOutput = Number.isFinite(parsedTradeAmount)
        && parsedTradeAmount > 0
        && Number.isFinite(agarPrice)
        && agarPrice > 0
        && Number.isFinite(solPrice)
        && solPrice > 0
        ? tradeSide === 'BUY'
            ? parsedTradeAmount * solPrice / agarPrice
            : parsedTradeAmount * agarPrice / solPrice
        : null;


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
                                {config.symbol}
                                <span>{config.name}</span>
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
                        <AgarPriceChart launchReady={launchReady} />
                    </div>

                    <aside className={`agar-modal__trade-panel${initialAction === 'BUY' ? ' is-buy-intent' : ''}`}>
                        <div className="agar-modal__account-wallet">
                            <div>
                                <span>Account wallet</span>
                                <strong className="mono" title={accountAddress}>
                                    {shortAddress(accountAddress)}
                                </strong>
                            </div>
                            <span className="agar-modal__account-lock" title="Locked to your AgarStake account">
                                Account linked
                            </span>
                        </div>

                        <div className="agar-modal__wallet-row">
                            <span>{config.symbol} Balance</span>
                            <strong>
                                {balanceLoading
                                    ? `… ${config.symbol}`
                                    : `${walletBalance.toLocaleString('en-US', { maximumFractionDigits: config.decimals })} ${config.symbol}`}
                            </strong>
                        </div>
                        <div className="agar-modal__wallet-row">
                            <span>SOL Balance</span>
                            <strong>{Number(accountSolBalance || 0).toFixed(4)} SOL</strong>
                        </div>
                        {balanceError && launchReady && <span className="agar-modal__micro-status">{balanceError}</span>}

                        <div className="agar-modal__trade-side-tabs">
                            <button
                                type="button"
                                className={tradeSide === 'BUY' ? 'active' : ''}
                                onClick={() => { setTradeSide('BUY'); setNotice(''); }}
                            >
                                Buy
                            </button>
                            <button
                                type="button"
                                className={tradeSide === 'SELL' ? 'active' : ''}
                                onClick={() => { setTradeSide('SELL'); setNotice(''); }}
                            >
                                Sell
                            </button>
                        </div>

                        <label className="agar-modal__trade-placeholder">
                            <span>You pay</span>
                            <div>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={tradeAmount}
                                    onChange={(event) => setTradeAmount(event.target.value)}
                                />
                                <span>{tradeSide === 'BUY' ? 'SOL' : config.symbol}</span>
                            </div>
                        </label>
                        <div className="agar-modal__trade-placeholder">
                            <span>Estimated receive</span>
                            <div>
                                <strong>
                                    {estimatedOutput == null
                                        ? '--'
                                        : estimatedOutput.toLocaleString('en-US', { maximumSignificantDigits: 7 })}
                                </strong>
                                <span>{tradeSide === 'BUY' ? config.symbol : 'SOL'}</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            className={`agar-modal__trade ${tradeSide === 'BUY' ? 'agar-modal__trade--buy' : 'agar-modal__trade--sell'}`}
                            onClick={() => handleTrade(tradeSide)}
                        >
                            {tradeSide === 'BUY' ? `Buy ${config.symbol}` : `Sell ${config.symbol}`}
                        </button>

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
