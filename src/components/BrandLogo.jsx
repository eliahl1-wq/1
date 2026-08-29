import React from 'react';

export default function BrandLogo({ responsive = false, className = '', labelled = false }) {
    const classes = [
        'brand-lockup',
        responsive ? 'brand-lockup--responsive' : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <span
            className={classes}
            {...(labelled ? { role: 'img', 'aria-label': 'Arenifi' } : { 'aria-hidden': true })}
        >
            <img
                className="brand-lockup__mark"
                src="/arenifi-mark-transparent.png"
                alt=""
                aria-hidden="true"
            />
            <span className="brand-lockup__name">
                <span>ARENI</span><span className="brand-lockup__accent">FI</span>
            </span>
        </span>
    );
}
