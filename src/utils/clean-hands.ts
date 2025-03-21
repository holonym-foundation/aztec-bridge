import { SignProtocolAttestationsQueryResponse } from '../types';
import { cleanHandsEVMAttester } from '../constants/index';

export async function getHasValidCleanHandsAttestation(
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

  let hasValidAttestation = false;
  for (const row of rows) {
    if (row.validUntil && new Date(Number(row.validUntil) * 1000).getTime() > Date.now()) {
      hasValidAttestation = true;
      break;
    }
  }

  return hasValidAttestation;
}
