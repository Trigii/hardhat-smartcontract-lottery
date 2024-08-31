# Hardhat SmartContract Lottery

This repo contains a tamper proof autonomous verifiably random lottery.

## Networks

-   Sepolia
-   Hardhat / Localhost

## Quickstart

```
git clone
cd hardhat-smartcontract-lottery
yarn
```

## Usage

### Deploy

```
yarn hardhat deploy
```

### Testing

```
yarn hardhat test
```

### Test Coverage

```
yarn hardhat coverage
```

## Deployment to a testnet or mainnet

1. Setup environment variables

You'll want to set your SEPOLIA_RPC_URL and PRIVATE_KEY as environment variables. You can add them to a .env file, similar to what you see in .env.example.

-   `PRIVATE_KEY`: The private key of your account (like from metamask). NOTE: FOR DEVELOPMENT, PLEASE USE A KEY THAT DOESN'T HAVE ANY REAL FUNDS ASSOCIATED WITH IT.

-   `SEPOLIA_RPC_URL`: This is url of the sepolia testnet node you're working with. You can get setup with one for free from Alchemy

2. Get testnet ETH

Head over to faucets.chain.link and get some testnet ETH & LINK. You should see the ETH and LINK show up in your metamask.

3. Setup a Chainlink VRF Subscription ID

Head over to vrf.chain.link and setup a new subscription, and get a subscriptionId. You can reuse an old subscription if you already have one.

You should leave this step with:

1. A subscription ID
2. Your subscription should be funded with LINK
3. Deploy

In your helper-hardhat-config.js add your subscriptionId under the section of the chainId you're using (aka, if you're deploying to sepolia, add your subscriptionId in the subscriptionId field under the 11155111 section.)

Then run:

```
yarn hardhat deploy --network sepolia
```

And copy / remember the contract address.

4. Add your contract address as a Chainlink VRF Consumer

Go back to vrf.chain.link and under your subscription add Add consumer and add your contract address. You should also fund the contract with a minimum of 1 LINK.

5. Register a Chainlink Keepers Upkeep

Go to keepers.chain.link and register a new upkeep. Choose Custom logic as your trigger mechanism for automation.

Enter your raffle!
Your contract is now setup to be a tamper proof autonomous verifiably random lottery. Enter the lottery by running:

```
yarn hardhat run scripts/enter.js --network sepolia
```

## TODO

-   Create the subscription ID for the Chainlink VRF programatically (for the testnet): its like the developer chains but with the testnet
-   Fix uint64 suscriptionId (change it to uint256 and use the vrfCoordinatorPlus)
