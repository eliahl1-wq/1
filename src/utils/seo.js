const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://www.agararena.space').replace(/\/$/, '');

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

/** Update title + meta description + social tags for the current SPA route. */
export function setPageSeo({ title, description, path = '' }) {
    if (title) document.title = title;

    if (description) {
        upsertMeta('meta[name="description"]', { name: 'description', content: description });
        upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
        upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    }

    if (title) {
        upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
        upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    }

    const canonical = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    upsertLink('canonical', canonical);
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
}

export const SEO = {
    gamemodesAgar: {
        title: 'Play Agar.io with Real Money | AgarStake',
        description: 'Play Agar.io with real money on AgarStake. Deposit SOL, grow your blob, eat opponents, and cash out crypto instantly. Real-money Agar arena with Web3 payouts.',
        path: '/gamemodes',
    },
    gamemodesSlither: {
        title: 'Play Slither.io with Real Money | AgarStake',
        description: 'Play Slither.io with real money on AgarStake. Deposit Solana, grow your snake, trap rivals, and cash out instantly. The ultimate crypto Slither arena.',
        path: '/gamemodes',
    },
    preGameAgar: {
        title: 'Agar Arena - Real Money | AgarStake',
        description: 'Join the Agar arena for real money. Choose your stake, dominate the blob battle, and withdraw SOL when you cash out.',
        path: '/pre-game',
    },
    preGameSlither: {
        title: 'Slither Arena - Real Money | AgarStake',
        description: 'Join the Slither arena for real money. Stake SOL, outgrow rival snakes, and cash out your winnings instantly.',
        path: '/pre-game',
    },
    lobby: {
        title: 'Deposit & Play .io Games for Crypto | AgarStake',
        description: 'Deposit Solana to play Agar.io and Slither.io for real money. Fund your wallet, pick your arena, and start earning crypto in browser .io games.',
        path: '/lobby',
    },
};
