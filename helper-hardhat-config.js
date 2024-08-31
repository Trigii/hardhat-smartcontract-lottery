const { ethers } = require('hardhat');

const networkConfig = {
    // hardhat we use mock so we dont have to specify it
    // sepolia:
    11155111: {
        name: 'sepolia',
        vrfCoordinatorV2: '0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B', // vrfcoordinator address for Sepolia Network from chainlink docs (https://docs.chain.link/vrf/v2-5/supported-networks)
        entranceFee: ethers.parseEther('0.01'),
        gasLane: '0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae', // 100 gwei Key Hash (https://docs.chain.link/vrf/v2-5/supported-networks)
        subscriptionId:
            '4898183188977114096165840824556960761265166624304389503358466110885264379387',
        callbackGasLimit: '500000', // 500.000
        interval: '30', // 30s
    },
    // hardhat / localhost
    31337: {
        name: 'hardhat',
        // vrfCoordinatorV2 -> we dont need it because we are deploying a mock
        entranceFee: ethers.parseEther('0.01'),
        gasLane: '0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae', // this value is fake, we are mocking it
        callbackGasLimit: '500000', // 500.000
        interval: '30', // 30s
    },
};

const developmentChains = ['hardhat', 'localhost'];

module.exports = {
    networkConfig,
    developmentChains,
};
