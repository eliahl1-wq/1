import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppTopbar from '../components/AppTopbar';
import Background from '../components/Background';
import AgarLogo from '../features/agar/ui/AgarLogo';
import { useAgarToken } from '../features/agar/ui/AgarTokenContext';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/apiBase';
import { flagSkinValue, DEFAULT_FLAG_CODE } from '../constants/flagSkins';
import { AGARSTAKE_SKIN_PRODUCT_ID, AGARSTAKE_SKIN_VALUE } from '../constants/agarStakeSkin';
import { SLITHER_SPECIAL_SKINS, getSlitherSpecialSkin } from '../constants/slitherSpecialSkins';
import { AgarBlobPreview, SnakeSkinPreview } from './PreGame';
import '../styles/shop.css';
import '../styles/slitherSpecialSkins.css';

function authHeaders(token, json = false) {
    return {
        Authorization: `Bearer ${token}`,
        ...(json ? { 'Content-Type': 'application/json' } : {}),
    };
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
function AgarStakePreview() {
    return (
        <div className="shop-rainbow-preview shop-agarstake-preview" aria-hidden="true">
            <div className="shop-agarstake-preview-glow" />
            <SnakeSkinPreview color={AGARSTAKE_SKIN_VALUE} isLarge />
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

    const load = useCallback(async () => {
        const [catalogResponse, inventoryResponse] = await Promise.all([
            fetch(`${API_URL}/api/shop/catalog`, { cache: 'no-store' }),
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
        document.title = 'AgarStake | Shop';
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
                throw new Error(payload.message || 'AGAR purchase failed.');
            }
            setQuote(null);
            await Promise.all([load(), refreshAgarBalance(), refreshUser({ forceBalance: true })]);
            setNotice({
                type: response.status === 202 ? 'pending' : 'success',
                message: response.status === 202
                    ? 'Payment was broadcast and is being confirmed. Do not retry.'
                    : `${getSlitherSpecialSkin(quote?.skinId)?.name || (quote?.skinId === 'flags' ? 'Flag Pack' : quote?.skinId === 'agarstake' ? 'AGAR' : 'Rainbow')} unlocked successfully.`,
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
        if (product.skinId === 'agarstake') {
            localStorage.setItem('selected_skin', AGARSTAKE_SKIN_VALUE);
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
    const shopReady = catalog?.ready === true && publicConfig?.shopReady === true;

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll shop-page">
            <Background />
            <AppTopbar />
            <main className="shop-shell">
                <header className="shop-hero">
                    <div className="shop-hero-copy">
                        <p className="shop-kicker"><span /> AGARSTAKE MARKETPLACE</p>
                        <h1>Skin Shop</h1>
                        <p>Stand out in every match with permanent cosmetics, unlocked securely using AGAR from your account wallet.</p>
                        <div className="shop-hero-points" aria-label="Shop benefits">
                            <span><i /> Permanent unlocks</span>
                            <span><i /> Account-bound</span>
                            <span><i /> On-chain checkout</span>
                        </div>
                    </div>
                    <section className="shop-balance-card" aria-label="Your AGAR balance">
                        <div className="shop-balance-logo">
                            <AgarLogo size={42} config={config} />
                        </div>
                        <div className="shop-balance-copy">
                            <span>YOUR AGAR BALANCE</span>
                            <strong className="mono">{balanceLoading ? '...' : walletBalance.toLocaleString('en-US', { maximumFractionDigits: 6 })}</strong>
                            <small>Available to spend</small>
                        </div>
                        <button
                            type="button"
                            className="shop-balance-add"
                            aria-label="Buy AGAR"
                            title="Buy AGAR"
                            onClick={() => openAgarModal({ action: 'BUY' })}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
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
                            <p>{catalog?.reason || publicConfig?.shopReason || 'The AGAR shop activates when the token launches.'}</p>
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
                <section className="shop-products" aria-label="AGAR skins">
                    {(catalog?.products || [
                        { id: 'flags:bundle', gameMode: 'all', skinId: 'flags', name: 'Flag Pack', usdPrice: 1 },
                        { id: 'agar:rainbow', gameMode: 'agar', skinId: 'rainbow', name: 'Rainbow', usdPrice: 3 },
                        { id: 'slither:rainbow', gameMode: 'slither', skinId: 'rainbow', name: 'Rainbow', usdPrice: 3 },
                        { id: AGARSTAKE_SKIN_PRODUCT_ID, gameMode: 'slither', skinId: 'agarstake', name: 'AGAR', usdPrice: 1 },
                        ...SLITHER_SPECIAL_SKINS.map((skin) => ({ id: skin.productId, gameMode: 'slither', skinId: skin.id, name: skin.name, usdPrice: skin.usdPrice })),
                    ]).map((product) => {
                        const owned = ownedProducts.has(product.id);
                        const specialSkin = getSlitherSpecialSkin(product.skinId);
                        return (
                            <article
                                className={'shop-product-card' + (owned ? ' shop-product-card--owned' : '')}
                                key={product.id}
                            >
                                <div className="shop-product-topline">
                                    <span className="shop-mode-badge">
                                        <i />
                                        {product.gameMode === 'all' ? 'AGAR + SLITHER' : product.gameMode.toUpperCase()}
                                    </span>
                                    <span className={'shop-availability' + (owned ? ' is-owned' : '')}>
                                        {owned && (
                                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                                <path d="m7 12.5 3 3 7-8" />
                                            </svg>
                                        )}
                                        {owned ? 'OWNED' : 'PREMIUM'}
                                    </span>
                                </div>
                                {product.skinId === 'flags'
                                    ? <FlagPackPreview nickname={user?.username} />
                                    : product.skinId === 'agarstake'
                                        ? <AgarStakePreview />
                                        : specialSkin
                                            ? <SpecialSlitherPreview skin={specialSkin} />
                                            : <RainbowPreview mode={product.gameMode} nickname={user?.username} />}
                                <div className="shop-product-copy">
                                    <div className="shop-product-heading">
                                        <h2>{product.name}</h2>
                                        <span>{product.skinId === 'flags' ? 'BUNDLE' : 'SKIN'}</span>
                                    </div>
                                    <p>{product.skinId === 'flags'
                                        ? 'One pack with popular country flags for both Agar and Slither.'
                                        : product.skinId === 'agarstake'
                                            ? 'A black and purple AGAR snake with a hanging crypto-logo charm.'
                                            : specialSkin
                                                ? specialSkin.description
                                                : 'A luminous animated spectrum made for ' + (product.gameMode === 'agar' ? 'Agar' : 'Slither') + '.'}</p>
                                </div>
                                <div className="shop-product-price">
                                    <div>
                                        <span>PRICE</span>
                                        <strong className="mono">
                                            {product.estimatedAgar ? product.estimatedAgar + ' AGAR' : 'Coming Soon'}
                                        </strong>
                                    </div>
                                    <small><b>{'$' + Number(product.usdPrice).toFixed(2)}</b> live-price target</small>
                                </div>
                                {owned ? (
                                    <button type="button" className="shop-buy-button shop-buy-button--owned" onClick={() => useSkin(product)}>
                                        <span>Use skin</span>
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M5 12h14M13 6l6 6-6 6" />
                                        </svg>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="shop-buy-button"
                                        disabled={!shopReady || busy === product.id}
                                        onClick={() => requestQuote(product.id)}
                                    >
                                        {busy === product.id && <span className="shop-button-spinner" aria-hidden="true" />}
                                        <span>{!shopReady ? 'Coming Soon' : busy === product.id ? 'Preparing quote...' : 'Buy with AGAR'}</span>
                                        {shopReady && busy !== product.id && (
                                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                                <path d="M5 12h14M13 6l6 6-6 6" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                            </article>
                        );
                    })}
                </section>

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
                            <h2 id="shop-economy-title">Where your AGAR goes</h2>
                            <p>Every purchase is split automatically and verified on Solana before your cosmetic unlocks.</p>
                        </div>
                    </div>
                    <div className="shop-economy-breakdown">
                        <div className="shop-economy-stat">
                            <div><strong>90%</strong><span>AGAR treasury</span></div>
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
                                    : quote.skinId === 'agarstake'
                                        ? 'AGAR'
                                        : (quote.gameMode === 'agar' ? 'Agar' : 'Slither') + ' Rainbow'
                            )}
                        </h2>
                        <p className="shop-confirm-subtitle">Review the purchase details before confirming.</p>
                        <div className="shop-confirm-amount">
                            <span>TOTAL</span>
                            <strong className="mono">{quote.tokenAmount} AGAR</strong>
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
