import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppTopbar from '../components/AppTopbar';
import Background from '../components/Background';
import { API_URL } from '../utils/apiBase';

export default function Rewards() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        document.title = 'AgarStake | Rewards';
    }, []);

    if (loading) {
        return (
            <div className="page-shell page-shell--with-topbar page-shell--scroll">
                <Background />
                <AppTopbar />
                <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    if (!user) {
        navigate('/login');
        return null;
    }

    const hasUnusedTicket = user.hasFreeTicket && !user.freeTicketUsed;
    const isCompleted = user.sponsoredRewardsCompleted || user.sponsoredRewardsUnlocked;
    
    const balance = user.sponsoredRewardsBalance || 0;
    const requiredContribution = Math.max(5, balance);
    const multiplier = Math.ceil(requiredContribution / 5);
    const req5 = multiplier * 3;
    const req10 = multiplier * 1;
    
    const normal5Progress = Math.min(req5, user.completedFiveDollarNormalGames ?? 0);
    const normal10Progress = Math.min(req10, user.completedTenDollarNormalGames ?? 0);

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />
            <AppTopbar />
            <div className="page-content" style={{ maxWidth: '800px', width: '100%' }}>
                
                <div className="page-header-row" style={{ marginBottom: '16px', marginTop: '20px' }}>
                    <div>
                        <p className="label" style={{ marginBottom: '6px' }}>AgarStake</p>
                        <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', fontWeight: 800, letterSpacing: '-1px', color: 'var(--text-h)', lineHeight: 1 }}>
                            Rewards
                        </h1>
                    </div>
                </div>
                <p style={{ margin: '0 0 32px', color: 'var(--text-2)', fontSize: '1.05rem', lineHeight: '1.5' }}>
                    Complete challenges to unlock your earned rewards and claim free tickets.
                </p>

                {/* Top Rewards Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '40px' }}>
                    <div className="panel" style={{ padding: '20px', background: 'rgba(20, 24, 30, 0.6)' }}>
                        <p style={{ margin: '0 0 4px', color: 'var(--text-2)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                            Total Rewards Earned
                        </p>
                        <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-h)' }}>
                            ${balance.toFixed(2)}
                        </div>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-2)', fontSize: '0.8rem' }}>Lifetime earnings from sponsored matches</p>
                    </div>
                    
                    <div className="panel" style={{ padding: '20px', background: 'rgba(20, 24, 30, 0.6)' }}>
                        <p style={{ margin: '0 0 4px', color: 'var(--green)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                            To Claim
                        </p>
                        <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--green)', marginBottom: '8px' }}>
                            ${isCompleted && balance === 0 ? '0.00' : balance.toFixed(2)}
                        </div>
                        {isCompleted && balance > 0 ? (
                            <button
                                className="gm-btn gm-btn--primary"
                                onClick={async (e) => {
                                    e.target.disabled = true;
                                    try {
                                        const res = await fetch(`${API_URL}/api/user/claim-rewards`, {
                                            method: 'POST',
                                            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            alert(`Successfully claimed $${data.amount.toFixed(2)}!`);
                                            window.location.reload();
                                        } else {
                                            alert(data.error || 'Failed to claim');
                                            e.target.disabled = false;
                                        }
                                    } catch (err) {
                                        alert('Error claiming rewards');
                                        e.target.disabled = false;
                                    }
                                }}
                                style={{ width: '100%', padding: '14px', fontSize: '1.05rem', fontWeight: '800', letterSpacing: '0.05em', borderRadius: '12px' }}
                            >
                                CLAIM REWARDS
                            </button>
                        ) : (
                            <p style={{ margin: '4px 0 0', color: 'var(--text-2)', fontSize: '0.8rem' }}>
                                {isCompleted && balance === 0 ? 'All rewards claimed!' : 'Requires challenges to be completed'}
                            </p>
                        )}
                    </div>
                </div>

                {/* Section 1: Free Game Ticket */}
                <section style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-1)', fontWeight: '700' }}>
                        Free Game Ticket
                    </h2>
                    
                    {hasUnusedTicket ? (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            borderRadius: '16px',
                            padding: '24px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    background: 'rgba(34, 197, 94, 0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#4ade80'
                                }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
                                        <path d="M12 11v6" />
                                        <path d="M10 13a2 2 0 1 0 0-4h2a2 2 0 1 1 0 4h-2a2 2 0 1 0 0 4" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem', color: '#4ade80', fontWeight: '700' }}>
                                        Free $5 Normal Game
                                    </h3>
                                    <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                        You have 1 sponsored ticket available! Use it to play a Normal match on either Agar or Slither for free.
                                    </p>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <button 
                                    className="gm-btn gm-btn--primary"
                                    onClick={() => navigate('/pre-game', { state: { selectedMode: 'agar' } })}
                                    style={{ flex: 1, padding: '12px 20px', fontSize: '1rem', display: 'flex', justifyContent: 'center' }}
                                >
                                    Use on Agar
                                </button>
                                <button 
                                    className="gm-btn gm-btn--secondary"
                                    onClick={() => navigate('/pre-game', { state: { selectedMode: 'slither' } })}
                                    style={{ flex: 1, padding: '12px 20px', fontSize: '1rem', display: 'flex', justifyContent: 'center' }}
                                >
                                    Use on Slither
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="panel" style={{ padding: '24px', opacity: 0.8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                <span style={{ color: 'var(--text-h)', fontWeight: '600' }}>Free Ticket Used</span>
                            </div>
                            <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.9rem' }}>
                                You have already used your free sponsored ticket. Any winnings are stored in your Rewards balance.
                            </p>
                        </div>
                    )}
                </section>

                {/* Section 2: Rewards (Only visible if ticket has been used) */}
                {user.freeTicketUsed && (
                    <section style={{ marginBottom: '40px' }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-1)', fontWeight: '700' }}>
                            Rewards
                        </h2>
                    
                    <div className="panel" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-h)', fontWeight: '600' }}>
                                Unlock Challenges
                            </h4>
                            <div style={{ 
                                padding: '6px 12px', 
                                borderRadius: '20px', 
                                fontSize: '0.85rem', 
                                fontWeight: '700',
                                background: 'rgba(139, 92, 246, 0.1)',
                                color: '#a78bfa',
                                border: '1px solid rgba(139, 92, 246, 0.2)'
                            }}>
                                Reward: ${balance.toFixed(2)}
                            </div>
                        </div>

                        {/* Challenges */}
                        <div>
                            {/* $5 Challenge */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                                    <span style={{ color: normal5Progress >= req5 ? '#4ade80' : 'var(--text-2)' }}>
                                        {normal5Progress >= req5 ? '✓ ' : ''}Complete {req5} × $5 Normal Games
                                    </span>
                                    <span style={{ color: 'var(--text-1)', fontWeight: '600' }}>{normal5Progress} / {req5}</span>
                                </div>
                                <div style={{ height: '8px', background: 'var(--bg-3)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${(normal5Progress / req5) * 100}%`, 
                                        background: normal5Progress >= req5 ? '#4ade80' : 'var(--accent)',
                                        transition: 'width 0.5s ease-out'
                                    }} />
                                </div>
                            </div>

                            {/* $10 Challenge */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                                    <span style={{ color: normal10Progress >= req10 ? '#4ade80' : 'var(--text-2)' }}>
                                        {normal10Progress >= req10 ? '✓ ' : ''}Complete {req10} × $10 Normal Game
                                    </span>
                                    <span style={{ color: 'var(--text-1)', fontWeight: '600' }}>{normal10Progress} / {req10}</span>
                                </div>
                                <div style={{ height: '8px', background: 'var(--bg-3)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${(normal10Progress / req10) * 100}%`, 
                                        background: normal10Progress >= req10 ? '#4ade80' : 'var(--accent)',
                                        transition: 'width 0.5s ease-out'
                                    }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                )}

                {/* Section 3: Information */}
                <section>
                    <div className="panel" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 16v-4"/>
                                <path d="M12 8h.01"/>
                            </svg>
                            How Rewards Work
                        </h3>
                        <p style={{ margin: '0 0 8px', color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            Complete challenges to earn and unlock rewards. By participating in games and fulfilling challenge requirements, you build up your Rewards balance.
                        </p>
                        <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            Once a challenge is fully completed, your locked rewards become available to claim. When you claim your rewards, the SOL is securely deposited into your wallet!
                        </p>
                    </div>
                </section>

            </div>
        </div>
    );
}
