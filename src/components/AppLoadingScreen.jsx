import React from 'react';
import BrandLogo from './BrandLogo';

export default function AppLoadingScreen() {
    return (
        <div className="app-loading" role="status" aria-label="Loading">
            <div className="app-loading-brand">
                <BrandLogo className="brand-lockup--loading" labelled />
            </div>
            <span className="spinner app-loading-spinner" />
        </div>
    );
}
