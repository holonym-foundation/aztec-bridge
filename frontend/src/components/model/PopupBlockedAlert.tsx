import StyledImage from '../StyledImage'
import TextButton from '../TextButton'
import { logInfo } from '@/utils/datadog'

export default function PopupBlockedAlert({ onClose }: { onClose: () => void }) {
  const handleSupportClick = () => {
    // Log support link click
    logInfo('User clicked support link from popup blocked alert', {
      walletType: null,
      loginMethod: null,
      walletProvider: null,
      address: '',
      chainId: null,
      action: 'support_link_click',
      supportUrl: 'https://support.google.com/chrome/answer/95472?hl=en&co=GENIE.Platform%3DDesktop',
      userAction: 'seeking_help',
    })
    
    window.open(
      'https://support.google.com/chrome/answer/95472?hl=en&co=GENIE.Platform%3DDesktop',
      '_blank'
    )
  }

  const handleRefreshClick = () => {
    // Log page refresh from popup blocked alert
    logInfo('User refreshed page from popup blocked alert', {
      walletType: null,
      loginMethod: null,
      walletProvider: null,
      address: '',
      chainId: null,
      action: 'page_refresh',
      userAction: 'attempting_fix',
      refreshReason: 'popup_blocked_alert',
    })
    
    window.location.reload()
  }

  return (
    <div className='absolute inset-0 bg-latest-grey-1000 z-20 rounded-lg'>
      <div className='absolute bottom-0 right-0 left-0'>
        <div className='px-2 py-2 bg-white rounded-lg'>
          <div className='flex justify-between items-center mx-2 py-1'>
            <p className='text-latest-black-300 font-semibold text-16'>
              Enable Pop-ups to Continue
            </p>
            {/* <button onClick={onClose}>
              <StyledImage src='/assets/svg/cross.svg' alt='' className='h-[14px] w-[14px] m-[2px]' />
            </button> */}
          </div>
          <div className='mt-1 mx-2'>
            <p className='text-latest-grey-600 text-14 mb-2'>
              Pop-ups are blocked in your browser. Obsidian wallet requires pop-ups to function properly.
            </p>

            <div className='bg-latest-grey-200 p-3 rounded-lg mb-3 '>
              <p className='text-[#0A0A0A] text-14 font-semibold mb-1'>
              How to enable pop-ups in Chrome:
              </p>
              <ol className='text-[#3B3B3B] text-14 ml-5 list-decimal'>
                <li className='mb-0.5'>Click the pop-up blocked icon in your address bar</li>
                <li className='mb-0.5'>Select &quot;Always allow pop-ups and redirects from https://bridge.human.tech/</li>
                <li className='mb-0.5'>Click &quot;Done&quot;</li>
                <li>Refresh the page</li>
              </ol>
              <div className='relative mt-2'>
                <div className=''>
                  <img 
                    src='/assets/svg/steps.svg' 
                    alt='Steps to enable popups in Chrome'
                    className='w-full rounded-md object-contain'
                  />
                </div>
              </div>
            </div>

            <div className='mt-2 flex justify-center'>
              <TextButton
                onClick={handleRefreshClick}
              >
                <StyledImage
                  src='/assets/svg/refresh.svg'
                  alt='Refresh'
                  className='h-6 w-6 mr-2'
                />
                <span>Refresh Page</span>
              </TextButton>
            </div>
            <TextButton onClick={handleSupportClick} className='mt-2 bg-[#F5F5F5] text-black hover:bg-[#e5e5e5]'>
              <StyledImage
                src='/assets/svg/more info.svg'
                alt='Help'
                className='h-6 w-6'
              />
              <span>Learn more</span>
            </TextButton>



            <div className='flex justify-center gap-2 mt-2'>
              <StyledImage
                src='/assets/svg/silk0.4.svg'
                alt=''
                className='h-4 w-[14px]'
              />
              <p className='text-12 font-medium text-latest-grey-600'>
                Secured by human.tech
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 