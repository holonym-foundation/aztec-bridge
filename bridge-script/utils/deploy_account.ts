import { createLogger, Fr, AccountManager } from "@aztec/aztec.js";
import type { PXE, Logger } from "@aztec/aztec.js";
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { deriveSigningKey } from '@aztec/stdlib/keys';
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { getSponsoredFPCInstance } from "./sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";

export async function deploySchnorrAccount(pxe: PXE): Promise<AccountManager> {

    let logger: Logger;
    logger = createLogger('aztec:');
    logger.info('Schnorr account')
    
    const SECRET_KEY_FR = new Fr(1);
    const SALT_FR = new Fr(2);

    const sponsoredFPC = await getSponsoredFPCInstance();
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // Use fixed keys for deterministic deployment, or random for new accounts
    const secretKey = SECRET_KEY_FR;
    const salt = SALT_FR;
    // let secretKey = Fr.random();
    // let salt = Fr.random();

    // logger.info(`Secret Key: ${secretKey}`)
    // logger.info(`Salt: ${salt}`)

    let schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);
    
    // Check if account is already deployed
    let wallet = await schnorrAccount.getWallet();
    const accountAddress = wallet.getAddress();
    
    try {
        // Try to get registered accounts to see if this one already exists
        logger.info(`Checking if account already exists at: ${accountAddress}`);
        const registeredAccounts = await pxe.getRegisteredAccounts();
        const existingAccount = registeredAccounts.find(acc => acc.address.equals(accountAddress));
        if (existingAccount) {
            logger.info(`Account already exists at: ${accountAddress}`);
            return schnorrAccount;
        }
    } catch (error) {
        // Error getting registered accounts, proceed with deployment
        logger.info(`Could not check registered accounts, proceeding with deployment...`);
    }
    
    try {
        logger.info(`Deploying schnorr account at: ${accountAddress}`);
        await schnorrAccount.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait({timeout: 120000});
        logger.info(`Schnorr account deployed at: ${accountAddress}`);
    } catch (error: any) {
        if (error?.message?.includes('Existing nullifier')) {
            logger.info(`Account already deployed at: ${accountAddress}`);
            return schnorrAccount;
        }
                 throw error;
    }

    return schnorrAccount;
}