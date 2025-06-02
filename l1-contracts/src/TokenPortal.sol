pragma solidity >=0.8.27;

import {IERC20} from "@oz/token/ERC20/IERC20.sol";
import {SafeERC20} from "@oz/token/ERC20/utils/SafeERC20.sol";

// Messaging
import {IRegistry} from "@aztec/governance/interfaces/IRegistry.sol";
import {IInbox} from "@aztec/core/interfaces/messagebridge/IInbox.sol";
import {IOutbox} from "@aztec/core/interfaces/messagebridge/IOutbox.sol";
import {IRollup} from "@aztec/core/interfaces/IRollup.sol";
import {DataStructures} from "@aztec/core/libraries/DataStructures.sol";
// docs:start:content_hash_sol_import
import {Hash} from "@aztec/core/libraries/crypto/Hash.sol";
// docs:end:content_hash_sol_import

enum AuthorizationType { DEPOSIT, WITHDRAW }

struct Authorization {
  bytes32 authorizationID; // The unique identifier for the authorization
  address authorizedToTransact; // The address authorized to deposit or withdraw
  uint256 expiration; // The expiration of the authorization
  uint256 amount; // The amount authorized to deposit or withdraw
  AuthorizationType authorizationType; // The type of authorization

  // To prevent replaying of the authorization on different contracts or chains, we include the chainId and contract address in the authorization
  address contractAddress;
  uint256 chainId;

  uint8 v; // The v value of the signature
  bytes32 r; // The r value of the signature
  bytes32 s; // The s value of the signature
}

contract TokenPortal {
  using SafeERC20 for IERC20;

  event DepositToAztecPublic(
    bytes32 to, uint256 amount, bytes32 secretHash, bytes32 key, uint256 index
  );

  event DepositToAztecPrivate(
    uint256 amount, bytes32 secretHashForL2MessageConsumption, bytes32 key, uint256 index
  );

  IRegistry public registry;
  IERC20 public underlying;
  bytes32 public l2Bridge;

  IRollup public rollup;
  IOutbox public outbox;
  IInbox public inbox;
  uint256 public rollupVersion;

  // Authorizor can verify the user's proof of clean hands, personhood, and/or other attributes that can reduce the risk of fraud, and authorize the user to deposit or withdraw funds
  address authorizor;
  uint256 chainId;

  // For checking the uniqueness of authorizationID, preventing double-spending
  mapping(bytes32 => bool) public authorizationIDUsed;


  /**
   * @notice Initialize the portal
   * @param _registry - The registry address
   * @param _underlying - The underlying token address
   * @param _l2Bridge - The L2 bridge address
   */
  // docs:start:init
  constructor(address _registry, address _underlying, bytes32 _l2Bridge, address _authorizor) {
    registry = IRegistry(_registry);
    underlying = IERC20(_underlying);
    l2Bridge = _l2Bridge;

    rollup = IRollup(registry.getCanonicalRollup());
    outbox = rollup.getOutbox();
    inbox = rollup.getInbox();
    rollupVersion = rollup.getVersion();

    authorizor = _authorizor;
    chainId = block.chainid;
  }
  // docs:end:init

  // NOTE: this function modifies state so that it cannot be called successfully twice for the same authorization, to prevent replay attacks
  function _verifyAuthorization(
      address caller, // The address trying to deposit or withdraw
      uint256 amount, // The amount authorized to deposit or withdraw
      AuthorizationType authorizationType, // What type authorization is it? e.g. Deposit or Withdraw
      Authorization memory authorization
  ) private returns (bool) {
    // Hash the authorization
    bytes32 messageHash = keccak256(abi.encode(authorization.authorizationID, authorization.authorizedToTransact, authorization.expiration, authorization.amount, authorization.authorizationType, authorization.contractAddress, authorization.chainId));
    // Convert the message hash to an Ethereum signed message hash
    bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
    // Recover the signer's address from the signature
    address recoveredSigner = ecrecover(ethSignedMessageHash, authorization.v, authorization.r, authorization.s);
    // Verify that the recovered signer is the authorizor
    require(recoveredSigner == authorizor, "Not signed by authorizor");


    // Verify that the chainId and contract address are correct to prevent replay attackss
    require(authorization.chainId == chainId, "Chain ID does not match");
    require(authorization.contractAddress == address(this), "Contract address does not match");

    // Verify that the authorization type is correct
    require(authorization.authorizationType == authorizationType, "Authorization type does not match");
    // Verify that the amount is correct
    require(authorization.amount == amount, "Amount does not match");
    // Verify that the expiration is in the future
    require(authorization.expiration > block.timestamp, "Authorization expired");
    // Verify that the authorizedToTransact is the caller
    require(authorization.authorizedToTransact == caller, "caller is not the address who was authorized to transact");
    // Verify that the authorizationID is unique
    require(authorizationIDUsed[authorization.authorizationID] == false, "Authorization ID already used");
    authorizationIDUsed[authorization.authorizationID] = true;
    return true;
  }

  // docs:start:deposit_public
  /**
   * @notice Deposit funds into the portal and adds an L2 message which can only be consumed publicly on Aztec
   * @param _to - The aztec address of the recipient
   * @param _amount - The amount to deposit
   * @param _secretHash - The hash of the secret consumable message. The hash should be 254 bits (so it can fit in a Field element)
   * @return The key of the entry in the Inbox and its leaf index
   */
  function depositToAztecPublic(bytes32 _to, uint256 _amount, bytes32 _secretHash, Authorization memory authorization)
    external
    returns (bytes32, uint256)
  // docs:end:deposit_public
  {
    // Verify the authorization
    require(_verifyAuthorization(msg.sender, _amount, AuthorizationType.DEPOSIT, authorization), "Authorization failed");

    // Preamble
    DataStructures.L2Actor memory actor = DataStructures.L2Actor(l2Bridge, rollupVersion);

    // Hash the message content to be reconstructed in the receiving contract
    // The purpose of including the function selector is to make the message unique to that specific call. Note that
    // it has nothing to do with calling the function.
    bytes32 contentHash =
      Hash.sha256ToField(abi.encodeWithSignature("mint_to_public(bytes32,uint256)", _to, _amount));

    // Hold the tokens in the portal
    underlying.safeTransferFrom(msg.sender, address(this), _amount);

    // Send message to rollup
    (bytes32 key, uint256 index) = inbox.sendL2Message(actor, contentHash, _secretHash);

    // Emit event
    emit DepositToAztecPublic(_to, _amount, _secretHash, key, index);

    return (key, index);
  }

  // docs:start:deposit_private
  /**
   * @notice Deposit funds into the portal and adds an L2 message which can only be consumed privately on Aztec
   * @param _amount - The amount to deposit
   * @param _secretHashForL2MessageConsumption - The hash of the secret consumable L1 to L2 message. The hash should be 254 bits (so it can fit in a Field element)
   * @return The key of the entry in the Inbox and its leaf index
   */
  function depositToAztecPrivate(uint256 _amount, bytes32 _secretHashForL2MessageConsumption, Authorization memory authorization)
    external
    returns (bytes32, uint256)
  // docs:end:deposit_private
  {
    // Verify the authorization
    require(_verifyAuthorization(msg.sender, _amount, AuthorizationType.DEPOSIT, authorization), "Authorization failed");

    // Preamble
    DataStructures.L2Actor memory actor = DataStructures.L2Actor(l2Bridge, rollupVersion);

    // Hash the message content to be reconstructed in the receiving contract - the signature below does not correspond
    // to a real function. It's just an identifier of an action.
    bytes32 contentHash =
      Hash.sha256ToField(abi.encodeWithSignature("mint_to_private(uint256)", _amount));

    // Hold the tokens in the portal
    underlying.safeTransferFrom(msg.sender, address(this), _amount);

    // Send message to rollup
    (bytes32 key, uint256 index) =
      inbox.sendL2Message(actor, contentHash, _secretHashForL2MessageConsumption);

    // Emit event
    emit DepositToAztecPrivate(_amount, _secretHashForL2MessageConsumption, key, index);

    return (key, index);
  }

  // docs:start:token_portal_withdraw
  /**
   * @notice Withdraw funds from the portal
   * @dev Second part of withdraw, must be initiated from L2 first as it will consume a message from outbox
   * @param _recipient - The address to send the funds to
   * @param _amount - The amount to withdraw
   * @param _withCaller - Flag to use `msg.sender` as caller, otherwise address(0)
   * @param _l2BlockNumber - The address to send the funds to
   * @param _leafIndex - The amount to withdraw
   * @param _path - Flag to use `msg.sender` as caller, otherwise address(0)
   * Must match the caller of the message (specified from L2) to consume it.
   */
  function withdraw(
    address _recipient,
    uint256 _amount,
    bool _withCaller,
    uint256 _l2BlockNumber,
    uint256 _leafIndex,
    bytes32[] calldata _path,
    Authorization memory authorization
  ) external {

    // Verify the authorization
    require(_verifyAuthorization(msg.sender, _amount, AuthorizationType.WITHDRAW, authorization), "Authorization failed");

    // The purpose of including the function selector is to make the message unique to that specific call. Note that
    // it has nothing to do with calling the function.
    DataStructures.L2ToL1Msg memory message = DataStructures.L2ToL1Msg({
      sender: DataStructures.L2Actor(l2Bridge, rollupVersion),
      recipient: DataStructures.L1Actor(address(this), block.chainid),
      content: Hash.sha256ToField(
        abi.encodeWithSignature(
          "withdraw(address,uint256,address)",
          _recipient,
          _amount,
          _withCaller ? msg.sender : address(0)
        )
      )
    });

    outbox.consume(message, _l2BlockNumber, _leafIndex, _path);

    underlying.transfer(_recipient, _amount);
  }
  // docs:end:token_portal_withdraw
}
