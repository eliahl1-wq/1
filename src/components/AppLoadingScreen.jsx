import React from 'react';

export default function AppLoadingScreen() {
    return (
        <div className="app-loading" role="status" aria-label="Loading">
            <div className="app-loading-brand">
                <div className="logo-dot" />
                <span className="app-loading-name">
                    AGAR<span className="logo-accent">STAKE</span>
                </span>
            </div>
            <span className="spinner app-loading-spinner" />
        </div>
    );
}
