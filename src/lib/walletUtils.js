import { WalletReadyState } from '@solana/wallet-adapter-base';

export const WALLET_INFO = {
    Phantom: {
        label: 'Phantom',
        icon: '👻',
        installUrl: 'https://phantom.app/download',
        description: 'Browser extension',
    },
    Brave: {
        label: 'Brave Wallet',
        icon: '🦁',
        installUrl: 'https://brave.com/wallet/',
        description: 'Built into Brave browser',
    },
    Solflare: {
        label: 'Solflare',
        icon: '🔥',
        installUrl: 'https://solflare.com/download',
        description: 'Browser extension',
    },
    Backpack: {
        label: 'Backpack',
        icon: '🎒',
        installUrl: 'https://backpack.app/download',
        description: 'Browser extension',
    },
};

const PREFERRED_INSTALL_ORDER = ['Brave', 'Phantom', 'Solflare'];

export function isBraveBrowser() {
    return typeof window !== 'undefined' && !!window.braveSolana?.isBraveWallet;
}

/** Wallets the user can actually connect to right now */
export function getConnectableWallets(wallets) {
    const ready = wallets.filter(w =>
        w.readyState === WalletReadyState.Installed ||
        w.readyState === WalletReadyState.Loadable
    );

    // Brave sets isPhantom — don't show Phantom separately in Brave
    if (isBraveBrowser()) {
        const hasBrave = ready.some(w => w.adapter.name === 'Brave');
        if (hasBrave) {
            return ready.filter(w => w.adapter.name !== 'Phantom');
        }
    }

    const seen = new Set();
    return ready.filter(w => {
        const key = w.adapter.name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/** Popular wallets not detected — show install links */
export function getSuggestedInstalls(wallets) {
    const installed = new Set(
        wallets
            .filter(w => w.readyState === WalletReadyState.Installed)
            .map(w => w.adapter.name)
    );

    // In Brave, don't suggest Phantom if Brave Wallet is the native option
    const suggestions = isBraveBrowser()
        ? PREFERRED_INSTALL_ORDER.filter(n => n !== 'Phantom' || !installed.has('Brave'))
        : PREFERRED_INSTALL_ORDER;

    return suggestions.filter(name => !installed.has(name));
}

export function getWalletDisplay(name) {
    return WALLET_INFO[name] || { label: name, icon: '💳', installUrl: null, description: 'Solana wallet' };
}

export function shortAddress(address, chars = 4) {
    if (!address) return '';
    const s = typeof address === 'string' ? address : address.toBase58?.() || String(address);
    if (s.length <= chars * 2 + 3) return s;
    return `${s.slice(0, chars)}…${s.slice(-chars)}`;
}
