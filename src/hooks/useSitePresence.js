import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { pingSitePresence } from '../utils/sitePresence';

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000')).replace(/\/$/, '');

/**
 * Lightweight heartbeat on all pages — keeps admin presence list up to date.
 */
export default function useSitePresence() {
    const location = useLocation();
    const { user } = useAuth();

    useEffect(() => {
        let alive = true;
        const ping = () => {
            if (!alive) return;
            pingSitePresence(API_URL, {
                page: location.pathname,
                username: user?.username,
            });
        };
        ping();
        const id = setInterval(ping, 30_000);
        return () => {
            alive = false;
            clearInterval(id);
        };
    }, [location.pathname, user?.username]);
}
