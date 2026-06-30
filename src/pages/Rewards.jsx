import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppTopbar from '../components/AppTopbar';

export default function Rewards() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        document.title = 'AgarStake | Rewards';
    }, []);

    if (loading) {
        return (
            <div className="lobby-container">
                <AppTopbar />
                <main className="lobby-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                    <div className="spinner" />
                </main>
            </div>
        );
    }

    if (!user) {
        navigate('/login');
        return null;
    }

    const hasUnusedTicket = user.hasFreeTicket && !user.freeTicketUsed;
    const isCompleted = user.sponsoredRewardsCompleted || user.sponsoredRewardsUnlocked;
    
    const normal5Progress = Math.min(3, user.completedFiveDollarNormalGames ?? 0);
    const normal10Progress = Math.min(1, user.completedTenDollarNormalGames ?? 0);
    const balance = user.sponsoredRewardsBalance || 0;

    return (
        <div className="lobby-container">
            <AppTopbar />
            <main className="lobby-content" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                
                <h1 style={{ fontSize: '2rem', marginBottom: '8px', color: 'var(--text-h)', fontWeight: '800', letterSpacing: '-0.02em' }}>
                    Rewards Overview
                </h1>
                <p style={{ color: 'var(--text-2)', marginBottom: '32px', fontSize: '1rem' }}>
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
                                        const res = await fetch('/api/user/claim-rewards', {
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

                {/* Section 1: Sponsored Match */}
                <section style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-1)', fontWeight: '700' }}>
                        Sponsored Match
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
                                        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
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
                                    onClick={() => navigate('/agar')}
                                    style={{ flex: 1, padding: '12px 20px', fontSize: '1rem', background: '#4ade80', color: '#064e3b', fontWeight: '700' }}
                                >
                                    Use on Agar
                                </button>
                                <button 
                                    className="gm-btn gm-btn--secondary"
                                    onClick={() => navigate('/slither')}
                                    style={{ flex: 1, padding: '12px 20px', fontSize: '1rem' }}
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
                                background: isCompleted ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: isCompleted ? '#4ade80' : '#ef4444',
                                border: `1px solid ${isCompleted ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                            }}>
                                {isCompleted ? 'Unlocked' : 'Locked'}
                            </div>
                        </div>

                        {/* Challenges */}
                        <div>
                            {/* $5 Challenge */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                                    <span style={{ color: normal5Progress >= 3 ? '#4ade80' : 'var(--text-2)' }}>
                                        {normal5Progress >= 3 ? '✓ ' : ''}Complete 3 × $5 Normal Games
                                    </span>
                                    <span style={{ color: 'var(--text-1)', fontWeight: '600' }}>{normal5Progress} / 3</span>
                                </div>
                                <div style={{ height: '8px', background: 'var(--bg-3)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${(normal5Progress / 3) * 100}%`, 
                                        background: normal5Progress >= 3 ? '#4ade80' : 'var(--accent)',
                                        transition: 'width 0.5s ease-out'
                                    }} />
                                </div>
                            </div>

                            {/* $10 Challenge */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                                    <span style={{ color: normal10Progress >= 1 ? '#4ade80' : 'var(--text-2)' }}>
                                        {normal10Progress >= 1 ? '✓ ' : ''}Complete 1 × $10 Normal Game
                                    </span>
                                    <span style={{ color: 'var(--text-1)', fontWeight: '600' }}>{normal10Progress} / 1</span>
                                </div>
                                <div style={{ height: '8px', background: 'var(--bg-3)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${(normal10Progress / 1) * 100}%`, 
                                        background: normal10Progress >= 1 ? '#4ade80' : 'var(--accent)',
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
                            New players receive one Free Ticket to play a sponsored $5 match. If you win and cash out during this match, your earnings are stored as a <strong>Locked Balance</strong> in To Claim.
                        </p>
                        <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            To unlock and withdraw this balance, you must complete the beginner challenges. Once the challenges are finished, the locked balance will automatically be deposited into your account as real SOL!
                        </p>
                    </div>
                </section>

            </main>
        </div>
    );
}
