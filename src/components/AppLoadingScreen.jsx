import React from 'react';

export default function AppLoadingScreen() {
    return (
        <div className="app-loading" role="status" aria-label="Loading">
            <div className="app-loading-brand">
                <img src="/arenifi-logo.png" alt="Arenifi" />
            </div>
            <span className="spinner app-loading-spinner" />
        </div>
    );
}
