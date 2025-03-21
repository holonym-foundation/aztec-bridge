// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'

import { getHasValidCleanHandsAttestation } from '../../utils/clean-hands'

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

  const hasValidAttestation = await getHasValidCleanHandsAttestation(evmAddress);

  if (!hasValidAttestation) {
    return res.status(400).json({
      message: `EVM address ${evmAddress} does not have a valid clean hands attestation`
    })
  }

  // TODO: Issue aztec SBT

  res.status(200).json({ message: 'success' });
}
