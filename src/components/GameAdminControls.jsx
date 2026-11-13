import React, { useState } from 'react';

export default function GameAdminControls({ socketRef, token, mode }) {
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState('Free Play admin controls');
    const run = (event, extra = {}) => {
        const socket = socketRef.current;
        if (!socket?.connected) { setMessage('Disconnected. Rejoin the match.'); return; }
        if (!token) { setMessage('Sign in again to use admin controls.'); return; }
        setPending(true);
        setMessage('Waiting for server…');
        socket.timeout(6000).emit(event, { token, mode, ...extra }, (error, result) => {
            setPending(false);
            setMessage(error
                ? 'Server did not respond. Deploy the updated game server, then rejoin.'
                : result?.message || 'Server returned no result.');
        });
    };
    return <div className="game-admin-controls" style={{ position: 'absolute', top: 30, left: 30, zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 260, pointerEvents: 'auto' }}
        onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
        <button disabled={pending} className="ui-btn ui-btn-primary" onClick={() => run('adminSpawnBotNearMe')}>Spawn Bot</button>
        <button disabled={pending} className="ui-btn ui-btn-primary" onClick={() => run('adminFreePlayAction', { action: 'food' })}>Queue +250 Food</button>
        <button disabled={pending} className="ui-btn ui-btn-primary" onClick={() => run('adminFreePlayAction', { action: 'grow' })}>{mode === 'agar' ? 'Size ×1.5' : '+100 Segments'}</button>
        <button disabled={pending} className="ui-btn ui-btn-primary" onClick={() => run('adminClearBots')}>Clear Bots</button>
        <span role="status" style={{ color: '#fff', fontSize: 12, background: 'rgba(12,12,18,.88)', padding: 8, borderRadius: 6 }}>{message}</span>
    </div>;
}
