import React, { useState } from 'react';
import { AGAR } from '../config/agarConfig';

export default function AgarLogo({ size = 42, config = AGAR }) {
    const [failed, setFailed] = useState(false);

    if (failed || !config.logoUrl) {
        return (
            <span
                className="agar-logo agar-logo--fallback"
                style={{ width: size, height: size }}
                aria-label={`${config.name} logo`}
            >
                {config.symbol.slice(0, 1)}
            </span>
        );
    }

    return (
        <span
            className="agar-logo"
            style={{ width: size, height: size }}
        >
            <img
                className="agar-logo__image"
                src={config.logoUrl}
                alt={config.name + ' logo'}
                onError={() => setFailed(true)}
            />
        </span>
    );
}
