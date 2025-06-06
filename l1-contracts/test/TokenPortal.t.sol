// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@oz/token/ERC20/IERC20.sol";
import {ERC20} from "@oz/token/ERC20/ERC20.sol";

import {TokenPortal, Authorization, AuthorizationType} from "../src/TokenPortal.sol";
import {DataStructures} from "@aztec/core/libraries/DataStructures.sol";

// Mock contracts for testing
contract MockERC20 is ERC20 {
    constructor() ERC20("MockToken", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockRegistry {
    address public canonicalRollup;

    constructor(address _rollup) {
        canonicalRollup = _rollup;
    }

    function getCanonicalRollup() external view returns (address) {
        return canonicalRollup;
    }
}

contract MockInbox {
    uint256 public nextKey = 1;
    uint256 public nextIndex = 1;

    mapping(bytes32 => bool) public messageExists;

    function sendL2Message(
        DataStructures.L2Actor memory,
        bytes32,
        bytes32
    ) external returns (bytes32 key, uint256 index) {
        key = bytes32(nextKey++);
        index = nextIndex++;
        
        messageExists[key] = true;
        
        return (key, index);
    }
}

contract MockOutbox {
    mapping(bytes32 => bool) public consumedMessages;

    function consume(
        DataStructures.L2ToL1Msg memory message,
        uint256 _l2BlockNumber,
        uint256 _leafIndex,
        bytes32[] calldata
    ) external {
        bytes32 messageHash = keccak256(abi.encode(message, _l2BlockNumber, _leafIndex));
        require(!consumedMessages[messageHash], "Message already consumed");
        consumedMessages[messageHash] = true;
    }

    function isMessageConsumed(bytes32 messageHash) external view returns (bool) {
        return consumedMessages[messageHash];
    }
}

contract MockRollup {
    MockInbox public immutable inbox;
    MockOutbox public immutable outbox;
    uint256 public constant version = 1;

    constructor() {
        inbox = new MockInbox();
        outbox = new MockOutbox();
    }

    function getInbox() external view returns (address) {
        return address(inbox);
    }

    function getOutbox() external view returns (address) {
        return address(outbox);
    }

    function getVersion() external pure returns (uint256) {
        return version;
    }
}

contract TokenPortalTest is Test {
    TokenPortal public portal;
    MockERC20 public token;
    MockRegistry public registry;
    MockRollup public rollup;
    MockInbox public inbox;
    MockOutbox public outbox;

    address public authorizor;
    uint256 public authorizorPrivateKey;
    address public user;
    address public recipient;
    bytes32 public l2Bridge = bytes32(uint256(0x1234));

    uint256 public constant DEPOSIT_AMOUNT = 1000e18;
    uint256 public constant CHAIN_ID = 31337; // Default anvil chain ID

    function setUp() public {
        // Set up test accounts
        authorizorPrivateKey = 0x1;
        authorizor = vm.addr(authorizorPrivateKey);
        user = makeAddr("user");
        recipient = makeAddr("recipient");

        // Deploy mock contracts
        rollup = new MockRollup();
        inbox = rollup.inbox();
        outbox = rollup.outbox();
        registry = new MockRegistry(address(rollup));
        token = new MockERC20();

        // Deploy TokenPortal
        portal = new TokenPortal(
            address(registry),
            address(token),
            l2Bridge,
            authorizor
        );

        // Setup token balances
        token.mint(user, 10000e18);
        vm.prank(user);
        token.approve(address(portal), type(uint256).max);
    }

    function createValidAuthorization(
        address authorizedUser,
        uint256 amount,
        AuthorizationType authType,
        uint256 expiration
    ) internal view returns (Authorization memory) {
        bytes32 authId = keccak256(abi.encodePacked(block.timestamp, authorizedUser, amount));
        
        bytes32 messageHash = keccak256(abi.encode(
            authId,
            authorizedUser,
            expiration,
            amount,
            authType,
            address(portal),
            CHAIN_ID
        ));

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(authorizorPrivateKey, ethSignedMessageHash);

        return Authorization({
            authorizationID: authId,
            authorizedToTransact: authorizedUser,
            expiration: expiration,
            amount: amount,
            authorizationType: authType,
            contractAddress: address(portal),
            chainId: CHAIN_ID,
            v: v,
            r: r,
            s: s
        });
    }

    // Constructor tests
    function test_Constructor() public {
        assertEq(address(portal.registry()), address(registry));
        assertEq(address(portal.underlying()), address(token));
        assertEq(portal.l2Bridge(), l2Bridge);
        assertEq(address(portal.rollup()), address(rollup));
        assertEq(address(portal.inbox()), address(inbox));
        assertEq(address(portal.outbox()), address(outbox));
        assertEq(portal.rollupVersion(), 1);
    }

    // Deposit to Aztec Public tests
    function test_DepositToAztecPublic_Success() public {
        bytes32 to = bytes32(uint256(0x5678));
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + 1 hours;

        Authorization memory auth = createValidAuthorization(
            user, 
            DEPOSIT_AMOUNT, 
            AuthorizationType.DEPOSIT, 
            expiration
        );

        uint256 userBalanceBefore = token.balanceOf(user);
        uint256 portalBalanceBefore = token.balanceOf(address(portal));

        vm.prank(user);
        (bytes32 key, uint256 index) = portal.depositToAztecPublic(to, DEPOSIT_AMOUNT, secretHash, auth);

        // Check balances
        assertEq(token.balanceOf(user), userBalanceBefore - DEPOSIT_AMOUNT);
        assertEq(token.balanceOf(address(portal)), portalBalanceBefore + DEPOSIT_AMOUNT);

        // Check authorization is marked as used
        assertTrue(portal.authorizationIDUsed(auth.authorizationID));

        // Check that key and index are returned
        assertTrue(key != bytes32(0));
        assertTrue(index > 0);
    }

    function test_DepositToAztecPublic_UnauthorizedUser() public {
        bytes32 to = bytes32(uint256(0x5678));
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + 1 hours;

        Authorization memory auth = createValidAuthorization(
            user, 
            DEPOSIT_AMOUNT, 
            AuthorizationType.DEPOSIT, 
            expiration
        );

        address unauthorizedUser = makeAddr("unauthorized");
        token.mint(unauthorizedUser, DEPOSIT_AMOUNT);
        vm.prank(unauthorizedUser);
        token.approve(address(portal), DEPOSIT_AMOUNT);

        vm.prank(unauthorizedUser);
        vm.expectRevert("caller is not the address who was authorized to transact");
        portal.depositToAztecPublic(to, DEPOSIT_AMOUNT, secretHash, auth);
    }

    function test_DepositToAztecPublic_ExpiredAuthorization() public {
        bytes32 to = bytes32(uint256(0x5678));
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp - 1; // Expired

        Authorization memory auth = createValidAuthorization(
            user, 
            DEPOSIT_AMOUNT, 
            AuthorizationType.DEPOSIT, 
            expiration
        );

        vm.prank(user);
        vm.expectRevert("Authorization expired");
        portal.depositToAztecPublic(to, DEPOSIT_AMOUNT, secretHash, auth);
    }

    function test_DepositToAztecPublic_WrongAmount() public {
        bytes32 to = bytes32(uint256(0x5678));
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + 1 hours;

        Authorization memory auth = createValidAuthorization(
            user, 
            DEPOSIT_AMOUNT, 
            AuthorizationType.DEPOSIT, 
            expiration
        );

        vm.prank(user);
        vm.expectRevert("Amount does not match");
        portal.depositToAztecPublic(to, DEPOSIT_AMOUNT / 2, secretHash, auth);
    }

    function test_DepositToAztecPublic_ReplayAttack() public {
        bytes32 to = bytes32(uint256(0x5678));
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + 1 hours;

        Authorization memory auth = createValidAuthorization(
            user, 
            DEPOSIT_AMOUNT, 
            AuthorizationType.DEPOSIT, 
            expiration
        );

        // First deposit should succeed
        vm.prank(user);
        portal.depositToAztecPublic(to, DEPOSIT_AMOUNT, secretHash, auth);

        // Second deposit with same authorization should fail
        token.mint(user, DEPOSIT_AMOUNT);
        vm.prank(user);
        vm.expectRevert("Authorization ID already used");
        portal.depositToAztecPublic(to, DEPOSIT_AMOUNT, secretHash, auth);
    }

    // Deposit to Aztec Private tests
    function test_DepositToAztecPrivate_Success() public {
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + 1 hours;

        Authorization memory auth = createValidAuthorization(
            user, 
            DEPOSIT_AMOUNT, 
            AuthorizationType.DEPOSIT, 
            expiration
        );

        uint256 userBalanceBefore = token.balanceOf(user);
        uint256 portalBalanceBefore = token.balanceOf(address(portal));

        vm.prank(user);
        (bytes32 key, uint256 index) = portal.depositToAztecPrivate(DEPOSIT_AMOUNT, secretHash, auth);

        // Check balances
        assertEq(token.balanceOf(user), userBalanceBefore - DEPOSIT_AMOUNT);
        assertEq(token.balanceOf(address(portal)), portalBalanceBefore + DEPOSIT_AMOUNT);

        // Check authorization is marked as used
        assertTrue(portal.authorizationIDUsed(auth.authorizationID));

        // Check that key and index are returned
        assertTrue(key != bytes32(0));
        assertTrue(index > 0);
    }

    function test_DepositToAztecPrivate_WrongAuthorizationType() public {
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + 1 hours;

        // Create authorization for WITHDRAW instead of DEPOSIT
        Authorization memory auth = createValidAuthorization(
            user, 
            DEPOSIT_AMOUNT, 
            AuthorizationType.WITHDRAW, 
            expiration
        );

        vm.prank(user);
        vm.expectRevert("Authorization type does not match");
        portal.depositToAztecPrivate(DEPOSIT_AMOUNT, secretHash, auth);
    }

    // Withdraw tests
    function test_Withdraw_Success() public {
        uint256 withdrawAmount = 500e18;
        uint256 expiration = block.timestamp + 1 hours;

        // First, add tokens to the portal (simulate previous deposits)
        token.mint(address(portal), withdrawAmount);

        Authorization memory auth = createValidAuthorization(
            user, 
            withdrawAmount, 
            AuthorizationType.WITHDRAW, 
            expiration
        );

        uint256 recipientBalanceBefore = token.balanceOf(recipient);
        uint256 portalBalanceBefore = token.balanceOf(address(portal));

        bytes32[] memory path = new bytes32[](1);
        path[0] = bytes32(uint256(0x1111));

        vm.prank(user);
        portal.withdraw(
            recipient,
            withdrawAmount,
            true,
            1, // l2BlockNumber
            0, // leafIndex
            path,
            auth
        );

        // Check balances
        assertEq(token.balanceOf(recipient), recipientBalanceBefore + withdrawAmount);
        assertEq(token.balanceOf(address(portal)), portalBalanceBefore - withdrawAmount);

        // Check authorization is marked as used
        assertTrue(portal.authorizationIDUsed(auth.authorizationID));
    }

    function test_Withdraw_WrongAuthorizationType() public {
        uint256 withdrawAmount = 500e18;
        uint256 expiration = block.timestamp + 1 hours;

        token.mint(address(portal), withdrawAmount);

        // Create authorization for DEPOSIT instead of WITHDRAW
        Authorization memory auth = createValidAuthorization(
            user, 
            withdrawAmount, 
            AuthorizationType.DEPOSIT, 
            expiration
        );

        bytes32[] memory path = new bytes32[](1);
        path[0] = bytes32(uint256(0x1111));

        vm.prank(user);
        vm.expectRevert("Authorization type does not match");
        portal.withdraw(
            recipient,
            withdrawAmount,
            true,
            1,
            0,
            path,
            auth
        );
    }

    // Authorization signature tests
    function test_Authorization_InvalidSignature() public {
        bytes32 to = bytes32(uint256(0x5678));
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + 1 hours;

        Authorization memory auth = createValidAuthorization(
            user, 
            DEPOSIT_AMOUNT, 
            AuthorizationType.DEPOSIT, 
            expiration
        );

        // Tamper with the signature
        auth.v = auth.v == 27 ? 28 : 27;

        vm.prank(user);
        vm.expectRevert("Not signed by authorizor");
        portal.depositToAztecPublic(to, DEPOSIT_AMOUNT, secretHash, auth);
    }

    function test_Authorization_WrongChainId() public {
        bytes32 to = bytes32(uint256(0x5678));
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + 1 hours;

        // Create authorization with wrong chain ID from the start
        bytes32 authId = keccak256(abi.encodePacked(block.timestamp, user, DEPOSIT_AMOUNT));
        
        bytes32 messageHash = keccak256(abi.encode(
            authId,
            user,
            expiration,
            DEPOSIT_AMOUNT,
            AuthorizationType.DEPOSIT,
            address(portal),
            999 // Wrong chain ID
        ));

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(authorizorPrivateKey, ethSignedMessageHash);

        Authorization memory auth = Authorization({
            authorizationID: authId,
            authorizedToTransact: user,
            expiration: expiration,
            amount: DEPOSIT_AMOUNT,
            authorizationType: AuthorizationType.DEPOSIT,
            contractAddress: address(portal),
            chainId: 999, // Wrong chain ID
            v: v,
            r: r,
            s: s
        });

        vm.prank(user);
        vm.expectRevert("Chain ID does not match");
        portal.depositToAztecPublic(to, DEPOSIT_AMOUNT, secretHash, auth);
    }

    function test_Authorization_WrongContractAddress() public {
        bytes32 to = bytes32(uint256(0x5678));
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + 1 hours;

        // Create authorization with wrong contract address from the start
        bytes32 authId = keccak256(abi.encodePacked(block.timestamp, user, DEPOSIT_AMOUNT));
        
        bytes32 messageHash = keccak256(abi.encode(
            authId,
            user,
            expiration,
            DEPOSIT_AMOUNT,
            AuthorizationType.DEPOSIT,
            address(0x999), // Wrong contract address
            CHAIN_ID
        ));

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(authorizorPrivateKey, ethSignedMessageHash);

        Authorization memory auth = Authorization({
            authorizationID: authId,
            authorizedToTransact: user,
            expiration: expiration,
            amount: DEPOSIT_AMOUNT,
            authorizationType: AuthorizationType.DEPOSIT,
            contractAddress: address(0x999), // Wrong contract address
            chainId: CHAIN_ID,
            v: v,
            r: r,
            s: s
        });

        vm.prank(user);
        vm.expectRevert("Contract address does not match");
        portal.depositToAztecPublic(to, DEPOSIT_AMOUNT, secretHash, auth);
    }

    // Edge case tests
    function test_InsufficientTokenBalance() public {
        address poorUser = makeAddr("poorUser");
        bytes32 to = bytes32(uint256(0x5678));
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + 1 hours;

        // Don't mint any tokens for this user
        Authorization memory auth = createValidAuthorization(
            poorUser, 
            DEPOSIT_AMOUNT, 
            AuthorizationType.DEPOSIT, 
            expiration
        );

        vm.prank(poorUser);
        vm.expectRevert(); // Just expect any revert for insufficient balance
        portal.depositToAztecPublic(to, DEPOSIT_AMOUNT, secretHash, auth);
    }

    function test_InsufficientAllowance() public {
        address userWithoutApproval = makeAddr("userWithoutApproval");
        bytes32 to = bytes32(uint256(0x5678));
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + 1 hours;

        token.mint(userWithoutApproval, DEPOSIT_AMOUNT);
        // Don't approve the portal

        Authorization memory auth = createValidAuthorization(
            userWithoutApproval, 
            DEPOSIT_AMOUNT, 
            AuthorizationType.DEPOSIT, 
            expiration
        );

        vm.prank(userWithoutApproval);
        vm.expectRevert(); // Just expect any revert for insufficient allowance
        portal.depositToAztecPublic(to, DEPOSIT_AMOUNT, secretHash, auth);
    }

    // Fuzz tests
    function testFuzz_DepositAmounts(uint256 amount) public {
        vm.assume(amount > 0 && amount <= 1000000e18);
        
        bytes32 to = bytes32(uint256(0x5678));
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + 1 hours;

        token.mint(user, amount);

        Authorization memory auth = createValidAuthorization(
            user, 
            amount, 
            AuthorizationType.DEPOSIT, 
            expiration
        );

        uint256 userBalanceBefore = token.balanceOf(user);
        uint256 portalBalanceBefore = token.balanceOf(address(portal));

        vm.prank(user);
        portal.depositToAztecPublic(to, amount, secretHash, auth);

        assertEq(token.balanceOf(user), userBalanceBefore - amount);
        assertEq(token.balanceOf(address(portal)), portalBalanceBefore + amount);
    }

    function testFuzz_AuthorizationExpiration(uint256 timeOffset) public {
        vm.assume(timeOffset > 0 && timeOffset < 365 days);
        
        bytes32 to = bytes32(uint256(0x5678));
        bytes32 secretHash = bytes32(uint256(0x9abc));
        uint256 expiration = block.timestamp + timeOffset;

        Authorization memory auth = createValidAuthorization(
            user, 
            DEPOSIT_AMOUNT, 
            AuthorizationType.DEPOSIT, 
            expiration
        );

        vm.prank(user);
        portal.depositToAztecPublic(to, DEPOSIT_AMOUNT, secretHash, auth);

        assertTrue(portal.authorizationIDUsed(auth.authorizationID));
    }
} 