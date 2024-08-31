const { assert, expect } = require('chai');
const { network, getNamedAccounts, deployments, ethers } = require('hardhat');
const { developmentChains, networkConfig } = require('../../helper-hardhat-config');

!developmentChains.includes(network.name)
    ? describe.skip
    : describe('Raffle', function () {
          let raffle, VRFCoordinatorV2Mock, raffleEntranceFee, deployer, interval;
          const chainId = network.config.chainId;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(['all']); // deploy everything
              raffle = await ethers.getContract('Raffle', deployer);
              VRFCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock', deployer);
              raffleEntranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
          });

          describe('constructor', function () {
              it('initializes the raffle correctly', async function () {
                  const raffleState = await raffle.getRaffleState();
                  assert.equal(raffleState.toString(), '0');
                  assert.equal(interval.toString(), networkConfig[chainId]['interval']);
              });
          });

          describe('enterRaffle', function () {
              it('reverts when you dont pay enough', async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      'Raffle__NotEnoughETHEntered',
                  );
              });
              it('records players when they enter', async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const playerFromContract = await raffle.getPlayer(0);
                  assert.equal(playerFromContract, deployer);
              });
              it('emits event on enter', async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      'RaffleEnter',
                  );
              });
              it('doesent allow entrance of player when raffle is calculating', async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send('evm_increaseTime', [Number(interval) + 1]); // increase the time of the blockchain to interval + 1 so state = CALCULATING
                  await network.provider.send('evm_mine', []); // mine one extra block
                  // We pretend to be a chainlink keeper:
                  await raffle.performUpkeep([]);
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      'Raffle__NotOpen',
                  );
              });
          });

          describe('checkUpkeep', function () {
              it('returns false if people havent sent any ETH', async function () {
                  await network.provider.send('evm_increaseTime', [Number(interval) + 1]); // increase the time of the blockchain to interval + 1 so state = CALCULATING
                  await network.provider.send('evm_mine', []); // mine one extra block
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]); // callStatic simulates a transaction
                  assert(!upkeepNeeded);
              });
              it('returns false if raffle isnt open', async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send('evm_increaseTime', [Number(interval) + 1]); // increase the time of the blockchain to interval + 1 so state = CALCULATING
                  await network.provider.send('evm_mine', []); // mine one extra block
                  await raffle.performUpkeep([]);
                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert.equal(raffleState.toString(), '1');
                  assert.equal(upkeepNeeded, false);
              });
              it("returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send('evm_increaseTime', [Number(interval) - 5]); // use a higher number here if this test fails
                  await network.provider.request({ method: 'evm_mine', params: [] });
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep('0x'); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded);
              });
              it('returns true if enough time has passed, has players, eth, and is open', async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send('evm_increaseTime', [Number(interval) + 1]);
                  await network.provider.request({ method: 'evm_mine', params: [] });
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep('0x'); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(upkeepNeeded);
              });
          });

          describe('performUpkeep', function () {
              it('it can only run if checkUpkeep is true', async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send('evm_increaseTime', [Number(interval) + 1]);
                  await network.provider.request({ method: 'evm_mine', params: [] });
                  const tx = await raffle.performUpkeep([]);
                  assert(tx);
              });
              it('reverts when checkUpkeep is false', async function () {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      'Raffle__UpkeepNotNeeded',
                  );
              });
              it('updats the raffle state, emits an event and calls the vrf coordinator', async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send('evm_increaseTime', [Number(interval) + 1]);
                  await network.provider.request({ method: 'evm_mine', params: [] });
                  const txResponse = await raffle.performUpkeep([]);
                  const txReceipt = await txResponse.wait(1);
                  const requestId = BigInt(txReceipt.logs[1].topics[1]); // review this
                  const raffleState = await raffle.getRaffleState();
                  assert(requestId.toNumber() > 0);
                  assert(raffleState.toString() == '1');
              });
          });

          describe('fulfillRandomWords', function () {
              // somebody have enter the raffle before the tests
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send('evm_increaseTime', [Number(interval) + 1]);
                  await network.provider.request({ method: 'evm_mine', params: [] });
              });

              it('it can only be called after performUpkeep', async function () {
                  // a requestId must exist (check VRFCoordinatorV2Mock contract)
                  await expect(
                      VRFCoordinatorV2Mock.fulfillRandomWords(0, await raffle.target),
                  ).to.be.revertedWith('nonexistent request');
                  await expect(
                      VRFCoordinatorV2Mock.fulfillRandomWords(1, await raffle.target),
                  ).to.be.revertedWith('nonexistent request');
              });
              // This test simulates users entering the raffle and wraps the entire functionality of the raffle
              // inside a promise that will resolve if everything is successful.
              // An event listener for the WinnerPicked is set up
              // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
              // All the assertions are done once the WinnerPicked event is fired
              it('picks a winner, resets the lottery, and sends the money', async function () {
                  const additionalEntrants = 3;
                  const startingAccountIndex = 1; // 0 = deployer
                  const accounts = await ethers.getSigners();
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i]); // connect the raffle contract to the accounts
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee }); // enter the raffle
                  }
                  const startingTimeStamp = raffle.getLatestTimeStamp();

                  // we want to call performUpkeep (mock being chainlink keepers)
                  // this will call fulfillRandomWords (mock being the chainlink vrf)
                  // we will have to wait for the fulfillRandomWords to be called (we are going to simulate that we are waiting fulfillRandomWords to be called -> set up a listener -> create a promise and do everything inside)
                  await new Promise(async (resolve, reject) => {
                      // wait until the winner is picked (we are waiting fulfillRandomWords to be called)
                      // here we set up first the listener waiting for the winner to be picked:
                      raffle.once('WinnerPicked', async () => {
                          console.log('Found the event!');
                          try {
                              // THIS GOES LATER!!!: this code executes once the event is triggered
                              const recentWinner = await raffle.getRecentWinner();
                              console.log(recentWinner);
                              const raffleState = await raffle.getRaffleState();
                              const endingTimeStamp = await raffle.getLatestTimeStamp();
                              const numPlayers = await raffle.getNumberOfPlayers();
                              assert.equal(numPlayers.toString(), '0');
                              assert.equal(raffleState.toString(), '0');
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve(); // if try passes, resolves the promise
                          } catch (error) {
                              reject(error); // if try fails, rejects the promise
                          }
                      });
                      // THIS GOES FIRST!!: here we will fire the event, and the listener will pick it up and resolve (we can do this on a development network, but on a testnet this cannot be done. We cant pretend to be the chainlink vrf):
                      // kicking off the event by mocking the chainlink keepers and vrf coordinator
                      const tx = await raffle.performUpkeep([]);
                      const txReceipt = await tx.wait(1);
                      await VRFCoordinatorV2Mock.fulfillRandomWords(
                          BigInt(txReceipt.logs[1].topics[1]),
                          await raffle.target,
                      );
                  });
              });
          });
      });
