const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://www.agararena.space').replace(/\/$/, '');

export const BASE_KEYWORDS = [
    'agarstake', 'agar stake', 'agararena', 'agar arena',
    'agar with money', 'agar.io with money', 'play agar for money', 'real money agar', 'real money agario',
    'slither with money', 'slither.io with money', 'play slither for money', 'real money slither', 'real money slitherio',
    'io games with money', 'real money io games', 'crypto io games', 'web3 browser games',
    'solana wager game', 'solana io game', 'earn crypto playing games', 'cash out crypto games',
].join(', ');

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

/**
 * tabTitle     → browser tab only (short)
 * description  → Google meta description (not Discord/OG)
 * keywords     → meta keywords
 * OG/twitter tags stay static in index.html for clean link previews.
 */
export function setPageSeo({ tabTitle, description, keywords, path = '' }) {
    if (tabTitle) document.title = tabTitle;

    if (description) {
        upsertMeta('meta[name="description"]', { name: 'description', content: description });
    }

    if (keywords) {
        upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords });
    }

    const canonical = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    upsertLink('canonical', canonical);
}

export const SEO = {
    home: {
        tabTitle: 'Play Agar & Slither with money - PvP Wagering Games | AgarStake',
        description: 'Welcome to the premier platform for competitive Web3 gaming. Wager Solana (SOL) in skill-based Agar and Slither arenas, outplay opponents, and withdraw your winnings instantly.',
        keywords: BASE_KEYWORDS,
        path: '/',
    },
    agar: {
        tabTitle: 'AgarStake | Play Agar with Money',
        description: 'Enter the high-stakes Agar arena. Wager SOL against real players, grow your mass, dominate the map, and cash out your crypto instantly.',
        keywords: `${BASE_KEYWORDS}, agar.io real money, wager agar`,
        path: '/agar',
    },
    slither: {
        tabTitle: 'AgarStake | Play Slither with Money',
        description: 'Join the ultimate competitive Slither arena. Stake SOL, outmaneuver opponents, claim the leaderboard, and cash out immediately.',
        keywords: `${BASE_KEYWORDS}, slither.io real money, wager slither`,
        path: '/slither',
    },
    gamemodesAgar: {
        tabTitle: 'AgarStake | Agar Arenas',
        description: 'Choose your Agar mode: high-stakes Normal or winner-takes-all Battle Royale. Secure your entry and compete for the Solana prize pool.',
        keywords: `${BASE_KEYWORDS}, agar.io real money, wager agar`,
        path: '/gamemodes',
    },
    gamemodesSlither: {
        tabTitle: 'AgarStake | Slither Arenas',
        description: 'Choose your Slither mode: high-stakes Normal or winner-takes-all Battle Royale. Secure your entry and compete for the Solana prize pool.',
        keywords: `${BASE_KEYWORDS}, slither.io real money, wager slither`,
        path: '/gamemodes',
    },
    preGameAgar: {
        tabTitle: 'AgarStake | Join Agar Match',
        description: 'Select your entry tier and jump straight into the Agar action. High stakes, real opponents, instant crypto cashouts.',
        keywords: `${BASE_KEYWORDS}, agar.io cash out`,
        path: '/pre-game',
    },
    preGameSlither: {
        tabTitle: 'AgarStake | Join Slither Match',
        description: 'Select your entry tier and jump straight into the Slither action. High stakes, real opponents, instant crypto cashouts.',
        keywords: `${BASE_KEYWORDS}, slither.io cash out`,
        path: '/pre-game',
    },
    lobby: {
        tabTitle: 'AgarStake | Game Lobby',
        description: 'Connect your wallet and manage your funds. Deposit Solana (SOL) to enter the arenas and track your live balance.',
        keywords: `${BASE_KEYWORDS}, deposit solana, crypto game lobby`,
        path: '/lobby',
    },
    login: {
        tabTitle: 'AgarStake | Login',
        description: 'Securely log in to your AgarStake account to play competitive Web3 games for Solana.',
        keywords: `${BASE_KEYWORDS}, agarstake login`,
        path: '/login',
    },
    register: {
        tabTitle: 'AgarStake | Register',
        description: 'Create your AgarStake account today and start competing in high-stakes PvP arenas.',
        keywords: `${BASE_KEYWORDS}, agarstake register, sign up`,
        path: '/register',
    },
    profile: {
        tabTitle: 'AgarStake | Profile & Performance',
        description: 'Track your overall performance, win rates, and account balance on AgarStake.',
        keywords: `${BASE_KEYWORDS}, agarstake profile, stats`,
        path: '/profile',
    },
    transactions: {
        tabTitle: 'AgarStake | Transaction History',
        description: 'View your secure deposit and withdrawal history on the AgarStake platform.',
        keywords: `${BASE_KEYWORDS}, agarstake transactions, withdrawals`,
        path: '/transactions',
    },
    howItWorks: {
        tabTitle: 'AgarStake | How it Works',
        description: 'Learn the mechanics of our high-stakes Web3 arenas. Master the economy, understand cashouts, and start winning Solana.',
        keywords: `${BASE_KEYWORDS}, how to play, cash out`,
        path: '/how-it-works',
    },
    faq: {
        tabTitle: 'AgarStake | Support & FAQ',
        description: 'Get answers to common questions about deposits, withdrawals, and game rules on AgarStake.',
        keywords: `${BASE_KEYWORDS}, faq, help, support`,
        path: '/faq',
    },
};
