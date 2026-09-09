import React, { useEffect, useState } from 'react';
import './survivBattleRoyale.css';
import { playSurvivMatchCue } from '../../audio/synthSounds.js';

export default function SurvivBRHud({ stateRef, alive, kills = 0, outsideZone = false, result, onLobby, onQueue }) {
    const [now, setNow] = useState(() => performance.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(performance.now()), 200);
        return () => clearInterval(timer);
    }, []);
    const state = stateRef.current || {};
    const elapsed = Math.max(0, now - (state.receivedAt || now));
    const zone = state.zone;
    const countdown = Math.max(0, Math.ceil(((state.countdownRemainingMs || 0) - elapsed) / 1000));
    const phaseSeconds = Math.max(0, Math.ceil(((zone?.shrinking ? zone.endsInMs : zone?.startsInMs) || 0) / 1000 - elapsed / 1000));
    const waiting = state.matchStatus === 'countdown';
    const phaseKey = `${zone?.phase || 1}:${zone?.shrinking ? 'moving' : 'waiting'}`;
    const won = result?.placement === 1;
    useEffect(() => {
        if (waiting && countdown > 0 && countdown <= 3) playSurvivMatchCue('countdown');
    }, [waiting, countdown]);
    useEffect(() => {
        if (!waiting && zone && !result) playSurvivMatchCue(zone.phase === 1 && !zone.shrinking ? 'start' : 'zone');
    }, [waiting, phaseKey]);
    useEffect(() => { if (won) playSurvivMatchCue('victory'); }, [won]);
    return <>
        {!result && !waiting && <div className={`sbr-zone-status${zone?.shrinking || zone?.final ? ' is-closing' : ''}`}>
            <div className="sbr-survivors"><strong>{alive}</strong><small>ALIVE</small></div>
            <span className="sbr-zone-glyph" aria-hidden="true" />
            <div><small>{zone?.final ? 'FINAL STAND' : zone?.shrinking ? 'RED ZONE ADVANCING' : 'NEXT SAFE ZONE'}</small>
                <strong>{zone?.final ? 'No safe ground' : `${phaseSeconds}s`} <span>· {kills} ELIMS</span></strong></div>
            <span className="sbr-pot">${Number(state.prizePool || 0).toFixed(2)}<small>WINNER POT</small></span>
        </div>}
        {!result && !waiting && !outsideZone && zone && <div key={phaseKey} className="sbr-announcement" role="status">
            {zone.shrinking ? 'Red zone is moving. Get to safety.' : zone.phase === 1 ? 'Loot up. Last survivor wins.' : 'Next safe zone marked on your map.'}
        </div>}
        {!result && !waiting && alive > 0 && alive <= 5 && <div className="sbr-final-players" key={alive}>{alive === 2 ? 'FINAL DUEL' : `${alive} SURVIVORS LEFT`}</div>}
        {waiting && !result && <div className="sbr-countdown" role="status">
            <span className="sbr-eyebrow">SURVIV BATTLE ROYALE</span>
            <h1>ONE LIFE. MAKE IT COUNT.</h1>
            <div className="sbr-countdown-ring"><strong key={countdown}>{countdown || 'GO'}</strong></div>
            <p>{state.playerCount} survivors <span>·</span> ${Number(state.prizePool || 0).toFixed(2)} winner pot</p>
            <small>Loot weapons · Stay inside the white circle · Be the last survivor</small>
        </div>}
        {result && <div className={`sbr-result-backdrop${won ? ' is-victory' : ''}`}>
            <section className="sbr-result" role="dialog" aria-modal="true" aria-labelledby="sbr-result-title">
                {won && <div className="sbr-victory-rays" aria-hidden="true" />}
                <span className="sbr-eyebrow">SURVIV BATTLE ROYALE</span>
                <div className="sbr-placement"><span>#</span>{result.placement || '—'}</div>
                <h1 id="sbr-result-title">{won ? 'LAST SURVIVOR' : result.cancelled ? 'MATCH ENDED' : 'ELIMINATED'}</h1>
                <p>{won ? 'The island is yours.' : result.cancelled ? result.refunded ? 'No survivor remained. Entries have been refunded.' : 'No survivor remained. Contact support about your entry.' : result.reason === 'red_zone' ? 'Caught by the red zone.' : 'One round ends. Your next starts here.'}</p>
                <div className="sbr-result-stats">
                    <div><strong>{result.kills || 0}</strong><span>ELIMINATIONS</span></div>
                    <div><strong>{result.playerCount || state.playerCount || 0}</strong><span>PLAYERS</span></div>
                    <div><strong>${Number(won ? result.amount ?? state.prizePool : state.prizePool || 0).toFixed(2)}</strong><span>{won ? 'YOUR PRIZE' : 'WINNER POT'}</span></div>
                </div>
                {won && <p className="sbr-payout-note" role="status">{result.payoutError ? 'Payout needs attention. Contact support.' : result.confirmed ? result.simulated ? 'Test match — no real money paid.' : 'Prize sent to your wallet.' : 'Confirming your prize…'}</p>}
                <div className="sbr-result-actions"><button type="button" onClick={onQueue} disabled={won && !result.confirmed && !result.payoutError}>Find another match</button><button type="button" onClick={onLobby}>Back to lobby</button></div>
            </section>
        </div>}
    </>;
}
