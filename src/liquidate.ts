import { formatEther, formatUnits } from '@ethersproject/units';
import { BigNumber, ethers } from 'ethers';
import StableLending2Liquidation from './contracts/artifacts/contracts/liquidation/StableLending2Liquidation.sol/StableLending2Liquidation.json';
import { loadKey } from './utils/load-key';
import addresses from './contracts/addresses.json';
import { moneyToken } from './utils/constants';

const curAddresses = addresses['43114'];

const { signer } = loadKey();

export async function viewBidTarget(
  trancheId: number,
  lendingAddress: string,
  requestedColVal: BigNumber,
  defaultResult: any
) {
  const liquidationContract = new ethers.Contract(
    lendingAddress,
    StableLending2Liquidation.abi,
    signer
  );

  const result = await liquidationContract.viewBidTarget(
    trancheId,
    requestedColVal
  );
  return result ?? defaultResult;
}

async function sendLiquidation({
  trancheId,
  collateralRequested,
  rebalancingBid,
  recipient,
}: {
  trancheId: number;
  collateralRequested: BigNumber;
  rebalancingBid: BigNumber;
  recipient: string;
}) {
  const lendingAddress = curAddresses.StableLending2Liquidation;
  const liquidationContract = new ethers.Contract(
    lendingAddress,
    StableLending2Liquidation.abi,
    signer
  );
  return await liquidationContract.liquidate(
    trancheId,
    collateralRequested,
    rebalancingBid,
    recipient
  );
}

export async function primitiveLiquidate({
  trancheId,
  collateral,
  collateralValue,
  borrowablePercent,
  debtParam,
  positionYield,
}: {
  trancheId: number;
  collateral: BigNumber;
  collateralValue: BigNumber;
  borrowablePercent: number;
  debtParam: BigNumber;
  positionYield: BigNumber;
}) {
  const lendingAddress = curAddresses.StableLending2Liquidation;
  const extantCollateral = collateral!;
  console.log('collateralValue', formatEther(collateralValue));
  const extantCollateralValue = collateralValue;
  const account = signer.address;
  const moneyContract = new ethers.Contract(
    moneyToken,
    [
      {
        inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    signer
  );

  const moneyBalance = await moneyContract.balanceOf(signer.address);

  const ltvPer10k = borrowablePercent * 100;

  const debt = debtParam.sub(positionYield);

  if (debt.gt(extantCollateralValue.mul(87).div(100))) {
    console.log(
      'liquidating',
      trancheId,
      extantCollateral.toString(),
      debt.toString(),
      account!
    );
    if (moneyBalance.gt(debt)) {
      sendLiquidation({
        trancheId,
        collateralRequested: extantCollateral,
        rebalancingBid: debt,
        recipient: account!,
      });
    } else {
      console.log('insufficient MONEY balance');
    }
  } else {
    const requestedColVal = debt
      .add(
        debt
          .mul(10000)
          .sub(extantCollateralValue.mul(ltvPer10k))
          .div(10000 - ltvPer10k)
      )
      .div(2);

    const collateralRequested = extantCollateral
      .mul(requestedColVal)
      .div(extantCollateralValue);

    const bidTarget = await viewBidTarget(
      trancheId,
      lendingAddress,
      requestedColVal,
      BigNumber.from(0)
    );

    const rebalancingBid = bidTarget.mul(1000).div(984);
    // console.log(
    //   'rebalancingBid',
    //   formatEther(requestedColVal),
    //   formatUnits(collateralRequested, token.decimals),
    //   formatEther(rebalancingBid)
    // );

    if (moneyBalance.gt(rebalancingBid)) {
      sendLiquidation({
        trancheId,
        collateralRequested,
        rebalancingBid,
        recipient: account!,
      });
    } else {
      console.log('insufficient MONEY balance');
    }
  }
}
