import { ethers } from 'ethers';
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

async function run(): Promise<void> {
  const curAddresses = addresses['43114'];
  const { provider } = loadKey();

  //TODO: get timestamp dynamically
  const timeStart = 1661738061879;
  const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;
  const endPeriod = 1 + Math.round(Date.now() / 1000 / ONE_WEEK_SECONDS);
  const startPeriod = Math.floor(timeStart / 1000 / ONE_WEEK_SECONDS) - 2;

  console.log('endPeriod', endPeriod);
  console.log('startPeriod', startPeriod);

  const stratRegistry = new ethers.Contract(
    curAddresses.StrategyRegistry,
    StrategyRegistry.abi,
    provider
  );

  const stratViewer = new ethers.Contract(
    curAddresses.StrategyViewer,
    StrategyViewer.abi,
    provider
  );

  //get all enabled strategies
  const enabledStrategies = await stratRegistry.allEnabledStrategies();

  //get all approved tokens for each strategy
  const approvedTokens = await Promise.all(
    enabledStrategies.map((address: any) => {
      const contract = new ethers.Contract(address, IStrategy.abi, provider);
      return contract.viewAllApprovedTokens();
    })
  );

  //for each token, set the strategy as value
  let token2Strat2: Record<string, string> = {};
  for (let i = 0; i < enabledStrategies.length; i++) {
    const strategy = enabledStrategies[i];
    const tokens = approvedTokens[i];
    for (let j = 0; j < tokens.length; j++) {
      if (token2Strat2[tokens[j]] == undefined) {
        token2Strat2[tokens[j]] = strategy;
      }
    }
  }

  //separate the tokens from the strategies
  const tokens = Object.keys(token2Strat2);
  const strats = Object.values(token2Strat2);

  const noHarvestBalanceResults =
    await stratViewer.viewMetadataNoHarvestBalance(
      curAddresses.StableLending2,
      curAddresses.OracleRegistry,
      curAddresses.Stablecoin,
      tokens,
      strats
    );

  //query the strategy metadata for each token
  const stratMeta = [...noHarvestBalanceResults];

  //get legacy opened positions
  const legacyRows = await Promise.all(
    Array(endPeriod - startPeriod)
      .fill(startPeriod)
      .map(async (x, y) => {
        return await new ethers.Contract(
          curAddresses.IsolatedLending,
          IsolatedLending.abi,
          provider
        ).viewPositionsByTrackingPeriod(x + y);
      })
  );

  //get current opened positions
  const currentRows = await Promise.all(
    Array(endPeriod - startPeriod)
      .fill(startPeriod)
      .map(async (x, y) => {
        return await new ethers.Contract(
          curAddresses.StableLending2,
          StableLending2.abi,
          provider
        ).viewPositionsByTrackingPeriod(x + y);
      })
  );
  const dollar = ethers.utils.parseEther('1');

  //merge the two arrays and set the corresponding trancheContract for legacy and current
  const positions = [
    ...legacyRows.flat().map((x) => {
      return { ...x, trancheContract: curAddresses.IsolatedLending };
    }),
    ...currentRows.flat().map((x) => {
      return { ...x, trancheContract: curAddresses.StableLending2 };
    }),
  ];

  //stable coins addresses to filter out
  const stableCoins = [
    '0xc7198437980c041c805a1edcba50c1ce5db95118',
    '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
    '0xd586e7f844cea2f87f50152665bcbc2c279d8d70',
    '0xd24c2ad096400b6fbcd2ad8b24e7acbc21a1da64',
  ].map((x) => x.toUpperCase());

  //get each token decimals in order to calculate the usdPrice
  const tokensDecimals = await Promise.all(
    positions.map((posMeta) => {
      const contract = new ethers.Contract(
        posMeta.token,
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
        provider
      );
      return contract.decimals();
    })
  );

  //calculate the usdPrice and check if the position is liquidatable
  const liquidatablePositions = positions
    .filter((posMeta, index) => {
      const rows = stratMeta.filter((x) => x.token === posMeta.token);

      const tokenPrice =
        parseFloat(ethers.utils.formatEther(rows[0].valuePer1e18)) /
        10 ** (18 - tokensDecimals[index]);
      const borrowablePercent = posMeta.borrowablePer10k.toNumber() / 100;
      const collateralVal = parseFloat(posMeta.collateral!) * tokenPrice;
      const totalPercentage =
        parseFloat(posMeta.collateral!) > 0 && tokenPrice > 0
          ? (100 * parseFloat(posMeta.debt)) / collateralVal
          : 0;
      const liquidatableZone = borrowablePercent;

      return totalPercentage > liquidatableZone && posMeta.debt.lt(dollar);
    })
    .filter((posMeta) => !stableCoins.includes(posMeta.token.toUpperCase()));
  console.log(positions);
}

run();
