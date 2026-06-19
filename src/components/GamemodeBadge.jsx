import React from 'react';

export default function GamemodeBadge({ type }) {
    if (type === 'popular') {
        return (
            <span className="gm-mode-badge gm-mode-badge--popular">
                Popular
            </span>
        );
    }

    if (type === 'new') {
        return (
            <span className="gm-mode-badge gm-mode-badge--new">
                New
            </span>
        );
    }

    return null;
}
