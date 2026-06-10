import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useNavigate } from 'react-router-dom';
import { createQR } from '@solana/pay';
import '../styles/ui.css';
import CustomDropdown from '../components/CustomDropdown';
import Background from '../components/Background';

const SolLogo = ({ size = 13, style }) => (
    <img src="/solana-sol-logo.png" alt="SOL"
        style={{ height: size, width: 'auto', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0, ...style }} />
);

const CUR_OPTIONS = [
    { label: 'USD', value: 'USD' },
    { label: 'SOL', value: 'SOL' },
];

export default function Lobby() {
    const { user, logout, token, login, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();

    const [depositAmount, setDepositAmount] = useState('');
    const [statusMsg, setStatusMsg] = useState('');
    const [arenaError, setArenaError] = useState('');
    const [isAlreadyInGame, setIsAlreadyInGame] = useState(false);
    const [depositMethod, setDepositMethod] = useState('wallet');
    const [isCurSOL, setIsCurSOL] = useState(false);
    const [onChainBalance, setOnChainBalance] = useState(null);
    const solPrice = user?.solPrice || 64;

    // Hämta blockkedje-saldo för att undvika databasfel
    useEffect(() => {
        if (!connection || !user?.depositAddress) return;
        const fetchBal = async () => {
            try {
                const b = await connection.getBalance(new PublicKey(user.depositAddress));
                setOnChainBalance(b / LAMPORTS_PER_SOL);
            } catch (e) { }
        };
        fetchBal();
        const id = setInterval(fetchBal, 10000);
        return () => clearInterval(id);
    }, [connection, user?.depositAddress]);

    const qrRef = useRef(null);
    const userMenuRef = useRef(null);
    const userPillRef = useRef(null);

    const depositAddress = user?.depositAddress;

    const statusClass = statusMsg.startsWith('✅') || statusMsg.includes('copied')
        ? 'success' : (statusMsg.includes('failed') || statusMsg.includes('Error') || statusMsg.startsWith('❌'))
            ? 'error' : 'info';

    // Pre-fill deposit amount from redirect
    useEffect(() => {
        try {
            const pending = localStorage.getItem('pending_deposit');
            if (pending) {
                setDepositAmount(pending);
                localStorage.removeItem('pending_deposit');
                setStatusMsg('Amount prefilled — complete deposit below.');
            }
        } catch { }
    }, [connected]);

    // Click outside user menu
    const handleClickOutside = useCallback((e) => {
        if (userMenuRef.current && !userMenuRef.current.contains(e.target) &&
            userPillRef.current && !userPillRef.current.contains(e.target)) {
            setShowUserMenu(false);
        }
    }, []);

    useEffect(() => {
        if (showUserMenu) document.addEventListener('mousedown', handleClickOutside);
        else document.removeEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showUserMenu, handleClickOutside]);

    useEffect(() => {
        if (token) {
            refreshUser();
            document.title = 'AgarStake | Lobby';
            const check = async () => {
                try {
                    const r = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/game-status`, {
                        headers: { Authorization: `Bearer ${token}`, 'bypass-tunnel-reminders': 'true' }
                    });
                    if (r.ok) { const d = await r.json(); setIsAlreadyInGame(d.inGame); }
                } catch { }
            };
            check();
            const id = setInterval(refreshUser, 5000);
            return () => clearInterval(id);
        }
    }, [token, refreshUser]);

    // QR code – show when disconnected (always) or connected + manual tab
    useEffect(() => {
        const shouldShow = !connected || depositMethod === 'manual';
        if (qrRef.current && depositAddress && shouldShow) {
            qrRef.current.innerHTML = '';
            try {
                const qr = createQR(`solana:${depositAddress}?amount=0&label=AgarStake&message=Deposit`, 190, 'white', 'black');
                qr.append(qrRef.current);
            } catch { }
        } else if (qrRef.current && !shouldShow) {
            qrRef.current.innerHTML = '';
        }
        return () => { if (qrRef.current) qrRef.current.innerHTML = ''; };
    }, [depositAddress, depositMethod, connected]);

    // Redirect if sufficient balance
    useEffect(() => {
        if (user && (user.balance || 0) >= 10 && !isAlreadyInGame) navigate('/pre-game');
        else if (isAlreadyInGame) navigate('/pre-game');
    }, [user, navigate]);

    const handleDeposit = async () => {
        if (!publicKey || !connected) { setStatusMsg('Connect your wallet first.'); return; }
        if (!depositAddress) { setStatusMsg('❌ No deposit address found.'); return; }
        const parsed = parseFloat(depositAmount);
        if (isNaN(parsed) || parsed <= 0) { setStatusMsg('❌ Enter a valid amount.'); return; }
        setStatusMsg('Waiting for wallet approval…');
        try {
            const solAmt = isCurSOL ? parsed : parsed / solPrice;
            const usdAmt = isCurSOL ? parsed * solPrice : parsed;
            const lamports = Math.round(solAmt * LAMPORTS_PER_SOL);
            const tx = new Transaction().add(
                SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: new PublicKey(depositAddress), lamports })
            );
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = publicKey;
            const sig = await sendTransaction(tx, connection);
            setStatusMsg('Confirming on-chain…');
            const conf = await connection.confirmTransaction(sig, 'confirmed');
            if (conf.value.err) throw new Error('Transaction failed on-chain.');
            setStatusMsg('Verifying with backend…');
            const vr = await fetch(`${import.meta.env.VITE_API_URL}/api/deposit-verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'bypass-tunnel-reminders': 'true' },
                body: JSON.stringify({ signature: sig, amountUSD: usdAmt, solAmount: solAmt, walletAddress: publicKey.toString() })
            });
            if (!vr.ok) {
                const ct = vr.headers.get('content-type');
                const err = ct?.includes('json') ? (await vr.json()).message : await vr.text();
                throw new Error(err || 'Verification failed.');
            }
            setStatusMsg(`✅ ${solAmt.toFixed(4)} SOL deposited!`);
            setDepositAmount('');
        } catch (err) {
            const m = err.message || '';
            if (m.includes('User rejected')) setStatusMsg('❌ Cancelled in wallet.');
            else if (m.toLowerCase().includes('insufficient')) setStatusMsg('❌ Insufficient funds.');
            else setStatusMsg('❌ Deposit failed. Try again.');
        }
    };

    const currentBalanceSol = onChainBalance !== null ? onChainBalance : (user?.balance || 0);

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <Background />

            {/* ── Top Bar ── */}
            <nav className="topbar">
                <div className="topbar-left">
                    <div className="logo" onClick={() => navigate('/pre-game')}>
                        <div className="logo-dot" />
                        <span>
                            AGAR<span className="logo-accent">STAKE</span>
                        </span>
                    </div>

                    <button className="gm-nav-link" onClick={() => navigate('/gamemodes')}>
                        Gamemode
                    </button>
                </div>

                {user && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ position: 'relative' }}>
                            <div
                                ref={userPillRef}
                                className={`user-pill${showUserMenu ? ' active' : ''}`}
                                onClick={() => setShowUserMenu(v => !v)}
                            >
                                <div className="avatar">
                                    {user.username?.charAt(0).toUpperCase()}
                                </div>
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>
                                {user.username}
                            </span>
                            <span className="mono" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isCurSOL
                                    ? <><SolLogo size={12} /> {currentBalanceSol.toFixed(4)}</>
                                    : `$${(currentBalanceSol * solPrice).toFixed(2)}`}
                            </span>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                                style={{ opacity: 0.35, transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                                <path d="M6 9l6 6 6-6" />
                            </svg>

                            {showUserMenu && (
                                <div ref={userMenuRef} className="user-menu">
                                    {/* Currency toggle in menu */}
                                    <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                                        <span className="label">Currency</span>
                                        <CustomDropdown
                                            options={CUR_OPTIONS}
                                            value={isCurSOL ? 'SOL' : 'USD'}
                                            onChange={v => setIsCurSOL(v === 'SOL')}
                                            renderValue={v => (
                                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {v === 'SOL' ? <><SolLogo size={10} /> Solana</> : '$USD'}
                                                </span>
                                            )}
                                            renderOption={opt => (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {opt.value === 'SOL' ? <><SolLogo size={12} /> Solana</> : '$ USD'}
                                                </span>
                                            )}
                                        />
                                    </div>
                                    <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/transactions'); }}>Transaction History</button>
                                    <button className="user-menu-item" onClick={() => { setShowUserMenu(false); navigate('/profile'); }}>My Profile</button>
                                    <button className="user-menu-item danger" onClick={logout}>Log Out</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            {/* ── Center Content ── */}
            <div style={{ zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '0 16px', marginTop: '52px', width: '100%', maxWidth: '440px' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                    <h1 style={{ margin: '0 0 6px 0', fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 900, letterSpacing: '-2px', color: 'var(--text-h)', lineHeight: 1.05 }}>
                        Fund Your Arena
                    </h1>
                    <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.85rem', fontWeight: 500 }}>
                        Deposit $10 minimum to enter the arena.
                    </p>
                </div>

                {/* Deposit Card */}
                <div style={{
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-2xl)',
                    padding: '22px',
                    width: '100%',
                    boxSizing: 'border-box',
                    boxShadow: 'var(--shadow-xl), inset 0 1px 0 rgba(255,255,255,0.03)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span className="label">Deposit</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div className="live-dot" />
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 600 }}>ARENA STAKE</span>
                        </div>
                    </div>

                    {connected ? (
                        <>
                            {/* Tab bar */}
                            <div className="tab-bar" style={{ marginBottom: '16px' }}>
                                <button
                                    className={`tab-btn${depositMethod === 'wallet' ? ' active' : ''}`}
                                    onClick={() => { if (qrRef.current) qrRef.current.innerHTML = ''; setDepositMethod('wallet'); setStatusMsg(''); }}
                                >
                                    Wallet Connect
                                </button>
                                <button
                                    className={`tab-btn${depositMethod === 'manual' ? ' active' : ''}`}
                                    onClick={() => { setDepositMethod('manual'); setStatusMsg(''); }}
                                >
                                    QR Deposit
                                </button>
                            </div>

                            {depositMethod === 'wallet' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {/* Amount */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                            <span className="label">Amount</span>
                                            <CustomDropdown
                                                options={CUR_OPTIONS}
                                                value={isCurSOL ? 'SOL' : 'USD'}
                                                onChange={v => setIsCurSOL(v === 'SOL')}
                                                renderValue={v => (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {v === 'SOL' ? <><SolLogo size={10} /> Solana</> : '$USD'}
                                                    </span>
                                                )}
                                                renderOption={opt => (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {opt.value === 'SOL' ? <><SolLogo size={12} /> Solana</> : '$ USD'}
                                                    </span>
                                                )}
                                            />
                                        </div>
                                        <div className="amount-field">
                                            <span className="amount-prefix">
                                                {isCurSOL ? <SolLogo size={13} /> : <span>$</span>}
                                            </span>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={depositAmount}
                                                onChange={e => setDepositAmount(e.target.value)}
                                                className="amount-input"
                                            />
                                        </div>
                                        {depositAmount && (
                                            <div className="amount-hint">
                                                {isCurSOL
                                                    ? `≈ $${(parseFloat(depositAmount) * solPrice).toFixed(2)}`
                                                    : `≈ ${(parseFloat(depositAmount) / solPrice).toFixed(4)} SOL`}
                                            </div>
                                        )}
                                    </div>

                                    {/* Wallet button */}
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <WalletMultiButton />
                                    </div>

                                    {/* Deposit action */}
                                    <button
                                        className="btn btn-green"
                                        style={{ width: '100%', padding: '12px', fontSize: '0.82rem', borderRadius: 'var(--r-lg)' }}
                                        onClick={handleDeposit}
                                    >
                                        Deposit via Wallet
                                    </button>
                                </div>
                            ) : (
                                /* QR tab */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                                    <div ref={qrRef} className="qr-container" />
                                    <div style={{ width: '100%' }}>
                                        <div className="label" style={{ marginBottom: '4px' }}>Recipient Address</div>
                                        <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--green)', wordBreak: 'break-all', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                                            {depositAddress || 'Generating…'}
                                        </div>
                                        <button
                                            onClick={() => { if (depositAddress) navigator.clipboard.writeText(depositAddress); setStatusMsg('✅ Address copied!'); }}
                                            style={{ width: '100%', marginTop: '8px', padding: '8px', background: 'var(--blue-dim)', border: '1px solid var(--blue-border)', color: 'var(--blue)', fontSize: '0.67rem', fontWeight: 700, borderRadius: 'var(--r-md)', cursor: 'pointer', letterSpacing: '0.04em' }}
                                        >
                                            COPY ADDRESS
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* No wallet connected – show QR + address + connect button */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
                            {/* QR code */}
                            <div ref={qrRef} className="qr-container" />

                            {/* Deposit address */}
                            <div style={{ width: '100%' }}>
                                <div className="label" style={{ marginBottom: '4px' }}>Deposit Address</div>
                                <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--green)', wordBreak: 'break-all', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                                    {depositAddress || 'Generating…'}
                                </div>
                                <button
                                    onClick={() => { if (depositAddress) navigator.clipboard.writeText(depositAddress); setStatusMsg('✅ Address copied!'); }}
                                    style={{ width: '100%', marginTop: '8px', padding: '8px', background: 'var(--blue-dim)', border: '1px solid var(--blue-border)', color: 'var(--blue)', fontSize: '0.67rem', fontWeight: 700, borderRadius: 'var(--r-md)', cursor: 'pointer', letterSpacing: '0.04em' }}
                                >
                                    COPY ADDRESS
                                </button>
                            </div>

                            {/* Divider */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600 }}>OR CONNECT WALLET</span>
                                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                            </div>

                            {/* Connect wallet button */}
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <WalletMultiButton />
                            </div>
                        </div>
                    )}

                    {statusMsg && (
                        <div className={`status-msg ${statusClass}`} style={{ marginTop: '10px' }}>
                            {statusMsg}
                        </div>
                    )}
                </div>

                {/* Enter game button */}
                <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px', fontSize: '0.9rem', borderRadius: 'var(--r-lg)', letterSpacing: '0.01em' }}
                    onClick={() => {
                        if (!connected) { setArenaError('Connect your wallet first.'); return; }
                        if (!isAlreadyInGame && (user?.balance ?? 0) < 10) {
                            setArenaError('Deposit at least $10 to enter.'); return;
                        }
                        setArenaError('');
                        navigate('/pre-game');
                    }}
                >
                    {isAlreadyInGame ? 'Rejoin Arena' : 'Enter Arena'}
                </button>

                {arenaError && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--red)', fontWeight: 600, textAlign: 'center' }}>
                        {arenaError}
                    </div>
                )}
            </div>

            {/* ── Footer ── */}
            <div className="footer-links">
                <span>Terms</span>
                <span>Provably Fair</span>
                <span>Support</span>
            </div>
        </div>
    );
}