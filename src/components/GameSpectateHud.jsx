import React from 'react';

function BackIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function ChevronIcon({ right = false }) {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d={right ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'}
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function GameSpectateHud({
    onBack,
    targetName = '',
    isFollowing = false,
    onPrevious,
    onNext,
    onFreeCamera,
}) {
    const canChoosePlayer = typeof onPrevious === 'function' && typeof onNext === 'function';

    return (
        <div className="game-spectate-hud">
            <button type="button" className="game-spectate-back" onClick={onBack}>
                <BackIcon />
                Back
            </button>

            {canChoosePlayer && (
                <div className="game-spectate-player-picker">
                    <button
                        type="button"
                        className="game-spectate-switch"
                        onClick={onPrevious}
                        aria-label="Previous player"
                    >
                        <ChevronIcon />
                    </button>
                    <div className="game-spectate-target">
                        <span>{isFollowing ? 'Following' : 'Spectating'}</span>
                        <strong>{isFollowing ? targetName : 'Free camera'}</strong>
                    </div>
                    <button
                        type="button"
                        className="game-spectate-switch"
                        onClick={onNext}
                        aria-label="Next player"
                    >
                        <ChevronIcon right />
                    </button>
                    <button
                        type="button"
                        className={'game-spectate-free' + (isFollowing ? '' : ' is-active')}
                        onClick={onFreeCamera}
                    >
                        Free
                    </button>
                </div>
            )}

            {!canChoosePlayer && <span className="game-spectate-label">Spectating</span>}
        </div>
    );
}
