import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/apiBase';

export default function RewardsWidget() {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [expanded, setExpanded] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const [hasSeen, setHasSeen] = useState(false);
    const [claimState, setClaimState] = useState({ loading: false, error: '' });
    const claimLockRef = useRef(false);

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

    useEffect(() => {
        if (!user?.rewardClaimInProgress) return undefined;
        let cancelled = false;
        const poll = async () => {
            try {
                const res = await fetch(`${API_URL}/api/user/reward-claim-status`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await res.json();
                if (!cancelled && ['confirmed', 'failed'].includes(data.claim?.status)) await refreshUser();
            } catch {
                // Server reconciliation continues even if this lightweight poll fails.
            }
        };
        poll();
        const id = setInterval(poll, 3000);
        return () => { cancelled = true; clearInterval(id); };
    }, [user?.rewardClaimInProgress, refreshUser]);
    if (!user || !isInitialized) return null;

    const allowedPaths = ['/pre-game', '/agar', '/slither', '/surviv', '/competitive-slither', '/competitive-agar'];
    if (!allowedPaths.includes(location.pathname)) return null;

    const hasUnusedTicket = user.hasFreeTicket && !user.freeTicketUsed;
    const promoBalance = Number(user.sponsoredRewardsBalance) || 0;
    const rentFallbackBalance = Number(user.rentFallbackBalanceUsd) || 0;
    const totalBalance = promoBalance + rentFallbackBalance;
    const hasBalance = totalBalance > 0;
    const isCompleted = user.sponsoredRewardsCompleted && user.sponsoredRewardsUnlocked;
    const canClaim = rentFallbackBalance > 0 || (!user.rewardsDisabled && isCompleted && promoBalance > 0);

    // Notifications: Needs attention if ticket unused or balance > 0 and not fully completed/cashed out
    // and if they haven't explicitly opened the widget in this session.
    const hasNotification = (hasUnusedTicket || hasBalance) && !hasSeen;

    const requiredContribution = Math.max(5, promoBalance);
    const multiplier = Math.ceil(requiredContribution / 5);
    const req5 = multiplier * 3;
    const req10 = multiplier;
    const normal5Progress = Math.min(req5, user.completedFiveDollarNormalGames ?? 0);
    const normal10Progress = Math.min(req10, user.completedTenDollarNormalGames ?? 0);

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

    const waitForClaim = async () => {
        for (let attempt = 0; attempt < 40; attempt += 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const res = await fetch(`${API_URL}/api/user/reward-claim-status`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.claim?.status === 'confirmed') {
                await refreshUser();
                return;
            }
            if (data.claim?.status === 'failed') throw new Error(data.claim.error || 'Reward claim failed.');
        }
        throw new Error('Claim is still processing. Check Rewards again shortly.');
    };

    const handleClaim = async () => {
        if (claimLockRef.current || claimState.loading || !canClaim) return;
        claimLockRef.current = true;
        setClaimState({ loading: true, error: '' });
        try {
            const res = await fetch(`${API_URL}/api/user/claim-rewards`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.status === 202 && data.processing) {
                await waitForClaim();
                return;
            }
            if (!res.ok || !data.success) throw new Error(data.error || 'Failed to claim reward.');
            await refreshUser();
        } catch (err) {
            setClaimState({ loading: false, error: err.message || 'Failed to claim reward.' });
        } finally {
            claimLockRef.current = false;
        }
    };
    if ((!hasUnusedTicket && !hasBalance && !user.rewardClaimInProgress) || (user.rewardsDisabled && rentFallbackBalance <= 0)) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '18px',
            right: '18px',
            zIndex: 1050,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            fontFamily: 'var(--font-main)'
        }}>
            {/* Expanded Content */}
            <div style={{
                width: '340px',
                background: 'linear-gradient(155deg, #151515 0%, #080808 62%, #050505 100%)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '18px',
                padding: '18px',
                boxShadow: '0 22px 60px rgba(0, 0, 0, 0.58), 0 1px 0 rgba(255, 255, 255, 0.05) inset',
                marginBottom: '12px',
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
                        aria-label="Close challenges"
                        style={{ width: '28px', height: '28px', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'var(--text-3)', cursor: 'pointer', padding: 0, display: 'flex' }}
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

                <div style={{ marginBottom: '16px', padding: '12px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px' }}>
                    <div style={{ color: 'var(--text-h)', fontSize: '0.9rem', fontWeight: 700 }}>
                        Reward: <span style={{ color: 'var(--green)' }}>${totalBalance.toFixed(2)}</span>
                    </div>
                    {(hasUnusedTicket || hasBalance) && !hasSeen && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 10px rgba(34,197,94,0.5)' }} />
                    )}
                </div>

                {user.freeTicketUsed && !isCompleted && !user.rewardsDisabled && (
                <div style={{ marginBottom: '20px' }}>
                    {/* $5 Challenge Bar */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                            <span style={{ color: normal5Progress >= req5 ? 'var(--green)' : 'var(--text-2)' }}>
                                {normal5Progress >= req5 ? '✓ ' : ''}{req5} × $5 Games
                            </span>
                            <span style={{ color: 'var(--text-1)', fontWeight: '600' }}>{normal5Progress} / {req5}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.12)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${(normal5Progress / req5) * 100}%`,
                                background: '#fff', boxShadow: '0 0 9px rgba(255, 255, 255, 0.22)',
                                transition: 'width 0.5s ease-out'
                            }} />
                        </div>
                    </div>

                    {/* $10 Challenge Bar */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                            <span style={{ color: normal10Progress >= req10 ? 'var(--green)' : 'var(--text-2)' }}>
                                {normal10Progress >= req10 ? '✓ ' : ''}{req10} × $10 Games
                            </span>
                            <span style={{ color: 'var(--text-1)', fontWeight: '600' }}>{normal10Progress} / {req10}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.12)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${(normal10Progress / req10) * 100}%`,
                                background: '#fff', boxShadow: '0 0 9px rgba(255, 255, 255, 0.22)',
                                transition: 'width 0.5s ease-out'
                            }} />
                        </div>
                    </div>
                </div>
                )}

                {(canClaim || user.rewardClaimInProgress) && (
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleClaim}
                        disabled={claimState.loading || user.rewardClaimInProgress}
                        style={{ width: '100%', padding: '11px', marginBottom: claimState.error ? '8px' : '12px' }}
                    >
                        {claimState.loading || user.rewardClaimInProgress ? 'CLAIMING...' : 'CLAIM REWARD'}
                    </button>
                )}
                {claimState.error && (
                    <p style={{ margin: '0 0 12px', color: 'var(--red)', fontSize: '0.78rem' }}>{claimState.error}</p>
                )}
                <button className="btn btn-primary"
                    onClick={goToRewards}
                    style={{ width: '100%', padding: '10px' }}

                >
                    View all challenges
                </button>
            </div>

            {/* Toggle Button */}
            <button
                onClick={toggleExpand}
                style={{
                    background: 'linear-gradient(180deg, #171717 0%, #080808 100%)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: '22px',
                    padding: '6px 12px 6px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 10px 28px rgba(0,0,0,0.42), 0 1px 0 rgba(255,255,255,0.05) inset',
                    color: 'var(--text-1)',
                    position: 'relative',
                    fontFamily: 'inherit',
                    fontWeight: '700',
                    fontSize: '0.74rem',
                    lineHeight: '1.5'
                }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-2)' }}>
                    <path d="M5 21V4"/><path d="M5 5h10.5l-2 3 2 3H5"/>
                </svg>
                challenges
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
