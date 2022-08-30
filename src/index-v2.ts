import { BigNumber, ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import addresses from './contracts/addresses.json';
import AMMYieldConverter from './contracts/contracts/strategies/AMMYieldConverter.sol/AMMYieldConverter.json';
import MultiAMMYieldConverter from './contracts/contracts/strategies/MultiAMMYieldConverter.sol/MultiAMMYieldConverter.json';
import Strategy from './contracts/contracts/Strategy.sol/Strategy.json';
import MultiYieldConversionStrategy from './contracts/contracts/strategies/MultiYieldConversionStrategy.sol/MultiYieldConversionStrategy.json';
import IsolatedLending from './contracts/contracts/IsolatedLending.sol/IsolatedLending.json';
import StableLending2 from './contracts/contracts/StableLending2.sol/StableLending2.json';
import StrategyViewer from './contracts/contracts/StrategyViewer.sol/StrategyViewer.json';
import StrategyRegistry from './contracts/contracts/StrategyRegistry.sol/StrategyRegistry.json';
import IStrategy from './contracts/interfaces/IStrategy.sol/IStrategy.json';
import { loadKey } from './utils/load-key';
import axios from 'axios';
import { parseEther } from '@ethersproject/units';
import { Interface } from 'ethers/lib/utils';

export function calcLiqPriceFromNum(
  borrowablePercent: number,
  debtNum: number,
  colNum: number
): number {
  if (colNum > 0) {
    return (100 * debtNum) / (colNum * borrowablePercent);
  } else {
    return 0;
  }
}

export function parsePositionMeta(row: any, trancheContract: string) {
  const debt = row.debt;
  const posYield = row.yield;
  const collateral = row.collateral;

  const borrowablePercent = row.borrowablePer10k.toNumber() / 100;

  return {
    trancheContract,
    trancheId: row.trancheId.toNumber(),
    strategy: row.strategy,
    debt,
    collateral,
    yield: posYield,
    token: row.token,
    collateralValue: row.collateralValue,
    borrowablePercent,
    owner: row.owner,
    liquidationPrice: debt.gt(posYield)
      ? calcLiqPriceFromNum(
          borrowablePercent,
          debt.sub(posYield),
          parseFloat(ethers.utils.formatEther(collateral!))
        )
      : 0,
  };
}

async function run(): Promise<void> {
  const curAddresses = addresses['43114'];
  const { signer } = loadKey();

  const token2Strat = {
    ['0x152b9d0FdC40C096757F570A51E494bd4b943E50']:
      curAddresses.YieldYakStrategy2,
    ['0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE']:
      curAddresses.YieldYakStrategy2,
    ['0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7']:
      curAddresses.YieldYakAVAXStrategy2,
    ['0x9e295B5B976a184B14aD8cd72413aD846C299660']:
      curAddresses.YieldYakPermissiveStrategy2,
    ['0xF7D9281e8e363584973F946201b82ba72C965D27']:
      curAddresses.SimpleHoldingStrategy,
  };

  // const masterChef2Tokens = [
  //   '0x57319d41f71e81f3c65f2a47ca4e001ebafd4f33',
  //   '0xa389f9430876455c36478deea9769b7ca4e3ddb1',
  //   '0xed8cbd9f0ce3c6986b22002f03c6475ceb7a6256',
  // ].map(getAddress);

  const tokens = Object.keys(token2Strat);
  const strats = Object.values(token2Strat);

  tokens.push('0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7');
  strats.push(curAddresses.AltYieldYakAVAXStrategy2);
  tokens.push('0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7');
  strats.push(curAddresses.OldYieldYakAVAXStrategy2);
  tokens.push('0x152b9d0FdC40C096757F570A51E494bd4b943E50');
  strats.push(curAddresses.AltYieldYakStrategy2);
  tokens.push('0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE');
  strats.push(curAddresses.AltYieldYakStrategy2);

  const stratViewer = new ethers.Contract(
    curAddresses.StrategyViewer,
    new Interface(StrategyViewer.abi),
    signer
  );
  const normalResults = await stratViewer.viewMetadata(
    curAddresses.StableLending2,
    tokens,
    strats
  );
  // console.log(normalResults);

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
  // get cache positions
  const cachedPositions = (
    await axios.get(
      'https://raw.githubusercontent.com/MoreMoney-Finance/craptastic-api/main/src/v2-updated-positions.json'
    )
  ).data;

  const parsedCachePositions = Object.values(cachedPositions.positions)
    .map((pos: any) => ({
      trancheId: BigNumber.from(pos.trancheId),
      strategy: pos.strategy,
      collateral: BigNumber.from(pos.collateral),
      debt: parseEther(pos.debt.toString()),
      token: pos.token,
      collateralValue: parseEther(pos.collateralValue.toString()),
      borrowablePer10k: BigNumber.from(pos.borrowablePer10k),
      owner: pos.owner,
      yield: BigNumber.from(0),
      trancheContract: pos.trancheContract,
    }))
    .map((pos) => parsePositionMeta(pos, pos.trancheContract));

  const TWELVE_HOURS_SECONDS = 43200;
  const START = cachedPositions.tstamp;
  const endPeriod = 1 + Math.round(Date.now() / 1000 / TWELVE_HOURS_SECONDS);
  const startPeriod = Math.floor(START / 1000 / TWELVE_HOURS_SECONDS) - 2;

  const currentRows = await Promise.all(
    Array(endPeriod - startPeriod)
      .fill(startPeriod)
      .map(async (x, y) => {
        return await new ethers.Contract(
          curAddresses.StableLending2,
          StableLending2.abi,
          signer
        ).viewPositionsByTrackingPeriod(x + y);
      })
  );
  function parseRows(rows: [][], trancheContract: string) {
    return rows
      .flatMap((x) => x)
      .filter((x) => x)
      .map((row) => parsePositionMeta(row, trancheContract));
  }
  const updatedPositions = [
    ...((currentRows.length > 0 &&
      parseRows(currentRows, curAddresses.StableLending2)) ||
      []),
  ];
  // console.log('parseCachePositions', parsedCachePositions);
  // console.log('updatedPositions', updatedPositions);
  const jointUpdatedPositions = [...parsedCachePositions, ...updatedPositions];

  const updatedMetadata = await Promise.all(
    jointUpdatedPositions.map(async (pos) => {
      return await new ethers.Contract(
        curAddresses.StableLending2,
        StableLending2.abi,
        signer
      ).viewPositionMetadata(pos.trancheId);
    })
  );
  const updatedPositionMetadata = updatedMetadata
    .filter((x) => x !== undefined)
    .map((pos) => {
      return parsePositionMeta(pos, pos.trancheContract);
    });

  const updatedDataMap = updatedPositionMetadata.reduce((acc, x) => {
    acc[x.trancheId] = x;
    return acc;
  }, {} as Record<string, any>);
  const parsedPositions = new Map<number, any>();
  for (let index = 0; index < jointUpdatedPositions.length; index++) {
    const pos = jointUpdatedPositions[index];
    const posUpdatedData = {
      ...updatedDataMap[pos.trancheId],
      trancheContract: pos.trancheContract,
    };
    parsedPositions.set(pos.trancheId, posUpdatedData);
  }
  const dollar = parseEther('1');

  const liquidatablePositions = Array.from(parsedPositions.values()).filter(
    (posMeta) => {
      const tokenPrice =
        parseFloat(ethers.utils.formatEther(tokenValuePer1e18[posMeta.token])) /
        10 ** (18 - tokenDecimals[posMeta.token]);

      const collateralVal =
        parseFloat(ethers.utils.formatEther(posMeta.collateral)) * tokenPrice;

      const totalPercentage =
        parseFloat(ethers.utils.formatEther(posMeta.collateral)) > 0 &&
        tokenPrice > 0
          ? (100 * parseFloat(ethers.utils.formatEther(posMeta.debt))) /
            collateralVal
          : 0;

      const liquidatableZone = posMeta.borrowablePercent;
      return (
        1.25 * posMeta.liquidationPrice > tokenPrice &&
        totalPercentage > liquidatableZone &&
        posMeta.debt.gt(dollar)
      );
    }
  );
  console.log('liquidatablePositions', liquidatablePositions);
}

run();
