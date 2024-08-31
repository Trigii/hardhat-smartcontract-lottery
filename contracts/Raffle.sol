// Enter the lottery (paying some amount)

// Pick a random winner (verifiably random)

// Winner to be selected every X minutes -> completely automated

// Chainlink Oracle -> Randomness, Automated Execution (Chainlink Keepers)

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import '@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol';
import '@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/automation/interfaces/KeeperCompatibleInterface.sol';

error Raffle__NotEnoughETHEntered(); // not enough money for entering the raffle
error Raffle__TransferFailed(); // failed to transfer the price to the winner
error Raffle__NotOpen(); // a user tried to enter the raffle when the state is not open
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/**
 * @title A sample Raffle Contract
 * @author Tristán Vaquero
 * @notice This contract is for creating an untamperable decentralized smart contract
 * @dev This implements Chainlink VRF v2 and Chainlink Keepers
 */
contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /* Type declarations */
    enum RaffleState {
        OPEN,
        CALCULATING
    } // uint256 -> 0 = OPEN; 1= CALCULATING

    /* State Variables */
    uint256 private immutable i_entranceFee; // price to enter the lottery
    address payable[] private s_players; // contains the addresses participating on the lottery
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane; // gasLane (in hash value): maximum gas price you are willing to pay for a request in wei (if the gas is very expensive, we avoid getting the random number)
    uint64 private immutable i_subscriptionId; // subscription that we need for funding the request to get the random number
    uint16 private constant REQUEST_CONFIRMATIONS = 3; // how many confirmations the chainlink node should wait before responding
    uint32 private immutable i_callbackGasLimit; // limit for how much gas to use for the callback request to the contracts "fulfillRandomWords"
    uint32 private constant NUM_WORDS = 1; // how many random numbers we want to get

    // Lottery Variables
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp; // previous timestamp to keep track of the intervals
    uint256 private immutable i_interval;

    /* Events */
    event RaffleEnter(address indexed player); // event generated when player enters the raffle
    event RequestedRaffleWinner(uint256 indexed requestId); // event generated when automatically the winner is requested
    event WinnerPicked(address indexed winner); // event generated with the winner of the raffle (to keep track of the different winners)

    constructor(
        address vrfCoordinatorV2, // contract address (we probably need to deploy some mocks to that address, since we have to interact with a `vrfCoordinatorV2` contract that is outside of the project. )
        uint64 subscriptionId,
        bytes32 gasLane,
        uint256 interval,
        uint256 entranceFee,
        uint32 callbackGasLimit
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        // VRFCoordinator = address of the contract that does the random number verification.
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    /**
     * @dev this function enters the Raffle
     * @dev it requires at least i_entranceFee to enter the raffle
     */
    function enterRaffle() public payable {
        // require(msg.value > i_entranceFee, "Not enough ETH!"); -> We have to store the error string; use error code to be more GAS efficient
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender)); // msg.sender is not a payable address so we have to type-cast it
        // Emit an event when we update a dynamic array or mapping
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that the Chainlink keeper nodes call
     * they look for the `upkeepNeeded` to return true
     * The following should be true in order to return true:
     * 1. Our time interval should have passed
     * 2. The lottery should have at least 1 player, and have some ETH
     * 3. Our subscription is funded with LINK
     * 4. The lottery should be in an "open" state (to avoid problems while requesting a random number because we are on a limbo state)
     */
    function checkUpkeep(
        bytes memory /*checkData*/ // calldata -> memory because calldata doesent work with strings
    ) public view override returns (bool upkeepNeeded, bytes memory /* performData */) {
        // checkData allows us to specify anything that we want (type bytes can be used to specify anything like functions to be called, variables...)
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance); // this variable tells if the conditions are met in order to update the state automatically

        return (upkeepNeeded, '');
    }

    /**
     * @dev this function will be called by the chainlink keepers network (so it can automatically run and every X minutes request a new winner)
     * @dev when the checkUpkeep returns that the upkeepNeeded is true, this function will be automatically called in order to update the state (calculate the random number and return the winner of the lottery)
     * @dev this function requests the generation of the random number
     * @dev request the random number
     * @dev once we get it, do something with it
     * @dev 2 transaction process (for security reasons. If its just 1 tx, people could brute force by simulate calling these transactions to see what they can manipulate to make sure they are the winner)
     */
    function performUpkeep(bytes memory /*performData*/) external override {
        (bool upkeepNeeded, ) = checkUpkeep('');
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        s_raffleState = RaffleState.CALCULATING; // block the lottery so no one can enter
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId); // this is redundant (the i_vrfCoordinator.requestRandomWords() already emits an event with the requestId)
    }

    /**
     *
     * @param randomWords array that contains random numbers. The amount of random numbers is equal to NUM_WORDS
     * @dev this function obtains the random numbers requested (randomWords) and returns the raffle winner
     */
    function fulfillRandomWords(
        uint256 /*requestId*/,
        uint256[] memory randomWords // contains an array of NUM_WORDS random numbers
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_players = new address payable[](0); // reset the players array
        s_lastTimeStamp = block.timestamp; // reset the timestamp to current timestamp
        (bool success, ) = recentWinner.call{value: address(this).balance}('');
        // require(success) // not so efficient
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
        s_raffleState = RaffleState.OPEN; // raffle is unclocked
    }

    /* View / Pure functions */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
