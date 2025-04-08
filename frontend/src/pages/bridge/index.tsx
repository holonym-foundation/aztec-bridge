import RootStyle from '@/components/RootStyle'
import TextButton from '@/components/TextButton'
import { useWallet } from '@/hooks/useWallet'
import { useBridge } from '@/hooks/useBridge'
import StyledImage from '@/components/StyedImage'

export default function BridgePage() {
  const { isConnected, connect } = useWallet()
  const {
    loading,
    status,
    pxe,
    l1TokenContract,
    l2TokenContract,
    l1PortalContractAddress,
    bridgeContract,
    feeJuicePaymentMethod,
    setup,
    deployL2Token,
    deployL1Token,
    deployPortal,
    deployBridgeContract,
    setupFeeJuiceForL2,
    bridgeTokensToL2,
    withdrawTokensToL1,
  } = useBridge()

  const handleConnect = async () => {
    try {
      await connect()
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

  const handleBridgeToL2 = async () => {
    try {
      await bridgeTokensToL2()
    } catch (error) {
      console.error('Failed to bridge tokens:', error)
    }
  }

  const handleWithdrawToL1 = async () => {
    try {
      await withdrawTokensToL1()
    } catch (error) {
      console.error('Failed to withdraw tokens:', error)
    }
  }

  return (
    <RootStyle>
      <div className='p-4'>
        <h1 className='text-2xl font-bold mb-4 text-center'>Aztec Bridge</h1>

        {!isConnected ? (
          <div className='bg-white rounded-lg p-3 text-center'>
            <p className='mb-3'>Please connect your wallet to use the bridge</p>
            <TextButton onClick={handleConnect}>Connect Wallet</TextButton>
          </div>
        ) : (
          <div className='space-y-3'>
            {/* Status Section */}
            {status && (
              <div className='bg-white rounded-lg p-3'>
                <h2 className='text-lg font-semibold mb-1'>Status</h2>
                <p className='text-sm'>{status}</p>
              </div>
            )}

            {/* Step 1: Setup Section */}
            <div className='bg-white rounded-lg p-3'>
              <h2 className='text-lg font-semibold mb-2'>1. Initial Setup</h2>
              <TextButton onClick={setup} disabled={loading} className='w-full'>
                Setup Sandbox
              </TextButton>
            </div>

            {/* Step 2: L2 Token Contract and Fee Juice */}
            <div className='bg-white rounded-lg p-3'>
              <h2 className='text-lg font-semibold mb-2'>2. L2 Setup</h2>
              <div className='space-y-1.5'>
                <TextButton
                  onClick={deployL2Token}
                  disabled={loading || !pxe}
                  className='w-full'>
                  Deploy L2 Token
                </TextButton>
                <TextButton
                  onClick={setupFeeJuiceForL2}
                  disabled={loading || !pxe || !l2TokenContract}
                  className='w-full'>
                  Setup Fee Juice
                </TextButton>
              </div>
            </div>

            {/* Step 3: L1 Token Contract */}
            <div className='bg-white rounded-lg p-3'>
              <h2 className='text-lg font-semibold mb-2'>3. L1 Setup</h2>
              <div className='space-y-1.5'>
                <TextButton
                  onClick={deployL1Token}
                  disabled={loading || !pxe}
                  className='w-full'>
                  Deploy L1 Token & Fee Asset Handler
                </TextButton>
                <TextButton
                  onClick={deployPortal}
                  disabled={loading || !l1TokenContract}
                  className='w-full'>
                  Deploy Portal
                </TextButton>
              </div>
            </div>

            {/* Step 4: Bridge Contract */}
            <div className='bg-white rounded-lg p-3'>
              <h2 className='text-lg font-semibold mb-2'>4. Bridge Deployment</h2>
              <TextButton
                onClick={deployBridgeContract}
                disabled={
                  loading || !l2TokenContract || !l1PortalContractAddress || !feeJuicePaymentMethod
                }
                className='w-full'>
                Deploy Bridge (using Fee Juice)
              </TextButton>
            </div>

            {/* Step 5: Bridge Operations */}
            <div className='bg-white rounded-lg p-3'>
              <h2 className='text-lg font-semibold mb-2'>5. Bridge Operations</h2>
              <div className='space-y-1.5'>
                <div className='flex items-center gap-2 mb-2'>
                  <StyledImage
                    src='/assets/svg/ethLogo.svg'
                    alt='ETH'
                    className='h-5 w-5'
                  />
                  <span className='text-sm'>→</span>
                  <StyledImage
                    src='/assets/svg/aztec.svg'
                    alt='Aztec'
                    className='h-5 w-5'
                  />
                </div>
                <TextButton
                  onClick={handleBridgeToL2}
                  disabled={loading || !bridgeContract || !l1TokenContract}
                  className='w-full'>
                  Bridge to L2
                </TextButton>

                <div className='flex items-center gap-2 my-2'>
                  <StyledImage
                    src='/assets/svg/aztec.svg'
                    alt='Aztec'
                    className='h-5 w-5'
                  />
                  <span className='text-sm'>→</span>
                  <StyledImage
                    src='/assets/svg/ethLogo.svg'
                    alt='ETH'
                    className='h-5 w-5'
                  />
                </div>
                <TextButton
                  onClick={handleWithdrawToL1}
                  disabled={loading || !bridgeContract || !l2TokenContract}
                  className='w-full'>
                  Withdraw to L1
                </TextButton>
              </div>
            </div>

            {/* Fee Juice Status */}
            <div className='bg-white rounded-lg p-3'>
              <h2 className='text-lg font-semibold mb-2'>Fee Juice Status</h2>
              <div className='text-sm'>
                {feeJuicePaymentMethod ? (
                  <div className='flex items-center gap-2'>
                    <span className='inline-block w-3 h-3 rounded-full bg-green-500'></span>
                    <span>Fee Juice is set up and ready to use</span>
                  </div>
                ) : (
                  <div className='flex items-center gap-2'>
                    <span className='inline-block w-3 h-3 rounded-full bg-gray-400'></span>
                    <span>Fee Juice not configured</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </RootStyle>
  )
}
