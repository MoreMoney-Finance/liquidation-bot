import { BigNumber, ethers } from 'ethers';
import { loadKey } from './utils/load-key';

const { signer } = loadKey();

export async function getTokenDecimalsAndValue1e18(normalResults: any) {
  let tokenDecimals: Record<string, number> = {};
  let tokenValuePer1e18: Record<string, BigNumber> = {};

  await Promise.all(
    normalResults.map(async (normalResult: any) => {
      const contract = new ethers.Contract(
        normalResult.token,
        [
          {
            inputs: [],
            name: 'decimals',
            outputs: [
              {
                internalType: 'uint8',
                name: '',
                type: 'uint8',
              },
            ],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        signer
      );
      const decimals = await contract.decimals();
      tokenDecimals[normalResult.token] = decimals;
      tokenValuePer1e18[normalResult.token] = normalResult.valuePer1e18;
    })
  );

  return { tokenDecimals, tokenValuePer1e18 };
}
