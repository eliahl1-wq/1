import React, { useId } from 'react';

function FlameIcon() {
    const gradId = useId();

    return (
        <svg className="gm-mode-badge-flame" width="11" height="13" viewBox="0 0 12 14" fill="none" aria-hidden="true">
            <path
                d="M6 13c2.5-1.8 4-3.8 4-6.5C10 3.2 8.2 1.5 6 0 3.8 1.5 2 3.2 2 6.5 2 9.2 3.5 11.2 6 13Z"
                fill={`url(#${gradId})`}
            />
            <path
                d="M6 10.5c1.2-.9 2-2 2-3.4 0-1.5-.9-2.6-2-3.4-1.1.8-2 1.9-2 3.4 0 1.4.8 2.5 2 3.4Z"
                fill="#FFD080"
                opacity="0.9"
            />
            <defs>
                <linearGradient id={gradId} x1="6" y1="0" x2="6" y2="13" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FF6B35" />
                    <stop offset="0.55" stopColor="#FF3B30" />
                    <stop offset="1" stopColor="#E62E00" />
                </linearGradient>
            </defs>
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
