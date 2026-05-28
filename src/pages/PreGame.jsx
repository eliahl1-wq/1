import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PreGame() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [walletTab, setWalletTab] = useState('deposit');
    const userMenuRef = useRef(null);
    const userPillRef = useRef(null);
    const walletPanelRef = useRef(null);
    
    const [nickname, setNickname] = useState(localStorage.getItem('match_nickname') || user?.username || '');
    const [showHowItWorks, setShowHowItWorks] = useState(false);
    const [amount, setAmount] = useState('');
    const [isMatchmaking, setIsMatchmaking] = useState(false);

    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const handleMouseMove = (e) => {
        setMousePos({
            x: (e.clientX - window.innerWidth / 2) / 60,
            y: (e.clientY - window.innerHeight / 2) / 60
        });
    };

    const [activities, setActivity] = useState([
        { id: 1, text: "Vortex extracted $82.40", time: "now" },
        { id: 2, text: "Cyborg entered the arena", time: "2m" },
        { id: 3, text: "Sarah reached 14,200 mass", time: "4m" }
    ]);

    useEffect(() => {
        // Simulera live-aktivitet mer frekvent för "ALIVE" känsla
        const interval = setInterval(() => {
            const names = ["Vortex", "Cyborg", "Nova", "Zane", "Echo", "Kinetix", "Aura", "Prime"];
            const actions = [
                "entered the arena",
                `extracted $${(Math.random()*40 + 5).toFixed(2)}`,
                "claimed 1st place"
            ];
            setActivity(prev => [{ id: Date.now(), text: `${names[Math.floor(Math.random()*names.length)]} ${actions[Math.floor(Math.random()*actions.length)]}`, time: "now" }, ...prev.slice(0, 3)]);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

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
        if (userMenuRef.current && !userMenuRef.current.contains(event.target) &&
            userPillRef.current && !userPillRef.current.contains(event.target)) {
            setShowUserMenu(false);
        }
        if (walletPanelRef.current && !walletPanelRef.current.contains(event.target) && 
            !event.target.closest('#wallet-trigger')) {
            setIsWalletOpen(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [handleClickOutside]);

    return (
        <div style={containerStyle} onMouseMove={handleMouseMove}>
            <style>{`
                @keyframes pulse-live {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.2); }
                    100% { opacity: 1; transform: scale(1); }
                }
                .live-indicator { width: 5px; height: 5px; background: #34C759; border-radius: 50%; animation: pulse-live 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                button { transition: all 0.2s ease !important; cursor: pointer; border: none; outline: none; }
                button:hover:not(:disabled) { filter: brightness(1.15); }
                button:active { transform: scale(0.98); }
                .play-btn-glow {
                    box-shadow: 0 10px 30px rgba(0, 122, 255, 0.2);
                    transition: 0.4s all cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .play-btn-glow:hover:not(:disabled) {
                    transform: translateY(-4px) scale(1.02);
                    box-shadow: 0 20px 50px rgba(0, 122, 255, 0.4);
                    filter: brightness(1.2);
                }
                .play-btn-glow:active {
                    transform: translateY(-1px) scale(0.99);
                }
                .floating-blob {
                    position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.12; z-index: -1; animation: float 25s infinite alternate ease-in-out;
                }
                input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .mono { 
                    font-family: ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
                    font-variant-numeric: tabular-nums;
                }
                .glass {
                    background: rgba(20, 20, 22, 0.85);
                    backdrop-filter: blur(24px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .glass-thick {
                    background: rgba(15, 15, 17, 0.9);
                    backdrop-filter: blur(40px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 40px 100px rgba(0,0,0,0.6);
                }
                @keyframes float {
                    0% { transform: translate(0, 0) scale(1); }
                    100% { transform: translate(100px, 50px) scale(1.2); }
                }
                .feed-item {
                    animation: slideInUp 0.5s ease-out;
                }
                @keyframes slideInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div style={backgroundStyle} />
            <div className="floating-blob" style={{ background: '#007AFF', width: '400px', height: '400px', top: '10%', left: '10%' }} />
            <div className="floating-blob" style={{ background: '#34C759', width: '300px', height: '300px', bottom: '15%', right: '15%', animationDelay: '-5s' }} />
            <div style={vignetteStyle} />

            <div style={topBarStyle}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={logoStyle}>AGAR<span style={{ color: '#007AFF' }}>STAKE</span></h2>
                    <span style={{ fontSize: '0.55rem', fontWeight: '900', color: '#007AFF', letterSpacing: '2px', marginTop: '-4px' }}>LIVE MULTIPLAYER</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button 
                        id="wallet-trigger"
                        onClick={() => setIsWalletOpen(!isWalletOpen)}
                        style={{
                            ...depositWithdrawBtnStyle,
                            border: isWalletOpen ? '1px solid #007AFF' : '1px solid rgba(255,255,255,0.1)',
                            background: isWalletOpen ? 'rgba(0,122,255,0.1)' : 'rgba(255,255,255,0.03)'
                        }}
                    >
                        Deposit / Withdraw
                    </button>

                    <div style={{ position: 'relative' }}>
                        <div ref={userPillRef} onClick={() => setShowUserMenu(!showUserMenu)} style={avatarPillStyle}>
                            <div style={avatarCircleStyle}>
                                {user?.username?.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    {showUserMenu && (
                        <div ref={userMenuRef} style={userMenuContainerStyle}>
                            <div style={userMenuHeader}>
                                <div>{user?.username}</div>
                                <div style={{ fontSize: '0.55rem', color: '#FFD700', marginTop: '2px' }}>RANK: GLADIATOR</div>
                            </div>
                            <button style={userMenuItemStyle}>Settings</button>
                            <button style={userMenuItemStyle}>Transaction History</button>
                            <button style={userMenuItemStyle}>Audio Settings</button>
                            <button onClick={logout} style={{ ...userMenuItemStyle, color: '#FF3B30' }}>Log Out</button>
                        </div>
                    )}
                    </div>
                </div>

                {isWalletOpen && (
                    <div ref={walletPanelRef} className="glass-thick" style={walletExpandPanelStyle}>
                        <button style={walletCloseX} onClick={() => setIsWalletOpen(false)}>✕</button>
                        <div style={{ fontSize: '0.6rem', fontWeight: '900', opacity: 0.3, letterSpacing: '1px' }}>AVAILABLE BALANCE</div>
                        <div style={walletPanelHeader}>
                            <div className="mono" style={walletPanelBalance}>${user?.balance?.toFixed(2) || '0.00'}</div>
                            <div className="live-indicator" />
                        </div>
                        <div style={walletTabContainer}>
                            <button onClick={() => setWalletTab('deposit')} style={{...walletTabBtn, ...(walletTab === 'deposit' ? walletTabActive : {})}}>Deposit</button>
                            <button onClick={() => setWalletTab('withdraw')} style={{...walletTabBtn, ...(walletTab === 'withdraw' ? walletTabActive : {})}}>Withdraw</button>
                        </div>
                        <div style={walletInputArea}>
                            <div style={walletInputPrefix}>$</div>
                            <input 
                                type="number" 
                                placeholder="0.00" 
                                value={amount} 
                                onChange={(e) => setAmount(e.target.value)} 
                                style={{...walletInput, border: amount ? '1px solid rgba(0,122,255,0.3)' : '1px solid rgba(255,255,255,0.05)'}} 
                            />
                            <button style={walletMaxBtn} onClick={() => setAmount(walletTab === 'withdraw' ? user?.balance?.toFixed(2) : '100')}>MAX</button>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-hover" style={quickChipStyle} onClick={() => setAmount('10')}>+$10</button>
                            <button className="btn-hover" style={quickChipStyle} onClick={() => setAmount('25')}>+$25</button>
                            <button className="btn-hover" style={quickChipStyle} onClick={() => setAmount('50')}>+$50</button>
                        </div>
                        <button style={{...walletConfirmBtn, background: walletTab === 'deposit' ? '#007AFF' : '#252529'}}>
                            Confirm {walletTab === 'deposit' ? 'Deposit' : 'Withdrawal'}
                        </button>
                        <div style={walletPanelFooter}>Solana Network · Instant Processing · Fee $0.02</div>
                    </div>
                )}
            </div>

            <div 
                className="glass-thick" 
                style={{
                    ...centerCardStyle,
                    transform: `translate(${mousePos.x}px, ${mousePos.y}px)`
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                    <div className="live-indicator" />
                    <span style={{ fontSize: '0.65rem', fontWeight: '900', opacity: 0.4, letterSpacing: '1px' }}>1,284 PLAYERS ONLINE</span>
                </div>

                <h1 style={{ fontSize: '2.4rem', fontWeight: '950', margin: '0 0 8px 0', letterSpacing: '-1.5px', color: '#fff' }}>ENTER THE ARENA</h1>
                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', marginBottom: '32px', lineHeight: '1.4' }}>
                    Compete, survive and cash out before everyone else.
                </p>

                <label style={inputLabelStyle}>Nickname</label>
                <input 
                    type="text" 
                    value={nickname} 
                    onChange={(e) => setNickname(e.target.value.substring(0, 20))}
                    placeholder="Enter your name..."
                    style={nicknameInputStyle}
                />
                <div style={{ fontSize: '0.6rem', opacity: 0.2, marginTop: '-18px', marginBottom: '24px', fontWeight: '700' }}>Your nickname is saved automatically.</div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    <div style={ecoCardStyle} className="btn-hover">
                        <span style={ecoLabel}>ENTRY</span>
                        <span className="mono" style={ecoVal}>$10.00</span>
                    </div>
                    <div style={ecoCardStyle} className="btn-hover">
                        <span style={ecoLabel}>START</span>
                        <span className="mono" style={ecoVal}>$1.00</span>
                    </div>
                    <div style={ecoCardStyle} className="btn-hover">
                        <span style={ecoLabel}>REWARD POOL</span>
                        <span className="mono" style={{...ecoVal, color: '#FFD700'}}>$840.00</span>
                    </div>
                </div>

                <button 
                    className="play-btn-glow"
                    onClick={handleStartMatch} 
                    disabled={!canJoin || isMatchmaking}
                    style={playBtnStyle}
                >
                    {isMatchmaking ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                            PREPARING...
                        </div>
                    ) : (canJoin ? 'ENTER GAME' : 'INSUFFICIENT BALANCE')}
                </button>

                <div style={howItWorksContainerStyle}>
                    <div onClick={() => setShowHowItWorks(!showHowItWorks)} style={howItWorksToggleStyle}>
                        <span>How it works</span>
                        <span style={{ transform: showHowItWorks ? 'rotate(180deg)' : 'rotate(0)', transition: '0.3s' }}>▼</span>
                    </div>
                    {showHowItWorks && (
                        <div style={howItWorksTextStyle}>
                            <div>• Entry fee is $10.00</div>
                            <div>• Grow by eating food and players</div>
                            <div>• Cash out your balance anytime</div>
                            <div style={{ marginTop: '8px', opacity: 0.5 }}>Top 3 Rewards: $20, $10, $10</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="glass" style={bottomLeftCardStyle}>
                <label style={cardSmallLabelStyle}>Wallet</label>
                <div className="mono" style={walletBalanceStyle}>${user?.balance?.toFixed(2) || '0.00'}</div>
            </div>

            <div className="glass" style={bottomRightCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.3, textTransform: 'uppercase' }}>Live Stats</div>
                    <div className="live-indicator" />
                </div>
                <div style={statItemStyle}>
                    <span>Players online</span>
                    <span className="mono">142</span>
                </div>
                <div style={statItemStyle}>
                    <span>Biggest payout today</span>
                    <span className="mono">$84.20</span>
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
const containerStyle = { width: '100vw', height: '100vh', background: '#020203', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', overflow: 'hidden', position: 'relative', letterSpacing: '-0.02em' };
const backgroundStyle = { position: 'fixed', inset: 0, zIndex: -1, background: '#020203', backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)`, backgroundSize: '120px 120px', filter: 'blur(1px)' };
const topBarStyle = { position: 'fixed', top: 0, left: 0, right: 0, height: '64px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 32px', zIndex: 1000, background: 'rgba(10, 10, 12, 0.7)', backdropFilter: 'blur(32px)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' };
const logoStyle = { margin: 0, fontWeight: '950', fontStyle: 'italic', letterSpacing: '-1.5px', fontSize: '1.2rem' };
const depositWithdrawBtnStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', padding: '10px 24px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: '800', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)' };
const avatarPillStyle = { width: '36px', height: '36px', borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '2px', cursor: 'pointer' };
const avatarCircleStyle = { width: '100%', height: '100%', background: '#007AFF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.65rem' };
const walletExpandPanelStyle = { position: 'absolute', top: '72px', left: '50%', transform: 'translateX(-50%)', width: '320px', padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 1100 };
const walletCloseX = { position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'white', opacity: 0.2, padding: '4px', fontSize: '0.8rem' };
const walletPanelHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' };
const walletPanelBalance = { fontSize: '1.25rem', fontWeight: '800' };
const walletTabContainer = { display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '10px' };
const walletTabBtn = { flex: 1, padding: '6px', border: 'none', background: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: '700', borderRadius: '8px' };
const walletTabActive = { background: 'rgba(255,255,255,0.08)', color: 'white' };
const walletInputArea = { position: 'relative', display: 'flex', alignItems: 'center' };
const walletInputPrefix = { position: 'absolute', left: '12px', fontSize: '0.85rem', opacity: 0.2, fontWeight: '800' };
const walletInput = { width: '100%', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '10px 10px 10px 24px', color: 'white', fontWeight: '700', fontSize: '0.9rem', outline: 'none' };
const walletMaxBtn = { position: 'absolute', right: '8px', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', padding: '3px 8px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: '800' };
const quickChipStyle = { flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', padding: '8px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: '800' };
const walletConfirmBtn = { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#007AFF', color: 'white', fontWeight: '800', fontSize: '0.8rem' };
const walletPanelFooter = { textAlign: 'center', fontSize: '0.6rem', opacity: 0.2, fontWeight: '700', marginTop: '4px' };
const userMenuContainerStyle = { position: 'absolute', top: '48px', right: 0, width: '180px', background: '#1c1c1e', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', padding: '4px' };
const userMenuHeader = { padding: '12px 14px', fontSize: '0.7rem', fontWeight: '800', opacity: 0.4, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px' };
const userMenuItemStyle = { width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'white', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600' };

const centerCardStyle = { width: '420px', borderRadius: '32px', padding: '48px', zIndex: 10, transition: 'transform 0.15s ease-out' };
const inputLabelStyle = { display: 'block', fontSize: '0.65rem', fontWeight: '900', opacity: 0.3, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' };
const nicknameInputStyle = { width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', color: 'white', fontSize: '1.1rem', fontWeight: '700', outline: 'none', padding: '16px 20px', borderRadius: '16px', boxSizing: 'border-box', marginBottom: '24px', transition: '0.3s all' };
const ecoCardStyle = { flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' };
const ecoLabel = { fontSize: '0.55rem', fontWeight: '900', opacity: 0.3, marginBottom: '4px' };
const ecoVal = { fontSize: '0.95rem', fontWeight: '800' };
const playBtnStyle = { width: '100%', padding: '22px', borderRadius: '18px', border: 'none', background: 'linear-gradient(180deg, #007AFF 0%, #005DCB 100%)', color: 'white', fontSize: '1.1rem', fontWeight: '900', letterSpacing: '1px' };

const howItWorksContainerStyle = { marginTop: '24px' };
const howItWorksToggleStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: 0.2, fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase' };
const howItWorksTextStyle = { fontSize: '0.75rem', marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)', fontWeight: '500', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' };
const stepStyle = { display: 'flex', gap: '12px', marginBottom: '8px', alignItems: 'center', opacity: 0.5 };
const stepCircle = { width: '18px', height: '18px', borderRadius: '50%', border: '1px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '800' };

const bottomLeftCardStyle = { position: 'fixed', bottom: '32px', left: '32px', width: '220px', borderRadius: '20px', padding: '20px', zIndex: 100 };
const activityFeedStyle = { position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)', width: '300px', padding: '16px', borderRadius: '20px', zIndex: 100, border: '1px solid rgba(255,255,255,0.03)' };
const cardSmallLabelStyle = { display: 'block', fontSize: '0.65rem', fontWeight: '900', opacity: 0.3, textTransform: 'uppercase', marginBottom: '8px' };
const walletBalanceStyle = { fontSize: '1.4rem', fontWeight: '900' };
const bottomRightCardStyle = { position: 'fixed', bottom: '32px', right: '32px', width: '220px', borderRadius: '20px', padding: '20px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '10px' };
const statItemStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700', opacity: 0.3 };
const footerContainerStyle = { position: 'fixed', bottom: '12px', left: '32px', right: '32px', display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '0.6rem', opacity: 0.15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' };
const vignetteStyle = { position: 'fixed', inset: 0, background: 'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.6) 100%)', pointerEvents: 'none', zIndex: -1 };