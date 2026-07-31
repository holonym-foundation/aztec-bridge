import { PrismaClient } from '@prisma/client'

/**
 * A second client, separate from `src/lib/prisma`'s singleton, so a test can
 * seed and inspect rows without going through the handlers it is exercising.
 * Both point at the same DATABASE_URL.
 */
export const db = new PrismaClient()

/** Wipe every table between tests. Order matters: BridgeActivity FKs to User. */
export async function resetDb() {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE bridge_activities, attestation_reservations, address_bindings, auth_nonces, users RESTART IDENTITY CASCADE',
  )
}

/** Record a settled L1→L2 deposit, the way the bridge flow does once it confirms. */
export async function settleDeposit(
  user: { userId: string },
  usdc: number,
  extra: { attestationNonce?: string; createdAt?: Date; status?: string } = {},
) {
  return db.bridgeActivity.create({
    data: {
      fkUserId: user.userId,
      direction: 'L1_TO_L2',
      status: (extra.status ?? 'deposited') as any,
      encryptedCiphertext: 'x',
      encryptedIv: 'x',
      encryptedTag: 'x',
      keyDerivationMessage: 'x',
      keyDerivationDomain: 'x',
      amountL1: String(BigInt(Math.round(usdc * 1e6))),
      tokenDecimalsL1: 6,
      tokenSymbolL1: 'USDC',
      ...(extra.attestationNonce ? { attestationNonce: extra.attestationNonce } : {}),
      ...(extra.createdAt ? { createdAt: extra.createdAt } : {}),
    },
  })
}
