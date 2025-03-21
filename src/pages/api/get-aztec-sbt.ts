// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import { AztecAddress } from '@aztec/aztec.js'

import {
  getAztecCleanHandsSBT,
  convertAztecSBTToSerializeable
} from '../../utils/clean-hands'

type Data = {
  message: string;
  sbt?: any;
};

/**
 * Endpoint mostly for testing purposes.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const aztecAddress = req.query.aztecAddress;

  if (typeof aztecAddress !== 'string') {
    return res.status(400).json({ message: 'aztecAddress must be a string' });
  }

  let parsedAztecAddress;
  try {
    parsedAztecAddress = AztecAddress.fromString(aztecAddress);
  } catch (err) {
    return res.status(400).json({
      message: 'Failed to parse aztec address into field element'
    });
  }

  const sbt = await getAztecCleanHandsSBT(parsedAztecAddress);

  if (!sbt) {
    return res.status(404).json({
      message: `No clean hands SBT found for aztec address ${aztecAddress}`
    });
  }

  return res.status(200).json({
    message: 'success',
    sbt: convertAztecSBTToSerializeable(sbt)
  });
}
