import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useNavigate } from 'react-router-dom';

export default function Lobby() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();

    // --- STATS FÖR DEPOSIT ---
    const [depositAmount, setDepositAmount] = useState('');
    const [minimumDepositUSD, setMinimumDepositUSD] = useState(10); // Ändra till t.ex. 0.01 för att testa billigt
    const [depositStatusMessage, setDepositStatusMessage] = useState(''); // Statusmeddelanden för insättning
    const [arenaError, setArenaError] = useState('');

    // Din mottagaradress
    const RECIPIENT_SOLANA_ADDRESS = useMemo(() => new PublicKey('ASAdMwhmCmcsWiGYaYw5xPddgQuDZHfESMLCDREVUMfb'), []);

    const userMenuRef = useRef(null);
    const userPillRef = useRef(null);

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

    // Funktion för att hantera insättning (Skicka SOL)
    const handleDeposit = async () => {
        if (!publicKey || !connected) {
            setDepositStatusMessage('Connect wallet first.');
            return;
        }

        const amountUSD = parseFloat(depositAmount);
        if (isNaN(amountUSD) || amountUSD < minimumDepositUSD) {
            setDepositStatusMessage(`Minimum deposit is $${minimumDepositUSD}.`);
            return;
        }

        setDepositStatusMessage('Waiting for approval in Phantom...');

        try {
            // Placeholder-kurs: 1 SOL = 150 USD. I framtiden bör du hämta detta via API.
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
            // --- KRITISKT STEG: Skicka signaturen till din backend för verifiering ---
            const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/api/deposit-verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                            <span style={{ fontWeight: '600', fontSize: '1.05rem', letterSpacing: '-0.3px' }}>{user.username}</span>
                            <span style={{ color: '#34C759', fontWeight: '800', fontSize: '1.05rem' }}>
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
                    fontSize: '5rem',
                    fontWeight: '900',
                    marginBottom: '5px',
                    letterSpacing: '-4px',
                    textShadow: '0 10px 30px rgba(0,0,0,0.3)'
                }}>
                    Hello, {user?.username}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.4rem', marginBottom: '50px', fontWeight: '500', letterSpacing: '-0.5px' }}>The arena awaits your stake.</p>

                <div style={{ 
                    background: 'rgba(255, 255, 255, 0.03)', 
                    padding: '60px', 
                    borderRadius: '48px', 
                    border: '1px solid rgba(255, 255, 255, 0.08)', 
                    textAlign: 'center', 
                    width: '480px', 
                    backdropFilter: 'blur(60px)',
                    boxShadow: '0 40px 120px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255,255,255,0.05)',
                    position: 'relative'
                }}>
                    <h2 style={{ 
                        fontSize: '0.9rem', 
                        margin: '0 0 15px 0', 
                        letterSpacing: '8px', 
                        fontWeight: '800', 
                        color: 'rgba(255,255,255,0.3)',
                        textTransform: 'uppercase'
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
                            <h3 style={{ fontSize: '1.2rem', margin: '0 0 20px 0', color: '#fff', fontWeight: '700', textAlign: 'left', opacity: 0.9 }}>Deposit Funds</h3>
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
                                        padding: '12px 12px 12px 45px', // Ökad padding så siffrorna inte nuddar $
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        background: 'rgba(0,0,0,0.2)',
                                        color: 'white',
                                        fontSize: '1rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <button
                                onClick={handleDeposit}
                                className="btn-hover"
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    fontSize: '1.05rem',
                                    borderRadius: '16px',
                                    border: 'none',
                                    background: '#34C759', // Grön för insättning
                                    color: 'white',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 8px 25px rgba(52, 199, 89, 0.2)'
                                }}
                            >
                                DEPOSIT
                            </button>
                            {depositStatusMessage && (
                                <p style={{ 
                                    fontSize: '0.85rem',
                                    color: depositStatusMessage.includes('failed') ? '#FF3B30' : 'rgba(255,255,255,0.7)',
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
                            } else if (!user?.balance || user.balance < minimumDepositUSD) { // Kontrollera användarens faktiska saldo
                                setArenaError(`Please deposit at least $${minimumDepositUSD} to enter the arena.`);
                            } else {
                                setArenaError('');
                                navigate('/game');
                            }
                        }}
                        className="btn-hover"
                        style={{ 
                            width: '100%', 
                            padding: '22px', 
                            fontSize: '1.4rem', 
                            borderRadius: '22px', 
                            border: 'none', 
                            background: 'linear-gradient(180deg, #007AFF 0%, #005DCB 100%)', 
                            color: 'white', 
                            fontWeight: '800', 
                            cursor: 'pointer', 
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 15px 35px rgba(0, 122, 255, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                            letterSpacing: '0.5px'
                        }}
                    >
                        ENTER GAME
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