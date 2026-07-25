import React from 'react';
import { useNavigate } from 'react-router-dom';
import GamemodePreview from './GamemodePreview';
import GamemodeBadge from './GamemodeBadge';
import { dismissDiscoveryPrompt, pickDiscoveryModes } from '../constants/gamemodes';

export default function GamemodeDiscoveryPrompt({
    currentMode,
    brAvailable,
    playersByGamemode = {},
    onSelectMode,
    onDismiss,
}) {
    const navigate = useNavigate();
    const modes = pickDiscoveryModes(currentMode, brAvailable, 3);

    if (modes.length === 0) return null;

    const playingKey = {
        agar: 'agar',
        slither: 'slither',
        'competitive-slither': 'competitiveSlither',
        surviv: 'surviv',
        'br-agar': 'brAgar',
        'br-slither': 'brSlither',
    };

    const handleDismiss = () => {
        dismissDiscoveryPrompt();
        onDismiss?.();
    };

    const handleSelect = (modeId) => {
        localStorage.setItem('selected_gamemode', modeId);
        onSelectMode?.(modeId);
        handleDismiss();
    };

    return (
        <div className="gm-discovery" role="dialog" aria-label="Discover other gamemodes">
            <div className="gm-discovery-header">
                <div className="gm-discovery-header-left">
                    <span className="gm-discovery-label">Try another arena</span>
                    <button
                        type="button"
                        className="gm-discovery-modes-link"
                        onClick={() => navigate('/gamemodes')}
                    >
                        All modes
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                    </button>
                </div>
                <button
                    type="button"
                    className="gm-discovery-close"
                    onClick={handleDismiss}
                    onPointerUp={(event) => {
                        if (event.pointerType === 'touch' || event.pointerType === 'pen') {
                            event.preventDefault();
                            handleDismiss();
                        }
                    }}
                    aria-label="Close arena suggestions"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                </button>
            </div>

            <div className="gm-discovery-grid">
                {modes.map((mode) => {
                    const playing = playersByGamemode[playingKey[mode.id]];
                    return (
                        <button
                            key={mode.id}
                            type="button"
                            className="gm-discovery-tile"
                            onClick={() => handleSelect(mode.id)}
                        >
                            <div className="gm-discovery-preview">
                                <GamemodePreview mode={mode.id} className="gm-discovery-preview-img" />
                                {mode.badge && (
                                    <span className="gm-discovery-badge-wrap">
                                        <GamemodeBadge type={mode.badge} />
                                    </span>
                                )}
                            </div>
                            <div className="gm-discovery-tile-meta">
                                <span className="gm-discovery-tile-title">{mode.shortTitle}</span>
                                {playing != null && playing > 0 && (
                                    <span className="gm-discovery-tile-playing">
                                        <span className="live-dot" aria-hidden="true" />
                                        {playing}
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
