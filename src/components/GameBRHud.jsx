import { formatBalanceAmount, getStoredBalanceCurrency } from '../utils/displayCurrency.js';

export default function GameBRHud({ prizePool, aliveCount, playerCount, solPrice = 0, currency = getStoredBalanceCurrency() }) {
    const displayedPool = formatBalanceAmount(prizePool, solPrice, currency);
    return (
        <div className="game-br-hud">
            <div className="game-br-hud-label">Prize Pool</div>
            <div className="game-br-hud-amount">{displayedPool}</div>
            <div className="game-br-hud-meta">
                {aliveCount} ALIVE · WINNER TAKES {displayedPool}
            </div>
            {playerCount > 0 && (
                <div className="game-br-hud-sub">
                    {playerCount} players · winner takes pool
                </div>
            )}
        </div>
    );
}
