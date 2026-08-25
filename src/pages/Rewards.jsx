import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppTopbar from '../components/AppTopbar';
import Background from '../components/Background';
import AffiliateRewardsPanel from '../components/AffiliateRewardsPanel';
import { API_URL } from '../utils/apiBase';
import { hasUnlockedFreeTicket } from '../utils/freeTicket';
import '../styles/rewards.css';

export default function Rewards() {
    const { user, loading, refreshUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [history, setHistory] = useState([]);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [claimStatus, setClaimStatus] = useState(null); // { type: 'success'|'error'|'loading', message: string }
    const [affiliateData, setAffiliateData] = useState(null);
    const [activeView, setActiveView] = useState(() => window.location.hash === '#affiliate-rewards' ? 'affiliate' : 'game');
    const claimLockRef = useRef(false);

    useEffect(() => {
        setActiveView(location.hash === '#affiliate-rewards' ? 'affiliate' : 'game');
    }, [location.hash]);

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
                        tx.meta?.event === 'free_ticket_join' ||
                        tx.meta?.freeTicketChallengeApplied === true ||
                        tx.meta?.starterRewardCompleted === true ||
                        (tx.meta?.event === 'reward_pool_contribution' && Number(tx.meta?.permanentVolumeUsd) > 0) ||
                        tx.meta?.event === 'tournament_reward' ||
                        tx.meta?.event === 'tournament_reward_claim'
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

    useEffect(() => {
        if (!user?.tournamentRewardClaimInProgress) return undefined;
        let cancelled = false;
        setClaimStatus({ type: 'loading', message: 'Waiting for tournament reward confirmation…' });
        const poll = async () => {
            try {
                const res = await fetch(`${API_URL}/api/user/tournament-reward-claim-status`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await res.json();
                if (cancelled) return;
                if (data.claim?.status === 'confirmed') {
                    await refreshUser();
                    setClaimStatus({ type: 'success', message: `Successfully claimed $${Number(data.claim.amountUsd).toFixed(2)} of tournament winnings!` });
                } else if (data.claim?.status === 'failed') {
                    await refreshUser();
                    setClaimStatus({ type: 'error', message: data.claim.error || 'Tournament reward claim failed.' });
                }
            } catch {
                // Keep the claim locked; the server reconciler remains authoritative.
            }
        };
        poll();
        const id = setInterval(poll, 3000);
        return () => { cancelled = true; clearInterval(id); };
    }, [user?.tournamentRewardClaimInProgress, refreshUser]);
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

    const hasUnusedTicket = hasUnlockedFreeTicket(user);
    const hasTicketChallenge = !user.freeTicketChallengeCompleted && !user.freeTicketUsed && !user.rewardsDisabled;
    const isCompleted = user.sponsoredRewardsCompleted && user.sponsoredRewardsUnlocked;

    const promoBalance = Number(user.sponsoredRewardsBalance) || 0;
    const permanentRewards = user.permanentRewards || {};
    const permanentBalance = Number(permanentRewards.balanceUsd) || 0;
    const permanentProgress = Number(permanentRewards.progressVolumeUsd) || 0;
    const permanentProgressPct = Number(permanentRewards.progressPct) || 0;
    const permanentCycleVolume = Number(permanentRewards.cycleVolumeUsd) || 20;
    const permanentCycleReward = Number(permanentRewards.rewardPerCycleUsd) || 4;
    const rentFallbackBalance = Number(user.rentFallbackBalanceUsd) || 0;
    const currentBalance = promoBalance + permanentBalance + rentFallbackBalance;
    const claimableBalance = rentFallbackBalance + (!user.rewardsDisabled
        ? permanentBalance + (isCompleted ? promoBalance : 0)
        : 0);
    const canClaim = claimableBalance > 0;
    const tournamentBalance = Number(user.tournamentRewardsBalance) || 0;
    const affiliateMetrics = affiliateData?.metrics || {};
    const affiliatePending = Number(affiliateMetrics.pendingCommissionUsd) || 0;
    const affiliateAvailable = Number(affiliateMetrics.availableCommissionUsd) || 0;
    const affiliateBalance = affiliatePending + affiliateAvailable;
    const affiliateMinimum = Number(affiliateData?.config?.minimumPayoutUsd) || 2;
    const affiliatePayoutActive = !!affiliateData?.payouts?.some(payout => ['requested', 'processing'].includes(payout.status));
    const affiliateRequestable = affiliateAvailable >= affiliateMinimum
        && !!affiliateData?.profile?.payoutWallet
        && !affiliatePayoutActive
        ? affiliateAvailable
        : 0;
    const totalRewardBalance = currentBalance + tournamentBalance + affiliateBalance;
    const totalReadyToClaim = claimableBalance + tournamentBalance + affiliateRequestable;
    const totalGameClaimed = history
        .filter(tx => tx.meta?.event === 'sponsored_rewards_claim')
        .reduce((sum, tx) => sum + (Number(tx.meta?.amountUsd) || 0), 0);
    const totalTournamentClaimed = history
        .filter(tx => tx.meta?.event === 'tournament_reward_claim')
        .reduce((sum, tx) => sum + (Number(tx.meta?.amountUsd) || 0), 0);
    const totalAffiliatePaid = Number(affiliateMetrics.totalPaidCommissionUsd) || 0;
    const totalClaimedAllTime = totalGameClaimed + totalTournamentClaimed + totalAffiliatePaid;
    const rewardHistory = [
        ...history,
        ...(affiliateData?.payouts || []).map(payout => ({
            _id: `affiliate-payout-${payout.id}`,
            affiliatePayout: true,
            createdAt: payout.requestedAt,
            ...payout,
        })),
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const requiredContribution = Math.max(5, promoBalance);
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

    const handleTournamentClaim = async () => {
        if (claimLockRef.current || claimStatus?.type === 'loading' || !(user.tournamentRewardsBalance > 0)) return;
        claimLockRef.current = true;
        setClaimStatus({ type: 'loading', message: 'Reserving and processing your tournament claim… Please wait.' });
        try {
            const res = await fetch(`${API_URL}/api/user/claim-tournament-rewards`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.status === 202 && data.processing) {
                setClaimStatus({ type: 'loading', message: 'Tournament payment submitted. Waiting for blockchain confirmation…' });
                await refreshUser();
                return;
            }
            if (!res.ok || !data.success) throw new Error(data.error || 'Failed to claim tournament rewards.');
            await refreshUser();
            setClaimStatus({ type: 'success', message: `Successfully claimed $${data.amount.toFixed(2)} in tournament rewards!` });
        } catch (err) {
            setClaimStatus({ type: 'error', message: err.message || 'Error claiming tournament rewards. Try again later.' });
        } finally {
            claimLockRef.current = false;
        }
    };

    const selectView = (view) => {
        setActiveView(view);
        navigate(view === 'affiliate' ? '/rewards#affiliate-rewards' : '/rewards', { replace: true });
    };

    const activityDisplay = (tx) => {
        if (tx.affiliatePayout) {
            const status = String(tx.status || 'requested').replace('_', ' ');
            const isPaid = ['completed', 'paid'].includes(String(tx.status));
            return { title: 'Affiliate payout', type: status, value: `${isPaid ? '-' : ''}$${Number(tx.amountUsd || 0).toFixed(2)}`, tone: isPaid ? 'green' : 'yellow' };
        }
        if (tx.meta?.starterRewardCompleted) {
            return { title: 'Starter reward completed', type: 'Completed', value: `$${Number(tx.meta.starterRewardAmountUsd || 0).toFixed(2)}`, tone: 'green' };
        }
        if (tx.meta?.freeTicketChallengeApplied) {
            return { title: 'Free ticket unlocked', type: 'Completed', value: '1 ticket', tone: 'purple' };
        }
        if (tx.meta?.event === 'sponsored_rewards_claim') {
            return { title: 'Game rewards claimed', type: 'Claim', value: `-$${Number(tx.meta.amountUsd || 0).toFixed(2)}`, tone: 'green' };
        }
        if (tx.meta?.isRentExemptFallback) {
            const amount = (Number(tx.amount) || 0) * Number(tx.meta.solPrice || 64);
            return { title: 'Reward retained', type: 'Wallet credit', value: `+$${amount.toFixed(2)}`, tone: 'purple' };
        }
        if (tx.meta?.event === 'free_ticket_join') {
            return { title: 'Free ticket used', type: tx.meta.mode || 'Normal', value: 'Free game', tone: 'purple' };
        }
        if (tx.meta?.event === 'reward_pool_contribution') {
            const unlocked = Number(tx.meta.permanentRewardUnlockedUsd) || 0;
            return unlocked > 0
                ? { title: 'Game reward unlocked', type: 'Completed', value: `+$${unlocked.toFixed(2)}`, tone: 'green' }
                : { title: 'Reward progress', type: 'Normal game', value: `+$${Number(tx.meta.permanentVolumeUsd || 0).toFixed(2)} played`, tone: 'default' };
        }
        if (tx.meta?.event === 'tournament_reward') {
            return { title: 'Tournament prize', type: `#${tx.meta.placement || '—'}`, value: `+$${Number(tx.meta.amountUsd || 0).toFixed(2)}`, tone: 'yellow' };
        }
        if (tx.meta?.event === 'tournament_reward_claim') {
            return { title: 'Tournament claimed', type: 'Claim', value: `-$${Number(tx.meta.amountUsd || 0).toFixed(2)}`, tone: 'green' };
        }
        return { title: 'Reward activity', type: 'Reward', value: '—', tone: 'default' };
    };

    return (
        <div className="page-shell page-shell--with-topbar page-shell--scroll">
            <Background />
            <AppTopbar />
            <div className="page-content product-page--rewards">
                <header className="rewards-page-head">
                    <h1>Rewards</h1>
                    <div className="rewards-view-tabs" role="tablist" aria-label="Reward views">
                        <button type="button" className={activeView === 'game' ? 'is-active' : ''} onClick={() => selectView('game')}>Game Rewards</button>
                        <button type="button" className={activeView === 'affiliate' ? 'is-active' : ''} onClick={() => selectView('affiliate')}>Affiliate</button>
                    </div>
                </header>

                <div className={activeView === 'game' ? 'rewards-view is-active' : 'rewards-view'}>
                    {user.rewardsDisabled && <div className="product-alert product-alert--error">Rewards are under review.</div>}

                    <section className="rewards-overview" aria-labelledby="game-rewards-heading">
                        <div className="rewards-overview-mark" aria-hidden="true">R</div>
                        <span className="rewards-overview-kicker">GAME REWARDS</span>
                        <h2 id="game-rewards-heading">${totalRewardBalance.toFixed(2)}</h2>
                        <p>Total balance</p>
                        <div className="rewards-overview-stats">
                            <div><span>Available</span><strong className="mono">${totalReadyToClaim.toFixed(2)}</strong></div>
                            <div><span>Earned</span><strong className="mono">${totalClaimedAllTime.toFixed(2)}</strong></div>
                        </div>
                        <div className="rewards-overview-progress-head">
                            <span>Play for ${permanentCycleVolume.toFixed(0)}</span>
                            <strong>Next reward ${permanentCycleReward.toFixed(0)}</strong>
                        </div>
                        <div className="rewards-overview-track" role="progressbar" aria-label="Next game reward" aria-valuemin="0" aria-valuemax={permanentCycleVolume} aria-valuenow={permanentProgress}>
                            <div style={{ width: `${Math.min(100, permanentProgressPct)}%` }} />
                        </div>
                        <div className="rewards-overview-progress-foot">
                            <span className="mono">${permanentProgress.toFixed(2)} / ${permanentCycleVolume.toFixed(2)}</span>
                            <span>{Number(permanentRewards.cyclesCompleted) || 0} completed</span>
                        </div>
                    </section>

                    <section className="rewards-block">
                        <h2>Claim</h2>
                        <div className="rewards-claim-grid">
                            <article className="rewards-dashboard-card rewards-claim-card">
                                <div className="rewards-card-head"><span>Game rewards</span><span className="rewards-status-dot" /></div>
                                <div className="rewards-claim-amount mono">${claimableBalance.toFixed(2)}</div>
                                <span className="rewards-claim-caption">Available</span>
                                <div className="rewards-claim-chips">
                                    <span>Game <b className="mono">${(promoBalance + permanentBalance).toFixed(2)}</b></span>
                                    <span>Retained <b className="mono">${rentFallbackBalance.toFixed(2)}</b></span>
                                </div>
                                <button type="button" className="btn btn-primary rewards-full-button" onClick={handleClaim} disabled={!canClaim || claimStatus?.type === 'loading' || user.rewardClaimInProgress}>
                                    {user.rewardClaimInProgress || claimStatus?.type === 'loading' ? 'CLAIMING…' : canClaim ? `CLAIM $${claimableBalance.toFixed(2)}` : 'NOTHING TO CLAIM'}
                                </button>
                            </article>

                            <article className="rewards-dashboard-card rewards-active-card">
                                <div className="rewards-card-head"><span>Active reward</span><span>{hasUnusedTicket || hasTicketChallenge || (user.freeTicketUsed && !isCompleted) ? '1' : '0'}</span></div>
                                {hasUnusedTicket ? (
                                    <div className="rewards-active-content">
                                        <div className="rewards-active-icon is-ready">✓</div>
                                        <strong>Free $5 game ready</strong>
                                        <span>Agar or Slither Normal</span>
                                        <div className="rewards-ticket-actions">
                                            <button type="button" onClick={() => navigate('/pre-game', { state: { selectedMode: 'agar' } })}>Agar</button>
                                            <button type="button" onClick={() => navigate('/pre-game', { state: { selectedMode: 'slither' } })}>Slither</button>
                                        </div>
                                    </div>
                                ) : hasTicketChallenge ? (
                                    <div className="rewards-active-content">
                                        <div className="rewards-ring" style={{ '--progress': '0deg' }}><span>0/1</span></div>
                                        <strong>Play 1 Normal game</strong>
                                        <span>Reward: Free $5 game</span>
                                        <button type="button" className="rewards-card-link" onClick={() => navigate('/gamemodes')}>Play now →</button>
                                    </div>
                                ) : user.freeTicketUsed && !isCompleted && !user.rewardsDisabled ? (
                                    <div className="rewards-active-content rewards-starter-content">
                                        <strong>Starter reward</strong>
                                        <span>Reward: ${promoBalance.toFixed(2)}</span>
                                        <div className="rewards-mini-task">
                                            <div><span>{req5} × $5 games</span><b>{normal5Progress}/{req5}</b></div>
                                            <i><em style={{ width: `${(normal5Progress / req5) * 100}%` }} /></i>
                                        </div>
                                        <div className="rewards-mini-task">
                                            <div><span>{req10} × $10 games</span><b>{normal10Progress}/{req10}</b></div>
                                            <i><em style={{ width: `${(normal10Progress / req10) * 100}%` }} /></i>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rewards-active-content rewards-empty-active">
                                        <div className="rewards-active-icon">✓</div>
                                        <strong>All caught up</strong>
                                        <span>New rewards will appear here.</span>
                                    </div>
                                )}
                            </article>

                            <article className="rewards-dashboard-card rewards-breakdown-card">
                                <div className="rewards-card-head"><span>Breakdown</span><span>USD</span></div>
                                <div className="rewards-breakdown-list">
                                    <div><span><i className="is-purple" />Game rewards</span><strong className="mono">${currentBalance.toFixed(2)}</strong></div>
                                    <div><span><i className="is-yellow" />Tournament</span><strong className="mono">${tournamentBalance.toFixed(2)}</strong></div>
                                    <div><span><i className="is-green" />Affiliate</span><strong className="mono">${affiliateBalance.toFixed(2)}</strong></div>
                                </div>
                                {tournamentBalance > 0 ? (
                                    <button type="button" className="btn rewards-tournament-button rewards-full-button" onClick={handleTournamentClaim} disabled={claimStatus?.type === 'loading' || user.tournamentRewardClaimInProgress}>
                                        {user.tournamentRewardClaimInProgress ? 'CLAIMING…' : `CLAIM TOURNAMENT $${tournamentBalance.toFixed(2)}`}
                                    </button>
                                ) : (
                                    <button type="button" className="rewards-card-link rewards-breakdown-link" onClick={() => selectView('affiliate')}>View affiliate rewards →</button>
                                )}
                            </article>
                        </div>
                    </section>

                    <section className="rewards-block rewards-activity-block">
                        <div className="rewards-block-head"><h2>Activity</h2><span>{rewardHistory.length}</span></div>
                        <div className="rewards-activity-panel">
                            <div className="rewards-activity-header"><span>Reward</span><span>Type</span><span>Date</span><span>Amount</span></div>
                            {!historyLoaded ? (
                                <div className="rewards-activity-empty"><span className="spinner" /></div>
                            ) : rewardHistory.length === 0 ? (
                                <div className="rewards-activity-empty">No reward activity yet.</div>
                            ) : rewardHistory.map(tx => {
                                const item = activityDisplay(tx);
                                return (
                                    <div className="rewards-activity-row" key={tx._id}>
                                        <strong>{item.title}</strong>
                                        <span><b className={`rewards-type-pill is-${item.tone}`}>{item.type}</b></span>
                                        <time>{new Date(tx.createdAt || Date.now()).toLocaleDateString()}</time>
                                        <em className={`is-${item.tone}`}>{item.value}</em>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>

                <div className={activeView === 'affiliate' ? 'rewards-view is-active' : 'rewards-view'}>
                    <AffiliateRewardsPanel onDataChange={setAffiliateData} />
                </div>

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
        </div>
    );
}
