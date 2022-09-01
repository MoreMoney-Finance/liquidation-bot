import { formatUnits } from '@ethersproject/units';
import axios from 'axios';
import { BigNumber, ethers } from 'ethers';
import { moneyToken } from './utils/constants';
import { loadKey } from './utils/load-key';

const tokensCoingecko: Record<string, string | null> = {
  '0x152b9d0FdC40C096757F570A51E494bd4b943E50': 'bitcoin',
  '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE': 'benqi-liquid-staked-avax',
  '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7': 'wrapped-avax',
  '0x9e295B5B976a184B14aD8cd72413aD846C299660': null,
  '0xF7D9281e8e363584973F946201b82ba72C965D27': null,
};

const { signer } = loadKey();

export async function getTokenPrice(token: string, amount: BigNumber) {
  const coingeckoPrice = await getCoingeckoPrice(token);
  const tokenPrice =
    coingeckoPrice ||
    parseFloat(ethers.utils.formatEther(await getOraclePrice(token, amount)));
  return tokenPrice;
}

export async function getCoingeckoPrice(token: string) {
  const tokenId = tokensCoingecko[token];
  if (tokenId) {
    return (
      await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`
      )
    ).data[tokenId].usd;
  } else {
    return null;
  }
}

export async function getOraclePrice(token: string, amount: BigNumber) {
  const contract = new ethers.Contract(
    '0x567Cf1675F5cb3c0457B35753d76e83E37CDBe96',
    [
      {
        inputs: [
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'uint256', name: 'inAmount', type: 'uint256' },
          { internalType: 'address', name: 'pegCurrency', type: 'address' },
        ],
        name: 'viewAmountInPeg',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    signer
  );
  return await contract.viewAmountInPeg(token, amount, moneyToken);
}

export async function getAmountInPeg(token: string, amount: BigNumber) {
  const contract = new ethers.Contract(
    '0x567Cf1675F5cb3c0457B35753d76e83E37CDBe96',
    [
      {
        inputs: [
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'uint256', name: 'inAmount', type: 'uint256' },
          { internalType: 'address', name: 'pegCurrency', type: 'address' },
        ],
        name: 'getAmountInPeg',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    signer
  );
  return await contract.getAmountInPeg(token, amount, moneyToken);
}
