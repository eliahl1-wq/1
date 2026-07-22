import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { pingSitePresence } from '../utils/sitePresence';
import { API_URL } from '../utils/apiBase';


/**
 * Lightweight heartbeat on all pages — keeps admin presence list up to date.
 */
export default function useSitePresence() {
    const location = useLocation();
    const { user, token } = useAuth();

    useEffect(() => {
        let alive = true;
        const ping = () => {
            if (!alive) return;
            pingSitePresence(API_URL, {
                page: location.pathname,
                username: user?.username,
                token,
            });
        };
        ping();
        const id = setInterval(ping, 30_000);
        return () => {
            alive = false;
            clearInterval(id);
        };
    }, [location.pathname, user?.username, token]);
}

