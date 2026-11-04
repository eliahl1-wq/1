import { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo';

const EXIT_DELAY_MS = 10_000;

export default function GameConnectionOverlay({
    active,
    connected,
    ready,
    joiningTitle = 'Joining arena…',
    joiningMessage = 'Your entry is being verified. Keep this window open.',
    error = '',
    onExit,
}) {
    const [waitingMs, setWaitingMs] = useState(0);

    useEffect(() => {
        if (!active) {
            setWaitingMs(0);
            return undefined;
        }
        const startedAt = Date.now();
        setWaitingMs(0);
        const timer = window.setInterval(() => setWaitingMs(Date.now() - startedAt), 500);
        return () => window.clearInterval(timer);
    }, [active, connected]);

    if (!active) return null;

    const reconnecting = !connected && !error;
    const title = error ? 'Could not join arena' : reconnecting ? 'Connection interrupted' : joiningTitle;
    const message = error || (reconnecting
        ? 'Reconnecting automatically. Your active match stays on the server while we restore the connection.'
        : joiningMessage);
    const showExit = !!error || waitingMs >= EXIT_DELAY_MS;

    return (
        <div className="game-connection-overlay" role="status" aria-live="polite">
            <div className="game-connection-card">
                <BrandLogo className="game-connection-card__logo" labelled />
                {!error && <span className="game-connection-card__spinner" aria-hidden="true" />}
                <span className={`game-connection-card__status${reconnecting ? ' is-reconnecting' : ''}`}>
                    {error ? 'Action needed' : reconnecting ? 'Reconnecting' : ready ? 'Syncing' : 'Connecting'}
                </span>
                <h2>{title}</h2>
                <p>{message}</p>
                {!error && waitingMs >= 5_000 && (
                    <small>Still working… you do not need to refresh or pay another entry.</small>
                )}
                {showExit && onExit && (
                    <button type="button" className="ui-btn ui-btn-secondary" onClick={onExit}>
                        Back to pregame
                    </button>
                )}
            </div>
        </div>
    );
}
