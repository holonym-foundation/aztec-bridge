import Network from '@/components/model/Network'
import TokensModal from '@/components/model/TokensModal'
import RootStyle from '@/components/RootStyle'
import StyledImage from '@/components/StyedImage'
import TextButton from '@/components/TextButton'
import { useMetaMask } from '../hooks/useMetaMask'
import { useAztecWallet } from '../hooks/useAztecWallet'
import SBT from '@/components/model/SBT'
import clsxm from '@/utils/clsxm'
import { useState, useEffect, ChangeEvent } from 'react'
import { MINT_AMOUNT } from '@/utils/bridge'
import { Oval } from 'react-loader-spinner'
import { useBridge } from '@/hooks/useBridge'
import { useBridgeV3 } from '@/hooks/useBridgeV3'

const networks = {
  send: {
    id: 3,
    img: '/assets/svg/ethereum.svg',
    title: 'Ethereum',
  },
  received: {
    id: 5,
    img: '/assets/svg/aztec.svg',
    title: 'Aztec',
  },
}

const tokens = {
  send: {
    id: 1,
    img: '/assets/svg/USDC.svg',
    title: 'USDC',
    about: 'Ethereum',
    amount: '$50.27',
    percentage: '+0.62%',
  },
  received: {
    id: 3,
    img: '/assets/svg/USDC.svg',
    title: 'USDC',
    about: 'USDC',
    amount: '$970.10',
    percentage: '+1.05%',
  },
}

function LoadingContent({ label }: { label: string }) {
  return (
    <div className='flex justify-center gap-2'>
      <Oval
        height='20'
        width='20'
        color='#ccc'
        visible={true}
        ariaLabel='oval-loading'
        secondaryColor='#ccc'
        strokeWidth={6}
        strokeWidthSecondary={6}
      />
      <span>{label}</span>
    </div>
  )
}

function BridgeActionButton({
  inputAmount,
  setInputAmount,
}: {
  inputAmount: string
  setInputAmount: (amount: string) => void
}) {
  // MetaMask integration
  const { 
    address: metaMaskAddress, 
    isConnected: isMetaMaskConnected, 
    connect: connectMetaMask, 
    disconnect: disconnectMetaMask 
  } = useMetaMask();
  
  // Aztec wallet integration
  const { 
    account: aztecAccount, 
    address: aztecAddress,
    isConnected: isAztecConnected, 
    isConnecting: isAztecConnecting,
    connect: connectAztec, 
    disconnect: disconnectAztec 
  } = useAztecWallet();


    const {
    loading,
    error,
    l1Balance,
    l2Balance,
    getL1Balance,
    getL2Balance,
    bridgeTokensToL2,
    withdrawTokensToL1,
    getL2ToL1MessageMembershipWitness,
    mintL1Tokens,
    // hasSBT,
    // mintSBT,
  } = useBridgeV3()

  // Local state for button logic
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [hasSoulboundToken, setHasSoulboundToken] = useState<boolean | null>(
    null
  )
  const [hasAztecSBT, setHasAztecSBT] = useState<boolean | null>(null)
  const [bridging, setBridging] = useState(false)
  const [checkingSBT, setCheckingSBT] = useState(false)
  const [buttonLoading, setButtonLoading] = useState(false)

  // Balance checks
  // const hasL1 = !!l1Balance && parseFloat(l1Balance) > 0
  const hasL1 = true
  // const hasL2 = !!l2Balance && parseFloat(l2Balance) > 0
  const hasL2 = true

  // Faucet placeholder
  const handleFaucet = () => {
    alert('Faucet function called (placeholder)')
  }

  // SBT check and bridge logic
  const checkSBTAndProceed = async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      alert('Please enter a valid amount')
      return
    }
    setCheckingSBT(true)
    try {
      if (!isWithdrawing) {
        // const hasToken = await hasSBT()
        const hasToken = true
        setHasSoulboundToken(hasToken)
        if (!hasToken) {
          alert('You need an SBT to bridge.')
        } else {
          setCheckingSBT(false)
          await handleBridgeOrWithdraw()
        }
      } else {
        // For demo, always false
        const hasToken = false
        setHasAztecSBT(hasToken)
        if (!hasToken) {
          alert('You need an Aztec SBT to withdraw.')
        } else {
          setCheckingSBT(false)
          await handleBridgeOrWithdraw()
        }
      }
    } catch (error) {
      console.error('Failed to check SBT status:', error)
    } finally {
      setCheckingSBT(false)
    }
  }

  const handleBridgeOrWithdraw = async () => {
    setBridging(true)
    try {
      if (!inputAmount || parseFloat(inputAmount) <= 0) {
        alert('Please enter a valid amount')
        return
      }
      const amount = BigInt(inputAmount)
      try {
        if (isWithdrawing) {
          await withdrawTokensToL1(amount)
        } else {
          await bridgeTokensToL2(amount)
        }
      } finally {
        // setBridging(false)
      }
    } catch (error) {
      console.error('Operation failed:', error)
      setBridging(false)
    }
  }

  // Button click logic
  const handleBridgeActionButton = async () => {
    if (!isMetaMaskConnected) {
      setButtonLoading(true)
      try {
        await connectMetaMask()
      } finally {
        setButtonLoading(false)
      }
    } else if (!isAztecConnected) {
      setButtonLoading(true)
      try {
        await connectAztec()
      } finally {
        setButtonLoading(false)
      }
    } else if (!hasL1 || !hasL2) {
      handleFaucet()
    } else {
      if (isWithdrawing ? hasSoulboundToken : hasAztecSBT) {
        await handleBridgeOrWithdraw()
      } else {
        await checkSBTAndProceed()
      }
    }
  }

  // Button label
  let buttonLabel = ''
  if (!isMetaMaskConnected) {
    buttonLabel = 'Connect MetaMask'
  } else if (!isAztecConnected) {
    buttonLabel = 'Connect Aztec'
  } else if (!hasL1 || !hasL2) {
    buttonLabel = 'Get Faucet'
  } else {
    buttonLabel = isWithdrawing ? 'Withdraw Tokens' : 'Bridge Tokens'
  }

  // Disabled state
  // const isDisabled =
  //   buttonLoading ||
  //   bridging ||
  //   checkingSBT ||
  //   !inputAmount ||
  //   (parseFloat(inputAmount) <= 0 &&
  //     buttonLabel === (isWithdrawing ? 'Withdraw Tokens' : 'Bridge Tokens'))
  const isDisabled = false

  // Loading content
  if (buttonLoading)
    return (
      <TextButton disabled>
        <LoadingContent label='Connecting...' />
      </TextButton>
    )
  if (checkingSBT)
    return (
      <TextButton disabled>
        <LoadingContent label='Checking SBT Status...' />
      </TextButton>
    )
  if (bridging)
    return (
      <TextButton disabled>
        <LoadingContent
          label={isWithdrawing ? 'Withdrawing Tokens...' : 'Bridging Tokens...'}
        />
      </TextButton>
    )

  return (
    <div>
      <TextButton onClick={handleBridgeActionButton} disabled={isDisabled}>
        {buttonLabel}
      </TextButton>
    </div>
  )
}

export default function Home() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectNetwork, setSelectNetwork] = useState<boolean>(false)
  const [selectToken, setSelectToken] = useState<boolean>(false)
  const [isSend, setIsSend] = useState<null | boolean>(null)
  const [showSBTModal, setShowSBTModal] = useState(false)
  const [checkingSBT, setCheckingSBT] = useState(false)

  // MetaMask integration
  const { 
    address: metaMaskAddress, 
    isConnected: isMetaMaskConnected, 
    connect: connectMetaMask, 
    disconnect: disconnectMetaMask 
  } = useMetaMask();
  
  // Aztec wallet integration
  const { 
    account: aztecAccount, 
    address: aztecAddress,
    isConnected: isAztecConnected, 
    isConnecting: isAztecConnecting,
    connect: connectAztec, 
    disconnect: disconnectAztec 
  } = useAztecWallet();

  const {
    loading,
    error,
    l1Balance,
    l2Balance,
    getL1Balance,
    getL2Balance,
    bridgeTokensToL2,
    withdrawTokensToL1,
    getL2ToL1MessageMembershipWitness,
    mintL1Tokens,
    // hasSBT,
    // mintSBT,
  } = useBridgeV3()

  // console.log({
  //   error,
  //   l1Balance,
  //   l2Balance,
  // })

  const [networkData, setNetworkData] = useState(networks)
  const [tokensData, setTokensData] = useState(tokens)
  const [bridgeComplete, setBridgeComplete] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [inputAmount, setInputAmount] = useState<string>('10')
  const [usdValue, setUsdValue] = useState<string>('$0.00')
  const [localL1Balance, setLocalL1Balance] = useState(l1Balance)
  const [localL2Balance, setLocalL2Balance] = useState(l2Balance)
  const [hasSoulboundToken, setHasSoulboundToken] = useState<boolean | null>(
    null
  )
  const [hasAztecSBT, setHasAztecSBT] = useState<boolean | null>(null)

  useEffect(() => {
    setLocalL1Balance(l1Balance)
    setLocalL2Balance(l2Balance)
  }, [l1Balance, l2Balance])

  const handleSBTMinted = async () => {
    if (isWithdrawing) {
      setHasSoulboundToken(true)
    } else {
      setHasAztecSBT(true)
    }
    setShowSBTModal(false)
    // await mintSBT()

    // Bridge logic now handled in BridgeActionButton
    // handleBridgeOrWithdraw()
  }

  const handleSwap = () => {
    setTokensData({ send: tokensData?.received, received: tokensData?.send })
    setNetworkData({ send: networkData?.received, received: networkData?.send })
    setIsWithdrawing(!isWithdrawing)
    setInputAmount('')
  }

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || !isNaN(Number(value))) {
      setInputAmount(value)
    }
  }

  return (
    <>
      <RootStyle>
        {selectNetwork && (
          <Network
            setNetworkData={setNetworkData}
            networkData={networkData}
            isSend={isSend}
            handleClose={() => setSelectNetwork(false)}
          />
        )}
        {selectToken && (
          <TokensModal
            setTokensData={setTokensData}
            tokensData={tokensData}
            isSend={isSend}
            handleClose={() => setSelectToken(false)}
          />
        )}
        {showSBTModal && (
          <SBT
            address={metaMaskAddress || ''}
            buttonText={
              isWithdrawing ? 'Get SBT on Aztec' : 'Get SBT on Ethereum'
            }
            chain={isWithdrawing ? 'Aztec' : 'Ethereum'}
            onMint={handleSBTMinted}
            onClose={() => setShowSBTModal(false)}
          />
        )}

        <div className=''>
          <div className=' bg-latest-grey-200 p-5 py-3'>
            <div className='flex items-center gap-3 max-w-[150px] mx-auto rounded-full bg-white px-4 py-1'>
              <StyledImage
                src='/assets/svg/bridgeIcon.svg'
                alt=''
                className='h-5 w-5 '
              />
              <p className=' font-bold text-20  cursor-pointer' onClick={() => {
                // disconnectMetaMask()
                // disconnectAztec()
                mintL1Tokens()
              }}> BRIDGE</p>
            </div>

            <div className='mt-5 bg-white rounded-md p-4 relative'>
              <p className='text-14 font-semibold   text-latest-grey-100'>
                From
              </p>
              {/* section1 */}
              <div className='flex justify-between'>
                <div className='mt-4 flex gap-2 items-center rounded-[12px]  cursor-pointer bg-latest-grey-200 p-[2px] max-w-[172px] '>
                  <StyledImage
                    src={networkData?.send?.img || '/assets/svg/ethLogo.svg'}
                    alt=''
                    className='h-6 w-6'
                  />
                  <p className='text-16 font-medium text-latest-black-100  w-[106px]'>
                    {networkData?.send?.title}
                  </p>
                  <StyledImage
                    src='/assets/svg/dropDown.svg'
                    alt=''
                    className='h-2.5 w-1.5 p-1.5 mr-1.5 '
                  />
                </div>
                <div className='mt-4 flex gap-2  items-center rounded-md cursor-pointer bg-latest-grey-200 p-[2px]  '>
                  <StyledImage
                    src={tokensData?.send?.img || '/assets/svg/USDC.svg'}
                    alt=''
                    className='h-6 w-6'
                  />
                  <p className='text-16 font-medium text-latest-black-100  '>
                    {tokensData?.send?.title}
                  </p>
                  <StyledImage
                    src='/assets/svg/dropDown.svg'
                    alt=''
                    className='h-2.5 w-1.5 p-1.5 mr-1.5 '
                  />
                </div>
              </div>
              <hr className=' text-latest-grey-300 my-3' />
              <div className='flex justify-between my-1'>
                <input
                  type='text'
                  placeholder='0'
                  value={inputAmount}
                  onChange={handleAmountChange}
                  className=' max-w-[190px] placeholder-latest-grey-400 outline-none bg-[transparent] text-32 font-medium'
                />
                <div className='flex gap-2'>
                  <p className=' text-latest-grey-500 text-12 font-medium'>
                    Balance:
                  </p>
                  <p className='text-latest-grey-500 text-12 font-medium break-all'>
                    {isWithdrawing ? l2Balance : l1Balance} USDC
                  </p>
                </div>
              </div>
              <div className='flex justify-between mt-2'>
                <p className='text-16 font-medium text-latest-grey-500'>
                  {/* {usdValue} */}
                </p>
                <p
                  className='text-14 font-medium text-latest-black-200 bg-latest-grey-200 px-2.5 rounded-[32px] h-5 cursor-pointer'
                  onClick={() =>
                    setInputAmount(isWithdrawing ? l2Balance : l1Balance)
                  }>
                  Max
                </p>
              </div>
              <div className='absolute mb-0 bottom-[-30px] left-0 right-0 text-center '>
                <button onClick={handleSwap} className='mx-auto w-10 h-10   '>
                  <StyledImage
                    src='/assets/svg/swap.svg'
                    alt=''
                    className='h-10 w-10'
                  />{' '}
                </button>
              </div>
            </div>

            {/* section2 */}
            <div className='mt-2 bg-white rounded-md  p-4'>
              <p className='text-14 font-regular text-latest-grey-100 '>To</p>
              <div className='flex justify-between'>
                <div className='mt-4 flex gap-2 items-center rounded-[12px] cursor-pointer bg-latest-grey-200  p-[2px] max-w-[172px] '>
                  <StyledImage
                    src={networkData?.received?.img || '/assets/svg/aztec.svg'}
                    alt=''
                    className='h-6 w-6'
                  />
                  <p className='text-16 font-medium text-latest-black-100  w-[106px]'>
                    {networkData?.received?.title}
                  </p>
                  <StyledImage
                    src='/assets/svg/dropDown.svg'
                    alt=''
                    className='h-2.5 w-1.5 p-1.5 mr-1.5 '
                  />
                </div>
                <div className='mt-4 flex gap-2 items-center rounded-md cursor-pointer bg-latest-grey-200  p-[2px]  '>
                  <StyledImage
                    src={tokensData?.received?.img || '/assets/svg/ethLogo.svg'}
                    alt=''
                    className='h-6 w-6'
                  />
                  <p className='text-16 font-medium text-latest-black-100 '>
                    {tokensData?.received?.title}
                  </p>
                  <StyledImage
                    src='/assets/svg/dropDown.svg'
                    alt=''
                    className='h-2.5 w-1.5 p-1.5 mr-1.5 '
                  />
                </div>
              </div>
              <hr className=' text-latest-grey-300  my-3' />
              <div className='flex justify-between'>
                <p className='text-14 font-medium text-latest-grey-100 '>
                  You will receive
                </p>
                <p className='text-black text-14 font-semibold'>
                  {inputAmount} USDC
                </p>
              </div>

              <div className='flex justify-between mt-2'>
                <p className='text-latest-grey-500 text-12 font-medium'>
                  Current Balance:
                </p>
                <p className='text-latest-grey-500 text-12 font-medium break-all'>
                  {isWithdrawing ? l1Balance : l2Balance} USDC
                </p>
              </div>
            </div>

            <div
              className={clsxm(
                'rounded-md bg-white mt-2 p-4 transition-all duration-400 ease-in-out',
                isOpen ? 'h-[244px]' : 'h-[54px]'
              )}>
              <button
                className='flex justify-between font-semibold w-full'
                onClick={() => setIsOpen(!isOpen)}>
                Transaction breakdown
                <span className=''>
                  <StyledImage
                    src='/assets/svg/buttons.svg'
                    className={clsxm(
                      'w-6 h-6 ',
                      isOpen &&
                        ' transition-transform duration-200 ease-in-out rotate-90'
                    )}
                    alt='open'
                  />
                </span>
              </button>
              {isOpen && (
                <div>
                  <div className='mt-4 flex justify-between'>
                    <p className='text-sm font-medium text-latest-grey-700'>
                      Time to Aztec
                    </p>
                    <p className='text-latest-black-300 text-14 font-medium'>
                      ~2 mins
                    </p>
                  </div>
                  <div className='mt-[14px] flex justify-between'>
                    <p className='text-sm font-medium text-latest-grey-700'>
                      Net fee
                    </p>
                    <p className='text-latest-black-300 text-14 font-medium'>
                      $ 0.04
                    </p>
                  </div>
                  <div className='mt-[14px] flex justify-between'>
                    <div className='flex gap-1 items-center text-center'>
                      {' '}
                      <p className='text-sm font-medium text-latest-grey-700'>
                        Bridge fee
                      </p>
                      <StyledImage
                        src='/assets/svg/info.svg'
                        alt=''
                        className='h-4 w-4'
                      />
                    </div>
                    <p className=' text-latest-grey-100 text-14 font-medium'>
                      $ 0.01{' '}
                      <span className='text-latest-black-300'>
                        {' '}
                        0.0000029 ETH
                      </span>
                    </p>
                  </div>
                  <div className='mt-[14px] flex justify-between'>
                    <div className='flex gap-1 items-center '>
                      {' '}
                      <p className='text-sm font-medium text-latest-grey-700'>
                        Destination <br /> Gas fee
                      </p>
                      <StyledImage
                        src='/assets/svg/info.svg'
                        alt=''
                        className='h-4 w-4'
                      />
                    </div>
                    <p className=' text-latest-grey-100 text-14 font-medium'>
                      $ 0.03{' '}
                      <span className='text-latest-black-300'>
                        {' '}
                        0.0000103 ETH
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className='bg-white rounded-md pt-4 px-5'>
            <div className='pb-4'>
              <BridgeActionButton
                inputAmount={inputAmount}
                setInputAmount={setInputAmount}
              />
            </div>
            <div className='flex justify-center gap-2 pb-3'>
              <StyledImage
                src='/assets/svg/silk0.4.svg'
                alt=''
                className='h-4 w-[14px]'
              />
              <p className='text-12 font-medium text-latest-grey-600'>
                Secured by Human Wallet
              </p>
            </div>
          </div>
        </div>
      </RootStyle>
    </>
  )
}
