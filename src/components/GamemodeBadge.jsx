import React from 'react';

function FlameIcon() {
    return (
        <svg className="gm-mode-badge-flame" width="12" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M12 22c4.2-3.1 7-7.2 7-11.8C19 5.4 15.8 2 12 1 8.2 2 5 5.4 5 10.2 5 14.8 7.8 18.9 12 22z"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinejoin="round"
            />
            <path
                d="M12 17.5c1.9-1.4 3.2-3.2 3.2-5.2 0-1.6-.9-3-2.2-3.8-1.3.8-2.2 2.2-2.2 3.8 0 2 1.3 3.8 3.2 5.2z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function GamemodeBadge({ type }) {
    if (type === 'popular') {
        return (
            <span className="gm-mode-badge gm-mode-badge--popular" title="Popular">
                <FlameIcon />
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
