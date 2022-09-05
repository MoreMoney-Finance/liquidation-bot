import { BigNumber, ethers } from 'ethers';
import { moneyToken } from './utils/constants';
import { loadKey } from './utils/load-key';

const { signer } = loadKey();

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
  return await (
    await contract.getAmountInPeg(token, amount, moneyToken)
  ).wait();
}
