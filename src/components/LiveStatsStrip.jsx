import React from 'react';

function StatItem({ label, value, accent }) {
    return (
        <div className="stats-strip-item">
            <span className="stats-strip-label">{label}</span>
            <span className={`stats-strip-value mono${accent ? ` stats-strip-value--${accent}` : ''}`}>
                {value}
            </span>
        </div>
    );
}

export default function LiveStatsStrip({ playersOnline = 0, totalEarnings = 0, biggestWin = 0, inArena = 0 }) {
    const fmtUsd = (n) => {
        const v = Number(n) || 0;
        if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 10_000) return `$${Math.round(v).toLocaleString()}`;
        return `$${Math.round(v).toLocaleString()}`;
    };

    return (
        <div className="stats-strip" role="region" aria-label="Live arena stats">
            <StatItem label="Online now" value={playersOnline.toLocaleString()} accent="accent" />
            <div className="stats-strip-divider" aria-hidden="true" />
            <StatItem label="In arena" value={inArena.toLocaleString()} />
            <div className="stats-strip-divider" aria-hidden="true" />
            <StatItem label="Total cashed out" value={fmtUsd(totalEarnings)} accent="green" />
            {biggestWin > 0 && (
                <>
                    <div className="stats-strip-divider" aria-hidden="true" />
                    <StatItem label="Biggest win" value={fmtUsd(biggestWin)} accent="yellow" />
                </>
            )}
        </div>
    );
}
