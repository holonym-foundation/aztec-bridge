// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { AztecAddress, Fr } from '@aztec/aztec.js'

import {
  getCleanHandsEVMAttestation,
  mintAztecCleanHandsSBT
} from '../../utils/clean-hands'

type Data = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const evmAddress = req.body.evmAddress;
  const aztecAddress = req.body.aztecAddress;

  if (!evmAddress) {
    return res.status(400).json({ message: 'EVM address is required' });
  }

  if (!aztecAddress) {
    return res.status(400).json({ message: 'Aztec address is required' });
  }

  let parsedAztecAddress;
  try {
    parsedAztecAddress = AztecAddress.fromString(aztecAddress);
  } catch (err) {
    return res.status(400).json({
      message: 'Failed to parse aztec address into field element'
    });
  }

  const attestation = await getCleanHandsEVMAttestation(evmAddress);

  if (!attestation) {
    return res.status(400).json({
      message: `EVM address ${evmAddress} does not have a valid clean hands attestation`
    })
  }

  // When issuing the clean hands attestation on sign protocol, we always use
  // - the action nullifier as the indexing value
  // - and the action id as the data field
  const actionNullifier = Fr.fromHexString(attestation.indexingValue)
  const actionId = Fr.fromHexString(attestation.data)

  try {
    await mintAztecCleanHandsSBT(
      parsedAztecAddress,
      actionId,
      actionNullifier
    )

    return res.status(200).json({
      message: `Successfully minted SBT to Aztec address ${aztecAddress}`
    });
  } catch (err) {
    console.error('Error minting clean hands SBT:', err)
    return res.status(500).json({
      message: `Failed to mint clean hands SBT for Aztec address ${aztecAddress}`
    });
  }
}
