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
    setup,
    deployCleanHandsSBT,
    mintCleanHandsSBT,
    deployL2Token,
    deployL1Token,
    deployPortal,
    deployBridgeContract,
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

            {/* Setup Section */}
            <div className='bg-white rounded-lg p-3'>
              <h2 className='text-lg font-semibold mb-2'>Initial Setup</h2>
              <TextButton onClick={setup} disabled={loading} className='w-full'>
                Setup Sandbox
              </TextButton>
            </div>

            {/* Contract Deployment Section */}
            <div className='bg-white rounded-lg p-3'>
              <h2 className='text-lg font-semibold mb-2'>Deploy Contracts</h2>
              <div className='space-y-1.5'>
                <TextButton
                  onClick={deployCleanHandsSBT}
                  disabled={loading || !pxe}
                  className='w-full'>
                  Deploy Clean Hands SBT
                </TextButton>
                <TextButton
                  onClick={deployL2Token}
                  disabled={loading || !pxe}
                  className='w-full'>
                  Deploy L2 Token
                </TextButton>
                <TextButton
                  onClick={deployL1Token}
                  disabled={loading || !pxe}
                  className='w-full'>
                  Deploy L1 Token
                </TextButton>
                <TextButton
                  onClick={deployPortal}
                  disabled={loading || !l1TokenContract}
                  className='w-full'>
                  Deploy Portal
                </TextButton>
                <TextButton
                  onClick={deployBridgeContract}
                  disabled={
                    loading || !l2TokenContract || !l1PortalContractAddress
                  }
                  className='w-full'>
                  Deploy Bridge
                </TextButton>
              </div>
            </div>

            <div className='bg-white rounded-lg p-3'>
              <h2 className='text-lg font-semibold mb-2'>Mint SBT</h2>
              <div className='space-y-1.5'>
                <TextButton
                  onClick={mintCleanHandsSBT}
                  disabled={loading || !pxe}
                  className='w-full'>
                  Mint Clean Hands SBT
                </TextButton>
              </div>
            </div>

            {/* Bridge Operations Section */}
            <div className='bg-white rounded-lg p-3'>
              <h2 className='text-lg font-semibold mb-2'>Bridge Operations</h2>
              <div className='space-y-1.5'>
                <div className='flex items-center gap-2 mb-2'>
                  <StyledImage
                    src='/assets/images/svg/ethLogo.svg'
                    alt='ETH'
                    className='h-5 w-5'
                  />
                  <span className='text-sm'>→</span>
                  <StyledImage
                    src='/assets/images/svg/aztec.svg'
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
                    src='/assets/images/svg/aztec.svg'
                    alt='Aztec'
                    className='h-5 w-5'
                  />
                  <span className='text-sm'>→</span>
                  <StyledImage
                    src='/assets/images/svg/ethLogo.svg'
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
          </div>
        )}
      </div>
    </RootStyle>
  )
}
