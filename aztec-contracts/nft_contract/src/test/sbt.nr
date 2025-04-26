use crate::NFT;
use crate::test::utils;

#[test]
unconstrained fn sbt_mint_success() {
    // Setup without account contracts and with SBT enabled
    let (env, nft_contract_address, owner, _) = utils::setup(/* with_account_contracts */ false, /* is_sbt */ true);

    let token_id = 10000;
    NFT::at(nft_contract_address).mint(owner, token_id).call(&mut env.public());

    env.advance_block_by(1);

    utils::assert_owns_public_nft(env, nft_contract_address, owner, token_id);
    assert(NFT::at(nft_contract_address).has_soulbound_token(owner).view(&mut env.public()), "Owner should have SBT");
}

#[test]
unconstrained fn sbt_mint_failures() {
    // Setup without account contracts and with SBT enabled
    let (env, nft_contract_address, owner, recipient) = utils::setup(/* with_account_contracts */ false, /* is_sbt */ true);

    let token_id = 10000;
    
    // First mint should succeed
    NFT::at(nft_contract_address).mint(owner, token_id).call(&mut env.public());
    env.advance_block_by(1);

    // Second mint to same address should fail
    let mint_call_interface = NFT::at(nft_contract_address).mint(owner, token_id + 1);
    env.assert_public_call_fails(mint_call_interface);

    // Mint to different address should succeed
    NFT::at(nft_contract_address).mint(recipient, token_id + 1).call(&mut env.public());
    env.advance_block_by(1);
    assert(NFT::at(nft_contract_address).has_soulbound_token(recipient).view(&mut env.public()), "Recipient should have SBT");
}

#[test]
unconstrained fn sbt_transfer_restrictions() {
    // Setup without account contracts and with SBT enabled
    let (env, nft_contract_address, owner, recipient) = utils::setup(/* with_account_contracts */ false, /* is_sbt */ true);

    let token_id = 10000;
    NFT::at(nft_contract_address).mint(owner, token_id).call(&mut env.public());
    env.advance_block_by(1);

    // Transfer should fail
    let transfer_call_interface = NFT::at(nft_contract_address).transfer(recipient, token_id);
    env.assert_public_call_fails(transfer_call_interface);

    // Transfer to private should fail
    let transfer_to_private_call_interface = NFT::at(nft_contract_address).transfer_to_private(owner, token_id);
    env.assert_public_call_fails(transfer_to_private_call_interface);

    // Verify ownership hasn't changed
    utils::assert_owns_public_nft(env, nft_contract_address, owner, token_id);
} 