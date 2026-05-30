import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

export default function PreGame() {
    const { user, logout, token, login } = useAuth();
    const navigate = useNavigate();
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [isWalletExpanded, setIsWalletExpanded] = useState(false);
    const [walletTab, setWalletTab] = useState('deposit'); // 'deposit' | 'withdraw'
    const [depositStatusMessage, setDepositStatusMessage] = useState('');
    const userMenuRef = useRef(null);
    const userPillRef = useRef(null);
    const walletDropdownRef = useRef(null);
    const walletExpandRef = useRef(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    
    const [panelPosition, setPanelPosition] = useState({ x: null, y: 60 });
    const [isDraggingPanel, setIsDraggingPanel] = useState(false);
    const [walletModalActive, setWalletModalActive] = useState(false);
    
    const [nickname, setNickname] = useState(localStorage.getItem('match_nickname') || user?.username || '');
    const [showHowItWorks, setShowHowItWorks] = useState(false);
    const [amount, setAmount] = useState(''); 
    const [isMatchmaking, setIsMatchmaking] = useState(false);
    const [liveStats, setLiveStats] = useState({ playersOnline: 0, biggestPayout: 0 });
    const RECIPIENT_SOLANA_ADDRESS = useMemo(() => new PublicKey('ASAdMwhmCmcsWiGYaYw5xPddgQuDZHfESMLCDREVUMfb'), []);

    const formatBalance = (val) => {
        const v = Number(val || 0);
        if (!isFinite(v)) return '0';
        if (v >= 10000) return Math.round(v).toString();
        if (v >= 1000) return Number(v.toFixed(1)).toString();
        if (v >= 1) return Number(v.toFixed(2)).toString();
        if (v > 0) return Number(v.toFixed(4)).toString();
        return '0';
    };

    const entryFee = 10.00;
    const canJoin = (user?.balance || 0) >= entryFee;

    const handleStartMatch = () => {
        if (!canJoin) return;
        setIsMatchmaking(true);
        localStorage.setItem('match_nickname', nickname);
        setTimeout(() => {
            navigate('/game', { state: { nickname } });
        }, 1200);
    };

    const handleClickOutside = useCallback((event) => {
        const path = event.composedPath ? event.composedPath() : [];
        const isWalletAdapterModalClick = path.some((element) => {
            return element instanceof HTMLElement && (
                element.classList.contains('wallet-adapter-modal') ||
                element.classList.contains('wallet-adapter-modal-overlay') ||
                element.classList.contains('wallet-adapter-modal-container') ||
                element.classList.contains('wallet-adapter-modal-wrapper') ||
                element.classList.contains('wallet-adapter-modal-list') ||
                element.classList.contains('wallet-adapter-modal-middle') ||
                element.classList.contains('wallet-adapter-modal-button-close') ||
                element.classList.contains('wallet-adapter-modal-list-more') ||
                element.classList.contains('wallet-adapter-modal-title') ||
                element.classList.contains('wallet-adapter-button')
            );
        });
        const walletModalOpen = !!document.querySelector('.wallet-adapter-modal');

        if (walletModalOpen) {
            return;
        }

        if (userMenuRef.current && !userMenuRef.current.contains(event.target) &&
            userPillRef.current && !userPillRef.current.contains(event.target)) {
            setShowUserMenu(false);
        }
        if (walletDropdownRef.current && !walletDropdownRef.current.contains(event.target) && 
            !event.target.closest('#wallet-trigger')) {
            setIsWalletOpen(false);
        }
        if (walletExpandRef.current && !walletExpandRef.current.contains(event.target) && !isWalletAdapterModalClick) {
            setIsWalletExpanded(false);
        }
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const checkWalletModal = () => {
            setWalletModalActive(Boolean(document.querySelector('.wallet-adapter-modal, wcm-modal')));
        };

        const observer = new MutationObserver(checkWalletModal);
        observer.observe(document.body, { childList: true, subtree: true });
        checkWalletModal();

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (walletModalActive && isWalletExpanded) {
            setPanelPosition((pos) => ({ x: 40, y: pos.y ?? 60 }));
        }
    }, [walletModalActive, isWalletExpanded]);

    useEffect(() => {
        if (!isWalletExpanded) {
            setPanelPosition({ x: null, y: 60 });
        }
    }, [isWalletExpanded]);

    useEffect(() => {
        if (!isDraggingPanel) return;

        const move = (event) => {
            const clientX = event.clientX ?? (event.touches && event.touches[0]?.clientX);
            const clientY = event.clientY ?? (event.touches && event.touches[0]?.clientY);
            if (clientX === undefined || clientY === undefined) return;
            const newX = Math.max(16, Math.min(window.innerWidth - 360 - 16, clientX - dragOffsetRef.current.x));
            const newY = Math.max(16, Math.min(window.innerHeight - 200 - 16, clientY - dragOffsetRef.current.y));
            setPanelPosition({ x: newX, y: newY });
        };

        const stop = () => setIsDraggingPanel(false);

        document.addEventListener('mousemove', move);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('mouseup', stop);
        document.addEventListener('touchend', stop);

        return () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('touchmove', move);
            document.removeEventListener('mouseup', stop);
            document.removeEventListener('touchend', stop);
        };
    }, [isDraggingPanel]);

    const handlePanelDragStart = useCallback((event) => {
        const clientX = event.clientX ?? (event.touches && event.touches[0]?.clientX);
        const clientY = event.clientY ?? (event.touches && event.touches[0]?.clientY);
        if (clientX === undefined || clientY === undefined) return;

        const rect = walletExpandRef.current?.getBoundingClientRect();
        if (!rect) return;

        event.preventDefault();
        dragOffsetRef.current = { x: clientX - rect.left, y: clientY - rect.top };
        setIsDraggingPanel(true);
    }, []);

    const handleDeposit = async () => {
        if (!publicKey || !connected) {
            setDepositStatusMessage('Connect wallet first.');
            return;
        }

        const amountUSD = parseFloat(amount);
        const minimumDepositUSD = 10;
        if (isNaN(amountUSD) || amountUSD < minimumDepositUSD) {
            setDepositStatusMessage(`Minimum deposit is $${minimumDepositUSD}.`);
            return;
        }

        setDepositStatusMessage('Waiting for approval in Phantom...');

        try {
            const SOL_USD_RATE = 150;
            const solAmount = amountUSD / SOL_USD_RATE;
            const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: RECIPIENT_SOLANA_ADDRESS,
                    lamports: lamports,
                })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            const signature = await sendTransaction(transaction, connection);
            setDepositStatusMessage('Confirming transaction on blockchain...');

            const confirmation = await connection.confirmTransaction(signature, 'confirmed');
            if (confirmation.value.err) {
                throw new Error('Transaction failed on-chain.');
            }

            setDepositStatusMessage('Verifying deposit with backend...');
            const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/api/deposit-verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'bypass-tunnel-reminders': 'true'
                },
                body: JSON.stringify({
                    signature: signature,
                    amountUSD: amountUSD,
                    solAmount: solAmount,
                    walletAddress: publicKey.toString()
                })
            });

            if (!verifyRes.ok) {
                const errorData = await verifyRes.json();
                throw new Error(errorData.message || 'Backend verification failed.');
            }

            if (token) {
                const meRes = await fetch(`${import.meta.env.VITE_API_URL}/api/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (meRes.ok) {
                    const freshUser = await meRes.json();
                    login(freshUser, token);
                }
            }

            setDepositStatusMessage(`✅ Success! ${solAmount.toFixed(4)} SOL deposited and verified.`);
            setAmount('');
        } catch (error) {
            console.error('Deposit error:', error);
            const msg = error.message || '';
            if (msg.includes('TransactionExpiredTimeoutError') || msg.toLowerCase().includes('insufficient')) {
                setDepositStatusMessage('❌ Not enough funds in wallet for transaction and fees.');
            } else if (msg.includes('User rejected')) {
                setDepositStatusMessage('❌ Transaction cancelled in Phantom.');
            } else {
                setDepositStatusMessage('❌ Deposit failed. Check your wallet balance.');
            }
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClickOutside]);

    useEffect(() => {
        let mounted = true;
        const fetchStats = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/stats`);
                if (!res.ok) return;
                const d = await res.json();
                if (mounted) setLiveStats(d);
            } catch (e) {}
        };
        fetchStats();
        const id = setInterval(fetchStats, 5000);
        return () => { mounted = false; clearInterval(id); };
    }, []);

    const adjustedWalletExpandPanelStyle = {
        ...walletExpandPanelStyle,
        left: panelPosition.x !== null ? panelPosition.x : '50%',
        top: panelPosition.y,
        transform: panelPosition.x !== null ? 'none' : 'translateX(-50%)',
        cursor: isDraggingPanel ? 'grabbing' : 'grab',
        transition: isDraggingPanel ? 'none' : 'left 0.2s ease, top 0.2s ease',
    };

    return (
        <div style={containerStyle}>
            <style>{`
                @keyframes pulse-live {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.95); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translate(-50%, -10px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
                .live-indicator { width: 5px; height: 5px; background: #34C759; border-radius: 50%; animation: pulse-live 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                button { transition: all 0.2s ease !important; cursor: pointer; border: none; outline: none; }
                button:hover:not(:disabled) { filter: brightness(1.15); }
                button:active { transform: scale(0.98); }
                input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .mono { 
                    font-family: ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
                    font-variant-numeric: tabular-nums;
                }
                .glass {
                    background: rgba(18, 18, 22, 0.8);
                    backdrop-filter: blur(24px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                :root {
                    --wcm-z-index: 100002 !important;
                }
                wcm-modal,
                wcm-modal *,
                wcm-modal-backcard,
                wcm-modal-content {
                    z-index: 100002 !important;
                }
                .wallet-adapter-modal,
                .wallet-adapter-modal-container,
                .wallet-adapter-modal-overlay,
                .wallet-adapter-modal-wrapper,
                .wallet-adapter-button {
                    z-index: 99999 !important;
                }
                .wallet-adapter-modal-wrapper {
                    z-index: 100001 !important;
                }
                .wallet-adapter-modal-overlay {
                    z-index: 100000 !important;
                    background: rgba(0,0,0,0.72) !important;
                }
            `}</style>

            <div style={topBarStyle}>
                <h2 style={logoStyle}>AGAR<span style={{ color: '#007AFF' }}>STAKE</span></h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Wallet Balance (removed) */}

                    {/* Wallet Balance Pill */}
                    <div style={{ position: 'relative' }}>
                        <button 
                            id="wallet-trigger"
                            onClick={() => setIsWalletOpen(!isWalletOpen)}
                            style={walletPillButtonStyle}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '8px', opacity: 0.7}}><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 00-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
                            <span className="mono" style={{fontWeight: '800', fontSize: '14px', color: '#14F195'}}>${formatBalance(user?.balance)}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{marginLeft: '8px', opacity: 0.5}}><path d="M6 9l6 6 6-6"/></svg>
                        </button>

                        {isWalletOpen && (
                            <div ref={walletDropdownRef} className="glass" style={walletDropdownCardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '600', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Value</span>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={() => {}} style={{ padding: '6px 10px', borderRadius: 10, background: 'transparent', border: 'none', color: 'white', fontWeight: 800 }}>Balance</button>
                                            <button onClick={() => { setIsWalletOpen(false); navigate('/transactions'); }} style={{ padding: '6px 10px', borderRadius: 10, background: 'transparent', border: 'none', color: 'white', fontWeight: 800 }}>Transaction History</button>
                                        </div>
                                </div>
                                
                                <div className="mono" style={{ fontSize: '28px', fontWeight: '800', marginBottom: '16px', color: 'white' }}>
                                    ${formatBalance(user?.balance)}
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                    <button className="pill-tab active" style={{fontSize: '10px', padding: '4px 10px'}}>USD</button>
                                </div>

                                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 -24px 16px -24px' }} />

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="mono" style={{ fontSize: '13px', opacity: 0.8, color: 'white' }}>${formatBalance(user?.balance)}</span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{opacity: 0.4}}><path d="M20 11a8.1 8.1 0 00-15.5-2m-.5 5v5h5m10-1a8.1 8.1 0 01-15.5 2m.5-5h5"/></svg>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => { setIsWalletOpen(false); setIsWalletExpanded(true); setWalletTab('deposit'); }} style={dropdownPrimaryBtn}>Deposit</button>
                                    <button onClick={() => { setIsWalletOpen(false); setIsWalletExpanded(true); setWalletTab('withdraw'); }} style={dropdownSecondaryBtn}>Withdraw</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => { setIsWalletOpen(false); setIsWalletExpanded(true); setWalletTab('deposit'); }}
                        style={standaloneDepositButtonStyle}
                    >
                        Deposit
                    </button>

                    <div style={{ position: 'relative' }}>
                        <div ref={userPillRef} onClick={() => setShowUserMenu(!showUserMenu)} style={avatarPillStyle}>
                            <div style={avatarCircleStyle}>{user?.username?.charAt(0).toUpperCase()}</div>
                        </div>
                    {showUserMenu && (
                        <div ref={userMenuRef} style={userMenuContainerStyle}>
                            <div style={userMenuHeader}>{user?.username}</div>
                            <button style={userMenuItemStyle}>Settings</button>
                            <button onClick={() => { setShowUserMenu(false); navigate('/transactions'); }} style={userMenuItemStyle}>Transactions</button>
                            <button onClick={logout} style={{ ...userMenuItemStyle, color: '#FF3B30' }}>Log Out</button>
                        </div>
                    )}
                    </div>
                </div>
            </div>

            {isWalletExpanded && (
                <div ref={walletExpandRef} className="glass" style={adjustedWalletExpandPanelStyle}>
                    <button style={walletCloseX} onClick={() => setIsWalletExpanded(false)}>✕</button>
                    <div style={walletPanelHeader} onMouseDown={handlePanelDragStart} onTouchStart={handlePanelDragStart}>
                        <div>
                            <div style={walletPanelTitle}>Wallet</div>
                            <div style={walletPanelSubtitle}>{connected ? `Connected to ${publicKey?.toString().slice(0, 4)}...${publicKey?.toString().slice(-4)}` : 'Connect to begin deposit'}</div>
                        </div>
                        <div style={{ ...walletStatusBadge, ...(connected ? walletStatusConnected : walletStatusDisconnected) }}>
                            {connected ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>
                    <div style={walletOptionRow}>
                        <WalletMultiButton />
                    </div>
                    <div style={walletTabContainer}>
                        <button onClick={() => setWalletTab('deposit')} style={{...walletTabBtn, ...(walletTab === 'deposit' ? walletTabActive : {})}}>Deposit</button>
                        <button onClick={() => setWalletTab('withdraw')} style={{...walletTabBtn, ...(walletTab === 'withdraw' ? walletTabActive : {})}}>Withdraw</button>
                    </div>
                    <div style={walletInputArea}>
                        <div style={walletInputPrefix}>$</div>
                        <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} style={walletInput} />
                        <button style={walletMaxBtn} onClick={() => setAmount(walletTab === 'withdraw' ? user?.balance?.toFixed(2) : '100')}>MAX</button>
                    </div>
                    <button style={walletConfirmBtn} onClick={() => {
                        if (walletTab === 'deposit') {
                            handleDeposit();
                        } else {
                            setDepositStatusMessage('Withdrawal is not implemented yet.');
                        }
                    }}>{walletTab === 'deposit' ? 'Deposit' : 'Withdraw'}</button>
                    {depositStatusMessage && (
                        <div style={{ marginTop: '14px', fontSize: '0.85rem', color: depositStatusMessage.startsWith('✅') ? '#34C759' : '#FF3B30', textAlign: 'center' }}>
                            {depositStatusMessage}
                        </div>
                    )}
                    <div style={walletPanelFooter}>Solana Devnet · Secure Processing</div>
                </div>
            )}

            {/* Standalone Deposit Modal */}

            <div className="glass" style={centerCardStyle}>
                <label style={inputLabelStyle}>Nickname</label>
                <input 
                    type="text" 
                    value={nickname} 
                    onChange={(e) => setNickname(e.target.value.substring(0, 20))}
                    placeholder="Your name..."
                    style={nicknameInputStyle}
                />
                
                <div style={dividerStyle} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.75rem', opacity: 0.35, fontWeight: '600' }}>Entry Fee</span>
                    <span className="mono" style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.35 }}>$10.00</span>
                </div>

                <button 
                    onClick={handleStartMatch} 
                    disabled={!canJoin || isMatchmaking}
                    style={{ 
                        ...playBtnStyle, 
                        background: canJoin ? '#14F195' : '#1e1f26',
                        color: canJoin ? '#050505' : 'rgba(255,255,255,0.2)',
                        boxShadow: canJoin ? '0 4px 12px rgba(20, 241, 149, 0.2)' : 'none',
                        cursor: canJoin ? 'pointer' : 'not-allowed'
                    }}
                >
                    {isMatchmaking ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                            Joining...
                        </div>
                    ) : (canJoin ? 'Play' : 'Insufficient Balance')}
                </button>

                <div style={howItWorksContainerStyle}>
                    <div onClick={() => setShowHowItWorks(!showHowItWorks)} style={howItWorksToggleStyle}>
                        <span>How it works</span>
                        <span style={{ transform: showHowItWorks ? 'rotate(180deg)' : 'rotate(0)', transition: '0.3s' }}>▼</span>
                    </div>
                    {showHowItWorks && (
                        <div style={howItWorksTextStyle}>
                            <div>• Entry Fee: $10.00</div>
                            <div>• Starting Balance: $1.00</div>
                            <div>• Grow by eating food and other players</div>
                            <div>• Cash out your balance anytime</div>
                            <div style={{ marginTop: '8px', opacity: 0.5 }}>Leaderboard Rewards:</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1st Place Bonus</span><span>$20.00</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>2nd & 3rd Place Bonus</span><span>$10.00</span></div>
                        </div>
                    )}
                </div>
            </div>

            <div className="glass" style={bottomRightCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.3, textTransform: 'uppercase' }}>Live Stats</div>
                    <div className="live-indicator" />
                </div>
                <div style={statItemStyle}>
                    <span>Players online</span>
                    <span className="mono">{liveStats.playersOnline ?? 0}</span>
                </div>
                <div style={statItemStyle}>
                    <span>Biggest payout today</span>
                    <span className="mono">${(liveStats.biggestPayout || 0).toFixed(2)}</span>
                </div>
            </div>

            <div style={footerContainerStyle}>
                <span>Terms of Service</span>
                <span>Provably Fair</span>
                <span>Support</span>
                <span style={{ opacity: 0.4 }}>EU-West · Stable</span>
            </div>
        </div>
    );
}
// --- Styles ---
const containerStyle = { width: '100vw', height: '100vh', background: '#050505', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', overflow: 'hidden', position: 'relative', letterSpacing: '-0.01em' };
const backgroundStyle = { position: 'fixed', inset: 0, zIndex: -1, background: '#050505', backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.01) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.01) 1px, transparent 1px)`, backgroundSize: '64px 64px' };
const topBarStyle = { position: 'fixed', top: 0, left: 0, right: 0, height: '56px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', zIndex: 1000, background: 'rgba(10, 10, 14, 0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' };
const logoStyle = { margin: 0, fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', fontSize: '1rem' };

const walletPillButtonStyle = { display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', padding: '6px 16px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer' };
const standaloneDepositButtonStyle = { background: 'linear-gradient(180deg, #4D8CFF 0%, #1B62FF 100%)', border: 'none', color: 'white', padding: '8px 20px', borderRadius: '100px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(69, 127, 255, 0.25)' };
const depositWithdrawBtnStyle = walletPillButtonStyle;

const walletDropdownCardStyle = { position: 'absolute', top: '48px', left: '50%', transform: 'translateX(-50%)', width: '360px', padding: '24px', borderRadius: '24px', boxShadow: '0 24px 50px rgba(0,0,0,0.45)', zIndex: 1100, animation: 'slideDown 0.2s ease-out' };
const dropdownPrimaryBtn = { flex: 1, padding: '12px', borderRadius: '100px', border: 'none', background: 'linear-gradient(180deg, #4D8CFF 0%, #1B62FF 100%)', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer', minWidth: '120px' };
const dropdownSecondaryBtn = { flex: 1, padding: '12px', borderRadius: '100px', border: 'none', background: 'rgba(255,255,255,0.06)', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer', minWidth: '120px' };

const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const depositModalCardStyle = { width: '400px', padding: '40px', borderRadius: '28px', position: 'relative' };
const modalCloseXStyle = { position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'white', opacity: 0.3, cursor: 'pointer', fontSize: '18px' };
const modalInputContainer = { position: 'relative', marginBottom: '32px' };
const modalInputPrefix = { position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', fontSize: '32px', fontWeight: '600', opacity: 0.2 };
const modalInputField = { width: '100%', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '48px', fontWeight: '800', outline: 'none', padding: '8px 0 8px 32px' };
const modalConfirmButtonStyle = { width: '100%', padding: '18px', borderRadius: '100px', border: 'none', background: 'linear-gradient(180deg, #4D8CFF 0%, #1B62FF 100%)', color: 'white', fontWeight: '800', fontSize: '16px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(69, 127, 255, 0.25)' };
const modalFooterTextStyle = { textAlign: 'center', marginTop: '24px', fontSize: '11px', opacity: 0.3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' };

const avatarPillStyle = { width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid rgba(255, 255, 255, 0.15)', padding: '2px' };
const avatarCircleStyle = { width: '100%', height: '100%', background: '#007AFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.65rem' };
const walletExpandPanelStyle = { position: 'absolute', top: '60px', left: '50%', transform: 'translateX(-50%)', width: '360px', maxWidth: '92vw', padding: '22px', borderRadius: '24px', boxShadow: '0 30px 70px rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 1100 };
const walletCloseX = { position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'white', opacity: 0.35, padding: '4px', cursor: 'pointer' };
const walletPanelHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' };
const walletPanelTitle = { fontSize: '0.8rem', letterSpacing: '0.24em', textTransform: 'uppercase', opacity: 0.65, fontWeight: '800' };
const walletPanelSubtitle = { marginTop: '4px', fontSize: '1rem', fontWeight: '800', color: 'white', opacity: 0.9 };
const walletStatusBadge = { padding: '7px 14px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em' };
const walletStatusConnected = { background: 'rgba(52, 199, 89, 0.16)', color: '#34C759' };
const walletStatusDisconnected = { background: 'rgba(255, 59, 48, 0.14)', color: '#FF3B30' };
const walletOptionRow = { display: 'flex', justifyContent: 'center' };
const walletPanelBalance = { fontSize: '1.25rem', fontWeight: '800' };
const walletTabContainer = { display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '14px' };
const walletTabBtn = { flex: 1, padding: '10px 0', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', fontWeight: '800', borderRadius: '12px', cursor: 'pointer' };
const walletTabActive = { background: 'rgba(255,255,255,0.06)', color: 'white' };
const walletInputArea = { position: 'relative', display: 'flex', alignItems: 'center', width: '100%' };
const walletInputPrefix = { position: 'absolute', left: '14px', fontSize: '0.85rem', opacity: 0.4, fontWeight: '800' };
const walletInput = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '14px 14px 14px 32px', color: 'white', fontWeight: '700', fontSize: '0.95rem', outline: 'none' };
const walletMaxBtn = { position: 'absolute', right: '10px', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', padding: '6px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' };
const walletConfirmBtn = { width: '100%', padding: '14px', borderRadius: '16px', border: 'none', background: 'linear-gradient(180deg, #4D8CFF 0%, #1B62FF 100%)', color: 'white', fontWeight: '800', fontSize: '0.92rem', boxShadow: '0 12px 30px rgba(69, 127, 255, 0.25)', cursor: 'pointer' };
const walletPanelFooter = { textAlign: 'center', fontSize: '0.75rem', opacity: 0.35, fontWeight: '700', marginTop: '8px' };
const userMenuContainerStyle = { position: 'absolute', top: '40px', right: 0, width: '160px', background: '#1c1c1e', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 16px 32px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' };
const userMenuHeader = { padding: '10px 14px', fontSize: '0.65rem', fontWeight: '800', opacity: 0.3, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)' };
const userMenuItemStyle = { width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'white', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600' };
const centerCardStyle = { width: '320px', borderRadius: '20px', padding: '24px', zIndex: 10 };
const inputLabelStyle = { display: 'block', fontSize: '0.65rem', fontWeight: '800', opacity: 0.2, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '8px' };
const nicknameInputStyle = { width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: 'white', fontSize: '0.95rem', fontWeight: '700', outline: 'none', padding: '12px 16px', borderRadius: '12px', boxSizing: 'border-box', marginBottom: '24px' };
const dividerStyle = { height: '1px', background: 'rgba(255, 255, 255, 0.05)', margin: '0 0 24px 0' };
const playBtnStyle = { width: '100%', padding: '10px', borderRadius: '12px', border: 'none', fontSize: '0.9rem', fontWeight: '900', letterSpacing: '0.01em' };
const howItWorksContainerStyle = { marginTop: '16px' };
const howItWorksToggleStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: 0.2, fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase' };
const howItWorksTextStyle = { fontSize: '0.7rem', lineHeight: '1.5', opacity: 0.25, marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', fontWeight: '600' };
const bottomLeftCardStyle = { position: 'fixed', bottom: '24px', left: '24px', width: '180px', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' };
const cardSmallLabelStyle = { display: 'block', fontSize: '0.6rem', fontWeight: '800', opacity: 0.2, textTransform: 'uppercase', marginBottom: '4px' };
const walletBalanceStyle = { fontSize: '1.15rem', fontWeight: '800' };
const bottomRightCardStyle = { position: 'fixed', bottom: '24px', right: '24px', width: '200px', borderRadius: '16px', padding: '16px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '12px' };
const statItemStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: '600', opacity: 0.5 };
const footerContainerStyle = { position: 'fixed', bottom: '12px', left: '24px', right: '24px', display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '0.6rem', opacity: 0.2, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' };