import React from 'react';

export default function AdminGrowthPanel({ growth, totals = {}, rates = {}, averages = {}, formatUsd }) {
    const rows = [
        ['New accounts → deposit', growth?.signupDepositPct, `${growth?.newUsersWhoDeposited ?? '—'} of ${totals.newUsers ?? 0} new accounts`],
        ['New accounts → paid play', rates.newUserPaidPct, `${totals.newUsersWhoPaid ?? 0} played with real money`],
        ['New accounts → any play', rates.newUserPlayPct, `${totals.newUsersWhoPlayed ?? 0} tried a game`],
        ['Returning players', growth?.returningPlayerPct, `${growth?.returningPlayers ?? '—'} also played in the previous period`],
    ];
    const devices = growth?.devices || [];
    const mobile = devices.find(row => row._id === 'mobile')?.count || 0;
    const desktop = devices.find(row => row._id === 'desktop')?.count || 0;
    const deviceTotal = mobile + desktop;
    return <section className="admin-overview-card admin-growth-panel">
        <header className="admin-overview-card-header"><div><span>Conversion &amp; repeat use</span><h2>Are people coming back?</h2><p>Account-based rates for the selected period.</p></div></header>
        <div className="admin-overview-funnel">
            {rows.map(([label, value, note]) => <div key={label} className="admin-overview-funnel__row">
                <span>{label}<small>{note}</small></span><strong>{value == null ? '—' : `${value}%`}</strong>
                <div><i style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }} /></div>
            </div>)}
        </div>
        <dl className="admin-growth-facts">
            <div><dt>Returning depositors</dt><dd>{growth?.repeatDepositors ?? '—'}<small>First deposit before this period</small></dd></div>
            <div><dt>Average deposit</dt><dd>{growth ? formatUsd(growth.averageDepositUsd) : '—'}<small>Per confirmed deposit</small></dd></div>
            <div><dt>Games / player</dt><dd>{averages.gamesPerPlayer ?? 0}<small>Paid + free entries</small></dd></div>
            <div><dt>Net account funding</dt><dd>{growth ? formatUsd(growth.netDepositsUsd) : '—'}<small>Deposits minus account withdrawals; not profit</small></dd></div>
        </dl>
        {deviceTotal > 0 && <div className="admin-growth-devices">
            <span>Visitor devices <b>{Math.round(mobile / deviceTotal * 100)}% mobile</b></span>
            <div><i style={{ width: `${mobile / deviceTotal * 100}%` }} /></div>
            <small>{mobile} mobile · {desktop} desktop browsers</small>
        </div>}
    </section>;
}
