// this script automatically updates the abi, contract address... on the front end once deployed

const { ethers } = require('hardhat');
const fs = require('fs');

const FRONT_END_ADDRESSES_FILE = '../nextjs-smartcontract-lottery/constants/contractAddresses.json';
const FRONT_END_ABI_FILE = '../nextjs-smartcontract-lottery/constants/abi.json';

async function updateContractAddresses() {
    const raffle = await ethers.getContract('Raffle');
    const chainId = network.config.chainId.toString();
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, 'utf8'));
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(await raffle.target)) {
            currentAddresses[chainId].push(await raffle.target);
        }
    } else {
        currentAddresses[chainId] = [await raffle.target];
    }
    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses));
}

async function updateAbi() {
    const raffle = await ethers.getContract('Raffle');
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.formatJson());
}

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log('Updating front end...');
        updateContractAddresses();
        updateAbi();
    }
};

module.exports.tags = ['all', 'frontend'];
