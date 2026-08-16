export const FREE_MODE_STORAGE_KEY = 'public_free_mode';

export function isPublicFreeModeEnabled() {
    return typeof window !== 'undefined'
        && localStorage.getItem(FREE_MODE_STORAGE_KEY) === 'true';
}

export function getFreeModeEntryFee(mode) {
    return mode === 'surviv' || mode === 'competitive-slither' ? 5 : 10;
}

export function setPublicFreeModeEnabled(enabled) {
    if (typeof window === 'undefined') return;
    if (enabled) localStorage.setItem(FREE_MODE_STORAGE_KEY, 'true');
    else localStorage.removeItem(FREE_MODE_STORAGE_KEY);
}
