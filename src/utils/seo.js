export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://arenifi.fun').replace(/\/$/, '');

const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/arenifi-logo.png`;
const ROUTE_SCHEMA_ID = 'arenifi-route-structured-data';

const NOINDEX_EXACT_PATHS = new Set([
    '/login',
    '/register',
    '/verify-email',
    '/lobby',
    '/game',
    '/slither-game',
    '/surviv-game',
    '/transactions',
    '/profile',
    '/rewards',
    '/shop',
    '/br-lobby',
    '/surviv-battle-royale',
    '/pre-game',
]);

function normalizePath(pathname = '/') {
    const path = String(pathname || '/').split(/[?#]/, 1)[0] || '/';
    if (path === '/') return '/';
    return `/${path.replace(/^\/+|\/+$/g, '')}`;
}

export function isNoIndexPath(pathname = '/') {
    const path = normalizePath(pathname);
    return NOINDEX_EXACT_PATHS.has(path)
        || path === '/admin'
        || path.startsWith('/admin/')
        || path.startsWith('/studio/')
        || /^\/tournaments\/[^/]+\/lobby$/.test(path);
}

function upsertMeta(selector, attrs) {
    let el = document.head.querySelector(selector);
    if (!el) {
        el = document.createElement('meta');
        document.head.appendChild(el);
    }
    for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, value);
    }
}

function upsertLink(rel, href) {
    let el = document.head.querySelector(`link[rel="${rel}"]`);
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
}

function canonicalUrl(path = '/') {
    const normalized = normalizePath(path);
    return normalized === '/' ? `${SITE_URL}/` : `${SITE_URL}${normalized}`;
}

function setStructuredData(value) {
    document.getElementById(ROUTE_SCHEMA_ID)?.remove();
    if (!value) return;

    const script = document.createElement('script');
    script.id = ROUTE_SCHEMA_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(value);
    document.head.appendChild(script);
}

export function applyRouteSeoPolicy(pathname = window.location.pathname) {
    const noindex = isNoIndexPath(pathname);
    const content = noindex
        ? 'noindex, nofollow, noarchive'
        : 'index, follow, max-image-preview:large';
    upsertMeta('meta[name="robots"]', { name: 'robots', content });
    upsertMeta('meta[name="googlebot"]', { name: 'googlebot', content });
    if (noindex) setStructuredData(null);
    return noindex;
}

function breadcrumbSchema(label, path) {
    if (!path || path === '/') return null;
    return {
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Arenifi',
                item: `${SITE_URL}/`,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: label,
                item: canonicalUrl(path),
            },
        ],
    };
}

function gameSchema(name, description, path) {
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'VideoGame',
                name,
                description,
                url: canonicalUrl(path),
                gamePlatform: 'Web browser',
                applicationCategory: 'Game',
                operatingSystem: 'Any',
                isAccessibleForFree: true,
                publisher: { '@id': `${SITE_URL}/#organization` },
            },
            breadcrumbSchema(name, path),
        ].filter(Boolean),
    };
}

/** Update route-specific metadata after React navigation. */
export function setPageSeo({
    tabTitle,
    description,
    path = '/',
    noindex,
    ogType = 'website',
    socialImage = DEFAULT_SOCIAL_IMAGE,
    structuredData,
}) {
    if (tabTitle) document.title = tabTitle;

    if (description) {
        upsertMeta('meta[name="description"]', { name: 'description', content: description });
        upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
        upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    }

    if (tabTitle) {
        upsertMeta('meta[property="og:title"]', { property: 'og:title', content: tabTitle });
        upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: tabTitle });
    }

    const canonical = canonicalUrl(path);
    upsertLink('canonical', canonical);
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: ogType });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: socialImage });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: socialImage });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });

    const shouldNoIndex = noindex ?? isNoIndexPath(window.location.pathname);
    const robots = shouldNoIndex
        ? 'noindex, nofollow, noarchive'
        : 'index, follow, max-image-preview:large';
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('meta[name="googlebot"]', { name: 'googlebot', content: robots });
    setStructuredData(shouldNoIndex ? null : structuredData);
}

const HOME_DESCRIPTION = 'Play Agar, Slither and Surviv-style multiplayer games on Arenifi. Choose free play or enter SOL-staked matches where available.';
const AGAR_DESCRIPTION = 'Play Agar online on Arenifi in free-play or SOL-staked arenas. Collect pellets, grow your mass and outplay other competitors.';
const SLITHER_DESCRIPTION = 'Play Slither online on Arenifi in free-play or SOL-staked arenas. Grow your snake, trap opponents and compete on the live leaderboard.';
const SURVIV_DESCRIPTION = 'Play Arenifi Surviv, a top-down browser battle royale with looting, ranged combat and a shrinking play zone.';

export const SEO = {
    home: {
        tabTitle: 'Play Agar & Slither for Money or Free | Arenifi',
        description: HOME_DESCRIPTION,
        path: '/',
        structuredData: {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Arenifi browser game arenas',
            description: HOME_DESCRIPTION,
            url: `${SITE_URL}/`,
            isPartOf: { '@id': `${SITE_URL}/#website` },
        },
    },
    agar: {
        tabTitle: 'Play Agar Online for Free or SOL Stakes | Arenifi',
        description: AGAR_DESCRIPTION,
        path: '/agar',
        structuredData: gameSchema('Arenifi Agar', AGAR_DESCRIPTION, '/agar'),
    },
    slither: {
        tabTitle: 'Play Slither Online for Free or SOL Stakes | Arenifi',
        description: SLITHER_DESCRIPTION,
        path: '/slither',
        structuredData: gameSchema('Arenifi Slither', SLITHER_DESCRIPTION, '/slither'),
    },
    surviv: {
        tabTitle: 'Play Surviv Battle Royale Online | Arenifi',
        description: SURVIV_DESCRIPTION,
        path: '/surviv',
        structuredData: gameSchema('Arenifi Surviv', SURVIV_DESCRIPTION, '/surviv'),
    },
    gamemodes: {
        tabTitle: 'Arenifi Game Modes | Agar, Slither & Surviv',
        description: 'Compare Arenifi game modes, live player counts and entry options for Agar, Slither and Surviv.',
        path: '/gamemodes',
        structuredData: {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'CollectionPage',
                    name: 'Arenifi game modes',
                    url: `${SITE_URL}/gamemodes`,
                    description: 'A catalog of the playable Agar, Slither and Surviv modes on Arenifi.',
                },
                breadcrumbSchema('Game modes', '/gamemodes'),
            ],
        },
    },
    gamemodesAgar: {
        tabTitle: 'Agar Game Modes | Arenifi',
        description: 'Compare Arenifi Agar modes, live player counts and available entry options.',
        path: '/gamemodes',
    },
    gamemodesSlither: {
        tabTitle: 'Slither Game Modes | Arenifi',
        description: 'Compare Arenifi Slither modes, live player counts and available entry options.',
        path: '/gamemodes',
    },
    gamemodesSurviv: {
        tabTitle: 'Surviv Game Modes | Arenifi',
        description: 'Compare Arenifi Surviv modes, live player counts and available entry options.',
        path: '/gamemodes',
    },
    tournaments: {
        tabTitle: 'Arenifi Tournaments | Live Browser Game Competitions',
        description: 'View live and scheduled Arenifi tournaments, including entry fees, prize pools, attempts and standings.',
        path: '/tournaments',
        structuredData: {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'CollectionPage',
                    name: 'Arenifi tournaments',
                    url: `${SITE_URL}/tournaments`,
                    description: 'Live and scheduled Arenifi browser game tournaments.',
                },
                breadcrumbSchema('Tournaments', '/tournaments'),
            ],
        },
    },
    lobby: {
        tabTitle: 'Wallet & Lobby | Arenifi',
        description: 'Manage your Arenifi balance and deposits.',
        path: '/lobby',
        noindex: true,
    },
    login: {
        tabTitle: 'Log In | Arenifi',
        description: 'Log in securely to your Arenifi account.',
        path: '/login',
        noindex: true,
    },
    register: {
        tabTitle: 'Create an Account | Arenifi',
        description: 'Create an Arenifi account to join multiplayer arenas and manage your balance.',
        path: '/register',
        noindex: true,
    },
    profile: {
        tabTitle: 'Profile & Performance | Arenifi',
        description: 'Review your Arenifi profile and game performance.',
        path: '/profile',
        noindex: true,
    },
    transactions: {
        tabTitle: 'Transaction History | Arenifi',
        description: 'Review your Arenifi account transactions.',
        path: '/transactions',
        noindex: true,
    },
    howItWorks: {
        tabTitle: 'How Arenifi Works | Games, Stakes & Cashouts',
        description: 'Learn how Arenifi accounts, free play, SOL deposits, entry options, arena balances, fees and withdrawals work.',
        path: '/how-it-works',
        structuredData: {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'HowTo',
                    name: 'How to play on Arenifi',
                    description: 'Create an account, choose a mode, select free play or an available SOL-staked match, play and withdraw eligible account funds.',
                    step: [
                        { '@type': 'HowToStep', position: 1, name: 'Create an account' },
                        { '@type': 'HowToStep', position: 2, name: 'Choose a game mode' },
                        { '@type': 'HowToStep', position: 3, name: 'Select free play or an entry option' },
                        { '@type': 'HowToStep', position: 4, name: 'Play the match' },
                        { '@type': 'HowToStep', position: 5, name: 'Cash out and withdraw eligible funds' },
                    ],
                },
                breadcrumbSchema('How it works', '/how-it-works'),
            ],
        },
    },
    faq: {
        tabTitle: 'Arenifi Help & FAQ | Accounts, Games & Payments',
        description: 'Find answers about Arenifi accounts, gameplay, deposits, withdrawals, fees and game rules.',
        path: '/faq',
    },
};
