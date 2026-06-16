import React from 'react';

function BackIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function GameSpectateHud({ onBack }) {
    return (
        <div className="game-spectate-hud">
            <button type="button" className="game-spectate-back" onClick={onBack}>
                <BackIcon />
                Back
            </button>
            <span className="game-spectate-label">Spectating</span>
        </div>
    );
}
