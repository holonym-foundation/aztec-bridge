"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const ethers_1 = require("ethers");
//For env File 
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 8000;
app.get('/', (req, res) => {
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
function signTransfer(quantity, timestamp, passportHolder) {
    const typedData = {
        transferQuantity: quantity,
        timestamp: timestamp,
        passportHolder: passportHolder
    };
    const signer = new ethers_1.Wallet(process.env.PASSPORT_ATTESTOR_PRIVATE_KEY);
    const signature = signTypedData(process.env.PASSPORT_ATTESTOR_PRIVATE_KEY, typedData);
}
