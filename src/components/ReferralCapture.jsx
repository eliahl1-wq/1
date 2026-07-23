import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { API_URL } from '../utils/apiBase';
import {
    captureReferralFirstTouch,
    getReferralDeviceId,
    getStoredReferral,
    updateStoredReferralClick,
} from '../utils/referral';

export default function ReferralCapture() {
    const location = useLocation();

    useEffect(() => {
        const codeFromUrl = new URLSearchParams(location.search).get('ref');
        if (codeFromUrl) captureReferralFirstTouch(codeFromUrl);
        const referral = getStoredReferral();
        if (!referral || referral.clickId) return;

        let cancelled = false;
        fetch(`${API_URL}/api/referrals/click`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'bypass-tunnel-reminders': 'true',
            },
            body: JSON.stringify({
                code: referral.code,
                deviceId: getReferralDeviceId(),
            }),
        })
            .then(async response => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.message || 'Referral click rejected');
                if (!cancelled) updateStoredReferralClick(data.clickId, data.referralCode);
            })
            .catch(() => {
                // Attribution is still validated during signup; click analytics can retry next navigation.
            });
        return () => {
            cancelled = true;
        };
    }, [location.search]);

    return null;
}
