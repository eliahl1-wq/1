import { PublicKey } from '@solana/web3.js';
import { AGAR, isAgarLaunchReady } from '../config/agarConfig';

export async function fetchAgarBalance({
    connection,
    owner,
    config = AGAR,
}) {
    if (!connection || !owner || !isAgarLaunchReady(config)) return 0;

    const mint = new PublicKey(config.mint);
    const response = await connection.getParsedTokenAccountsByOwner(
        owner,
        { mint },
        'confirmed',
    );

    return response.value.reduce((total, account) => {
        const amount = account.account.data?.parsed?.info?.tokenAmount?.uiAmountString;
        const parsed = Number(amount);
        return total + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);
}
