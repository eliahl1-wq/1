import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppTopbar from '../components/AppTopbar';
import Background from '../components/Background';
import AgarLogo from '../features/agar/ui/AgarLogo';
import { useAgarToken } from '../features/agar/ui/AgarTokenContext';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/apiBase';
import '../styles/shop.css';

function authHeaders(token, json = false) {
    return {
        Authorization: `Bearer ${token}`,
        ...(json ? { 'Content-Type': 'application/json' } : {}),
    };
}

function RainbowPreview({ mode }) {
    return (
        <div className={`shop-rainbow-preview shop-rainbow-preview--${mode}`} aria-hidden="true">
            {mode === 'agar' ? (
                <div className="shop-rainbow-agar"><span>AGAR</span></div>
            ) : (
                <div className="shop-rainbow-snake">
                    {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
                </div>
            )}
        </div>
    );
}

export default function Shop() {
    const navigate = useNavigate();
    const { token, refreshUser } = useAuth();
    const {
        walletBalance,
        balanceLoading,
        refreshAgarBalance,
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

    const ownedProducts = useMemo(() => new Set(
        (inventory?.entitlements || []).map((entry) => entry.productId),
    ), [inventory]);

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
                    : 'Rainbow unlocked successfully.',
            });
        } catch (error) {
            setNotice({ type: 'error', message: error.message });
        } finally {
            setBusy('');
        }
    };

    const useSkin = (product) => {
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
                    <div>
                        <p className="shop-kicker">AGARSTAKE COSMETICS</p>
                        <h1>Skin Shop</h1>
                        <p>Own premium skins using real AGAR from your AgarStake account wallet.</p>
                    </div>
                    <div className="shop-balance-card">
                        <AgarLogo size={42} config={config} />
                        <div>
                            <span>YOUR AGAR BALANCE</span>
                            <strong className="mono">{balanceLoading ? '…' : walletBalance.toLocaleString('en-US', { maximumFractionDigits: 6 })}</strong>
                        </div>
                    </div>
                </header>

                {!shopReady && (
                    <div className="shop-launch-banner">
                        <span>COMING SOON</span>
                        <p>{catalog?.reason || publicConfig?.shopReason || 'The AGAR shop activates when the token launches.'}</p>
                    </div>
                )}

                {notice && <div className={`shop-notice shop-notice--${notice.type}`}>{notice.message}</div>}

                <section className="shop-products" aria-label="AGAR skins">
                    {(catalog?.products || [
                        { id: 'agar:rainbow', gameMode: 'agar', skinId: 'rainbow', name: 'Rainbow', usdPrice: 3 },
                        { id: 'slither:rainbow', gameMode: 'slither', skinId: 'rainbow', name: 'Rainbow', usdPrice: 3 },
                    ]).map((product) => {
                        const owned = ownedProducts.has(product.id);
                        return (
                            <article className="shop-product-card" key={product.id}>
                                <div className="shop-product-topline">
                                    <span>{product.gameMode.toUpperCase()}</span>
                                    <span className={owned ? 'is-owned' : ''}>{owned ? 'OWNED' : 'LIMITED SKIN'}</span>
                                </div>
                                <RainbowPreview mode={product.gameMode} />
                                <div className="shop-product-copy">
                                    <h2>{product.name}</h2>
                                    <p>A luminous animated spectrum made for {product.gameMode === 'agar' ? 'Agar' : 'Slither'}.</p>
                                </div>
                                <div className="shop-product-price">
                                    <div>
                                        <span>PRICE</span>
                                        <strong className="mono">
                                            {product.estimatedAgar ? `${product.estimatedAgar} AGAR` : 'Coming Soon'}
                                        </strong>
                                    </div>
                                    <small>${Number(product.usdPrice).toFixed(2)} live-price target</small>
                                </div>
                                {owned ? (
                                    <button type="button" className="shop-buy-button shop-buy-button--owned" onClick={() => useSkin(product)}>
                                        Use skin
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="shop-buy-button"
                                        disabled={!shopReady || busy === product.id}
                                        onClick={() => requestQuote(product.id)}
                                    >
                                        {!shopReady ? 'Coming Soon' : busy === product.id ? 'Preparing quote…' : 'Buy with AGAR'}
                                    </button>
                                )}
                            </article>
                        );
                    })}
                </section>

                <section className="shop-economy-note">
                    <h2>Where your AGAR goes</h2>
                    <div><strong>90%</strong><span>AGAR treasury</span></div>
                    <div><strong>10%</strong><span>Owner revenue wallet</span></div>
                    <p>The split is executed atomically on Solana. A skin unlocks only after blockchain confirmation.</p>
                </section>
            </main>

            {quote && (
                <div className="shop-confirm-backdrop" role="presentation" onMouseDown={() => !busy && setQuote(null)}>
                    <section className="shop-confirm" role="dialog" aria-modal="true" aria-labelledby="shop-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
                        <AgarLogo size={46} config={config} />
                        <p className="shop-kicker">CONFIRM ON-CHAIN PURCHASE</p>
                        <h2 id="shop-confirm-title">{quote.gameMode === 'agar' ? 'Agar' : 'Slither'} Rainbow</h2>
                        <div className="shop-confirm-amount mono">{quote.tokenAmount} AGAR</div>
                        <div className="shop-confirm-row"><span>Reference value</span><strong>${Number(quote.usdPrice).toFixed(2)}</strong></div>
                        <div className="shop-confirm-row"><span>Distribution</span><strong>90% / 10%</strong></div>
                        <div className="shop-confirm-row"><span>Network fee</span><strong>Paid in SOL</strong></div>
                        <p className="shop-confirm-warning">Purchases are account-bound and non-refundable after confirmation.</p>
                        <div className="shop-confirm-actions">
                            <button type="button" className="shop-cancel-button" disabled={!!busy} onClick={() => setQuote(null)}>Cancel</button>
                            <button type="button" className="shop-buy-button" disabled={!!busy} onClick={confirmPurchase}>
                                {busy ? 'Confirming…' : 'Confirm purchase'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
