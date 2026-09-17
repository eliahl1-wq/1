export const HOUSE_TRANSITION_DEBOUNCE_MS = 60;

export function stabilizeHouseSelection({
    stableId = null,
    pendingId = undefined,
    pendingSince = 0,
    candidateId = null,
    previousStillValid = false,
    now = 0,
    debounceMs = HOUSE_TRANSITION_DEBOUNCE_MS,
}) {
    if (previousStillValid || candidateId === stableId) {
        return {
            selectedId: stableId,
            pendingId: undefined,
            pendingSince: 0,
            committed: false,
        };
    }
    if (pendingId !== candidateId) {
        return {
            selectedId: stableId,
            pendingId: candidateId,
            pendingSince: now,
            committed: false,
        };
    }
    if (now - pendingSince < debounceMs) {
        return { selectedId: stableId, pendingId, pendingSince, committed: false };
    }
    return {
        selectedId: candidateId,
        pendingId: undefined,
        pendingSince: 0,
        committed: true,
    };
}
