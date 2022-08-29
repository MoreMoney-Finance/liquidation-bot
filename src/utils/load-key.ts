import { parseEther, parseUnits, formatUnits } from '@ethersproject/units';
import { BigNumber, ethers } from 'ethers';
import { Provider } from 'ethers-multicall';
import * as fs from 'fs';
const homedir = require('os').homedir();
const privateKey = fs
  .readFileSync(`${homedir}/.liquidation-bot`)
  .toString()
  .trim();

export function loadKey() {
  const provider = new ethers.providers.JsonRpcProvider(
    'https://api.avax.network/ext/bc/C/rpc'
  );
  const ethcallProvider = new Provider(provider);
  const signer = new ethers.Wallet(privateKey, provider);
  return { provider, signer, ethcallProvider };
}
