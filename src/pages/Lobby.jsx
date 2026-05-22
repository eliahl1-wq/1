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
        <div style={{ width: '100vw', height: '100vh', position: 'relative', color: 'white', userSelect: 'none' }}>
            {/* Logo Top Left */}
            <div style={{ position: 'absolute', top: '30px', left: '30px', zIndex: 10 }}>
                <h2 style={{ margin: 0, color: 'white', letterSpacing: '-0.5px', fontWeight: '700', fontSize: '1.4rem' }}>AgarArena</h2>
            </div>

            {/* iOS Style User Pill */}
            <div style={{ position: 'absolute', top: '30px', right: '30px', zIndex: 100 }}>
                {user && (
                    <div style={{ position: 'relative', fontFamily: 'system-ui' }}>
                        <div 
                            ref={userPillRef}
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                padding: '10px 24px',
                                borderRadius: '100px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                transition: '0.2s all ease',
                                backdropFilter: 'blur(25px)',
                                border: showUserMenu ? '1px solid #007AFF' : '1px solid rgba(255, 255, 255, 0.1)'
                            }}
                        >
                            <span style={{ fontWeight: '500', fontSize: '1rem' }}>{user.username}</span>
                            <span style={{ color: '#34C759', fontWeight: '700' }}>
                                ${user.balance?.toFixed(2) || '0.00'}
                            </span>
                        </div>

                        {showUserMenu && (
                            <div ref={userMenuRef} style={{
                                position: 'absolute', top: '55px', right: '0', width: '180px',
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
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, fontFamily: 'system-ui' }}>
                <h1 style={{ 
                    color: 'white',
                    fontSize: '4.5rem',
                    fontWeight: '800',
                    marginBottom: '10px',
                    letterSpacing: '-2px'
                }}>
                    Hello, {user?.username}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.2rem', marginBottom: '40px' }}>Welcome back to the Arena.</p>

                <div style={{ 
                    background: 'rgba(255, 255, 255, 0.05)', 
                    padding: '60px', 
                    borderRadius: '36px', 
                    border: '0.5px solid rgba(255, 255, 255, 0.15)', 
                    textAlign: 'center', 
                    width: '460px', 
                    backdropFilter: 'blur(40px)',
                    boxShadow: '0 40px 100px rgba(0, 0, 0, 0.6)'
                }}>
                    <h2 style={{ fontSize: '2rem', margin: '0 0 10px 0', letterSpacing: '10px', fontWeight: '300', color: 'white' }}>ARENA</h2>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '45px', marginTop: '20px' }}>
                        <WalletMultiButton />
                    </div>

                    {connected && (
                        <div style={{ marginTop: '20px', marginBottom: '20px', padding: '20px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '18px', border: '0.5px solid rgba(255, 255, 255, 0.1)' }}>
                            <h3 style={{ fontSize: '1.5rem', margin: '0 0 15px 0', color: 'white' }}>Deposit</h3>
                            <div style={{ position: 'relative', width: '100%', marginBottom: '10px' }}>
                                <span style={{ 
                                    position: 'absolute', 
                                    left: '15px', 
                                    top: '50%', 
                                    transform: 'translateY(-50%)', 
                                    color: 'rgba(255,255,255,0.4)',
                                    fontWeight: 'bold',
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
                                        padding: '12px 12px 12px 30px', // Extra padding till vänster för $
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
                                style={{
                                    width: '100%',
                                    padding: '15px',
                                    fontSize: '1.1rem',
                                    borderRadius: '14px',
                                    border: 'none',
                                    background: '#34C759', // Grön för insättning
                                    color: 'white',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: '0.3s all ease',
                                    boxShadow: '0 8px 20px rgba(52, 199, 89, 0.3)'
                                }}
                            >
                                DEPOSIT
                            </button>
                            {depositStatusMessage && (
                                <p style={{ 
                                    fontSize: '0.9rem',
                                    color: depositStatusMessage.includes('failed') ? '#FF3B30' : 'rgba(255,255,255,0.7)',
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
                        style={{ 
                            width: '100%', 
                            padding: '20px', 
                            fontSize: '1.3rem', 
                            borderRadius: '18px', 
                            border: 'none', 
                            background: '#007AFF', 
                            color: 'white', 
                            fontWeight: '600', 
                            cursor: 'pointer', 
                            transition: '0.3s all ease',
                            boxShadow: '0 10px 25px rgba(0, 122, 255, 0.3)',
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