import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { makeFetch } from '@aztec/foundation/json-rpc/client';
import { getAztecNodeUrl, getAztecNodeApiKey, getEnv } from '../config/config.js';
import { EmbeddedWallet } from '@aztec/wallets/embedded';

// Some node endpoints (e.g. mainnet.rpc.aztec-labs.com) authenticate via an X-Aztec-API-Key
// header. createAztecNodeClient sends no auth by default, so inject the header when
// AZTEC_NODE_API_KEY is set — otherwise the client behaves exactly as before.
export function createNode(): ReturnType<typeof createAztecNodeClient> {
    const url = getAztecNodeUrl();
    const apiKey = getAztecNodeApiKey();
    if (!apiKey) return createAztecNodeClient(url);
    const base = makeFetch([1, 2, 3], false);
    const authFetch: typeof base = (host, body, extraHeaders = {}, noRetry) =>
        base(host, body, { ...extraHeaders, 'X-Aztec-API-Key': apiKey }, noRetry);
    return createAztecNodeClient(url, {}, authFetch);
}

export async function setupWallet(): Promise<EmbeddedWallet> {
    const node = createNode();
    const proverEnabled = getEnv() !== 'sandbox';
    const wallet = await EmbeddedWallet.create(node, { pxeConfig: { proverEnabled } });
    return wallet;
}
