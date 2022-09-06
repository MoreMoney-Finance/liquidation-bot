import { parseUnits } from '@ethersproject/units';
import { BigNumber, ethers } from 'ethers';
import { getTokenPrice } from './coingecko';
import { getOraclePrice } from './oracle';
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

export async function fetchPrices(tokenDecimals: Record<string, number>) {
  const keys = Object.keys(tokenDecimals);
  let coingeckoPrices: Record<string, number> = {};
  let oraclePrices: Record<string, number> = {};

  for (let index = 0; index < keys.length; index++) {
    const token = keys[index];
    const amount = parseUnits('1', tokenDecimals[token]);
    const price = await getTokenPrice(token, amount);
    const oraclePrice = await getOraclePrice(token, amount);
    coingeckoPrices[token] = price;
    oraclePrices[token] = parseFloat(ethers.utils.formatEther(oraclePrice));
  }

  console.log(coingeckoPrices);
  console.log(oraclePrices);

  return { coingeckoPrices, oraclePrices };
}

