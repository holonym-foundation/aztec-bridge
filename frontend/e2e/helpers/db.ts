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
