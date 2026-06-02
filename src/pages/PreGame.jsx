import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { createQR } from '@solana/pay';

export default function PreGame() {
    const { user, logout, token, login, refreshUser, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [solPrice, setSolPrice] = useState(150); // Placeholder, ideally fetched from an API

    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [isWalletExpanded, setIsWalletExpanded] = useState(false); 
    const [isWithdrawExpanded, setIsWithdrawExpanded] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawAddress, setWithdrawAddress] = useState('');
    const withdrawExpandRef = useRef(null);
    const [depositStatusMessage, setDepositStatusMessage] = useState('');
    const [isValidWithdrawAddress, setIsValidWithdrawAddress] = useState(true);
    const [displayFullWithdrawAddress, setDisplayFullWithdrawAddress] = useState(false);
    const [isWithdrawAmountInSOL, setIsWithdrawAmountInSOL] = useState(false);
    const [isDepositAmountInSOL, setIsDepositAmountInSOL] = useState(false);
    const userMenuRef = useRef(null);
    const userPillRef = useRef(null);
    const qrRef = useRef(null); // Ref for the QR code canvas
    const walletDropdownRef = useRef(null); // Återinförd

    const walletExpandRef = useRef(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    
    const [panelPosition, setPanelPosition] = useState({ x: null, y: 60 }); // Keep for expanded panel
    const [isDraggingPanel, setIsDraggingPanel] = useState(false);
    const [walletModalActive, setWalletModalActive] = useState(false);
    const [depositMethod, setDepositMethod] = useState('wallet');
    const [nickname, setNickname] = useState(localStorage.getItem('match_nickname') || user?.username || '');
    const [amount, setAmount] = useState(''); 
    const [isMatchmaking, setIsMatchmaking] = useState(false);
    const [isAlreadyInGame, setIsAlreadyInGame] = useState(false);
    const [liveStats, setLiveStats] = useState({ playersOnline: 0, biggestPayout: 0 });
    
    const depositAddress = user?.depositAddress;

    // Solana Address Validation Regex
    const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

    const [showHowItWorks, setShowHowItWorks] = useState(false); // Moved here

    const formatBalance = (val) => {
        const v = Number(val || 0);
        if (!isFinite(v)) return '0';
        if (v >= 10000) return Math.round(v).toString();
        if (v >= 1000) return Number(v.toFixed(1)).toString();
        if (v >= 1) return Number(v.toFixed(2)).toString();
        if (v > 0) return Number(v.toFixed(4)).toString();
        return '0';
    };
    
    // Helper for shortening Solana addresses
    const shortenAddress = (address, chars = 6) => {
        if (!address || address.length <= chars * 2 + 3) return address;
        return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
    };

    const entryFee = 10.00;
    const canJoin = (user?.balance || 0) >= entryFee;

    useEffect(() => {
        document.title = "AgarStake | Arena Lobby";
    }, []);

    const handleStartMatch = () => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        if (!canJoin && !isAlreadyInGame) {
            navigate('/lobby');
            return;
        }
        setIsMatchmaking(true);
        refreshUser(); // En extra koll precis innan start
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
            !event.target.closest('#wallet-trigger')) { // Fix: Ensure walletDropdownRef is defined
            setIsWalletOpen(false);
        }
        if (walletExpandRef.current && !walletExpandRef.current.contains(event.target) && !isWalletAdapterModalClick) {
            setIsWalletExpanded(false);
        }
        if (withdrawExpandRef.current && !withdrawExpandRef.current.contains(event.target) && !isWalletAdapterModalClick) {
            setIsWithdrawExpanded(false);
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
        if (publicKey && !withdrawAddress) {
            setWithdrawAddress(publicKey.toBase58());
        }
    }, [publicKey]);

    useEffect(() => {
        if (!isWalletExpanded) {
            setPanelPosition({ x: null, y: 60 });
        }
    }, [isWalletExpanded]);

    useEffect(() => {
        if (!isWithdrawExpanded) {
            setPanelPosition({ x: null, y: 120 });
        }
    }, [isWithdrawExpanded]);

    useEffect(() => {
        if (withdrawAddress) {
            setIsValidWithdrawAddress(SOLANA_ADDRESS_REGEX.test(withdrawAddress));
        } else {
            setIsValidWithdrawAddress(true); // No address, no invalid state
        }
    }, [withdrawAddress]);

    useEffect(() => {
        if (qrRef.current && depositAddress && depositMethod === 'manual') {
            const solanaPayUrl = `solana:${depositAddress}?amount=0&label=AgarArena&message=Deposit`;
            try {
                qrRef.current.innerHTML = '';
                // Skapar QR-koden med Solana-logga (createQR hanterar detta automatiskt), större storlek och vit bakgrund
                const qr = createQR(solanaPayUrl, 180, 'white', 'black'); 
                qr.append(qrRef.current);
            } catch (err) { console.error(err); }
        }
    }, [depositAddress, depositMethod]);

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

        const activePanel = walletExpandRef.current || withdrawExpandRef.current;
        const rect = activePanel?.getBoundingClientRect();
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
        if (!depositAddress) {
            setDepositStatusMessage('❌ No deposit address assigned to your account. Contact support.');
            return;
        }

        const amountToDeposit = parseFloat(amount);
        const minimumDepositUSD = 0;
        if (isNaN(amountToDeposit) || amountToDeposit < minimumDepositUSD) {
            setDepositStatusMessage(`Minimum deposit is $${minimumDepositUSD}.`);
            return;
        }

        setDepositStatusMessage('Waiting for approval...');

        let finalAmountUSD = 0;
        let finalSolAmount = 0;

        if (isDepositAmountInSOL) {
            finalSolAmount = amountToDeposit;
            finalAmountUSD = finalSolAmount * solPrice;
        } else {
            finalAmountUSD = amountToDeposit;
            finalSolAmount = finalAmountUSD / solPrice;
        }

        try {
            const lamports = Math.round(finalSolAmount * LAMPORTS_PER_SOL);

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new PublicKey(depositAddress),
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
                    'Authorization': `Bearer ${token}`,
                    'bypass-tunnel-reminders': 'true'
                },
                body: JSON.stringify({
                    signature: signature,
                    amountUSD: finalAmountUSD,
                    solAmount: finalSolAmount,
                    walletAddress: publicKey.toString()
                })
            });

            if (!verifyRes.ok) {
                let errorMessage = 'Backend verification failed.';
                const contentType = verifyRes.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await verifyRes.json();
                    errorMessage = errorData.message || errorMessage;
                } else {
                    errorMessage = await verifyRes.text();
                }
                throw new Error(errorMessage);
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

            setDepositStatusMessage(`✅ Success! ${finalSolAmount.toFixed(4)} SOL deposited and verified.`);
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

    const handleWithdraw = async () => {
        if (!publicKey) {
            setDepositStatusMessage('❌ Connect your wallet first.');
            return;
        }
        if (!token) return;
        const amountToWithdraw = parseFloat(withdrawAmount);
        if (isNaN(amountToWithdraw) || amountToWithdraw < 1) {
            setDepositStatusMessage('❌ Minimum withdrawal is $1.00');
            return;
        }
        if (!withdrawAddress) {
            setDepositStatusMessage('❌ Please enter a destination address.');
            return;
        }
        if (!isValidWithdrawAddress) {
            setDepositStatusMessage('❌ Invalid Solana address.');
            return;
        }

        setDepositStatusMessage('⏳ Processing withdrawal...');
        try {
            const currentSolPrice = solPrice;
            const finalAmountUSD = isWithdrawAmountInSOL ? amountToWithdraw * currentSolPrice : amountToWithdraw;

            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    amountUSD: finalAmountUSD,
                    destinationAddress: withdrawAddress
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Withdrawal failed');
            await refreshUser();
            setDepositStatusMessage(`✅ Success! Funds sent to your wallet.`);
            setWithdrawAmount('');
        } catch (error) { setDepositStatusMessage(`❌ ${error.message}`); }
    };

    useEffect(() => {
        const checkStatus = async () => {
            if (!token) return;
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/game-status`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'bypass-tunnel-reminders': 'true' }
                });
                const contentType = res.headers.get("content-type");
                if (!res.ok || !contentType || !contentType.includes("application/json")) return;
                const data = await res.json();
                setIsAlreadyInGame(data.inGame);
            } catch (e) {}
        };
        checkStatus();

        refreshUser();
        const id = setInterval(refreshUser, 5000); // Polla balans var 5:e sekund
        return () => clearInterval(id);
    }, [refreshUser]);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClickOutside]);

    useEffect(() => {
        let mounted = true;
        const fetchStats = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/stats?t=${Date.now()}`, {
                    headers: { 
                        'bypass-tunnel-reminders': 'true',
                        'Cache-Control': 'no-cache'
                    }
                });
                if (!res.ok) return;
                const d = await res.json();
                if (mounted) setLiveStats(d);
            } catch (e) {}
        };
        fetchStats();
        const id = setInterval(fetchStats, 5000);
        return () => { mounted = false; clearInterval(id); };
    }, []);

    // Solana Icon (simple text for now)
    const SolanaTextIcon = () => (
        <span style={{ fontFamily: 'system-ui', fontWeight: '800', fontSize: '0.9rem' }}>SOL</span>
    );

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
                    {isAuthenticated ? (
                        <>
                            {/* Wallet Balance Pill */}
                            <div style={{ position: 'relative', display: (user?.balance || 0) === 0 ? 'none' : 'block' }}>
                                <button 
                            id="wallet-trigger"
                            onClick={() => setIsWalletOpen(!isWalletOpen)}
                            style={walletPillButtonStyle}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '10px', opacity: 0.8}}><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 00-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg> {/* Wallet Icon */}
                            <span className="mono" style={{fontWeight: '800', fontSize: '17px', color: '#fff'}}>
                                {isDepositAmountInSOL ? `${(user?.balance / solPrice)?.toFixed(4)} SOL` : `$${formatBalance(user?.balance)}`}
                            </span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{marginLeft: '10px', opacity: 0.6}}><path d="M6 9l6 6 6-6"/></svg>
                        </button>

                        {isWalletOpen && (
                            <div ref={walletDropdownRef} className="glass" style={walletDropdownCardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                                    <button onClick={() => { setIsWalletOpen(false); navigate('/transactions'); }}
                                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                        Transaction History
                                    </button>
                                </div>
                                
                                <div className="mono" style={{ fontSize: '36px', fontWeight: '800', marginBottom: '8px', color: 'white' }}>
                                    {isDepositAmountInSOL ? `${(user?.balance / solPrice)?.toFixed(4)} SOL` : `$${formatBalance(user?.balance)}`}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'rgba(255,255,255,0.2)' }}>
                                        {isDepositAmountInSOL ? `~${formatBalance(user?.balance)} USD` : `~${(user?.balance / solPrice)?.toFixed(4)} SOL`}
                                    </span>
                                    <button
                                        onClick={() => setIsDepositAmountInSOL(!isDepositAmountInSOL)}
                                        style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer' }}
                                    >
                                        {isDepositAmountInSOL ? 'Show USD' : 'Show SOL'}
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'rgba(255,255,255,0.2)' }}>USD</span>
                                </div>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => { 
                                        setIsWalletOpen(false); 
                                        setIsWithdrawExpanded(false);
                                        setIsWalletExpanded(true); 
                                        setDepositMethod('wallet'); 
                                    }} style={dropdownPrimaryBtn}>Deposit</button>
                                    <button onClick={() => { 
                                        setIsWalletOpen(false); 
                                        setIsWalletExpanded(false);
                                        setIsWithdrawExpanded(true); 
                                    }} style={dropdownSecondaryBtn}>Withdraw</button>
                                </div>
                            </div>
                        )}
                            </div>

                            <button
                                onClick={() => { 
                                    if ((user?.balance || 0) === 0) {
                                        navigate('/lobby');
                                    } else {
                                        setIsWalletOpen(false); 
                                        setIsWalletExpanded(true); 
                                    }
                                }}
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
                                        <button onClick={() => { setShowUserMenu(false); navigate('/profile', { state: { tab: 'profile' } }); }} style={userMenuItemStyle}>Profile</button>
                                        <button onClick={() => { setShowUserMenu(false); navigate('/profile', { state: { tab: 'stats' } }); }} style={userMenuItemStyle}>Stats</button>
                                        <button onClick={() => { setShowUserMenu(false); navigate('/transactions'); }} style={userMenuItemStyle}>Transactions</button>
                                        <button onClick={logout} style={{ ...userMenuItemStyle, color: '#FF3B30' }}>Log Out</button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <button onClick={() => navigate('/login')} style={standaloneDepositButtonStyle}>
                            Login
                        </button>
                    )}
                </div>
            </div>

            {isWalletExpanded && (
                <div ref={walletExpandRef} className="glass" style={adjustedWalletExpandPanelStyle}>
                    <button style={walletCloseX} onClick={() => setIsWalletExpanded(false)}>✕</button>
                    
                    <div style={walletPanelHeader} onMouseDown={handlePanelDragStart} onTouchStart={handlePanelDragStart}>
                        <div>
                            <div style={walletPanelTitle}>Wallet</div>
                        </div>
                    </div>

                    {/* Tabs: Wallet vs Deposit Address */}
                    <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '14px', marginBottom: '16px' }}>
                        <button 
                            onClick={() => setDepositMethod('wallet')}
                            style={{
                                flex: 1, padding: '10px 0', border: 'none', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer',
                                background: depositMethod === 'wallet' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                color: depositMethod === 'wallet' ? 'white' : 'rgba(255,255,255,0.4)',
                                transition: '0.2s'
                            }}
                        >
                            Wallet
                        </button>
                        <button 
                            onClick={() => setDepositMethod('manual')}
                            style={{
                                flex: 1, padding: '10px 0', border: 'none', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer',
                                background: depositMethod === 'manual' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                color: depositMethod === 'manual' ? 'white' : 'rgba(255,255,255,0.4)',
                                transition: '0.2s'
                            }}
                        >
                            Deposit Address
                        </button>
                    </div>

                    {/* Content based on selected tab */}
                    {depositMethod === 'wallet' ? ( // Wallet Connect tab
                        <>
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '5px 0 15px 0' }}>
                                <WalletMultiButton />
                            </div>
                            <div style={walletInputArea}>
                                <div style={walletInputPrefix}>{isDepositAmountInSOL ? <SolanaTextIcon /> : '$'}</div>
                                <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} style={walletInput} />
                                <button
                                    onClick={() => setIsDepositAmountInSOL(!isDepositAmountInSOL)}
                                    style={{ ...walletMaxBtn, right: '10px', width: 'auto', padding: '6px 8px', fontSize: '0.65rem' }}
                                >
                                    {isDepositAmountInSOL ? 'USD' : 'SOL'}
                                </button>
                            </div>
                            {isDepositAmountInSOL && amount && (
                                <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px', textAlign: 'right' }}>
                                    ~${(parseFloat(amount) * solPrice).toFixed(2)}
                                </div>
                            )}
                            {!isDepositAmountInSOL && amount && (
                                <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px', textAlign: 'right' }}>
                                    ~{(parseFloat(amount) / solPrice).toFixed(4)} SOL
                                </div>
                            )}
                            <button style={walletConfirmBtn} onClick={handleDeposit}>Deposit SOL</button>
                        </>
                    ) : ( // Deposit Address (QR) tab
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '20px' }}>
                            <div ref={qrRef} style={{ background: 'white', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}></div>
                            <div style={{ textAlign: 'center', width: '100%' }}>
                                <div className="mono" style={{ fontSize: '10px', color: '#14F195', wordBreak: 'break-all', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '10px' }}>
                                    {depositAddress || 'Generating...'}
                                </div>
                                <button 
                                    onClick={() => {
                                        if (depositAddress) navigator.clipboard.writeText(depositAddress);
                                        setDepositStatusMessage('Address copied!');
                                    }}
                                    style={{ background: 'rgba(0,122,255,0.1)', border: '1px solid rgba(0,122,255,0.2)', color: '#007AFF', fontSize: '10px', fontWeight: '800', marginTop: '10px', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', width: '100%' }}
                                >
                                    COPY ADDRESS
                                </button>
                            </div>
                        </div>
                    )}

                    {depositStatusMessage && (
                        <div style={{ marginTop: '14px', fontSize: '0.85rem', color: depositStatusMessage.startsWith('✅') ? '#34C759' : '#FF3B30', textAlign: 'center' }}>
                            {depositStatusMessage}
                        </div>
                    )}
                    <div style={walletPanelFooter}>Solana Mainnet · Secure Processing</div>
                </div>
            )}

            {isWithdrawExpanded && (
                <div ref={withdrawExpandRef} className="glass" style={{...adjustedWalletExpandPanelStyle, top: 120}}>
                    <button style={walletCloseX} onClick={() => setIsWithdrawExpanded(false)}>✕</button>
                    <div style={walletPanelHeader} onMouseDown={handlePanelDragStart} onTouchStart={handlePanelDragStart}>
                        <div style={walletPanelTitle}>Withdraw</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{...inputLabelStyle, marginBottom: '4px'}}>Destination Address</div>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <input 
                                type="text" 
                                placeholder="Paste Solana Address" 
                                value={displayFullWithdrawAddress ? withdrawAddress : shortenAddress(withdrawAddress, 6)}
                                onFocus={() => setDisplayFullWithdrawAddress(true)}
                                onBlur={() => setDisplayFullWithdrawAddress(false)}
                                onChange={(e) => setWithdrawAddress(e.target.value)}
                                style={{...walletInput, padding: '12px 40px 12px 12px'}} // Adjusted padding for icon
                            />
                            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isValidWithdrawAddress ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-8.93"></path><path d="M22 4L12 14.01l-3-3"></path></svg>
                                ) : (
                                    withdrawAddress && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                )}
                                <SolanaTextIcon />
                            </div>
                        </div>
                        <div style={{...inputLabelStyle, marginBottom: '4px'}}>Amount ({isWithdrawAmountInSOL ? 'SOL' : 'USD'})</div>
                        <div style={walletInputArea}>
                            <div style={walletInputPrefix}>{isWithdrawAmountInSOL ? <SolanaTextIcon /> : '$'}</div>
                            <input 
                                type="number" 
                            placeholder="Paste Solana Address" 
                                value={withdrawAmount} 
                                onChange={(e) => setWithdrawAmount(e.target.value)} 
                                style={walletInput} 
                            />
                            <button style={walletMaxBtn} onClick={() => setWithdrawAmount(user?.balance?.toFixed(2))}>MAX</button>
                            <button
                                onClick={() => setIsWithdrawAmountInSOL(!isWithdrawAmountInSOL)}
                                style={{ ...walletMaxBtn, right: '60px', width: 'auto', padding: '6px 8px', fontSize: '0.65rem' }}
                            >
                                {isWithdrawAmountInSOL ? 'USD' : 'SOL'}
                            </button>
                        </div>
                        {isWithdrawAmountInSOL && withdrawAmount && (
                            <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '-8px', textAlign: 'right' }}>
                                ~${(parseFloat(withdrawAmount) * solPrice).toFixed(2)}
                            </div>
                        )}
                        {!isWithdrawAmountInSOL && withdrawAmount && (
                            <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '-8px', textAlign: 'right' }}>
                                ~{(parseFloat(withdrawAmount) / solPrice).toFixed(4)} SOL
                            </div>
                        )}
                        <button style={{...walletConfirmBtn, background: 'linear-gradient(180deg, #4D8CFF 0%, #1B62FF 100%)'}} onClick={handleWithdraw}>
                            Withdraw
                        </button>
                    </div>
                    {depositStatusMessage && (
                        <div style={{ marginTop: '14px', fontSize: '0.85rem', color: depositStatusMessage.startsWith('✅') ? '#34C759' : '#FF3B30', textAlign: 'center' }}>
                            {depositStatusMessage}
                        </div>
                    )}
                    <div style={walletPanelFooter}>Custodial Wallet · Secure Transfer</div>
                </div>
            )}

            {/* Standalone Deposit Modal */}

            <div className="glass" style={centerCardStyle}>
                <label style={inputLabelStyle}>Nickname</label>
                <input 
                    type="text" 
                    value={nickname} 
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={15}
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
                    disabled={isMatchmaking}
                    style={{ 
                        ...playBtnStyle, 
                        background: !isAuthenticated ? 'linear-gradient(180deg, #4D8CFF 0%, #1B62FF 100%)' : (isAlreadyInGame ? 'linear-gradient(180deg, #007AFF 0%, #005DCB 100%)' : (canJoin ? '#34C759' : '#1e1f26')),
                        color: 'white',
                        boxShadow: isAlreadyInGame ? '0 4px 12px rgba(0, 122, 255, 0.3)' : (canJoin || !isAuthenticated ? '0 4px 12px rgba(52, 199, 89, 0.2)' : 'none'),
                        cursor: 'pointer'
                    }}
                >
                    {isMatchmaking ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                            Joining...
                        </div>
                    ) : (!isAuthenticated ? 'Play' : (isAlreadyInGame ? 'REJOIN ARENA' : (canJoin ? 'Play' : 'Deposit to Play')))}
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
const topBarStyle = { position: 'fixed', top: 0, left: 0, right: 0, height: '60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', zIndex: 1000, background: 'rgba(10, 10, 14, 0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' };
const logoStyle = { margin: 0, fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', fontSize: '1.15rem' };

const walletPillButtonStyle = { display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', padding: '6px 12px', borderRadius: '100px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' };
const standaloneDepositButtonStyle = { background: 'linear-gradient(180deg, #4D8CFF 0%, #1B62FF 100%)', border: 'none', color: 'white', padding: '9px 22px', borderRadius: '100px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(69, 127, 255, 0.25)' };
const depositWithdrawBtnStyle = walletPillButtonStyle;

const walletDropdownCardStyle = { position: 'absolute', top: '44px', left: '50%', transform: 'translateX(-50%)', width: '320px', padding: '20px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', zIndex: 1100, animation: 'slideDown 0.2s ease-out' };
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

const avatarPillStyle = { width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid rgba(255, 255, 255, 0.15)', padding: '2px', cursor: 'pointer' };
const avatarCircleStyle = { width: '100%', height: '100%', background: '#007AFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.65rem' };
const walletExpandPanelStyle = { position: 'absolute', top: '54px', left: '50%', transform: 'translateX(-50%)', width: '340px', maxWidth: '92vw', padding: '20px', borderRadius: '20px', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 1100 };
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