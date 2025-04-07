import Network from '@/components/model/Network'
import TokensModal from '@/components/model/TokensModal'
import RootStyle from '@/components/RootStyle'
import StyledImage from '@/components/StyedImage'
import TextButton from '@/components/TextButton'
import { useWallet } from '@/hooks/useWallet'
import { useBridge } from '@/hooks/useBridge'
import SBT from '@/components/model/SBT'
import clsxm from '@/utils/clsxm'
import { useState, useEffect, ChangeEvent } from 'react'
import { MINT_AMOUNT } from '@/utils/bridge'
import { Oval } from 'react-loader-spinner'

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
    img: '/assets/svg/ETH.svg',
    title: 'ETH',
    about: 'Ethereum',
    amount: '$970.10',
    percentage: '+1.05%',
  },
}

export default function Home() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectNetwork, setSelectNetwork] = useState<boolean>(false)
  const [selectToken, setSelectToken] = useState<boolean>(false)
  const [isSend, setIsSend] = useState<null | boolean>(null)
  const [showSBTModal, setShowSBTModal] = useState(false)
  const [checkingSBT, setCheckingSBT] = useState(false)
  const { isConnected, connect, address } = useWallet()
  const {
    loading,
    l1WalletAddress,
    l2WalletAddress,
    setupProgress,
    setupError,
    setupComplete,
    setupEverything,
    bridgeTokensToL2,
    withdrawTokensToL1,
    l2TokenContract,
    l2Wallets,
    l1Balance,
    l2Balance,
    hasSBT,
    mintSBT,
  } = useBridge()

  const [networkData, setNetworkData] = useState(networks)
  const [tokensData, setTokensData] = useState(tokens)
  const [bridging, setBridging] = useState(false)
  const [bridgeComplete, setBridgeComplete] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [inputAmount, setInputAmount] = useState<string>('')
  const [usdValue, setUsdValue] = useState<string>('$0.00')
  const [localL1Balance, setLocalL1Balance] = useState(l1Balance)
  const [localL2Balance, setLocalL2Balance] = useState(l2Balance)
  const [hasSoulboundToken, setHasSoulboundToken] = useState<boolean | null>(null)

  const stepLabels = [
    'Setting up sandbox...',
    'Deploying L2 token...',
    'Setting up fee juice...',
    'Deploying L1 token & fee asset handler...',
    'Deploying portal...',
    'Deploying bridge contract...',
    'Minting L1 tokens...',
    'Deploying Portal SBT...',
    'Ready to bridge!',
  ]

  useEffect(() => {
    setLocalL1Balance(l1Balance)
    setLocalL2Balance(l2Balance)
  }, [l1Balance, l2Balance])

  const checkSBTAndProceed = async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    if (parseFloat(inputAmount) > parseFloat(l1Balance)) {
      alert(`Amount exceeds available L1 balance of ${l1Balance} ETH`)
      return
    }

    setCheckingSBT(true)
    try {
      const hasToken = await hasSBT(l1WalletAddress || '')
      setHasSoulboundToken(hasToken)
      
      if (!hasToken) {
        setShowSBTModal(true)
      } else {
        // User has an SBT, proceed with bridging
        handleBridgeOrWithdraw()
      }
    } catch (error) {
      console.error('Failed to check SBT status:', error)
    } finally {
      setCheckingSBT(false)
    }
  }

  const handleBridgeOrWithdraw = async () => {
    try {
      if (!inputAmount || parseFloat(inputAmount) <= 0) {
        alert('Please enter a valid amount')
        return
      }

      const amount = BigInt(inputAmount)

      if (isWithdrawing) {
        if (parseFloat(inputAmount) > parseFloat(l2Balance)) {
          alert(`Amount exceeds available L2 balance of ${l2Balance} ETH`)
          return
        }

        setBridging(true)
        try {
          await withdrawTokensToL1(amount)
          setBridgeComplete(true)
        } finally {
          setBridging(false)
        }
      } else {
        if (parseFloat(inputAmount) > parseFloat(l1Balance)) {
          alert(`Amount exceeds available L1 balance of ${l1Balance} ETH`)
          return
        }

        setBridging(true)
        try {
          await bridgeTokensToL2(amount)
          setBridgeComplete(true)
        } finally {
          setBridging(false)
        }
      }
    } catch (error) {
      console.error('Operation failed:', error)
      setBridging(false)
    }
  }

  const handleSBTMinted = async () => {
    setHasSoulboundToken(true)
    setShowSBTModal(false)
    await mintSBT()
    // Proceed with bridging after successful minting
    handleBridgeOrWithdraw()
  }

  const handleSwap = () => {
    setTokensData({ send: tokensData?.received, received: tokensData?.send })
    setNetworkData({ send: networkData?.received, received: networkData?.send })
    setIsWithdrawing(!isWithdrawing)
    setInputAmount('')
  }

  const handleSetupSandbox = async () => {
    try {
      if (!isConnected) {
        await connect()
      }

      await setupEverything()
      

    } catch (error) {
      console.error('Failed to setup bridge:', error)
    }
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
            address={l1WalletAddress || ''}
            buttonText="Get SBT on Ethereum"
            chain="Ethereum"
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
              <p className=' font-bold text-20 '> BRIDGE</p>
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
                    src={tokensData?.send?.img || '/assets/svg/ethLogo.svg'}
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
                  disabled={!setupComplete || bridging}
                  className=' max-w-[190px] placeholder-latest-grey-400 outline-none bg-[transparent] text-32 font-medium'
                />
                <div className='flex gap-2'>
                  <p className=' text-latest-grey-500 text-12 font-medium'>
                    Balance:
                  </p>
                  <p className='text-latest-grey-500 text-12 font-medium break-all'>
                    {isWithdrawing ? l2Balance : l1Balance} ETH
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
                  {inputAmount}
                </p>
              </div>

              <div className='flex justify-between mt-2'>
                <p className='text-latest-grey-500 text-12 font-medium'>
                  Current Balance:
                </p>
                <p className='text-latest-grey-500 text-12 font-medium break-all'>
                  {isWithdrawing ? l1Balance : l2Balance} ETH
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
            {/* {setupProgress > 0 && setupProgress !== 7 && (
              <div className='mb-3 text-center'>
                <p
                  className={`text-14 font-medium ${setupComplete ? 'text-green-600' : 'text-blue-600'}`}>
                  {setupComplete
                    ? 'Ready to bridge!'
                    : 
                </p>
                {setupError && (
                  <p className='text-red-500 text-12 mt-1'>{setupError}</p>
                )}
              </div>
            )} */}

            <div className='pb-4'>
              {!setupComplete ? (
                <TextButton onClick={handleSetupSandbox} disabled={loading}>
                  {loading ? (
                    <>
                      <div className='flex justify-center gap-2'>
                        <Oval
                          height='20'
                          width='20'
                          color='#ccc'
                          wrapperStyle={
                            {
                              //
                            }
                          }
                          wrapperClass=''
                          visible={true}
                          ariaLabel='oval-loading'
                          secondaryColor='#ccc'
                          strokeWidth={6}
                          strokeWidthSecondary={6}
                        />

                        <p className='text-14 font-medium text-white'>
                          {stepLabels[setupProgress]}
                        </p>
                      </div>
                    </>
                  ) : (
                    'Setup Sandbox'
                  )}
                </TextButton>
              ) : (
                <TextButton
                  onClick={hasSoulboundToken ? handleBridgeOrWithdraw : checkSBTAndProceed}
                  disabled={
                    bridging || checkingSBT || !inputAmount || parseFloat(inputAmount) <= 0
                  }
                  >
                  {checkingSBT ? (
                    <div className='flex justify-center gap-2'>
                      <Oval
                        height='20'
                        width='20'
                        color='#ccc'
                        wrapperStyle={{}}
                        wrapperClass=''
                        visible={true}
                        ariaLabel='oval-loading'
                        secondaryColor='#ccc'
                        strokeWidth={6}
                        strokeWidthSecondary={6}
                      />
                      Checking SBT Status...
                    </div>
                  ) : bridging ? (
                    isWithdrawing ? (
                      <div className='flex justify-center gap-2'>
                        <Oval
                          height='20'
                          width='20'
                          color='#ccc'
                          wrapperStyle={{}}
                          wrapperClass=''
                          visible={true}
                          ariaLabel='oval-loading'
                          secondaryColor='#ccc'
                          strokeWidth={6}
                          strokeWidthSecondary={6}
                        />
                        Withdrawing Tokens...
                      </div>
                    ) : (
                      <div className='flex justify-center gap-2'>
                        <Oval
                          height='20'
                          width='20'
                          color='#ccc'
                          wrapperStyle={{}}
                          wrapperClass=''
                          visible={true}
                          ariaLabel='oval-loading'
                          secondaryColor='#ccc'
                          strokeWidth={6}
                          strokeWidthSecondary={6}
                        />
                        Bridging Tokens...
                      </div>
                    )
                  ) : (
                    isWithdrawing ? 'Withdraw Tokens' : 'Bridge Tokens'
                  )}
                </TextButton>
              )}
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
