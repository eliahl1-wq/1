import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/apiBase';
import { hasUnlockedFreeTicket } from '../utils/freeTicket';
import { AGAR } from '../features/agar/config/agarConfig';
import { useAgarToken } from '../features/agar/ui/AgarTokenContext';
import AgarLogo from '../features/agar/ui/AgarLogo';
import useBalanceCurrency from '../hooks/useBalanceCurrency';

const SolLogo = ({ size = 13, style }) => (
    <img
        src="/solana-sol-logo.png"
        alt="SOL"
        style={{ height: size, width: 'auto', objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    />
);

export default function RewardsWidget() {
    const { user, refreshUser } = useAuth();
    const [balanceCurrency] = useBalanceCurrency();
    const navigate = useNavigate();
    const location = useLocation();
    const { snapshot: agarMarket, launchReady: agarLaunchReady, openAgarModal } = useAgarToken();
    const [expanded, setExpanded] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const [hasSeen, setHasSeen] = useState(false);
    const [claimStatus, setClaimStatus] = useState(null); // { type: 'success'|'error'|'loading', message: string }
    const [hoveredKey, setHoveredKey] = useState(() => localStorage.getItem('challenges_hovered_key'));
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

    const hasTicketChallenge = Boolean(
        user
        && !user.freeTicketChallengeCompleted
        && !user.freeTicketUsed
        && !user.rewardsDisabled
    );
    const hasUnusedTicket = Boolean(user && hasUnlockedFreeTicket(user));

    useEffect(() => {
        if (!isInitialized || !user || (!hasTicketChallenge && !hasUnusedTicket)) return;

        const accountKey = user._id || user.id || user.username || 'account';
        const state = hasTicketChallenge ? 'challenge' : 'unlocked';
        const stateTimestamp = hasTicketChallenge
            ? user.freeTicketChallengeCheckedAt
            : user.freeTicketChallengeCompletedAt;
        const popupKey = `free_ticket_popup_v2:${accountKey}:${state}:${stateTimestamp || 'initial'}`;

        if (localStorage.getItem(popupKey) === 'shown') return;

        setExpanded(true);
        setHasSeen(false);
        localStorage.setItem('rewards_widget_expanded', 'true');
        localStorage.removeItem('rewards_notif_seen');
        localStorage.setItem(popupKey, 'shown');
    }, [hasTicketChallenge, hasUnusedTicket, isInitialized, user]);

    if (!user || !isInitialized) return null;

    const allowedPaths = ['/pre-game', '/agar', '/slither', '/surviv', '/competitive-slither', '/competitive-agar'];
    if (!allowedPaths.includes(location.pathname)) return null;
    const isPregame = location.pathname === '/pre-game';

    const promoBalance = Number(user.sponsoredRewardsBalance) || 0;
    const permanentRewards = user.permanentRewards || {};
    const permanentBalance = Number(permanentRewards.balanceUsd) || 0;
    const permanentProgress = Number(permanentRewards.progressVolumeUsd) || 0;
    const permanentProgressPct = Number(permanentRewards.progressPct) || 0;
    const permanentCycleVolume = Number(permanentRewards.cycleVolumeUsd) || 50;
    const permanentCycleReward = Number(permanentRewards.rewardPerCycleUsd) || 2;
    const solPrice = Number(user.solPrice) || 0;
    const isSolView = balanceCurrency === 'SOL' && solPrice > 0;
    const nextRewardLabel = isSolView
        ? `${(permanentCycleReward / solPrice).toFixed(6)} SOL`
        : `$${permanentCycleReward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    const rentFallbackBalance = Number(user.rentFallbackBalanceUsd) || 0;
    const totalBalance = promoBalance + permanentBalance + rentFallbackBalance;
    const hasBalance = totalBalance > 0;
    const isCompleted = user.sponsoredRewardsCompleted && user.sponsoredRewardsUnlocked;
    const canClaim = rentFallbackBalance > 0 || (!user.rewardsDisabled && (permanentBalance > 0 || (isCompleted && promoBalance > 0)));

    const fallbackMultiplier = Math.ceil(Math.max(5, promoBalance) / 5);
    const req5 = Number(user.starterRewardRequirements?.req5) || fallbackMultiplier * 3;
    const req10 = Number(user.starterRewardRequirements?.req10) || fallbackMultiplier;
    const normal5Progress = Math.min(req5, user.completedFiveDollarNormalGames ?? 0);
    const normal10Progress = Math.min(req10, user.completedTenDollarNormalGames ?? 0);
    const hasActiveChallenge = user.freeTicketUsed && !isCompleted && !user.rewardsDisabled;
    const showReward = user.freeTicketUsed && (totalBalance > 0 || !isCompleted);

    const challengeKey = `${user.freeTicketChallengeCompleted}_${normal5Progress}_${req5}_${normal10Progress}_${req10}_${user.freeTicketUsed}`;
    const hasUnhoveredChallenge = hasActiveChallenge && (hoveredKey !== challengeKey);
    const hasNotification = ((hasTicketChallenge || hasUnusedTicket || hasBalance) && !hasSeen) || hasUnhoveredChallenge || canClaim;

    const handleChallengeHover = () => {
        if (hasUnhoveredChallenge) {
            localStorage.setItem('challenges_hovered_key', challengeKey);
            setHoveredKey(challengeKey);
        }
    };

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
                return data.claim;
            }
            if (data.claim?.status === 'failed') throw new Error(data.claim.error || 'Reward claim failed.');
        }
        throw new Error('Claim is still processing. It is safe to close this page and check again later.');
    };

    const handleClaim = async () => {
        if (claimLockRef.current || claimStatus?.type === 'loading' || !canClaim) return;
        claimLockRef.current = true;
        setClaimStatus({ type: 'loading', message: 'Reserving and processing your claim… Please wait.' });
        try {
            const res = await fetch(`${API_URL}/api/user/claim-rewards`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.status === 202 && data.processing) {
                setClaimStatus({ type: 'loading', message: 'Payment submitted. Waiting for blockchain confirmation…' });
                const confirmedClaim = await waitForClaim();
                setClaimStatus({ type: 'success', message: `Successfully claimed $${confirmedClaim.amountUsd.toFixed(2)}!` });
                return;
            }
            if (!res.ok || !data.success) throw new Error(data.error || 'Failed to claim rewards.');
            await refreshUser();
            setClaimStatus({ type: 'success', message: `Successfully claimed $${data.amount.toFixed(2)}!` });
        } catch (err) {
            setClaimStatus({ type: 'error', message: err.message || 'Error claiming rewards. Try again later.' });
        } finally {
            claimLockRef.current = false;
        }
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
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)',
                padding: '16px',
                boxShadow: isPregame ? 'none' : 'var(--shadow-xl)',
                marginBottom: '10px',
                transform: expanded ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                opacity: expanded ? 1 : 0,
                pointerEvents: expanded ? 'auto' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                transformOrigin: 'bottom right'
            }}>
                {!isPregame && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-2)' }}>
                            Rewards
                        </span>
                        {(hasUnhoveredChallenge || canClaim) && (
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: 'var(--green)',
                                boxShadow: '0 0 10px rgba(34,197,94,0.5)'
                            }} />
                        )}
                    </div>
                    <button
                        onClick={toggleExpand}
                        aria-label="Close rewards"
                        className="float-panel-close"
                        style={{ fontSize: '1rem', fontWeight: 'bold' }}
                    >
                        ✕
                    </button>
                </div>}

                {hasTicketChallenge && (
                    <div className="challenge-pulse-animation" style={{ marginBottom: '16px', padding: isPregame ? 0 : '14px', background: isPregame ? 'transparent' : 'var(--bg-1)', borderRadius: isPregame ? 0 : 'var(--r-md)', border: isPregame ? 'none' : '1px solid var(--border-2)' }}>
                        <div style={{ color: 'var(--text-subtle)', fontSize: '0.68rem', fontWeight: 900, letterSpacing: '0.08em', marginBottom: '5px' }}>
                            NEW REWARD
                        </div>
                        <div style={{ color: 'var(--text-h)', fontSize: '0.94rem', fontWeight: 800 }}>
                            Unlock a Free Ticket
                        </div>
                        <p style={{ margin: '6px 0 10px', color: 'var(--text-2)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                            Complete 1 Normal game in Agar, Slither or Surviv to earn your free ticket. Arena games do not count.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-1)', fontSize: '0.76rem', fontWeight: 700, marginBottom: '6px' }}>
                            <span>Normal games played</span><span>0 / 1</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.10)', borderRadius: '999px', overflow: 'hidden', marginBottom: '10px' }}>
                            <div style={{ width: '0%', height: '100%', background: 'var(--green)' }} />
                        </div>
                        <div style={{ color: 'var(--green)', fontSize: '0.76rem', fontWeight: 800 }}>
                            REWARD: 1 FREE TICKET
                        </div>
                    </div>
                )}

                {hasUnusedTicket && (
                    <div style={{ marginBottom: '16px', padding: isPregame ? 0 : '12px', background: isPregame ? 'transparent' : 'rgba(34, 197, 94, 0.08)', borderRadius: isPregame ? 0 : 'var(--r-md)', border: isPregame ? 'none' : '1px solid var(--green-border)' }}>
                        <p style={{ margin: 0, color: 'var(--green)', fontSize: '0.8rem', fontWeight: '700' }}>✨ 1 Free Ticket Available</p>
                    </div>
                )}

                <div style={{ marginBottom: '16px', padding: isPregame ? 0 : '13px', border: isPregame ? 'none' : '1px solid var(--border-2)', borderRadius: isPregame ? 0 : 'var(--r-md)', background: isPregame ? 'transparent' : 'var(--bg-1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div>
                            <div style={{ color: 'var(--text-subtle)', fontSize: '.64rem', fontWeight: 900, letterSpacing: '.08em' }}>NEXT REWARD</div>
                            <div style={{ marginTop: '3px', color: 'var(--text-h)', fontSize: '.84rem', fontWeight: 800 }}>{nextRewardLabel}</div>
                        </div>
                        {!isPregame && <strong className="mono" style={{ color: permanentBalance > 0 ? 'var(--green)' : 'var(--text-h)', fontSize: '.9rem' }}>${permanentBalance.toFixed(2)}</strong>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-2)', fontSize: '.72rem', marginBottom: '6px' }}>
                        <span>Cashout progress</span><span className="mono">${permanentProgress.toFixed(2)} / ${permanentCycleVolume.toFixed(2)}</span>
                    </div>
                    <div style={{ height: '7px', overflow: 'hidden', borderRadius: '999px', background: 'rgba(255,255,255,.08)' }}>
                        <div style={{ width: `${Math.min(100, permanentProgressPct)}%`, height: '100%', borderRadius: 'inherit', background: 'linear-gradient(90deg,#16a34a,#22c55e,#4ade80)', boxShadow: '0 0 10px rgba(34,197,94,.3)' }} />
                    </div>
                </div>

                {showReward && (
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: 'var(--text-h)', fontSize: '0.9rem', fontWeight: 700 }}>
                        Reward: <span style={{ color: 'var(--green)' }}>${totalBalance.toFixed(2)}</span>
                    </div>
                    {(hasUnusedTicket || hasBalance) && !hasSeen && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 10px rgba(34,197,94,0.5)' }} />
                    )}
                </div>
                )}

                {hasActiveChallenge && (
                <div
                    onMouseEnter={handleChallengeHover}
                    onTouchStart={handleChallengeHover}
                    onClick={handleChallengeHover}
                    className={hasUnhoveredChallenge ? 'challenge-pulse-animation' : ''}
                    style={{ marginBottom: '20px' }}
                >
                    {/* $5 reward progress */}
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                            <span style={{ color: normal5Progress >= req5 ? 'var(--green)' : 'var(--text-2)' }}>
                                {normal5Progress >= req5 ? '✓ ' : ''}{req5} × $5 Games
                            </span>
                            <span style={{ color: 'var(--text-1)', fontWeight: '600' }}>{normal5Progress} / {req5}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${(normal5Progress / req5) * 100}%`,
                                background: normal5Progress >= req5 ? 'var(--green)' : '#ffffff',
                                boxShadow: normal5Progress >= req5 ? '0 0 8px rgba(34, 197, 94, 0.4)' : '0 0 8px rgba(255, 255, 255, 0.2)',
                                transition: 'width 0.5s ease-out'
                            }} />
                        </div>
                    </div>

                    {/* $10 reward progress */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                            <span style={{ color: normal10Progress >= req10 ? 'var(--green)' : 'var(--text-2)' }}>
                                {normal10Progress >= req10 ? '✓ ' : ''}{req10} × $10 Games
                            </span>
                            <span style={{ color: 'var(--text-1)', fontWeight: '600' }}>{normal10Progress} / {req10}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${(normal10Progress / req10) * 100}%`,
                                background: normal10Progress >= req10 ? 'var(--green)' : '#ffffff',
                                boxShadow: normal10Progress >= req10 ? '0 0 8px rgba(34, 197, 94, 0.4)' : '0 0 8px rgba(255, 255, 255, 0.2)',
                                transition: 'width 0.5s ease-out'
                            }} />
                        </div>
                    </div>
                </div>
                )}

                {(canClaim || user.rewardClaimInProgress) && (
                    <button
                        type="button"
                        className="btn btn-green"
                        onClick={handleClaim}
                        disabled={claimStatus?.type === 'loading' || user.rewardClaimInProgress}
                        style={{ width: '100%', padding: '11px', marginBottom: '12px' }}
                    >
                        {claimStatus?.type === 'loading' || user.rewardClaimInProgress ? 'CLAIMING...' : 'CLAIM REWARD'}
                    </button>
                )}
                <button
                    onClick={goToRewards}
                    style={{ 
                        width: '100%', 
                        padding: '10px', 
                        background: 'none', 
                        border: 'none', 
                        color: 'var(--text-2)', 
                        cursor: 'pointer', 
                        fontSize: '0.85rem',
                        textDecoration: 'underline'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-2)'}
                >
                    View details
                </button>
            </div>

            {/* Toggle Button Container */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {location.pathname === '/pre-game' && (
                    <button
                        type="button"
                        className="agar-price-pill"
                        onClick={() => openAgarModal()}
                        aria-label="Open AGAR price chart"
                        title="Open AGAR chart"
                    >
                        <AgarLogo size={18} />
                        <span className="mono">
                            {agarLaunchReady && Number.isFinite(agarMarket.price)
                                ? `${agarMarket.price.toLocaleString('en-US', { maximumSignificantDigits: 5 })}`
                                : AGAR.messages.comingSoon}
                        </span>
                    </button>
                )}
                {location.pathname === '/pre-game' && (
                    <div className="sol-price-pill" style={{ position: 'static', margin: 0, height: '28px', display: 'flex', alignItems: 'center', gap: '6px', boxSizing: 'border-box' }}>
                        <SolLogo size={14} />
                        <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-h)', fontWeight: 700 }}>
                            ${(user?.solPrice || 64).toFixed(2)}
                        </span>
                    </div>
                )}
                <button
                    onClick={toggleExpand}
                    style={{
                        background: 'var(--bg-2)',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '5px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-md)',
                        color: 'var(--text)',
                        position: 'relative',
                        fontFamily: 'inherit',
                        fontWeight: '700',
                        fontSize: '0.72rem',
                        lineHeight: '1.2',
                        transition: 'all 0.15s ease',
                        height: '28px',
                        boxSizing: 'border-box'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-3)';
                        e.currentTarget.style.color = 'var(--text-h)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-2)';
                        e.currentTarget.style.color = 'var(--text)';
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-2)' }}>
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                    </svg>
                    Rewards
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-2)', transition: 'transform 0.2s ease', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
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
            {claimStatus && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 9999, padding: '20px', backdropFilter: 'blur(8px)'
                }}>
                    <div className="panel" style={{
                        maxWidth: '400px', width: '100%', padding: '30px', textAlign: 'center',
                        border: claimStatus.type === 'error' ? '1px solid rgba(239, 68, 68, 0.4)' : claimStatus.type === 'success' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--border)'
                    }}>
                        <div style={{ marginBottom: '20px' }}>
                            {claimStatus.type === 'loading' && <div className="spinner" style={{ margin: '0 auto' }} />}
                            {claimStatus.type === 'success' && (
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" style={{ margin: '0 auto' }}>
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            )}
                            {claimStatus.type === 'error' && (
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ margin: '0 auto' }}>
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="15" y1="9" x2="9" y2="15"/>
                                    <line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                            )}
                        </div>

                        <h3 style={{ margin: '0 0 10px', color: 'var(--text-h)', fontSize: '1.25rem', fontWeight: '700' }}>
                            {claimStatus.type === 'loading' ? 'Claiming Rewards' : claimStatus.type === 'success' ? 'Success!' : 'Failed'}
                        </h3>

                        <p style={{ margin: '0 0 24px', color: 'var(--text-2)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            {claimStatus.message}
                        </p>

                        {claimStatus.type !== 'loading' && (
                            <button
                                className="btn btn-green"
                                onClick={() => setClaimStatus(null)}
                                style={{ padding: '10px 24px', fontSize: '0.9rem' }}
                            >
                                Dismiss
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
