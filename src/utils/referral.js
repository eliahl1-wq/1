export const REFERRAL_STORAGE_KEY = 'agararena_referral_first_touch';
export const REFERRAL_DEVICE_KEY = 'agararena_referral_device_id';
export const REFERRAL_DURATION_MS = 60 * 24 * 60 * 60 * 1000;

export function normalizeReferralCode(code) {
    const normalized = String(code || '').trim().toLowerCase();
    return /^[a-z0-9_][a-z0-9_-]{1,38}[a-z0-9_]$/.test(normalized) ? normalized : null;
}

function safeParse(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export function getStoredReferral({
    storage = typeof window !== 'undefined' ? window.localStorage : null,
    now = Date.now(),
} = {}) {
    if (!storage) return null;
    const parsed = safeParse(storage.getItem(REFERRAL_STORAGE_KEY));
    if (!parsed?.code || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= now) {
        storage.removeItem(REFERRAL_STORAGE_KEY);
        return null;
    }
    return parsed;
}

export function captureReferralFirstTouch(code, {
    storage = typeof window !== 'undefined' ? window.localStorage : null,
    now = Date.now(),
    source = 'link',
} = {}) {
    if (!storage) return null;
    const existing = getStoredReferral({ storage, now });
    if (existing) return existing;
    const normalized = normalizeReferralCode(code);
    if (!normalized) return null;
    const referral = {
        code: normalized,
        source,
        capturedAt: now,
        expiresAt: now + REFERRAL_DURATION_MS,
        clickId: null,
    };
    storage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referral));
    return referral;
}

export function updateStoredReferralClick(clickId, canonicalCode, {
    storage = typeof window !== 'undefined' ? window.localStorage : null,
    now = Date.now(),
} = {}) {
    const current = getStoredReferral({ storage, now });
    if (!current || !storage) return current;
    const next = {
        ...current,
        code: normalizeReferralCode(canonicalCode) || current.code,
        clickId: String(clickId || '') || current.clickId,
    };
    storage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(next));
    return next;
}

export function clearStoredReferral(storage = typeof window !== 'undefined' ? window.localStorage : null) {
    storage?.removeItem(REFERRAL_STORAGE_KEY);
}

export function getReferralDeviceId(storage = typeof window !== 'undefined' ? window.localStorage : null) {
    if (!storage) return '';
    let id = storage.getItem(REFERRAL_DEVICE_KEY);
    if (!id) {
        id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        storage.setItem(REFERRAL_DEVICE_KEY, id);
    }
    return id;
}
