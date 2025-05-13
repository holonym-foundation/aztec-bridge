'use client'

import { useWalletSync } from '@/hooks/useWalletSync'
import { useWalletStore } from '@/stores/walletStore'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'

type WalletDisplayProps = {
  address?: string
  isConnected: boolean
  walletIcon: string
  networkIcon?: string
  onClick?: () => void
  onDisconnect?: () => void
  walletType: 'metamask' | 'aztec'
}

const WalletDisplay: React.FC<WalletDisplayProps> = ({
  address,
  isConnected,
  walletIcon,
  networkIcon,
  onClick,
  onDisconnect,
  walletType,
}) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleClick = () => {
    setShowDropdown(!showDropdown)
  }

  const handleCopyAddress = () => {
    if (address) {
      // Copy the address to clipboard
      navigator.clipboard.writeText(address)

      // Show the "Copied!" tooltip
      setCopied(true)

      // Hide the tooltip after 2 seconds
      setTimeout(() => {
        setCopied(false)
        // Only close dropdown after tooltip is hidden
        setShowDropdown(false)
      }, 2000)
    }
  }

  const handleDisconnect = () => {
    if (onDisconnect) {
      onDisconnect()
    }
    setShowDropdown(false)
  }

  if (!isConnected) return null

  return (
    <div className='relative' ref={dropdownRef}>
      <div
        className='flex pr-[8px] justify-center items-center gap-[12px] rounded-[8px] border border-[#D4D4D4] bg-white cursor-pointer hover:shadow-md transition-shadow duration-200'
        onClick={handleClick}
        data-tooltip-id={`tooltip-${walletType}`}>
 
        <Image src={walletIcon} alt='Wallet' width={32} height={32} />
               {networkIcon && (
          <Image src={networkIcon} alt='Network' width={20} height={20} />
        )}
        <span className='text-sm font-medium'>
          {address
            ? `${address.substring(0, 6)}...${address.substring(
                address.length - 4
              )}`
            : ''}
        </span>
        <Image
          src='/assets/svg/drop-down-logo.svg'
          alt='Dropdown'
          width={24}
          height={24}
        />
      </div>

      {showDropdown && (
        <div className='absolute right-0 mt-2 shadow-lg z-10 min-w-[180px] py-2  rounded-[12px] border border-[#D4D4D4] bg-white '>
          <div
            className='flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer relative transition-colors duration-150 hover:bg-latest-grey-300'
            onClick={handleCopyAddress}>
              <div>
                
              </div>
            <svg
              width='16'
              height='16'
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'>
              <path
                d='M8 5H6C4.89543 5 4 5.89543 4 7V19C4 20.1046 4.89543 21 6 21H16C17.1046 21 18 20.1046 18 19V17'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              <path
                d='M8 9H6C4.89543 9 4 9.89543 4 11V19C4 20.1046 4.89543 21 6 21H16C17.1046 21 18 20.1046 18 19V17'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeDasharray='0.2 4'
                strokeDashoffset='2'
              />
              <rect
                x='8'
                y='3'
                width='12'
                height='12'
                rx='2'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
            <span>{copied ? 'Copied!' : 'Copy Address'}</span>
          </div>
          <div
            className='flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer text-red-500 transition-colors duration-150 hover:bg-latest-grey-300'
            onClick={handleDisconnect}>
            <svg
              width='16'
              height='16'
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'>
              <path
                d='M16 17L21 12M21 12L16 7M21 12H9'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              <path
                d='M9 3H7C4.79086 3 3 4.79086 3 7V17C3 19.2091 4.79086 21 7 21H9'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
            <span>Disconnect</span>
          </div>
        </div>
      )}
    </div>
  )
}

interface ConnectWalletButtonProps {
  onClick: () => void
  minimal?: boolean
}

const ConnectWalletButton: React.FC<ConnectWalletButtonProps> = ({
  onClick,
  minimal = false,
}) => {
  return (
    <button
      className={`flex justify-center items-center gap-[8px] rounded-[8px] bg-latest-grey-300 hover:bg-latest-grey-400 transition-colors duration-200 ${
        minimal ? 'p-2' : 'px-[10px] py-[5px]'
      }`}
      onClick={onClick}>
      <svg
        width='20'
        height='20'
        viewBox='0 0 24 24'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'>
        <path
          d='M2 7C2 5.89543 2.89543 5 4 5H20C21.1046 5 22 5.89543 22 7V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V7Z'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <path
          d='M16 14C16 12.8954 16.8954 12 18 12C19.1046 12 20 12.8954 20 14C20 15.1046 19.1046 16 18 16C16.8954 16 16 15.1046 16 14Z'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <path
          d='M2 10H22'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
      {!minimal && <span>Connect Wallet</span>}
    </button>
  )
}

interface HeaderProps {
  credentials?: React.ReactNode
  privatePayments?: React.ReactNode
}

const Header: React.FC<HeaderProps> = ({ credentials, privatePayments }) => {
  // Get wallet state from useWalletSync
  const {
    metaMaskAddress,
    isMetaMaskConnected,
    connectMetaMask,
    disconnectMetaMask,
    aztecAddress,
    isAztecConnected,
    disconnectAztec,
  } = useWalletSync()

  // Get wallet store actions
  const { setShowWalletModal } = useWalletStore()

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Track if connect wallet button was pressed
  const [walletButtonPressed, setWalletButtonPressed] = useState(false)

  // Client-side rendering check
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-connect to Aztec when MetaMask is connected
  useEffect(() => {
    if (isMetaMaskConnected && !isAztecConnected && walletButtonPressed) {
      // Add a slight delay to avoid UI issues
      const timer = setTimeout(() => {
        setShowWalletModal(true)
        // Reset the button press tracker after showing modal
        setWalletButtonPressed(false)
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [isMetaMaskConnected, isAztecConnected, walletButtonPressed, setShowWalletModal])

  // Handle connect wallet click
  const handleConnectWallet = async () => {
    // Set the button pressed flag
    setWalletButtonPressed(true)
    try {
      await connectMetaMask()
      // Aztec connection will be handled by the useEffect above
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      // Reset the button press tracker if connection fails
      setWalletButtonPressed(false)
    }
    setMobileMenuOpen(false)
  }

  // Check if any wallet is connected
  const isAnyWalletConnected = isMetaMaskConnected || isAztecConnected

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  if (!mounted) {
    return (
      <header className='w-full px-4 flex justify-between items-center'>
        <div className='flex-shrink-0'>
          <Link href='/' className="hover:opacity-80 transition-opacity duration-200">
            <Image
              src='/assets/svg/human.tech.logo.svg'
              alt='human.tech'
              width={120}
              height={30}
            />
          </Link>
        </div>
      </header>
    )
  }

  return (
    <header className='w-full px-4 pt-3 flex justify-between items-center relative'>
      <div className='flex-shrink-0'>
        <Link href='/' className="hover:opacity-80 transition-opacity duration-200">
          <Image
            src='/assets/svg/human.tech.logo.svg'
            alt='human.tech'
            width={120}
            height={30}
          />
        </Link>
      </div>

      {/* Desktop Navigation */}
      <div className='hidden md:flex gap-6 items-center'>
        {credentials && (
          <div className='text-sm font-medium cursor-pointer hover:text-latest-grey-800 transition-colors duration-200'>
            {credentials}
          </div>
        )}

        {privatePayments && (
          <div className='text-sm font-medium cursor-pointer hover:text-latest-grey-800 transition-colors duration-200'>
            {privatePayments}
          </div>
        )}

        <div className='flex items-center gap-3'>
          {!isAnyWalletConnected ? (
            <ConnectWalletButton onClick={handleConnectWallet} />
          ) : (
            <>
              <WalletDisplay
                address={metaMaskAddress}
                isConnected={isMetaMaskConnected}
                walletIcon='/assets/svg/meta-mask-wallet-logo.svg'
                networkIcon='/assets/svg/network-logo.svg'
                onDisconnect={disconnectMetaMask}
                walletType='metamask'
              />

              <WalletDisplay
                address={aztecAddress}
                isConnected={isAztecConnected}
                walletIcon='/assets/svg/aztec-wallet-logo.svg'
                // networkIcon='/assets/svg/network-logo.svg'
                onDisconnect={disconnectAztec}
                walletType='aztec'
              />
            </>
          )}
        </div>
      </div>

      {/* Mobile Menu Button */}
      <div className='md:hidden'>
        <button 
          onClick={toggleMobileMenu}
          className='p-2'
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className='md:hidden absolute top-full left-0 right-0 bg-white z-50 shadow-lg py-4 px-6 flex flex-col gap-4'>
          {credentials && (
            <div className='text-sm font-medium cursor-pointer hover:text-latest-grey-800 transition-colors duration-200'>
              {credentials}
            </div>
          )}

          {privatePayments && (
            <div className='text-sm font-medium cursor-pointer hover:text-latest-grey-800 transition-colors duration-200'>
              {privatePayments}
            </div>
          )}

          <div className='flex flex-col items-start gap-3'>
            {!isAnyWalletConnected ? (
              <ConnectWalletButton onClick={handleConnectWallet} />
            ) : (
              <>
                <WalletDisplay
                  address={metaMaskAddress}
                  isConnected={isMetaMaskConnected}
                  walletIcon='/assets/svg/meta-mask-wallet-logo.svg'
                  networkIcon='/assets/svg/network-logo.svg'
                  onDisconnect={disconnectMetaMask}
                  walletType='metamask'
                />

                <WalletDisplay
                  address={aztecAddress}
                  isConnected={isAztecConnected}
                  walletIcon='/assets/svg/aztec-wallet-logo.svg'
                  // networkIcon='/assets/svg/network-logo.svg'
                  onDisconnect={disconnectAztec}
                  walletType='aztec'
                />
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
