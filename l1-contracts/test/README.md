# TokenPortal Test Suite

This directory contains comprehensive tests for the `TokenPortal` contract, which implements a bridge for tokens between L1 and L2 (Aztec) with authorization logic.

## Test Coverage

### Core Functionality Tests

#### Constructor Tests
- `test_Constructor()` - Verifies proper initialization of all contract state variables

#### Deposit to Aztec Public Tests
- `test_DepositToAztecPublic_Success()` - Tests successful public deposits with valid authorization
- `test_DepositToAztecPublic_UnauthorizedUser()` - Ensures unauthorized users cannot use someone else's authorization
- `test_DepositToAztecPublic_ExpiredAuthorization()` - Verifies expired authorizations are rejected
- `test_DepositToAztecPublic_WrongAmount()` - Tests that amount mismatches are caught
- `test_DepositToAztecPublic_ReplayAttack()` - Prevents reuse of the same authorization ID

#### Deposit to Aztec Private Tests
- `test_DepositToAztecPrivate_Success()` - Tests successful private deposits with valid authorization
- `test_DepositToAztecPrivate_WrongAuthorizationType()` - Ensures WITHDRAW authorizations can't be used for deposits

#### Withdraw Tests
- `test_Withdraw_Success()` - Tests successful withdrawals with valid authorization
- `test_Withdraw_WrongAuthorizationType()` - Ensures DEPOSIT authorizations can't be used for withdrawals

### Authorization Security Tests

#### Signature Validation
- `test_Authorization_InvalidSignature()` - Tests detection of tampered signatures
- `test_Authorization_WrongChainId()` - Prevents cross-chain replay attacks
- `test_Authorization_WrongContractAddress()` - Prevents cross-contract replay attacks

### Edge Case Tests

#### ERC20 Token Handling
- `test_InsufficientTokenBalance()` - Tests behavior when user lacks sufficient token balance
- `test_InsufficientAllowance()` - Tests behavior when user hasn't approved sufficient allowance

### Fuzz Tests

#### Property-Based Testing
- `testFuzz_DepositAmounts(uint256)` - Tests deposits with random valid amounts
- `testFuzz_AuthorizationExpiration(uint256)` - Tests authorizations with random future expiration times

## Authorization System

The tests validate a comprehensive authorization system that includes:

1. **Digital Signatures**: All operations require valid ECDSA signatures from an authorized signer
2. **Replay Protection**: Each authorization has a unique ID that can only be used once
3. **Expiration**: Authorizations have time limits to prevent indefinite validity
4. **Cross-Chain Protection**: Chain ID verification prevents replay attacks across different networks
5. **Cross-Contract Protection**: Contract address verification prevents replay attacks across different contracts
6. **Amount Verification**: Exact amount matching prevents authorization amount manipulation
7. **Operation Type Verification**: Separate authorizations required for deposits vs withdrawals
8. **User Verification**: Only the specifically authorized user can execute the operation

## Mock Contracts

The test suite includes lightweight mock contracts for:

- `MockERC20`: ERC20 token with minting capability for testing
- `MockRegistry`: Simple registry returning the rollup address
- `MockInbox`: Mock inbox that tracks sent L2 messages
- `MockOutbox`: Mock outbox that tracks consumed L2-to-L1 messages
- `MockRollup`: Mock rollup connecting inbox and outbox

## Running Tests

To run the test suite:

```bash
forge test --match-contract TokenPortalTest -v
```

To run with more verbose output:

```bash
forge test --match-contract TokenPortalTest -vvv
```

To run specific test functions:

```bash
forge test --match-test test_DepositToAztecPublic_Success -v
```

## Test Results

All 17 tests pass, covering:
- ✅ Constructor initialization
- ✅ Public deposit functionality
- ✅ Private deposit functionality  
- ✅ Withdrawal functionality
- ✅ Authorization signature validation
- ✅ Replay attack prevention
- ✅ Cross-chain security
- ✅ Cross-contract security
- ✅ Edge cases and error handling
- ✅ Fuzz testing for various inputs

The test suite ensures the TokenPortal contract is secure and functions correctly under various conditions and attack scenarios. 