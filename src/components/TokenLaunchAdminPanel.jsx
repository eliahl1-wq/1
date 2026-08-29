import React, { useEffect, useState } from 'react';

const EMPTY_FORM = {
    name: 'AreniFi Coin', symbol: 'ARENA',
    description: 'The utility token for the AreniFi gaming ecosystem.',
    imageSourceUrl: 'https://arenifi.fun/arenifi-coin-logo.png',
    website: 'https://arenifi.fun', twitter: '', telegram: '',
};

export default function TokenLaunchAdminPanel({ fetchAdmin }) {
    const [launch, setLaunch] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [confirmation, setConfirmation] = useState('');
    const [busy, setBusy] = useState('');
    const [notice, setNotice] = useState('');

    const load = async () => {
        const value = await fetchAdmin('/api/admin/token-launch');
        setLaunch(value);
        if (value.prepared) setForm(current => ({ ...current, ...Object.fromEntries(Object.keys(current).map(key => [key, value[key] || current[key]])) }));
    };
    useEffect(() => { load().catch(error => setNotice(error.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    const prepared = launch?.prepared;
    const metadataReady = !!launch?.metadataUri;
    const launched = launch?.status === 'launched';
    return (
        <div style={{ display: 'grid', gap: 20 }}>
            <section className="admin-panel" style={{ padding: 22 }}>
                <p className="shop-kicker"><span /> EXACT MINT LAUNCH</p>
                <h2 className="admin-section-title">AreniFi Coin · Pump.fun</h2>
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
                            <span className="admin-filter-label">{key.replace(/([A-Z])/g, ' $1')}</span>
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
                <p style={{ color: 'var(--text-3)' }}>Uses your admin account wallet as creator and fee payer. No automatic initial purchase is made.</p>
                {!launch.launchEnabled && <div className="product-alert product-alert--error">Railway: set PUMP_LAUNCH_ENABLED=true only when you are ready.</div>}
                {!launch.mintMatchesEnvironment && <div className="product-alert product-alert--error">AGAR_TOKEN_MINT must match the prepared mint.</div>}
                <label style={{ display: 'grid', gap: 6, marginTop: 14 }}><span className="admin-filter-label">Type LAUNCH followed by the complete mint address</span><input className="admin-input" value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder={`LAUNCH ${launch.mintAddress}`} /></label>
                <button style={{ marginTop: 14 }} className="btn btn-danger" disabled={!!busy || !launch.launchEnabled || !launch.mintMatchesEnvironment || confirmation !== `LAUNCH ${launch.mintAddress}`} onClick={() => run('launch', '/api/admin/token-launch/launch', { confirmation })}>{busy === 'launch' ? 'Launching…' : 'Launch exact mint on Pump.fun'}</button>
            </section>}

            {launched && <section className="admin-panel" style={{ padding: 22 }}><h2 className="admin-section-title">Launched</h2><p>{launch.mintAddress}</p><a href={`https://solscan.io/tx/${launch.signature}`} target="_blank" rel="noreferrer">View transaction</a></section>}
        </div>
    );
}
