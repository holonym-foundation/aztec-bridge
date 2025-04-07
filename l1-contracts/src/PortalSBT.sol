// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@oz/token/ERC721/ERC721.sol";
import "@oz/access/Ownable.sol";

contract PortalSBT is ERC721, Ownable {
    // Mapping to track if an address has an SBT
    mapping(address => bool) public hasSBT;
    
    // Counter for token IDs
    uint256 private _tokenIdCounter;

    constructor() ERC721("Portal SBT", "PSBT") Ownable(msg.sender) {}

    /**
     * @dev Mints a new SBT to the caller's address
     */
    function mint() external {
        require(!hasSBT[msg.sender], "Address already has an SBT");
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(msg.sender, tokenId);
        hasSBT[msg.sender] = true;
    }

    /**
     * @dev Checks if an address has an SBT
     * @param account The address to check
     * @return bool True if the address has an SBT, false otherwise
     */
    function hasSoulboundToken(address account) external view returns (bool) {
        return hasSBT[account];
    }

    /**
     * @dev Override _update to make token non-transferable
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        require(from == address(0) || to == address(0), "SBT: transfer not allowed");
        return super._update(to, tokenId, auth);
    }
} 