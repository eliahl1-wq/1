import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppTopbar from '../components/AppTopbar';
import Background from '../components/Background';
import AgarLogo from '../features/agar/ui/AgarLogo';
import { useAgarToken } from '../features/agar/ui/AgarTokenContext';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/apiBase';
import { formatAgarAmount } from '../features/agar/formatAgarAmount';
import { flagSkinValue, DEFAULT_FLAG_CODE } from '../constants/flagSkins';
import { SLITHER_SPECIAL_SKINS, getSlitherSpecialSkin } from '../constants/slitherSpecialSkins';
import { AgarBlobPreview, SnakeSkinPreview } from './PreGame';
import '../styles/shop.css';
import '../styles/shopV2.css';
import '../styles/slitherSpecialSkins.css';

function authHeaders(token, json = false) {
    return {
        Authorization: `Bearer ${token}`,
        ...(json ? { 'Content-Type': 'application/json' } : {}),
    };
}

function getProductDisplayName(product) {
    return product?.name || 'Skin';
}

function RainbowPreview({ mode, nickname }) {
    return (
        <div className={`shop-rainbow-preview shop-rainbow-preview--${mode}`} aria-hidden="true">
            {mode === 'agar' ? (
                <AgarBlobPreview color="random" isLarge={true} nickname={nickname} hideName />
            ) : (
                <SnakeSkinPreview color="random" isLarge={true} />
            )}
        </div>
    );
}

function FlagPackPreview() {
    return (
        <div className="shop-rainbow-preview shop-flag-preview" aria-hidden="true">
            <div className="shop-flag-scene shop-flag-scene--agar">
                <span className="shop-flag-scene-label">AGAR FLAGS</span>
                <div className="shop-flag-actor shop-flag-blob shop-flag-blob--main">
                    <AgarBlobPreview color="flag:se" isLarge hideName />
                </div>
                <div className="shop-flag-actor shop-flag-blob shop-flag-blob--medium">
                    <AgarBlobPreview color="flag:br" isLarge hideName />
                </div>
                <div className="shop-flag-actor shop-flag-blob shop-flag-blob--small">
                    <AgarBlobPreview color="flag:jp" isLarge hideName />
                </div>
            </div>
            <div className="shop-flag-scene shop-flag-scene--slither">
                <span className="shop-flag-scene-label">SLITHER FLAGS</span>
                <div className="shop-flag-actor shop-flag-snake shop-flag-snake--main">
                    <SnakeSkinPreview color="flag:us" isLarge />
                </div>
                <div className="shop-flag-actor shop-flag-snake shop-flag-snake--medium">
                    <SnakeSkinPreview color="flag:de" isLarge={false} />
                </div>
                <div className="shop-flag-actor shop-flag-snake shop-flag-snake--small">
                    <SnakeSkinPreview color="flag:gb" isLarge={false} />
                </div>
            </div>
        </div>
    );
}
function SpecialSlitherPreview({ skin }) {
    return (
        <div className={`shop-rainbow-preview shop-special-preview shop-special-preview--${skin.id}`} aria-hidden="true" style={{ '--special-skin-glow': skin.colors[4] }}>
            <div className="shop-special-preview-glow" />
            <SnakeSkinPreview color={skin.value} isLarge />
        </div>
    );
}

function ProductArtwork({ product, nickname }) {
    const specialSkin = getSlitherSpecialSkin(product?.skinId);
    if (!product) return null;
    if (product.skinId === 'flags') return <FlagPackPreview nickname={nickname} />;
    if (specialSkin) return <SpecialSlitherPreview skin={specialSkin} />;
    return <RainbowPreview mode={product.gameMode} nickname={nickname} />;
}

function ShopStatusIcon({ type }) {
    if (type === 'success') {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7.5 12.5 3 3 6-7" />
                <circle cx="12" cy="12" r="9" />
            </svg>
        );
    }

    if (type === 'error') {
        return (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5.5M12 16.5h.01" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5V12l3 2" />
        </svg>
    );
}
export default function Shop() {
    const navigate = useNavigate();
    const { token, user, refreshUser } = useAuth();
    const {
        walletBalance,
        balanceLoading,
        refreshAgarBalance,
        openAgarModal,
        config,
        publicConfig,
    } = useAgarToken();
    const [catalog, setCatalog] = useState(null);
    const [inventory, setInventory] = useState(null);
    const [quote, setQuote] = useState(null);
    const [busy, setBusy] = useState('');
    const [notice, setNotice] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');
    const [selectedProductId, setSelectedProductId] = useState('');

    const load = useCallback(async () => {
        const [catalogResponse, inventoryResponse] = await Promise.all([
            fetch(`${API_URL}/api/shop/catalog`, { cache: 'no-store', headers: authHeaders(token) }),
            fetch(`${API_URL}/api/shop/inventory`, {
                cache: 'no-store',
                headers: authHeaders(token),
            }),
        ]);
        const nextCatalog = await catalogResponse.json();
        const nextInventory = inventoryResponse.ok ? await inventoryResponse.json() : { entitlements: [], purchases: [] };
        setCatalog(nextCatalog);
        setInventory(nextInventory);
    }, [token]);

    useEffect(() => {
        document.title = 'Shop | Arenifi';
        load().catch(() => setNotice({ type: 'error', message: 'The shop could not be loaded.' }));
    }, [load]);

    useEffect(() => {
        if (!quote) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape' && !busy) setQuote(null);
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [busy, quote]);
    const ownedProducts = useMemo(() => {
        const products = new Set((inventory?.entitlements || []).map((entry) => entry.productId));
        if (user?.isAdmin) {
            (catalog?.products || []).forEach((product) => products.add(product.id));
        }
        return products;
    }, [catalog?.products, inventory, user?.isAdmin]);

    const requestQuote = async (productId) => {
        setBusy(productId);
        setNotice(null);
        try {
            const response = await fetch(`${API_URL}/api/shop/quote`, {
                method: 'POST',
                headers: authHeaders(token, true),
                body: JSON.stringify({ productId }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.message || 'Could not create a purchase quote.');
            setQuote(payload.quote);
        } catch (error) {
            setNotice({ type: 'error', message: error.message });
        } finally {
            setBusy('');
        }
    };

    const confirmPurchase = async () => {
        if (!quote || busy) return;
        setBusy(quote.productId);
        setNotice(null);
        try {
            const response = await fetch(`${API_URL}/api/shop/purchase`, {
                method: 'POST',
                headers: authHeaders(token, true),
                body: JSON.stringify({
                    quoteId: quote.id,
                    idempotencyKey: `shop_${crypto.randomUUID()}`,
                }),
            });
            const payload = await response.json();
            if (!response.ok && response.status !== 202) {
                throw new Error(payload.message || `${config.symbol} purchase failed.`);
            }
            setQuote(null);
            await Promise.all([load(), refreshAgarBalance(), refreshUser({ forceBalance: true })]);
            setNotice({
                type: response.status === 202 ? 'pending' : 'success',
                message: response.status === 202
                    ? 'Payment was broadcast and is being confirmed. Do not retry.'
                    : `${getSlitherSpecialSkin(quote?.skinId)?.name || (quote?.skinId === 'flags' ? 'Flag Pack' : 'Rainbow')} unlocked successfully.`,
            });
        } catch (error) {
            setNotice({ type: 'error', message: error.message });
        } finally {
            setBusy('');
        }
    };

    const useSkin = (product) => {
        const specialSkin = getSlitherSpecialSkin(product.skinId);
        if (specialSkin) {
            localStorage.setItem('selected_skin', specialSkin.value);
            navigate('/pre-game', { state: { mode: 'slither' } });
            return;
        }
        if (product.skinId === 'flags') {
            const flag = flagSkinValue(DEFAULT_FLAG_CODE);
            localStorage.setItem('selected_skin_agar', flag);
            localStorage.setItem('selected_skin', flag);
            navigate('/pre-game', { state: { mode: 'agar' } });
            return;
        }
        const storageKey = product.gameMode === 'agar' ? 'selected_skin_agar' : 'selected_skin';
        localStorage.setItem(storageKey, 'random');
        navigate('/pre-game', { state: { mode: product.gameMode } });
    };
    const agarAccess = publicConfig?.accessGranted === true;
    const shopReady = agarAccess && catalog?.ready === true && publicConfig?.shopReady === true;
    const products = useMemo(() => catalog?.products || [
        { id: 'flags:bundle', gameMode: 'all', skinId: 'flags', name: 'Flag Pack', usdPrice: 1 },
        { id: 'agar:rainbow', gameMode: 'agar', skinId: 'rainbow', name: 'Rainbow', usdPrice: 3 },
        { id: 'slither:rainbow', gameMode: 'slither', skinId: 'rainbow', name: 'Rainbow', usdPrice: 3 },
        ...SLITHER_SPECIAL_SKINS.map((skin) => ({ id: skin.productId, gameMode: 'slither', skinId: skin.id, name: skin.name, usdPrice: skin.usdPrice })),
    ], [catalog?.products]);
    const filteredProducts = useMemo(() => products.filter((product) => {
        if (activeFilter === 'owned') return ownedProducts.has(product.id);
        if (activeFilter === 'agar') return product.gameMode === 'agar' || product.gameMode === 'all';
        if (activeFilter === 'slither') return product.gameMode === 'slither' || product.gameMode === 'all';
        return true;
    }), [activeFilter, ownedProducts, products]);
    const ownedCount = products.filter((product) => ownedProducts.has(product.id)).length;
    const selectedProduct = filteredProducts.find((product) => product.id === selectedProductId) || filteredProducts[0] || null;
    const selectedOwned = selectedProduct ? ownedProducts.has(selectedProduct.id) : false;
    const selectedSpecialSkin = selectedProduct ? getSlitherSpecialSkin(selectedProduct.skinId) : null;

    useEffect(() => {
        if (!filteredProducts.length) return;
        if (!filteredProducts.some((product) => product.id === selectedProductId)) {
            setSelectedProductId(filteredProducts[0].id);
        }
    }, [filteredProducts, selectedProductId]);

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll shop-page">
            <Background />
            <AppTopbar />
            <main className="shop-shell shop-v2">
                <header className="shop-v2-header">
                    <div>
                        <p className="shop-kicker"><span /> ARENIFI COSMETICS</p>
                        <h1>Skin locker</h1>
                        <p>Preview the collection. Find your identity. Own it permanently.</p>
                    </div>
                    <section className="shop-balance-card" aria-label={`Your ${config.symbol} balance`}>
                        <div className="shop-balance-logo"><AgarLogo size={36} config={config} /></div>
                        <div className="shop-balance-copy">
                            <span>WALLET BALANCE</span>
                            <strong className="mono">{!agarAccess ? 'Coming Soon' : balanceLoading ? '...' : `${formatAgarAmount(walletBalance)} ${config.symbol}`}</strong>
                            <small>{agarAccess ? `${ownedCount}/${products.length} cosmetics owned` : 'Admin preview only'}</small>
                        </div>
                        <button type="button" className="shop-balance-add" aria-label={`Buy ${config.symbol}`} title={agarAccess ? `Buy ${config.symbol}` : 'Coming Soon'} disabled={!agarAccess} onClick={() => openAgarModal({ action: 'BUY' })}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                        </button>
                    </section>
                </header>
                {!shopReady && (
                    <div className="shop-launch-banner" role="status">
                        <div className="shop-banner-icon">
                            <ShopStatusIcon type="pending" />
                        </div>
                        <div>
                            <span>COMING SOON</span>
                            <p>{catalog?.reason || publicConfig?.shopReason || `The ${config.symbol} shop activates when the token launches.`}</p>
                        </div>
                    </div>
                )}

                {notice && (
                    <div
                        className={'shop-notice shop-notice--' + notice.type}
                        role={notice.type === 'error' ? 'alert' : 'status'}
                    >
                        <ShopStatusIcon type={notice.type} />
                        <span>{notice.message}</span>
                    </div>
                )}
                <div className="shop-v2-filters" role="group" aria-label="Filter shop items">
                    {[
                        ['all', 'All cosmetics', products.length],
                        ['agar', 'Agar', products.filter((p) => p.gameMode === 'agar' || p.gameMode === 'all').length],
                        ['slither', 'Slither', products.filter((p) => p.gameMode === 'slither' || p.gameMode === 'all').length],
                        ['owned', 'My locker', ownedCount],
                    ].map(([value, label, count]) => (
                        <button key={value} type="button" className={activeFilter === value ? 'is-active' : ''} aria-pressed={activeFilter === value} onClick={() => setActiveFilter(value)}>
                            <span>{label}</span><b className="mono">{count}</b>
                        </button>
                    ))}
                </div>

                {selectedProduct ? (
                    <section className="shop-v2-showcase" aria-labelledby="shop-selected-title">
                        <div className="shop-v2-details">
                            <div className="shop-v2-meta">
                                <span className="shop-mode-badge"><i />{selectedProduct.gameMode === 'all' ? 'AGAR + SLITHER' : selectedProduct.gameMode.toUpperCase()}</span>
                                <span className={'shop-availability' + (selectedOwned ? ' is-owned' : '')}>
                                    {selectedOwned && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 12.5 3 3 7-8" /></svg>}
                                    {!agarAccess ? 'COMING SOON' : selectedOwned ? 'OWNED' : 'PREMIUM'}
                                </span>
                            </div>
                            <div className="shop-v2-title">
                                <span>{selectedProduct.skinId === 'flags' ? 'COSMETIC BUNDLE' : 'PREMIUM SKIN'}</span>
                                <h2 id="shop-selected-title">{getProductDisplayName(selectedProduct)}</h2>
                                <p>{selectedProduct.skinId === 'flags'
                                    ? 'A complete collection of popular country flags for both Agar and Slither.'
                                    : selectedSpecialSkin
                                        ? selectedSpecialSkin.description
                                        : `An animated spectrum crafted exclusively for ${selectedProduct.gameMode === 'agar' ? 'Agar' : 'Slither'}.`}</p>
                            </div>
                            <div className="shop-v2-benefits">
                                <span><i /> Permanent unlock</span>
                                <span><i /> Account-bound</span>
                                <span><i /> Instant equip</span>
                            </div>
                            <div className="shop-v2-checkout">
                                <div>
                                    <span>PRICE</span>
                                    <strong className="mono">${Number(selectedProduct.usdPrice).toFixed(2)}</strong>
                                    <small className="mono">{selectedProduct.estimatedAgar ? `${selectedProduct.estimatedAgar} ${config.symbol}` : 'Live token quote'}</small>
                                </div>
                                {!agarAccess ? (
                                    <button type="button" className="shop-buy-button" disabled>Coming Soon</button>
                                ) : selectedOwned ? (
                                    <button type="button" className="shop-buy-button shop-buy-button--owned" onClick={() => useSkin(selectedProduct)}>
                                        Equip cosmetic<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                                    </button>
                                ) : (
                                    <button type="button" className="shop-buy-button" disabled={!shopReady || busy === selectedProduct.id} onClick={() => requestQuote(selectedProduct.id)}>
                                        {busy === selectedProduct.id && <span className="shop-button-spinner" aria-hidden="true" />}
                                        <span>{!shopReady ? 'Coming Soon' : busy === selectedProduct.id ? 'Preparing quote...' : `Unlock with ${config.symbol}`}</span>
                                        {shopReady && busy !== selectedProduct.id && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="shop-v2-stage" aria-label={`${getProductDisplayName(selectedProduct)} preview`}>
                            <div className="shop-v2-stage-grid" aria-hidden="true" />
                            <ProductArtwork product={selectedProduct} nickname={user?.username} />
                            <span className="shop-v2-stage-caption mono">LIVE PREVIEW / {selectedProduct.gameMode.toUpperCase()}</span>
                        </div>
                    </section>
                ) : (
                    <div className="shop-empty-state">
                        <span>0</span><h3>No owned skins yet</h3><p>Your unlocked cosmetics will appear here.</p><button type="button" onClick={() => setActiveFilter('all')}>Browse collection</button>
                    </div>
                )}

                {filteredProducts.length > 0 && (
                    <section className="shop-v2-rail" aria-labelledby="shop-collection-title">
                        <header><div><span>COLLECTION</span><h2 id="shop-collection-title">Select a cosmetic</h2></div><small>{filteredProducts.length} ITEMS</small></header>
                        <div className="shop-v2-rail-track">
                            {filteredProducts.map((product) => {
                                const owned = ownedProducts.has(product.id);
                                const selected = product.id === selectedProduct?.id;
                                return (
                                    <button key={product.id} type="button" className={'shop-v2-tile' + (selected ? ' is-selected' : '')} aria-pressed={selected} onClick={() => setSelectedProductId(product.id)}>
                                        <span className="shop-v2-tile-art"><ProductArtwork product={product} nickname={user?.username} /></span>
                                        <span className="shop-v2-tile-copy"><b>{getProductDisplayName(product)}</b><small>{product.gameMode === 'all' ? 'Agar + Slither' : product.gameMode}</small></span>
                                        <span className={'shop-v2-tile-status' + (owned ? ' is-owned' : '')}>{owned ? 'OWNED' : `$${Number(product.usdPrice).toFixed(2)}`}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}

                <section className="shop-economy-note" aria-labelledby="shop-economy-title">
                    <div className="shop-economy-intro">
                        <div className="shop-economy-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 3 4.5 6.5v5c0 4.6 3.1 7.8 7.5 9.5 4.4-1.7 7.5-4.9 7.5-9.5v-5L12 3Z" />
                                <path d="m8.8 12 2.1 2.1 4.4-4.6" />
                            </svg>
                        </div>
                        <div>
                            <p className="shop-kicker"><span /> TRANSPARENT DISTRIBUTION</p>
                            <h2 id="shop-economy-title">Where your {config.symbol} goes</h2>
                            <p>Every purchase is split automatically and verified on Solana before your cosmetic unlocks.</p>
                        </div>
                    </div>
                    <div className="shop-economy-breakdown">
                        <div className="shop-economy-stat">
                            <div><strong>90%</strong><span>{config.symbol} treasury</span></div>
                            <div><strong>10%</strong><span>Owner revenue</span></div>
                        </div>
                        <div className="shop-economy-bar" aria-label="90 percent treasury and 10 percent owner revenue">
                            <span />
                            <span />
                        </div>
                        <p>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="5" y="10" width="14" height="10" rx="2" />
                                <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
                            </svg>
                            Atomic, account-bound and final after confirmation
                        </p>
                    </div>
                </section>
            </main>

            {quote && (
                <div className="shop-confirm-backdrop" role="presentation" onMouseDown={() => !busy && setQuote(null)}>
                    <section className="shop-confirm" role="dialog" aria-modal="true" aria-labelledby="shop-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
                        <button
                            type="button"
                            className="shop-confirm-close"
                            aria-label="Close purchase confirmation"
                            disabled={!!busy}
                            onClick={() => setQuote(null)}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="m7 7 10 10M17 7 7 17" />
                            </svg>
                        </button>
                        <div className="shop-confirm-logo">
                            <AgarLogo size={46} config={config} />
                        </div>
                        <p className="shop-kicker"><span /> SECURE CHECKOUT</p>
                        <h2 id="shop-confirm-title">
                            {getSlitherSpecialSkin(quote.skinId)?.name || (
                                quote.skinId === 'flags'
                                    ? 'Agar + Slither Flag Pack'
                                    : (quote.gameMode === 'agar' ? 'Agar' : 'Slither') + ' Rainbow'
                            )}
                        </h2>
                        <p className="shop-confirm-subtitle">Review the purchase details before confirming.</p>
                        <div className="shop-confirm-amount">
                            <span>TOTAL</span>
                            <strong className="mono">{quote.tokenAmount} {config.symbol}</strong>
                            <small>{'≈ $' + Number(quote.usdPrice).toFixed(2) + ' reference value'}</small>
                        </div>
                        <div className="shop-confirm-details">
                            <div className="shop-confirm-row"><span>Distribution</span><strong>90% / 10%</strong></div>
                            <div className="shop-confirm-row"><span>Network fee</span><strong>Paid in SOL</strong></div>
                            <div className="shop-confirm-row"><span>Unlock</span><strong>After confirmation</strong></div>
                        </div>
                        <p className="shop-confirm-warning">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 10.5v5M12 7.5h.01" />
                            </svg>
                            Purchases are account-bound and non-refundable after confirmation.
                        </p>
                        <div className="shop-confirm-actions">
                            <button type="button" className="shop-cancel-button" disabled={!!busy} onClick={() => setQuote(null)}>Cancel</button>
                            <button type="button" className="shop-buy-button" disabled={!!busy} onClick={confirmPurchase}>
                                {busy && <span className="shop-button-spinner" aria-hidden="true" />}
                                <span>{busy ? 'Confirming...' : 'Confirm purchase'}</span>
                                {!busy && (
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M5 12h14M13 6l6 6-6 6" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
