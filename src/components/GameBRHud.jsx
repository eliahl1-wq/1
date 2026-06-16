export default function GameBRHud({ prizePool, aliveCount, playerCount }) {
    return (
        <div className="game-br-hud">
            <div className="game-br-hud-label">Prize Pool</div>
            <div className="game-br-hud-amount">${prizePool.toFixed(2)}</div>
            <div className="game-br-hud-meta">
                {aliveCount} ALIVE · WINNER TAKES ${prizePool.toFixed(2)}
            </div>
            {playerCount > 0 && (
                <div className="game-br-hud-sub">
                    {playerCount} players · winner takes pool
                </div>
            )}
        </div>
    );
}
