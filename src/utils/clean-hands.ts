import {
  Fr,
  AztecAddress,
  createPXEClient,
  waitForPXE,
} from '@aztec/aztec.js'
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'
import { SignProtocolAttestationsQueryResponse, CleanHandsSBTAztec } from '../types';
import { cleanHandsEVMAttester } from '../constants/index';
import { CleanHandsSBTContract } from '../constants/contract-interfaces/CleanHandsSBT';

// TODO: Update this address. This address needs to be changed every 
// time the contract is deployed to the sandbox.
const CLEAN_HANDS_SBT_AZTEC_ADDRESS = AztecAddress.fromString(
  '0x05f44fc0ca0269510a0664c5ae86d56be6e13dee815f0cd1523fa76a81bd56cb'
)

/**
 * @returns The attestation if the user has a valid one, null otherwise.
 */
export async function getCleanHandsEVMAttestation(
  address: string,
) {
  // https://mainnet-rpc.sign.global/api/scan/addresses/0xdbd6b2c02338919EdAa192F5b60F5e5840A50079/attestations?id=0xdbd6b2c02338919EdAa192F5b60F5e5840A50079&network=all&page=1&type=received
  
  const url = new URL(`https://mainnet-rpc.sign.global/api/scan/addresses/${address}/attestations`);
  url.searchParams.set('schemaId', '0x8');
  url.searchParams.set('network', '10');
  url.searchParams.set('type', 'received');

  const resp = await fetch(url.toString())

  if (!resp.ok) {
    throw new Error(`Error fetching clean hands attestation: ${resp.statusText}`);
  }

  const data = (await resp.json()) as SignProtocolAttestationsQueryResponse;
  const rows = data.data.rows.filter((row) => row.attester == cleanHandsEVMAttester);

  console.log('data', JSON.stringify(data, null, 2))

  if (rows.length === 0) {
    return false;
  }

  for (const row of rows) {
    if (row.validUntil && new Date(Number(row.validUntil) * 1000).getTime() > Date.now()) {
      if (row.data.length > 66) continue // hack for my specific wallet
      return row;
    }
  }

  return null;
}

/**
 * !!! TODO: Rewrite this once the SBT contract is on testnet !!!
 * WE SHOULD NOT ISSUE SBTS FROM THIS SERVER. It should all be done by
 * the Human ID verifier server, but no need to update that server
 * until Aztec testnet is ready.
 */
export async function mintAztecCleanHandsSBT(
  aztecAddress: AztecAddress,
  actionId: Fr,
  actionNullifier: Fr
) {
  const { PXE_URL = 'http://localhost:8080' } = process.env
  const pxe = createPXEClient(PXE_URL)
  await waitForPXE(pxe)

  const wallets = await getInitialTestAccountsWallets(pxe)
  const ownerWallet = wallets[0]

  const contract = await CleanHandsSBTContract.at(
    CLEAN_HANDS_SBT_AZTEC_ADDRESS,
    ownerWallet,
  )

  // Expire 365 days from now. Expressed in seconds
  const expiry = Math.floor((new Date().getTime() + 1000 * 60 * 60 * 24 * 365) / 1000);
  await contract.methods.mint(
    aztecAddress,
    actionId,
    actionNullifier,
    expiry,
  ).send().wait();
}

export async function getAztecCleanHandsSBT(
  aztecAddress: AztecAddress,
) {
  const { PXE_URL = 'http://localhost:8080' } = process.env
  const pxe = createPXEClient(PXE_URL)
  await waitForPXE(pxe)

  const wallets = await getInitialTestAccountsWallets(pxe)
  const ownerWallet = wallets[0]

  const contract = await CleanHandsSBTContract.at(
    CLEAN_HANDS_SBT_AZTEC_ADDRESS,
    ownerWallet,
  )

  return contract.methods.get_sbt_by_address(aztecAddress).simulate();
}

export function convertAztecSBTToSerializeable(sbt: CleanHandsSBTAztec) {
  return {
    id: sbt.id.toString(),
    recipient: sbt.recipient.toString(),
    expiry: sbt.expiry.toString(),
    action_id: sbt.action_id.toString(),
    action_nullifier: sbt.action_nullifier.toString(),
    revoked: sbt.revoked.toString(),
    minter: sbt.minter.toString(),
  }
}