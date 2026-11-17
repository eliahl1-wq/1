export default function TournamentPrizeNote({ ended = false, className = '' }) {
    return <small className={`tournament-prize-note ${className}`}>
        {ended ? 'Prize pool funded by player entries.' : 'The prize pool grows as more players join.'}
    </small>;
}
