import React from 'react';

function BackIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 4.5 7 10l5.5 5.5M7.5 10H17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function ProductPageHeader({
    eyebrow = 'Arenifi',
    title,
    description,
    onBack,
    actions,
    className = '',
}) {
    return (
        <header className={`product-page-header ${className}`.trim()}>
            <div className="product-page-header__copy">
                {eyebrow && <p className="product-page-header__eyebrow">{eyebrow}</p>}
                <h1 className="product-page-header__title">{title}</h1>
                {description && <p className="product-page-header__description">{description}</p>}
            </div>
            {(actions || onBack) && (
                <div className="product-page-header__actions">
                    {actions}
                    {onBack && (
                        <button className="btn btn-ghost product-page-header__back" type="button" onClick={onBack}>
                            <BackIcon />
                            <span>Back</span>
                        </button>
                    )}
                </div>
            )}
        </header>
    );
}
