import { AGAR, isAgarLaunchReady } from '../config/agarConfig';
import { accountJupiterSwapProvider } from './providers/accountJupiterSwapProvider';

const providers = new Map([
    ['account-jupiter', accountJupiterSwapProvider],
]);

/**
 * Swap providers implement:
 *   execute({ side, amount, mint, accountAddress, authToken }): Promise<unknown>
 *
 * This keeps Jupiter-specific request, quote, transaction, and signing logic
 * outside the UI.
 */
export function registerAgarSwapProvider(name, provider) {
    if (!name || typeof provider?.execute !== 'function') {
        throw new TypeError('A token swap provider must expose execute().');
    }
    providers.set(name, provider);
}

export async function executeAgarSwap({
    side,
    amount,
    accountAddress,
    authToken,
    config = AGAR,
}) {
    if (!isAgarLaunchReady(config)) {
        throw new Error(config.messages.notLaunched);
    }

    const provider = providers.get(config.swap.provider);
    if (!provider) {
        // TODO: Register any custom swap adapter selected in configuration.
        throw new Error(`${config.symbol} swaps are not available yet.`);
    }

    return provider.execute({
        side,
        mint: config.mint,
        decimals: config.decimals,
        amount,
        accountAddress,
        authToken,
        config,
    });
}
