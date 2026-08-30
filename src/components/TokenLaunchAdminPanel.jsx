import React, { useEffect, useState } from 'react';

const EMPTY_FORM = {
    name: 'AreniFi Credits', symbol: 'ARC',
    description: 'The utility token for the AreniFi gaming ecosystem.',
    imageSourceUrl: 'https://arenifi.fun/arenifi-coin-logo.png',
    website: 'https://arenifi.fun', twitter: '', twitterPost: '', telegram: '',
};

export default function TokenLaunchAdminPanel({ fetchAdmin }) {
    const [launch, setLaunch] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [confirmation, setConfirmation] = useState('');
    const [initialBuySol, setInitialBuySol] = useState('0');
    const [busy, setBusy] = useState('');
    const [notice, setNotice] = useState('');
    const [position, setPosition] = useState(null);
    const [ownerRevenueAddress, setOwnerRevenueAddress] = useState('');
    const [sellAmount, setSellAmount] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [newCoinConfirmation, setNewCoinConfirmation] = useState('');

    const load = async () => {
        const value = await fetchAdmin('/api/admin/token-launch');
        setLaunch(value);
        if (value.prepared) setForm(current => ({ ...current, ...Object.fromEntries(Object.keys(current).map(key => [key, value[key] || current[key]])) }));
    };
    useEffect(() => { load().catch(error => setNotice(error.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const loadPosition = async () => {
        const value = await fetchAdmin('/api/admin/token-launch/position');
        setPosition(value.position);
        setOwnerRevenueAddress(value.ownerRevenueAddress || '');
    };
    useEffect(() => {
        if (launch?.status === 'launched' && launch?.launchWalletAddress) loadPosition().catch(error => setNotice(error.message));
    }, [launch?.status, launch?.launchWalletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

    const run = async (kind, path, body) => {
        setBusy(kind); setNotice('');
        try {
            const result = await fetchAdmin(path, { method: 'POST', body: JSON.stringify(body || {}) });
            setLaunch(result.launch);
            setNotice(kind === 'launch' ? 'Token launched successfully.' : kind === 'metadata' ? 'Metadata pinned permanently to IPFS.' : 'Future mint address generated.');
        } catch (error) { setNotice(error.message); } finally { setBusy(''); }
    };

    const downloadBackup = async () => {
        setBusy('backup'); setNotice('');
        try {
            const backup = await fetchAdmin('/api/admin/token-launch/backup', { method: 'POST', body: JSON.stringify({ confirmation: launch.mintAddress }) });
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url; anchor.download = `arenifi-mint-${launch.mintAddress}.encrypted.json`; anchor.click();
            URL.revokeObjectURL(url);
            setNotice('Encrypted mint backup downloaded. Store it offline with a separate backup of WALLET_ENCRYPTION_KEY.');
        } catch (error) { setNotice(error.message); } finally { setBusy(''); }
    };

    const sell = async (max = false) => {
        const shownAmount = max ? position?.tokenAmount : sellAmount;
        if (!shownAmount || Number(shownAmount) <= 0) return setNotice('Enter an amount to sell.');
        if (!window.confirm(`Sell ${shownAmount} ${launch.symbol} from the creator wallet for SOL? This is an on-chain transaction and cannot be reversed.`)) return;
        setBusy('sell'); setNotice('');
        try {
            const result = await fetchAdmin('/api/admin/token-launch/sell', {
                method: 'POST',
                body: JSON.stringify({ amount: shownAmount, max, confirmation: `SELL ${launch.mintAddress}` }),
            });
            setPosition(result.position);
            setSellAmount('');
            setNotice(`Sold successfully. Transaction: ${result.signature}`);
            await load();
        } catch (error) { setNotice(error.message); } finally { setBusy(''); }
    };

    const withdrawSol = async (max = false) => {
        const shownAmount = max ? position?.solAmount : withdrawAmount;
        if (!shownAmount || Number(shownAmount) <= 0) return setNotice('Enter a SOL amount to withdraw.');
        if (!window.confirm(`Withdraw ${max ? 'the maximum available' : shownAmount} SOL from the launch wallet to ${ownerRevenueAddress}? This cannot be reversed.`)) return;
        setBusy('withdraw'); setNotice('');
        try {
            const result = await fetchAdmin('/api/admin/token-launch/withdraw-sol', {
                method: 'POST',
                body: JSON.stringify({ amount: shownAmount, max, confirmation: `WITHDRAW ${launch.launchWalletAddress}` }),
            });
            setPosition(result.position);
            setWithdrawAmount('');
            setNotice(`Withdrew ${Number(result.sentSol).toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL to ${result.destination}.`);
        } catch (error) { setNotice(error.message); } finally { setBusy(''); }
    };

    const prepareNewCoin = async () => {
        setBusy('prepare-new'); setNotice('');
        try {
            const result = await fetchAdmin('/api/admin/token-launch/prepare-new', {
                method: 'POST',
                body: JSON.stringify({ confirmation: newCoinConfirmation }),
            });
            setLaunch(result.launch);
            setPosition(null);
            setNewCoinConfirmation('');
            setForm(EMPTY_FORM);
            setNotice('A new future mint address was generated. The previous launch remains archived securely.');
        } catch (error) { setNotice(error.message); } finally { setBusy(''); }
    };

    const prepared = launch?.prepared;
    const metadataReady = !!launch?.metadataUri;
    const launched = launch?.status === 'launched';
    return (
        <div style={{ display: 'grid', gap: 20 }}>
            <section className="admin-panel" style={{ padding: 22 }}>
                <p className="shop-kicker"><span /> EXACT MINT LAUNCH</p>
                <h2 className="admin-section-title">AreniFi Credits · Pump.fun</h2>
                <p style={{ color: 'var(--text-3)', maxWidth: 760 }}>Generate the final address now. Nothing is created on Solana until you explicitly enable and confirm Launch.</p>
                {notice && <div className="product-alert" style={{ marginTop: 14 }}>{notice}</div>}
                {!prepared ? (
                    <button className="btn btn-primary" disabled={!!busy} onClick={() => run('prepare', '/api/admin/token-launch/prepare')}>Generate future mint address</button>
                ) : (
                    <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
                        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>FINAL MINT ADDRESS</span>
                        <code style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, overflowWrap: 'anywhere' }}>{launch.mintAddress}</code>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(launch.mintAddress)}>Copy mint</button>
                            <button className="btn btn-ghost" disabled={!!busy} onClick={downloadBackup}>Download encrypted backup</button>
                            <span className={`admin-status-badge ${launch.mintMatchesEnvironment ? 'is-success' : 'is-warning'}`}>{launch.mintMatchesEnvironment ? 'Matches Railway mint' : 'Add this mint to Railway + Cloudflare'}</span>
                        </div>
                    </div>
                )}
            </section>

            {prepared && !launched && <section className="admin-panel" style={{ padding: 22 }}>
                <h2 className="admin-section-title">Permanent token metadata</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                    {Object.entries(form).map(([key, value]) => (
                        <label key={key} style={{ display: 'grid', gap: 6, gridColumn: key === 'description' ? '1 / -1' : undefined }}>
                            <span className="admin-filter-label">{key === 'twitter' ? 'X account URL' : key === 'twitterPost' ? 'Featured X post URL (Axiom preview)' : key.replace(/([A-Z])/g, ' $1')}</span>
                            {key === 'description' ? <textarea className="admin-input" rows="4" value={value} onChange={e => setForm({ ...form, [key]: e.target.value })} /> : <input className="admin-input" value={value} onChange={e => setForm({ ...form, [key]: e.target.value })} />}
                        </label>
                    ))}
                </div>
                {form.imageSourceUrl && <img src={form.imageSourceUrl} alt="Token preview" style={{ width: 112, height: 112, objectFit: 'cover', borderRadius: '50%', marginTop: 16 }} />}
                <div style={{ marginTop: 16 }}><button className="btn btn-primary" disabled={!!busy} onClick={() => run('metadata', '/api/admin/token-launch/metadata', form)}>{busy === 'metadata' ? 'Uploading…' : metadataReady ? 'Replace pinned metadata' : 'Pin metadata to IPFS'}</button></div>
                {metadataReady && <code style={{ display: 'block', marginTop: 12, overflowWrap: 'anywhere' }}>{launch.metadataUri}</code>}
            </section>}

            {prepared && metadataReady && !launched && <section className="admin-panel" style={{ padding: 22, borderColor: 'rgba(239,68,68,.55)' }}>
                <h2 className="admin-section-title">Final irreversible launch</h2>
                <p style={{ color: 'var(--text-3)' }}>Uses your admin account wallet as creator and fee payer. You may include an optional initial purchase.</p>
                {!launch.launchEnabled && <div className="product-alert product-alert--error">Railway: set PUMP_LAUNCH_ENABLED=true only when you are ready.</div>}
                {!launch.mintMatchesEnvironment && <div className="product-alert product-alert--error">AGAR_TOKEN_MINT must match the prepared mint.</div>}
                {launch.launchWalletAddress && <div style={{ display: 'grid', gap: 7, marginTop: 14 }}><span className="admin-filter-label">Dedicated Pump launch wallet</span><code style={{ overflowWrap: 'anywhere' }}>{launch.launchWalletAddress}</code><button type="button" className="btn btn-ghost" style={{ justifySelf: 'start' }} onClick={() => navigator.clipboard.writeText(launch.launchWalletAddress)}>Copy launch wallet</button></div>}
                <label style={{ display: 'grid', gap: 6, marginTop: 14 }}><span className="admin-filter-label">Type LAUNCH followed by the complete mint address</span><input className="admin-input" value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder={`LAUNCH ${launch.mintAddress}`} /></label>
                <label style={{ display: 'grid', gap: 6, marginTop: 14 }}><span className="admin-filter-label">Initial creator buy (SOL, 0 = no buy)</span><input className="admin-input" type="number" min="0" max="100" step="0.001" value={initialBuySol} onChange={e => setInitialBuySol(e.target.value)} /></label>
                <p style={{ color: 'var(--text-3)', fontSize: 12 }}>The initial buy is included atomically in the launch transaction and paid from the admin account wallet.</p>
                <button style={{ marginTop: 14 }} className="btn btn-danger" disabled={!!busy || !launch.launchEnabled || !launch.mintMatchesEnvironment || confirmation !== `LAUNCH ${launch.mintAddress}`} onClick={() => run('launch', '/api/admin/token-launch/launch', { confirmation, initialBuySol })}>{busy === 'launch' ? 'Launching…' : 'Launch exact mint on Pump.fun'}</button>
            </section>}

            {launched && <section className="admin-panel" style={{ padding: 22, display: 'grid', gap: 18 }}>
                <div><h2 className="admin-section-title">Launched</h2><code style={{ overflowWrap: 'anywhere' }}>{launch.mintAddress}</code><div style={{ marginTop: 10 }}><a href={`https://solscan.io/tx/${launch.signature}`} target="_blank" rel="noreferrer">View launch transaction</a></div></div>
                {launch.launchWalletAddress ? <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, display: 'grid', gap: 14 }}>
                    <div>
                        <p className="shop-kicker"><span /> CREATOR POSITION</p>
                        <h2 className="admin-section-title">Sell {launch.symbol} for SOL</h2>
                        <p style={{ color: 'var(--text-3)', margin: 0 }}>Sold from the encrypted dedicated launch wallet. SOL from the sale remains in this wallet.</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                        <div className="admin-panel" style={{ padding: 14 }}><span className="admin-filter-label">{launch.symbol} balance</span><strong style={{ display: 'block', fontSize: 22, marginTop: 6 }}>{position ? Number(position.tokenAmount).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}</strong></div>
                        <div className="admin-panel" style={{ padding: 14 }}><span className="admin-filter-label">Launch-wallet SOL</span><strong style={{ display: 'block', fontSize: 22, marginTop: 6 }}>{position ? Number(position.solAmount).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}</strong></div>
                    </div>
                    <div style={{ display: 'grid', gap: 7 }}><span className="admin-filter-label">Launch wallet</span><code style={{ overflowWrap: 'anywhere' }}>{launch.launchWalletAddress}</code></div>
                    <label style={{ display: 'grid', gap: 6, maxWidth: 520 }}>
                        <span className="admin-filter-label">Amount to sell</span>
                        <div style={{ display: 'flex', gap: 8 }}><input className="admin-input" type="number" min="0" step="any" value={sellAmount} onChange={e => setSellAmount(e.target.value)} placeholder={`0 ${launch.symbol}`} style={{ flex: 1 }} /><button type="button" className="btn btn-ghost" disabled={!position || !!busy} onClick={() => setSellAmount(position.tokenAmount)}>Max</button></div>
                    </label>
                    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                        <button className="btn btn-danger" disabled={!!busy || !position || Number(position.tokenAmount) <= 0 || !sellAmount || Number(sellAmount) <= 0} onClick={() => sell(false)}>{busy === 'sell' ? 'Selling…' : `Sell ${launch.symbol}`}</button>
                        <button className="btn btn-ghost" disabled={!!busy || !position || Number(position.tokenAmount) <= 0} onClick={() => sell(true)}>Sell max</button>
                        <button className="btn btn-ghost" disabled={!!busy} onClick={() => loadPosition().catch(error => setNotice(error.message))}>Refresh balances</button>
                    </div>
                    {launch.lastSellSignature && <a href={`https://solscan.io/tx/${launch.lastSellSignature}`} target="_blank" rel="noreferrer">View latest sell transaction</a>}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, display: 'grid', gap: 12 }}>
                        <div><h2 className="admin-section-title">Withdraw launch-wallet SOL</h2><p style={{ color: 'var(--text-3)', margin: 0 }}>Destination: your configured owner revenue wallet. Max subtracts the Solana network fee automatically.</p></div>
                        {ownerRevenueAddress ? <code style={{ overflowWrap: 'anywhere' }}>{ownerRevenueAddress}</code> : <div className="product-alert product-alert--error">AGAR_OWNER_REVENUE_ADDRESS is not configured.</div>}
                        <label style={{ display: 'grid', gap: 6, maxWidth: 520 }}>
                            <span className="admin-filter-label">SOL amount</span>
                            <div style={{ display: 'flex', gap: 8 }}><input className="admin-input" type="number" min="0" step="0.000000001" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0 SOL" style={{ flex: 1 }} /><button type="button" className="btn btn-ghost" disabled={!position || !!busy} onClick={() => setWithdrawAmount(String(position.solAmount))}>Max</button></div>
                        </label>
                        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" disabled={!!busy || !ownerRevenueAddress || !withdrawAmount || Number(withdrawAmount) <= 0} onClick={() => withdrawSol(false)}>{busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw SOL'}</button>
                            <button className="btn btn-ghost" disabled={!!busy || !ownerRevenueAddress || !position || Number(position.solAmount) <= 0} onClick={() => withdrawSol(true)}>Withdraw max</button>
                        </div>
                    </div>
                </div> : <div className="product-alert">The initial purchase was made by the admin account wallet. Use the normal token Sell flow for that wallet.</div>}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, display: 'grid', gap: 12 }}>
                    <div><h2 className="admin-section-title">Create another coin</h2><p style={{ color: 'var(--text-3)', margin: 0 }}>The current launch is archived, not deleted. A dedicated launch wallet must first be emptied so no funds become inaccessible from this panel.</p></div>
                    <label style={{ display: 'grid', gap: 6 }}><span className="admin-filter-label">Type NEW COIN followed by the current mint address</span><input className="admin-input" value={newCoinConfirmation} onChange={e => setNewCoinConfirmation(e.target.value)} placeholder={`NEW COIN ${launch.mintAddress}`} /></label>
                    <button className="btn btn-danger" style={{ justifySelf: 'start' }} disabled={!!busy || newCoinConfirmation !== `NEW COIN ${launch.mintAddress}`} onClick={prepareNewCoin}>{busy === 'prepare-new' ? 'Preparing…' : 'Archive launch and create new mint'}</button>
                    {!!launch.archivedLaunches && <small style={{ color: 'var(--text-3)' }}>{launch.archivedLaunches} previous launch{launch.archivedLaunches === 1 ? '' : 'es'} archived.</small>}
                </div>
            </section>}
        </div>
    );
}
