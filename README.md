# Moremoney liquidation bot 

The purpose of this bot is to liquidate positions that have exceeded the allowable loan-to-value ratio (LTV) on the Moremoney protocol. It is open sourced in order to encourage liquidator participation; which makes the Moremoney protocol more secure. 

# Install

Install dependencies:
```(shell)
yarn install
```

Place a private key file in your home folder `~/.liquidation-bot`. If you want it to match up with your wallet like MetaMask, create the account in your wallet, copy the private key and paste it into the file.

# Usage

To run the liquidation-bot once:

```(shell)
yarn start
```

To run the liquidation-bot every 30 seconds:

```(shell)
yarn start-bot
```

# Disclaimer

This is alpha software, demonstrating functionality and proficiency, which has not yet been reviewed and tested rigorously.

# Documentation

## Liquidation

Liquidation occurs in `IsolatedLendingLiquidation.sol`.

- Would-be liquidators bid a rebalancing amount in stablecoin with which to repay some debt of the liquidatable tranche.
- Liquidators can request a collateral amount by which they may be compensated, the value of which may not exceed their liquidation bid, plus a per-asset liquidation fee.
- After depositing the rebalancing amount of stablecoin and withdrawing the requested collateral to the liquidator, the tranche must be above the minimum collateralization threshold.
- The protocol additionally asseses a fee, as a portion of the requested collateral value, which can be set per-asset.

*NOTE:* In case a tranche goes underwater we reserve liquidation for governance and whitelisted addresses, in order to guard against oracle vulnerabilities.

We will also provide unprivileged convenience contracts to organize complete unwinding of positions using AMMs and stablecoin flash loans.

## Oracles

The protocol provides a central point for governance to register oracles in `OracleRegistry`. Oracles generally provide a way to convert amounts in one token into another and are specifically used to convert amounts in a variety of accepted collateral tokens into amounts in our USD-pegged stablecoin (often represented by converting into USD or other USD-pegged tokens).

Oracle calls are offered as view functions or state-updating.

### Chainlink oracle

Chainlink provides a strong stable of USD price feeds on a variety of networks. The main issues to bear in mind are oracle freshness and correct decimal conversion. In order to guard against stale chainlink pricefeeds, our oracles also maintain a fallback TWAP oracle, using another reputable stablecoin as stand-in for USD price.
