import express, { Express, Request, Response , Application } from 'express';
import dotenv from 'dotenv';
import { Wallet, BigNumberish } from 'ethers';

//For env File 
dotenv.config();

const app: Application = express();
const port = process.env.PORT || 8000;

app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to Express & TypeScript Server');
});

app.listen(port, () => {
  console.log(`Express Server is running at https://localhost:${port}`);
});

// This function signs typed data of the allowed transfer quantity, along with the timestamp at which this transfer amount was authorized
// It uses process.env.PASSPORT_ATTESTOR_PRIVATE_KEY to sign the message
// The signature is in an EIP-712 format

// The typed data is as follows:
// 1. The allowed transfer quantity (ethers BigNumber that represents a uint256)
// 2. The timestamp at which this transfer amount was authorized (ethers BigNumber that represents a uint256)
// 3. The address of the passport holder

function signTransfer(quantity: BigNumberish, timestamp: BigNumberish, passportHolder: string): string {
  const domain = TypedD
  const typedData = {
    transferQuantity: quantity,
    timestamp: timestamp,
    passportHolder: passportHolder
  };
  const signer = new Wallet(process.env.PASSPORT_ATTESTOR_PRIVATE_KEY as string);

  const signature = signer.signTypedData(typedData);
}