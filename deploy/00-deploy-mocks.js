const { network, ethers } = require('hardhat');
const { developmentChains } = require('../helper-hardhat-config');

// VRFCoordinatorV2Mock constructor arguments:
const BASE_FEE = ethers.parseEther('0.20'); // every time we want to request a random number, it will cost us 0.2 LINK (Premium percentage (paying with testnet LINK) -> https://docs.chain.link/vrf/v2-5/supported-networks)
// chainlink nodes pay gas fees to give us randomness and do external execution. So the price of the requests change based on the price of the gas.
const GAS_PRICE_LINK = 1e9; // calculated value based on the gas price of the chain (link/gas).

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const args = [BASE_FEE, GAS_PRICE_LINK];

    if (developmentChains.includes(network.name)) {
        log('Local network detected! Deploying mocks...');
        // deploy a mock vrfCoordinatorV2 (from https://github.com/smartcontractkit/chainlink/blob/develop/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2Mock.sol)
        await deploy('VRFCoordinatorV2Mock', {
            from: deployer,
            log: true,
            args: args,
        });
        log('Mocks Deployed!');
        log('---------------------------------------------');
    }
};

module.exports.tags = ['all', 'mocks'];
