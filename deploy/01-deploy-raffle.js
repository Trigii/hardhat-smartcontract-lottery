const { network, ethers } = require('hardhat');
const { developmentChains, networkConfig } = require('../helper-hardhat-config');
const { verify } = require('../utils/verify');

const VRF_SUBSCRIPTION_FUND_AMOUNT = ethers.parseEther('2'); // amount of link that we are going to use to fund the VRF subscription to be able to generate random numbers

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const signer = await ethers.getSigner(deployer);

    // Smart Contract arguments
    let vrfCoordinatorV2Address, subscriptionId;
    const entranceFee = networkConfig[chainId]['entranceFee'];
    const gasLane = networkConfig[chainId]['gasLane'];
    const callbackGasLimit = networkConfig[chainId]['callbackGasLimit'];
    const interval = networkConfig[chainId]['interval'];

    // depending on the network we are deploying the contract, we will use some parameters or others
    if (chainId == 31337) {
        // if we are deploying on a developer chain (hardhat/localhost) we have to grab the mock contract address:
        const VRFCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock');
        vrfCoordinatorV2Address = await VRFCoordinatorV2Mock.target; // or await VRFCoordinatorV2Mock.getAddress()
        const transactionResponse = await VRFCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1); // inside this transactionReceipt there is an event that is emitted with the subscription
        // log(transactionReceipt.logs[0]);
        //subscriptionId = transactionReceipt.events[0].args.subId;
        subscriptionId = BigInt(transactionReceipt.logs[0].topics[1]); // extract the subscription ID from the last emitted event
        // Fund the subscription
        // On a real network, we need to fund it with Link
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUBSCRIPTION_FUND_AMOUNT);
    } else {
        // if we are not deploying on a developer chain (hardhat/localhost) we have to get the contract address from the "helper-hardhat-config.js" file:
        vrfCoordinatorV2Address = networkConfig[chainId]['vrfCoordinatorV2'];
        // TODO: create and fund the subscription programatically
        subscriptionId = networkConfig[chainId]['subscriptionId'];
    }

    // deploying the contract
    const args = [
        vrfCoordinatorV2Address,
        subscriptionId,
        gasLane,
        interval,
        entranceFee,
        callbackGasLimit,
    ];
    const raffle = await deploy('Raffle', {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    // verifying the deployment of the contract (only if we are not on a development chain)
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(raffle.address, args);
    }
    log('---------------------------------------------');
};

module.exports.tags = ['all', 'raffle'];
