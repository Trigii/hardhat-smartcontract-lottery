const { assert, expect } = require('chai');
const { network, getNamedAccounts, deployments, ethers } = require('hardhat');
const { developmentChains, networkConfig } = require('../../helper-hardhat-config');

// Execution:
// 1. Get our SubId for Chainlink VRF (https://vrf.chain.link/sepolia/new)
// 2. Deploy our contract using the SubId (copy the ID and paste it on the helper-hardhat-config.js; deploy using `yarn hardhat deploy --network sepolia`)
// 3. Register the contract with Chainlink VRF & its subId (add as a consumer the address of the deployed contract)
// 4. Register the contract with Chainlink Keepers (go to https://automation.chain.link/ and register a new upkeep using the deployed contract address)
// 5. Run the staging tests (run `yarn hardhat test --network sepolia`)

developmentChains.includes(network.name)
    ? describe.skip
    : describe('Raffle', function () {
          let raffle, VRFCoordinatorV2Mock, raffleEntranceFee, deployer;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              raffle = await ethers.getContract('Raffle', deployer);
              raffleEntranceFee = await raffle.getEntranceFee();
          });

          describe('fulfillRandomWords', function () {
              it('works with live Chainlink Keepers and Chainlink VRF, we got a random winner', async function () {
                  // enter the raffle (here we dont mock the chainlink keepers / vrf)
                  const startingTimeStamp = await raffle.getLatestTimeStamp();
                  const accounts = await ethers.getSigners();

                  // setup a listener before we enter the raffle just in case the blockchain moves really fast
                  await new Promise(async (resolve, reject) => {
                      raffle.once('WinnerPicked', async () => {
                          console.log('WinnerPicked event fired!');
                          try {
                              // add our asserts here
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerEndingBalance = await accounts[0].getBalance();
                              const endingTimeStamp = await raffle.getLatestTimeStamp();

                              await expect(raffle.getPlayer(0)).to.be.reverted; // the same as: assert.equal(numPlayers.toString(), '0');
                              assert.equal(recentWinner.toString(), accounts[0].address);
                              assert.equal(raffleState, 0); // state = OPEN
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(raffleEntranceFee).toString(),
                              );
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve();
                          } catch (error) {
                              console.log(error);
                              reject(error);
                          }
                      });
                  });
                  // Then we enter the raffle
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const winnerStartingBalance = await accounts[0].getBalance();

                  // this code wont complete until our listener has finished listening
              });
          });
      });
