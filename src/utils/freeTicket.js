export function hasUnlockedFreeTicket(user) {
    return Boolean(
        !user?.rewardsDisabled
        && user?.freeTicketChallengeCompleted
        && user?.hasFreeTicket
        && !user?.freeTicketUsed,
    );
}
