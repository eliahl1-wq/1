import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { useNavigate } from 'react-router-dom';
import { createQR } from '@solana/pay';

export default function Lobby() {
    const { user, logout, token, login, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();

    // If redirected from PreGame with a pending deposit, prefill the deposit amount
    useEffect(() => {
        try {
            const pending = localStorage.getItem('pending_deposit');
            if (pending) {
                setDepositAmount(pending);
                localStorage.removeItem('pending_deposit');
                setDepositStatusMessage('Amount prefilled — complete deposit below.');
            }
        } catch (e) {}
    }, [connected]);

    // --- STATS FÖR DEPOSIT ---
    const [depositAmount, setDepositAmount] = useState('');
    const [minimumDepositUSD, setMinimumDepositUSD] = useState(0); // Gräns borttagen för test
    const [depositStatusMessage, setDepositStatusMessage] = useState(''); // Statusmeddelanden för insättning
    const [arenaError, setArenaError] = useState('');
    const [isAlreadyInGame, setIsAlreadyInGame] = useState(false);
    const [depositMethod, setDepositMethod] = useState('wallet'); // 'wallet' | 'manual'
    const qrRef = useRef(null);

    const depositAddress = user?.depositAddress;

    // Memoize bakgrundsblobs så de inte skapas på nytt vid varje re-render (fixar "snabba blobs")
    const backgroundBlobs = useMemo(() => [...Array(6)].map((_, i) => ({
        id: i,
        color: i % 2 === 0 ? '#007AFF' : i % 3 === 0 ? '#34C759' : '#5E5CE6',
        top: `${10 + Math.random() * 80}%`,
        left: `${5 + Math.random() * 90}%`,
        size: `${150 + Math.random() * 300}px`,
        duration: `${20 + Math.random() * 20}s`,
        delay: `${Math.random() * -20}s`,
        opacity: 0.08 + Math.random() * 0.08
    })), []);

    const userMenuRef = useRef(null);
    const userPillRef = useRef(null);
    const hasRefreshedRef = useRef(false); // För att stoppa loopen

    // Stäng menyn om man klickar utanför
    const handleClickOutside = useCallback((event) => {
        if (
            userMenuRef.current && 
            !userMenuRef.current.contains(event.target) &&
            userPillRef.current &&
            !userPillRef.current.contains(event.target)
        ) {
            setShowUserMenu(false);
        }
    }, []);

    useEffect(() => {
        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showUserMenu, handleClickOutside]);

    // Uppdaterar användardata när komponenten laddas (löser problemet med bakåt-navigering)
    useEffect(() => {
        if (token) {
            refreshUser();
            document.title = "AgarStake | Lobby";
            
            // Kolla om vi redan spelar
            const checkStatus = async () => {
                try {
                    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');
                    const res = await fetch(`${baseUrl}/api/game-status`, {
                        headers: { 'Authorization': `Bearer ${token}`, 'bypass-tunnel-reminders': 'true' }
                    });
                    
                    const contentType = res.headers.get("content-type");
                    if (res.ok && contentType && contentType.includes("application/json")) {
                        const data = await res.json();
                        setIsAlreadyInGame(data.inGame);
                    }
                } catch (e) {}
            };
            checkStatus();

            const id = setInterval(refreshUser, 5000); // Polla var 5:e sekund
            return () => clearInterval(id);
        }
    }, [token, refreshUser]);

    // Generate Solana Pay QR code
    useEffect(() => {
        if (qrRef.current && depositAddress && depositMethod === 'manual') {
            const solanaPayUrl = `solana:${depositAddress}?amount=0&label=AgarArena&message=Deposit`;
            // Clear previous QR code if any
            const canvas = qrRef.current;
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
            createQR(qrRef.current, solanaPayUrl, 100); // 100px size
        }
    }, [depositAddress, depositMethod]);

    // Om användaren redan har balans och INTE är i ett game, skicka dem till PreGame
    useEffect(() => {
        if (user && (user.balance || 0) >= 10 && !isAlreadyInGame) {
            navigate('/pre-game');
        } else if (isAlreadyInGame) {
            // Om man redan är i ett game, tvinga in dem i PreGame (eller Game direkt om du vill)
            navigate('/pre-game');
        }
    }, [user, navigate]);

    // Funktion för att hantera insättning (Skicka SOL)
    const handleDeposit = async () => {
        if (!publicKey || !connected) {
            setDepositStatusMessage('Connect wallet first.');
            return;
        }
        if (!depositAddress) {
            setDepositStatusMessage('❌ No deposit address found.');
            return;
        }

        const amountUSD = parseFloat(depositAmount);
        if (isNaN(amountUSD) || amountUSD < minimumDepositUSD) {
            setDepositStatusMessage(`Minimum deposit is $${minimumDepositUSD}.`);
            return;
        }

        setDepositStatusMessage('Waiting for approval...');

        try {
            // Placeholder-kurs: 1 SOL = 150 USD. I framtiden bör du hämta detta via API.
            const SOL_USD_RATE = 150; 
            const solAmount = amountUSD / SOL_USD_RATE;
            const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);

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
            // --- KRITISKT STEG: Skicka signaturen till din backend för verifiering ---
            const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/api/deposit-verify`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
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

            // TODO: Skicka signature till backend här för att uppdatera databasen
            // await fetch(`${import.meta.env.VITE_API_URL}/api/verify-deposit`, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ signature, amountUSD })
            // });

            setDepositStatusMessage(`✅ Success! ${solAmount.toFixed(4)} SOL deposited and verified.`);
            // Efter lyckad backend-verifiering bör din AuthContext uppdatera användarens saldo.
            // Om din AuthContext inte automatiskt hämtar ny användardata, kan du behöva trigga det här.
            // Exempel: refreshUserData(); // En funktion i AuthContext som hämtar senaste användardata
            setDepositAmount(''); // Rensa insättningsfältet
        } catch (error) {
            console.error('Deposit error:', error);
            const msg = error.message || "";
            
            if (msg.includes('TransactionExpiredTimeoutError') || msg.toLowerCase().includes('insufficient')) {
                setDepositStatusMessage('❌ Not enough funds in wallet for transaction and fees.');
            } else if (msg.includes('User rejected')) {
                setDepositStatusMessage('❌ Transaction cancelled in Phantom.');
            } else {
                setDepositStatusMessage(`❌ Deposit failed. Check your wallet balance.`);
            }
        }
    };

    return (
        <div style={{ 
            width: '100vw', 
            height: '100vh', 
            position: 'relative', 
            color: 'white', 
            userSelect: 'none',
            background: '#050505',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            {/* Background Glows for Depth */}
            <div style={{
                position: 'absolute',
                top: '-15%',
                left: '-5%',
                width: '50%',
                height: '50%',
                background: 'radial-gradient(circle, rgba(0, 122, 255, 0.1) 0%, transparent 70%)',
                filter: 'blur(100px)',
                animation: 'float-glow 15s infinite alternate'
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-15%',
                right: '-5%',
                width: '60%',
                height: '60%',
                background: 'radial-gradient(circle, rgba(52, 199, 89, 0.07) 0%, transparent 70%)',
                filter: 'blur(100px)',
                animation: 'float-glow 20s infinite alternate-reverse'
            }} />

            {/* Blurry Background Blobs (Nu stabila via useMemo) */}
            {backgroundBlobs.map((blob) => (
                <div 
                    key={blob.id}
                    className="bg-blob"
                    style={{
                        background: blob.color,
                        top: blob.top,
                        left: blob.left,
                        width: blob.size,
                        height: blob.size,
                        animationDelay: blob.delay,
                        animationDuration: blob.duration,
                        opacity: blob.opacity
                    }}
                />
            ))}

            <style>{`
                @keyframes float-glow {
                    from { transform: translate(0, 0) scale(1); opacity: 0.5; }
                    to { transform: translate(5%, 5%) scale(1.1); opacity: 0.8; }
                }
                .btn-hover:hover {
                    transform: translateY(-2px);
                    filter: brightness(1.1);
                }
                .btn-hover:active {
                    transform: translateY(0);
                }
                .bg-blob {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(110px);
                    opacity: 0.12;
                    z-index: 1;
                    animation: float-blob infinite alternate ease-in-out;
                }
                @keyframes float-blob {
                    from { transform: translate(0, 0) scale(1); }
                    to { transform: translate(120px, 60px) scale(1.15); }
                }
            `}</style>

            {/* Logo Top Left */}
            <div style={{ position: 'absolute', top: '40px', left: '40px', zIndex: 10 }}>
                <h2 style={{ 
                    margin: 0, 
                    color: 'white', 
                    letterSpacing: '-1.5px', 
                    fontWeight: '900', 
                    fontSize: '1.8rem',
                    fontStyle: 'italic'
                }}>
                    AGAR<span style={{ color: '#007AFF' }}>STAKE</span>
                </h2>
            </div>

            {/* iOS Style User Pill */}
            <div style={{ position: 'absolute', top: '40px', right: '40px', zIndex: 100 }}>
                {user && (
                    <div style={{ position: 'relative', fontFamily: 'system-ui' }}>
                        <div 
                            ref={userPillRef}
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                padding: '12px 28px',
                                borderRadius: '100px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                transition: '0.2s all ease',
                                backdropFilter: 'blur(30px)',
                                border: showUserMenu ? '1px solid #007AFF' : '1px solid rgba(255, 255, 255, 0.08)',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                            }}
                        >
                            <span style={{ fontWeight: '600', fontSize: '1.1rem', letterSpacing: '-0.3px' }}>{user.username}</span>
                            <span style={{ color: '#fff', fontWeight: '700', fontSize: '1.1rem' }}>
                                ${user.balance?.toFixed(2) || '0.00'}
                            </span>
                        </div>

                        {showUserMenu && (
                            <div ref={userMenuRef} style={{
                                position: 'absolute', top: '65px', right: '0', width: '200px',
                                background: 'rgba(28, 28, 30, 0.95)',
                                borderRadius: '14px',
                                overflow: 'hidden',
                                backdropFilter: 'blur(30px)',
                                border: '0.5px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                            }}>
                                <button 
                                    onClick={logout}
                                    style={{
                                        width: '100%',
                                        padding: '14px 18px',
                                        background: 'none',
                                        border: 'none',
                                        color: '#FF3B30',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        fontSize: '1rem'
                                    }}
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Center Content */}
            <div style={{ zIndex: 5, fontFamily: 'system-ui', textAlign: 'center' }}>
                <h1 style={{ 
                    color: 'white',
                    fontSize: '5.5rem',
                    fontWeight: '900',
                    marginBottom: '5px',
                    letterSpacing: '-5px',
                    textShadow: '0 15px 40px rgba(0,0,0,0.4)',
                    lineHeight: '1'
                }}>
                    Welcome, {user?.username}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.5rem', marginBottom: '45px', fontWeight: '500', letterSpacing: '-0.8px' }}>Stake your claim and dominate the arena.</p>

                <div style={{ 
                    background: 'rgba(255, 255, 255, 0.04)', 
                    padding: '50px 60px', 
                    borderRadius: '48px', 
                    border: '1px solid rgba(255, 255, 255, 0.07)', 
                    textAlign: 'center', 
                    width: '480px', 
                    backdropFilter: 'blur(80px)',
                    boxShadow: '0 40px 120px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255,255,255,0.05)',
                    position: 'relative'
                }}>
                    <h2 style={{ 
                        fontSize: '1.4rem', 
                        margin: '0 0 35px 0', 
                        letterSpacing: '22px', 
                        fontWeight: '900', 
                        color: 'rgba(255,255,255,0.07)',
                        textShadow: '0 0 20px rgba(255,255,255,0.05)',
                        textTransform: 'uppercase',
                        textIndent: '22px'
                    }}>ARENA</h2>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px', marginTop: '20px' }}>
                        <WalletMultiButton />
                    </div>

                    {connected && (
                        <div style={{ 
                            marginTop: '20px', 
                            marginBottom: '30px', 
                            padding: '25px', 
                            background: 'rgba(255, 255, 255, 0.04)', 
                            borderRadius: '28px', 
                            border: '1px solid rgba(255, 255, 255, 0.05)' 
                        }}>
                            <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '14px', marginBottom: '20px' }}>
                                <button 
                                    onClick={() => { setDepositMethod('wallet'); setDepositStatusMessage(''); }}
                                    style={{
                                        flex: 1, padding: '10px 0', border: 'none', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer',
                                        background: depositMethod === 'wallet' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                        color: depositMethod === 'wallet' ? 'white' : 'rgba(255,255,255,0.4)',
                                        transition: '0.2s'
                                    }}
                                >
                                    Wallet Connect
                                </button>
                                <button 
                                    onClick={() => { setDepositMethod('manual'); setDepositStatusMessage(''); }}
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

                        {depositMethod === 'wallet' ? (
                            <div style={{ position: 'relative', width: '100%', marginBottom: '15px' }}>
                                <span style={{ 
                                    position: 'absolute', 
                                    left: '18px', 
                                    top: '50%',
                            
                                    transform: 'translateY(-55%)', 
                                    color: 'rgba(255,255,255,0.4)',
                                    fontSize: '1.1rem',
                                    fontFamily: 'inherit',
                                    pointerEvents: 'none'
                                }}>$</span>
                                <input
                                    type="number"
                                    placeholder="Enter deposit amount..."
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '12px 12px 12px 45px', 
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        background: 'rgba(0,0,0,0.2)',
                                        color: 'white',
                                        fontSize: '1rem',
                                        outline: 'none'
                                    }}
                                />
                                        </div>
                                    </>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                                            <canvas
                                                ref={qrRef}
                                    alt="Deposit QR"
                                    style={{ borderRadius: '8px', border: '3px solid white', width: '100px', height: '100px' }}
                                />
                                <div style={{ width: '100%' }}>
                                    <div style={{ fontSize: '9px', opacity: 0.4, textAlign: 'left', marginBottom: '4px', textTransform: 'uppercase' }}>Recipient Address</div>
                                    <div style={{ fontSize: '10px', wordBreak: 'break-all', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', color: '#14F195', textAlign: 'left', fontFamily: 'monospace' }}>
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
                                <div style={{ fontSize: '0.75rem', opacity: 0.3, marginTop: '5px', lineHeight: '1.4', fontStyle: 'italic' }}>
                                    Detected automatically after sending.
                                </div>
                            </div>
                        )}

                        {depositMethod === 'wallet' && (
                            <button
                                onClick={handleDeposit}
                                className="btn-hover"
                                style={{
                                    width: '100%', padding: '16px', fontSize: '1rem', borderRadius: '16px', border: 'none',
                                    background: '#34C759', color: 'white', fontWeight: '700', cursor: 'pointer',
                                    boxShadow: '0 8px 20px rgba(52, 199, 89, 0.2)'
                                }}
                            >
                                DEPOSIT VIA WALLET
                            </button>
                        )}

                        {depositStatusMessage && (
                            <p style={{ 
                                fontSize: '0.85rem',
                                color: (depositStatusMessage.includes('failed') || depositStatusMessage.includes('Error')) ? '#FF3B30' : 'rgba(255,255,255,0.7)',
                                fontWeight: '500',
                                marginTop: '15px' 
                                }}>
                                {depositStatusMessage}
                            </p>
                        )}
                        </div>
                    )}
                    
                    <button 
                        onClick={() => {
                            if (!connected) { // Kontrollera om plånbok är ansluten
                                setArenaError('Please connect your wallet first.');
                            } else if (!isAlreadyInGame && ((user?.balance ?? 0) < 10)) { 
                                setArenaError(`Please deposit at least $10 to enter the arena.`);
                            } else {
                                setArenaError('');
                                navigate('/pre-game');
                            }
                        }}
                        className="btn-hover"
                        style={{ 
                            width: '100%', 
                            padding: '22px', 
                            fontSize: '1.4rem', 
                            borderRadius: '22px', 
                            border: 'none', 
                            background: 'linear-gradient(180deg, #4D8CFF 0%, #1B62FF 100%)', 
                            color: 'white', 
                            fontWeight: '800', 
                            cursor: 'pointer', 
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 8px 25px rgba(69, 127, 255, 0.3)',
                            letterSpacing: '0.5px'
                        }}
                    >
                        {isAlreadyInGame ? 'Reconnect' : 'ENTER GAME'}
                    </button>

                    {arenaError && (
                        <p style={{ color: '#FF3B30', fontSize: '0.9rem', marginTop: '15px', fontWeight: '500' }}>
                            {arenaError}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}