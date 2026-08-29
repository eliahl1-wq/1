import React from 'react';
import { AGAR, isAgarLaunchReady } from '../config/agarConfig';
import AgarLogo from './AgarLogo';
import { formatAgarAmount } from '../formatAgarAmount';

const CARD_METRICS = [
    ['Price', 'price'],
    ['24h', 'priceChange24h'],
    ['Market Cap', 'marketCap'],
    ['Volume', 'volume24h'],
    ['Liquidity', 'liquidity'],
];

function compactUsd(value) {
    if (!Number.isFinite(value)) return '--';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 2,
    }).format(value);
}

function metricValue(key, value, launchReady, comingSoon) {
    if (!launchReady) return comingSoon;
    if (key === 'priceChange24h') {
        return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : '--';
    }
    return compactUsd(value);
}

export default function AgarTokenCard({
    snapshot,
    walletConnected,
    walletBalance,
    balanceLoading,
    onOpen,
    config = AGAR,
}) {
    const launchReady = isAgarLaunchReady(config);

    return (
        <button
            type="button"
            className="agar-token-card"
            onClick={onOpen}
            aria-label={`Open ${config.symbol} token details`}
        >
            <span className="agar-token-card__header">
                <AgarLogo size={40} config={config} />
                <span className="agar-token-card__identity">
                    <span className="agar-token-card__eyebrow">AgarStake token</span>
                    <span className="agar-token-card__name">
                        {config.name}
                        <span>{config.symbol}</span>
                    </span>
                </span>
                <span className={`agar-token-card__status${launchReady ? ' is-live' : ''}`}>
                    {launchReady ? 'Live' : config.messages.comingSoon}
                </span>
            </span>

            <span className="agar-token-card__metrics">
                {CARD_METRICS.map(([label, key]) => (
                    <span className="agar-token-card__metric" key={key}>
                        <span>{label}</span>
                        <strong className={key === 'priceChange24h' && snapshot[key] < 0 ? 'is-negative' : ''}>
                            {metricValue(key, snapshot[key], launchReady, config.messages.comingSoon)}
                        </strong>
                    </span>
                ))}
            </span>

            <span className="agar-token-card__footer">
                {walletConnected && (
                    <span className="agar-token-card__balance">
                        <span>{config.symbol} Balance</span>
                        <strong>
                            {!launchReady
                                ? config.messages.comingSoon
                                : balanceLoading
                                    ? '…'
                                    : formatAgarAmount(walletBalance)}
                            {launchReady ? ` ${config.symbol}` : ''}
                        </strong>
                    </span>
                )}
                <span className="agar-token-card__open">
                    View token
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="m7 4 6 6-6 6" />
                    </svg>
                </span>
            </span>
        </button>
    );
}
