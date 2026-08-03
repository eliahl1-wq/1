import React, { useLayoutEffect, useRef } from 'react';
import GamemodeBadge from './GamemodeBadge';
import GamemodePreview from './GamemodePreview';
import { GAMEMODE_CATALOG } from '../constants/gamemodes';

const MODE_PRESENTATION = Object.freeze({
    agar: { name: 'Agar', subtype: 'Normal' },
    slither: { name: 'Slither', subtype: 'Normal' },
    'competitive-slither': { name: 'Slither', subtype: 'Arena' },
    surviv: { name: 'Surviv', subtype: 'Normal' },
    'br-agar': { name: 'Agar', subtype: 'Battle Royale' },
    'br-slither': { name: 'Slither', subtype: 'Battle Royale' },
});

const PLAYING_KEYS = Object.freeze({
    agar: 'agar',
    slither: 'slither',
    'competitive-slither': 'competitiveSlither',
    surviv: 'surviv',
    'br-agar': 'brAgar',
    'br-slither': 'brSlither',
});

export function getGamemodePlayingCount(playersByGamemode, modeId) {
    const key = PLAYING_KEYS[modeId];
    const value = key ? Number(playersByGamemode?.[key]) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
}

export default function PregameGamemodeSelector({
    selectedMode,
    brAvailable,
    playersByGamemode,
    heroPlayingCount,
    entryFeeLabel,
    onSelectMode,
    cardRef,
}) {
    const selectedPresentation = MODE_PRESENTATION[selectedMode] || MODE_PRESENTATION.agar;
    const railRef = useRef(null);

    const scrollModes = (direction) => {
        railRef.current?.scrollBy({
            left: direction * Math.max(railRef.current.clientWidth * 0.62, 150),
            behavior: 'smooth',
        });
    };

    useLayoutEffect(() => {
        const rail = railRef.current;
        const selectedCard = rail?.querySelector('.mode-mini-card[aria-pressed="true"]');
        if (!rail || !selectedCard) return undefined;

        const railRect = rail.getBoundingClientRect();
        const cardRect = selectedCard.getBoundingClientRect();
        const targetLeft = rail.scrollLeft
            + (cardRect.left + cardRect.width / 2)
            - (railRect.left + railRect.width / 2);
        rail.scrollLeft = targetLeft;
        return undefined;
    }, [selectedMode]);
    return (
        <section className="mode-card mode-selector-card" ref={cardRef} aria-label="Choose gamemode">
            <div className="mode-selector-hero">
                <GamemodePreview mode={selectedMode} className="mode-card-preview" />
                <div className="mode-card-overlay mode-selector-hero-overlay">
                    <div className="mode-card-header">
                        <span className="mode-card-label">Gamemode</span>
                        <div className="mode-card-title mode-card-title--stacked">
                            {selectedPresentation.name.toUpperCase()}
                        </div>
                        <div className="mode-card-subtitle">{selectedPresentation.subtype}</div>
                    </div>

                    <div className="mode-selector-hero-footer">
                        <div className="mode-playing-count">
                            <span className="live-dot" aria-hidden="true" />
                            <span>Playing: <span className="mono">{heroPlayingCount}</span></span>
                        </div>
                        <div className="mode-selector-fee">
                            <span>Entry fee</span>
                            <strong className="mono">{entryFeeLabel}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mode-selector-grid-wrap">
                <div className="mode-selector-grid-heading">
                    <span>Gamemodes</span>
                    <small>Use arrows to browse</small>
                </div>
                <div className="mode-selector-carousel">
                    <button
                        type="button"
                        className="mode-selector-arrow mode-selector-arrow--left"
                        aria-label="Previous gamemodes"
                        onClick={() => scrollModes(-1)}
                    >
                        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 4.5-5 5.5 5 5.5" /></svg>
                    </button>
                    <div className="mode-selector-grid" ref={railRef}>
                    {GAMEMODE_CATALOG.map((mode) => {
                        const selected = mode.id === selectedMode;
                        const comingSoon = !!mode.brOnly && !brAvailable;
                        const presentation = MODE_PRESENTATION[mode.id] || { name: mode.shortTitle, subtype: '' };
                        const playing = getGamemodePlayingCount(playersByGamemode, mode.id);

                        return (
                            <button
                                key={mode.id}
                                type="button"
                                className={`mode-mini-card${selected ? ' mode-mini-card--selected' : ''}${comingSoon ? ' mode-mini-card--coming-soon' : ''}`}
                                disabled={comingSoon}
                                aria-pressed={selected}
                                onClick={() => onSelectMode(mode.id)}
                            >
                                <span className="mode-mini-card-preview">
                                    <GamemodePreview mode={mode.id} className="mode-mini-card-preview-canvas" fit />
                                </span>
                                {mode.badge && !comingSoon && (
                                    <span className="mode-mini-card-badge"><GamemodeBadge type={mode.badge} /></span>
                                )}
                                <span className="mode-mini-card-copy">
                                    <span className="mode-mini-card-title-row">
                                        <strong>{presentation.name}</strong>
                                    </span>
                                    <span className="mode-mini-card-subtype">{presentation.subtype}</span>
                                    <span className="mode-mini-card-playing">
                                        <i aria-hidden="true" />
                                        {comingSoon ? 'Coming soon' : `Playing: ${playing}`}
                                    </span>
                                </span>
                                {selected && (
                                    <span className="mode-mini-card-check" aria-label="Selected">
                                        <svg viewBox="0 0 16 16" aria-hidden="true">
                                            <path d="m4 8.2 2.4 2.4L12.2 5" />
                                        </svg>
                                    </span>
                                )}
                            </button>
                        );
                    })}
                    </div>
                    <button
                        type="button"
                        className="mode-selector-arrow mode-selector-arrow--right"
                        aria-label="Next gamemodes"
                        onClick={() => scrollModes(1)}
                    >
                        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 4.5 5 5.5-5 5.5" /></svg>
                    </button>
                </div>
            </div>
        </section>
    );
}
