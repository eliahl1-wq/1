import test from 'node:test';
import assert from 'node:assert/strict';
import {
    REFERRAL_DURATION_MS,
    captureReferralFirstTouch,
    clearStoredReferral,
    getStoredReferral,
    normalizeReferralCode,
    updateStoredReferralClick,
} from './referral.js';

function memoryStorage() {
    const values = new Map();
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
    };
}

test('first-touch referral cannot be overwritten during the 60-day window', () => {
    const storage = memoryStorage();
    const first = captureReferralFirstTouch('CreatorOne', { storage, now: 1_000 });
    const second = captureReferralFirstTouch('OtherCreator', { storage, now: 2_000 });
    assert.equal(first.code, 'creatorone');
    assert.equal(second.code, 'creatorone');
    assert.equal(second.expiresAt, 1_000 + REFERRAL_DURATION_MS);
});

test('expired first touch is removed and a later touch can be captured', () => {
    const storage = memoryStorage();
    captureReferralFirstTouch('first_creator', { storage, now: 0 });
    assert.equal(getStoredReferral({ storage, now: REFERRAL_DURATION_MS }), null);
    const next = captureReferralFirstTouch('second_creator', { storage, now: REFERRAL_DURATION_MS + 1 });
    assert.equal(next.code, 'second_creator');
});

test('click ID enriches but never changes the stored first-touch affiliate', () => {
    const storage = memoryStorage();
    captureReferralFirstTouch('creator_one', { storage, now: 10 });
    const updated = updateStoredReferralClick('click-123', 'CREATOR_ONE', { storage, now: 20 });
    assert.equal(updated.code, 'creator_one');
    assert.equal(updated.clickId, 'click-123');
});

test('manual normalization and explicit clearing are deterministic', () => {
    const storage = memoryStorage();
    assert.equal(normalizeReferralCode(' Partner-Name '), 'partner-name');
    captureReferralFirstTouch('partner-name', { storage, now: 10 });
    clearStoredReferral(storage);
    assert.equal(getStoredReferral({ storage, now: 20 }), null);
});
