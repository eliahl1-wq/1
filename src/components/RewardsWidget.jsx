import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RewardsWidget() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const [hasSeen, setHasSeen] = useState(false);

    useEffect(() => {
        const storedState = localStorage.getItem('rewards_widget_expanded');
        const storedSeen = localStorage.getItem('rewards_notif_seen');
        if (storedState !== null) {
            const isExpanded = storedState === 'true';
            setExpanded(isExpanded);
        }
        if (storedSeen === 'true') {
            setHasSeen(true);
        }
        setIsInitialized(true);
    }, []);

    if (!user || !isInitialized) return null;

    const hasUnusedTicket = user.hasFreeTicket && !user.freeTicketUsed;
    const hasBalance = (user.sponsoredRewardsBalance || 0) > 0;
    const isCompleted = user.sponsoredRewardsCompleted || user.sponsoredRewardsUnlocked;
    
    // Notifications: Needs attention if ticket unused or balance > 0 and not fully completed/cashed out
    // and if they haven't explicitly opened the widget in this session.
    const hasNotification = (hasUnusedTicket || (hasBalance && !isCompleted)) && !hasSeen;

    const normal5Progress = Math.min(3, user.completedFiveDollarNormalGames ?? 0);
    const normal10Progress = Math.min(1, user.completedTenDollarNormalGames ?? 0);

    const toggleExpand = (e) => {
        e.stopPropagation();
        const newState = !expanded;
        setExpanded(newState);
        localStorage.setItem('rewards_widget_expanded', String(newState));
        if (newState) {
            setHasSeen(true);
            localStorage.setItem('rewards_notif_seen', 'true');
        }
    };

    const goToRewards = () => {
        navigate('/rewards');
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            zIndex: 1050,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            fontFamily: 'var(--font-main)'
        }}>
            {/* Expanded Content */}
            <div style={{
                width: '320px',
                background: '#000',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '20px',
                boxShadow: 'var(--shadow-xl)',
                marginBottom: '10px',
                transform: expanded ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                opacity: expanded ? 1 : 0,
                pointerEvents: expanded ? 'auto' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                transformOrigin: 'bottom right'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-2)' }}>
                        Challenges
                    </span>
                    <button 
                        onClick={toggleExpand}
                        style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '4px', display: 'flex' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {hasUnusedTicket && (
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(34, 197, 94, 0.08)', borderRadius: 'var(--r-md)', border: '1px solid var(--green-border)' }}>
                        <p style={{ margin: 0, color: 'var(--green)', fontSize: '0.8rem', fontWeight: '700' }}>✨ 1 Free Ticket Available</p>
                    </div>
                )}

                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ margin: '0 0 4px', color: 'var(--text-3)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                            To Claim
                        </p>
                        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-h)' }}>
                            ${(user.sponsoredRewardsBalance || 0).toFixed(2)}
                        </div>
                    </div>
                    {(hasUnusedTicket || (hasBalance && !isCompleted)) && !hasSeen && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 10px rgba(34,197,94,0.5)' }} />
                    )}
                </div>

                {user.freeTicketUsed && (
                <div style={{ marginBottom: '20px' }}>
                    {/* $5 Challenge Bar */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                            <span style={{ color: normal5Progress >= 3 ? 'var(--green)' : 'var(--text-2)' }}>
                                {normal5Progress >= 3 ? '✓ ' : ''}3 × $5 Games
                            </span>
                            <span style={{ color: 'var(--text-1)', fontWeight: '600' }}>{normal5Progress} / 3</span>
                        </div>
                        <div style={{ height: '4px', background: 'var(--bg-3)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ 
                                height: '100%', 
                                width: `${(normal5Progress / 3) * 100}%`, 
                                background: normal5Progress >= 3 ? 'var(--green)' : 'var(--accent)',
                                transition: 'width 0.5s ease-out'
                            }} />
                        </div>
                    </div>
                    
                    {/* $10 Challenge Bar */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                            <span style={{ color: normal10Progress >= 1 ? 'var(--green)' : 'var(--text-2)' }}>
                                {normal10Progress >= 1 ? '✓ ' : ''}1 × $10 Game
                            </span>
                            <span style={{ color: 'var(--text-1)', fontWeight: '600' }}>{normal10Progress} / 1</span>
                        </div>
                        <div style={{ height: '4px', background: 'var(--bg-3)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ 
                                height: '100%', 
                                width: `${(normal10Progress / 1) * 100}%`, 
                                background: normal10Progress >= 1 ? 'var(--green)' : 'var(--accent)',
                                transition: 'width 0.5s ease-out'
                            }} />
                        </div>
                    </div>
                </div>
                )}

                <button 
                    onClick={goToRewards}
                    style={{ 
                        width: '100%', 
                        padding: '10px', 
                        fontSize: '0.9rem', 
                        fontWeight: '600',
                        color: 'var(--text-2)',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseOver={(e) => {
                        e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.target.style.color = '#fff';
                    }}
                    onMouseOut={(e) => {
                        e.target.style.background = 'transparent';
                        e.target.style.color = 'var(--text-2)';
                    }}
                >
                    View details
                </button>
            </div>

            {/* Toggle Button */}
            <button
                onClick={toggleExpand}
                style={{
                    background: '#000',
                    border: '1px solid var(--border)',
                    borderRadius: '20px',
                    padding: '5px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-xl)',
                    color: 'var(--text-1)',
                    position: 'relative',
                    fontFamily: 'inherit',
                    fontWeight: '700',
                    fontSize: '0.72rem',
                    lineHeight: '1.5'
                }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-2)' }}>
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                </svg>
                CHALLENGES
                {hasNotification && !expanded && (
                    <div style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--green)',
                        border: '2px solid #000'
                    }} />
                )}
            </button>
        </div>
    );
}
