import React from 'react';

const LABELS = {
    popular: 'Popular',
    new: 'New',
};

export default function GamemodeBadge({ type }) {
    if (!type || !LABELS[type]) return null;
    return (
        <span className={`gm-mode-badge gm-mode-badge--${type}`}>
            {LABELS[type]}
        </span>
    );
}
