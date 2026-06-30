import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RewardsWidget() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const storedState = localStorage.getItem('rewards_widget_expanded');
        if (storedState !== null) {
            setExpanded(storedState === 'true');
        }
        setIsInitialized(true);
    }, []);

    if (!user || !isInitialized) return null;

    const hasUnusedTicket = user.hasFreeTicket && !user.freeTicketUsed;
    const hasBalance = (user.sponsoredRewardsBalance || 0) > 0;
    const isCompleted = user.sponsoredRewardsCompleted || user.sponsoredRewardsUnlocked;
    
    // Notifications: Needs attention if ticket unused or balance > 0 and not fully completed/cashed out
    const hasNotification = hasUnusedTicket || (hasBalance && !isCompleted);

    const normal5Progress = Math.min(3, user.completedFiveDollarNormalGames ?? 0);
    const normal10Progress = Math.min(1, user.completedTenDollarNormalGames ?? 0);

    const toggleExpand = (e) => {
        e.stopPropagation();
        const newState = !expanded;
        setExpanded(newState);
        localStorage.setItem('rewards_widget_expanded', String(newState));
    };

    const goToRewards = () => {
        navigate('/rewards');
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            fontFamily: 'var(--font-main)'
        }}>
            {/* Expanded Content */}
            <div style={{
                width: '320px',
                background: 'rgba(20, 24, 30, 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
                marginBottom: '16px',
                transform: expanded ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                opacity: expanded ? 1 : 0,
                pointerEvents: expanded ? 'auto' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transformOrigin: 'bottom right'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-h)', fontWeight: '700' }}>
                        Rewards
                    </h3>
                    <button 
                        onClick={toggleExpand}
                        style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: '4px' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {hasUnusedTicket && (
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        <p style={{ margin: 0, color: '#4ade80', fontSize: '0.85rem', fontWeight: '700' }}>✨ 1 Free Ticket Available</p>
                    </div>
                )}

                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ margin: '0 0 4px', color: 'var(--text-2)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            To Claim
                        </p>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-h)' }}>
                            ${(user.sponsoredRewardsBalance || 0).toFixed(2)}
                        </div>
                    </div>
                    {hasNotification && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                    )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 12px', color: 'var(--text-2)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Challenges
                    </p>
                    {/* $5 Challenge Bar */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                            <span style={{ color: normal5Progress >= 3 ? '#4ade80' : 'var(--text-2)' }}>
                                {normal5Progress >= 3 ? '✓ ' : ''}3 × $5 Games
                            </span>
                            <span style={{ color: 'var(--text-1)', fontWeight: '600' }}>{normal5Progress} / 3</span>
                        </div>
                        <div style={{ height: '4px', background: 'var(--bg-3)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ 
                                height: '100%', 
                                width: `${(normal5Progress / 3) * 100}%`, 
                                background: normal5Progress >= 3 ? '#4ade80' : 'var(--accent)',
                                transition: 'width 0.5s ease-out'
                            }} />
                        </div>
                    </div>
                    
                    {/* $10 Challenge Bar */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                            <span style={{ color: normal10Progress >= 1 ? '#4ade80' : 'var(--text-2)' }}>
                                {normal10Progress >= 1 ? '✓ ' : ''}1 × $10 Game
                            </span>
                            <span style={{ color: 'var(--text-1)', fontWeight: '600' }}>{normal10Progress} / 1</span>
                        </div>
                        <div style={{ height: '4px', background: 'var(--bg-3)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ 
                                height: '100%', 
                                width: `${(normal10Progress / 1) * 100}%`, 
                                background: normal10Progress >= 1 ? '#4ade80' : 'var(--accent)',
                                transition: 'width 0.5s ease-out'
                            }} />
                        </div>
                    </div>
                </div>

                <button 
                    onClick={goToRewards}
                    className="gm-btn gm-btn--primary"
                    style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }}
                >
                    View Details
                </button>
            </div>

            {/* Toggle Button */}
            <button
                onClick={toggleExpand}
                style={{
                    background: 'linear-gradient(135deg, #2a2d36 0%, #1e2026 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    color: 'var(--text-1)',
                    transition: 'transform 0.2s, background 0.2s',
                    position: 'relative',
                    fontFamily: 'inherit',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #323640 0%, #262932 100%)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #2a2d36 0%, #1e2026 100%)'}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Challenges
                {hasNotification && !expanded && (
                    <div style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#ef4444',
                        border: '2px solid #1e2026'
                    }} />
                )}
            </button>
        </div>
    );
}
