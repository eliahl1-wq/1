import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppTopbar from '../components/AppTopbar';
import Background from '../components/Background';
import { API_URL } from '../utils/apiBase';

export default function Rewards() {
    const { user, loading, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [claimStatus, setClaimStatus] = useState(null); // { type: 'success'|'error'|'loading', message: string }
    const claimLockRef = useRef(false);

    useEffect(() => {
        document.title = 'AgarStake | Rewards';

        // Fetch transaction history for rewards
        const fetchHistory = async () => {
            setHistoryLoaded(false);
            try {
                const res = await fetch(`${API_URL}/api/transactions`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const rewardTxs = data.filter(tx =>
                        tx.meta?.event === 'sponsored_rewards_claim' ||
                        tx.meta?.isRentExemptFallback === true ||
                        tx.meta?.event === 'free_ticket_join'
                    );
                    setHistory(rewardTxs);
                }
            } catch (err) {
                console.error("Failed to fetch rewards history:", err);
            } finally {
                setHistoryLoaded(true);
            }
        };

        if (user) {
            fetchHistory();
        }
    }, [user]);

    useEffect(() => {
        if (!user?.rewardClaimInProgress) return undefined;
        let cancelled = false;
        setClaimStatus({ type: 'loading', message: 'Waiting for blockchain confirmation…' });
        const poll = async () => {
            try {
                const res = await fetch(`${API_URL}/api/user/reward-claim-status`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await res.json();
                if (cancelled) return;
                if (data.claim?.status === 'confirmed') {
                    await refreshUser();
                    setClaimStatus({ type: 'success', message: `Successfully claimed $${Number(data.claim.amountUsd).toFixed(2)}!` });
                } else if (data.claim?.status === 'failed') {
                    await refreshUser();
                    setClaimStatus({ type: 'error', message: data.claim.error || 'Reward claim failed.' });
                }
            } catch {
                // Keep the claim locked; the server reconciler remains authoritative.
            }
        };
        poll();
        const id = setInterval(poll, 3000);
        return () => { cancelled = true; clearInterval(id); };
    }, [user?.rewardClaimInProgress, refreshUser]);
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
    const isCompleted = user.sponsoredRewardsCompleted && user.sponsoredRewardsUnlocked;

    const promoBalance = Number(user.sponsoredRewardsBalance) || 0;
    const rentFallbackBalance = Number(user.rentFallbackBalanceUsd) || 0;
    const currentBalance = promoBalance + rentFallbackBalance;
    const claimableBalance = rentFallbackBalance + (isCompleted && !user.rewardsDisabled ? promoBalance : 0);
    const canClaim = claimableBalance > 0;
    const latestClaim = history.find(tx => tx.meta?.event === 'sponsored_rewards_claim');
    const claimedRewardAmount = Number(latestClaim?.meta?.amountUsd) || 0;
    const challengeRewardAmount = promoBalance > 0 ? promoBalance : (isCompleted ? claimedRewardAmount : 0);
    const challengeRewardLabel = isCompleted && promoBalance <= 0 && !historyLoaded
        ? '--'
        : '
    const requiredContribution = Math.max(5, challengeRewardAmount);
    const multiplier = Math.ceil(requiredContribution / 5);
    const req5 = multiplier * 3;
    const req10 = multiplier * 1;

    const normal5Progress = Math.min(req5, user.completedFiveDollarNormalGames ?? 0);
    const normal10Progress = Math.min(req10, user.completedTenDollarNormalGames ?? 0);

    const waitForClaim = async () => {
        for (let attempt = 0; attempt < 40; attempt += 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const res = await fetch(`${API_URL}/api/user/reward-claim-status`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.claim?.status === 'confirmed') {
                await refreshUser();
                setClaimStatus({ type: 'success', message: `Successfully claimed $${data.claim.amountUsd.toFixed(2)}!` });
                return;
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
                await waitForClaim();
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
                            Current Reward Balance
                        </p>
                        <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-h)' }}>
                            ${currentBalance.toFixed(2)}
                        </div>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-2)', fontSize: '0.8rem' }}>Locked promo rewards and retained game winnings</p>
                    </div>

                    <div className="panel" style={{ padding: '20px', background: 'rgba(20, 24, 30, 0.6)' }}>
                        <p style={{ margin: '0 0 4px', color: 'var(--green)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                            To Claim
                        </p>
                        <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--green)', marginBottom: '8px' }}>
                            ${claimableBalance.toFixed(2)}
                        </div>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-2)', fontSize: '0.8rem' }}>
                            {user.rewardClaimInProgress ? 'Claim is processing' : canClaim ? 'Ready to claim below' : isCompleted && currentBalance === 0 ? 'All rewards claimed!' : 'Requires challenges to be completed'}
                        </p>
                    </div>
                </div>

                {user.rewardsDisabled && (
                    <div className="panel" style={{ padding: '16px 18px', marginBottom: '24px', border: '1px solid rgba(239,68,68,0.35)', color: 'var(--red)' }}>
                        Promotional rewards are disabled while an admin reviews accounts funded by the same external wallet. Retained game winnings can still be claimed.
                    </div>
                )}
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
                                    className="btn btn-primary"
                                    onClick={() => navigate('/pre-game', { state: { selectedMode: 'agar' } })}
                                    style={{ flex: 1, padding: '12px 20px', fontSize: '1rem', display: 'flex', justifyContent: 'center' }}
                                >
                                    Use on Agar
                                </button>
                                <button
                                    className="btn btn-primary"
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
                {(user.freeTicketUsed || rentFallbackBalance > 0 || user.rewardClaimInProgress) && (
                    <section style={{ marginBottom: '40px' }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-1)', fontWeight: '700' }}>
                            Rewards
                        </h2>

                    <div className="panel" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
                            <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-h)', fontWeight: '600' }}>
                                Unlock Challenges
                            </h4>
                            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-h)' }}>
                                Reward: <span style={{ color: 'var(--green)' }}>{challengeRewardLabel}</span>
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

                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleClaim}
                            disabled={!canClaim || claimStatus?.type === 'loading' || user.rewardClaimInProgress}
                            style={{
                                width: '100%', marginTop: '24px', padding: '13px 20px', fontSize: '0.95rem',
                                ...(!canClaim && !user.rewardClaimInProgress ? { background: '#374151', color: '#9ca3af', boxShadow: 'none', opacity: 0.7 } : {})
                            }}
                        >
                            {user.rewardClaimInProgress || claimStatus?.type === 'loading' ? 'CLAIMING...' : canClaim ? (user.rewardsDisabled ? 'CLAIM RETAINED WINNINGS' : 'CLAIM REWARD') : isCompleted && currentBalance === 0 ? 'CLAIMED' : user.rewardsDisabled ? 'REWARDS UNDER REVIEW' : 'COMPLETE CHALLENGES'}
                        </button>
                    </div>
                </section>
                )}

                {/* Section 3: Information */}
                <section style={{ marginBottom: '40px' }}>
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

                {/* Section 4: History */}
                <section style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-1)', fontWeight: '700' }}>
                        Rewards History
                    </h2>
                    {history.length === 0 ? (
                        <div className="panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-2)', fontSize: '0.9rem' }}>
                            No rewards activity found.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {history.map((tx) => {
                                let title = 'Reward Activity';
                                let desc = '';
                                let val = '';
                                let color = 'var(--text-h)';

                                if (tx.meta?.event === 'sponsored_rewards_claim') {
                                    title = 'Claim Payout';
                                    desc = `Claimed via Solana: ${tx.meta.signature ? tx.meta.signature.slice(0, 8) + '...' : 'Pending'}`;
                                    val = `-$${(tx.meta.amountUsd || 0).toFixed(2)}`;
                                    color = 'var(--green)';
                                } else if (tx.meta?.isRentExemptFallback) {
                                    title = 'Rent Fallback Credit';
                                    desc = 'Game payout auto-credited due to wallet rent limits';
                                    val = `+$${((tx.amount || 0) * (tx.meta.solPrice || 64)).toFixed(2)}`;
                                    color = 'var(--accent)';
                                } else if (tx.meta?.event === 'free_ticket_join') {
                                    title = 'Free Ticket Used';
                                    desc = `Joined $${tx.meta.entryFeeUsd || 10} match using free ticket`;
                                    val = 'FREE';
                                    color = 'var(--blue)';
                                }

                                return (
                                    <div key={tx._id} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: 'var(--text-h)', fontWeight: '600' }}>{title}</h4>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-2)' }}>{desc}</p>
                                        </div>
                                        <div style={{ fontSize: '1.05rem', fontWeight: '700', color }}>
                                            {val}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Custom Modal/Alert System */}
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
                                    className="btn btn-primary"
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
        </div>
    );
}
 + challengeRewardAmount.toFixed(2);
    const requiredContribution = Math.max(5, challengeRewardAmount);
    const multiplier = Math.ceil(requiredContribution / 5);
    const req5 = multiplier * 3;
    const req10 = multiplier * 1;

    const normal5Progress = Math.min(req5, user.completedFiveDollarNormalGames ?? 0);
    const normal10Progress = Math.min(req10, user.completedTenDollarNormalGames ?? 0);

    const waitForClaim = async () => {
        for (let attempt = 0; attempt < 40; attempt += 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const res = await fetch(`${API_URL}/api/user/reward-claim-status`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.claim?.status === 'confirmed') {
                await refreshUser();
                setClaimStatus({ type: 'success', message: `Successfully claimed $${data.claim.amountUsd.toFixed(2)}!` });
                return;
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
                await waitForClaim();
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
                            Current Reward Balance
                        </p>
                        <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-h)' }}>
                            ${currentBalance.toFixed(2)}
                        </div>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-2)', fontSize: '0.8rem' }}>Locked promo rewards and retained game winnings</p>
                    </div>

                    <div className="panel" style={{ padding: '20px', background: 'rgba(20, 24, 30, 0.6)' }}>
                        <p style={{ margin: '0 0 4px', color: 'var(--green)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                            To Claim
                        </p>
                        <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--green)', marginBottom: '8px' }}>
                            ${claimableBalance.toFixed(2)}
                        </div>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-2)', fontSize: '0.8rem' }}>
                            {user.rewardClaimInProgress ? 'Claim is processing' : canClaim ? 'Ready to claim below' : isCompleted && currentBalance === 0 ? 'All rewards claimed!' : 'Requires challenges to be completed'}
                        </p>
                    </div>
                </div>

                {user.rewardsDisabled && (
                    <div className="panel" style={{ padding: '16px 18px', marginBottom: '24px', border: '1px solid rgba(239,68,68,0.35)', color: 'var(--red)' }}>
                        Promotional rewards are disabled while an admin reviews accounts funded by the same external wallet. Retained game winnings can still be claimed.
                    </div>
                )}
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
                                    className="btn btn-primary"
                                    onClick={() => navigate('/pre-game', { state: { selectedMode: 'agar' } })}
                                    style={{ flex: 1, padding: '12px 20px', fontSize: '1rem', display: 'flex', justifyContent: 'center' }}
                                >
                                    Use on Agar
                                </button>
                                <button
                                    className="btn btn-primary"
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
                {(user.freeTicketUsed || rentFallbackBalance > 0 || user.rewardClaimInProgress) && (
                    <section style={{ marginBottom: '40px' }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-1)', fontWeight: '700' }}>
                            Rewards
                        </h2>

                    <div className="panel" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
                            <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-h)', fontWeight: '600' }}>
                                Unlock Challenges
                            </h4>
                            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-h)' }}>
                                Reward: <span style={{ color: 'var(--green)' }}>{challengeRewardLabel}</span>
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

                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleClaim}
                            disabled={!canClaim || claimStatus?.type === 'loading' || user.rewardClaimInProgress}
                            style={{
                                width: '100%', marginTop: '24px', padding: '13px 20px', fontSize: '0.95rem',
                                ...(!canClaim && !user.rewardClaimInProgress ? { background: '#374151', color: '#9ca3af', boxShadow: 'none', opacity: 0.7 } : {})
                            }}
                        >
                            {user.rewardClaimInProgress || claimStatus?.type === 'loading' ? 'CLAIMING...' : canClaim ? (user.rewardsDisabled ? 'CLAIM RETAINED WINNINGS' : 'CLAIM REWARD') : isCompleted && currentBalance === 0 ? 'CLAIMED' : user.rewardsDisabled ? 'REWARDS UNDER REVIEW' : 'COMPLETE CHALLENGES'}
                        </button>
                    </div>
                </section>
                )}

                {/* Section 3: Information */}
                <section style={{ marginBottom: '40px' }}>
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

                {/* Section 4: History */}
                <section style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-1)', fontWeight: '700' }}>
                        Rewards History
                    </h2>
                    {history.length === 0 ? (
                        <div className="panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-2)', fontSize: '0.9rem' }}>
                            No rewards activity found.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {history.map((tx) => {
                                let title = 'Reward Activity';
                                let desc = '';
                                let val = '';
                                let color = 'var(--text-h)';

                                if (tx.meta?.event === 'sponsored_rewards_claim') {
                                    title = 'Claim Payout';
                                    desc = `Claimed via Solana: ${tx.meta.signature ? tx.meta.signature.slice(0, 8) + '...' : 'Pending'}`;
                                    val = `-$${(tx.meta.amountUsd || 0).toFixed(2)}`;
                                    color = 'var(--green)';
                                } else if (tx.meta?.isRentExemptFallback) {
                                    title = 'Rent Fallback Credit';
                                    desc = 'Game payout auto-credited due to wallet rent limits';
                                    val = `+$${((tx.amount || 0) * (tx.meta.solPrice || 64)).toFixed(2)}`;
                                    color = 'var(--accent)';
                                } else if (tx.meta?.event === 'free_ticket_join') {
                                    title = 'Free Ticket Used';
                                    desc = `Joined $${tx.meta.entryFeeUsd || 10} match using free ticket`;
                                    val = 'FREE';
                                    color = 'var(--blue)';
                                }

                                return (
                                    <div key={tx._id} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: 'var(--text-h)', fontWeight: '600' }}>{title}</h4>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-2)' }}>{desc}</p>
                                        </div>
                                        <div style={{ fontSize: '1.05rem', fontWeight: '700', color }}>
                                            {val}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Custom Modal/Alert System */}
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
                                    className="btn btn-primary"
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
        </div>
    );
}
