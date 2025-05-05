import StyledImage from '../StyledImage'
import TextButton from '../TextButton'
export default function MetaMaskPrompt({ onClose }: { onClose: () => void }) {
  const handleInstallClick = () => {
    window.open(
      'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
      '_blank'
    )
  }

  return (
    <div className='absolute inset-0 bg-latest-grey-1000 z-20 rounded-lg'>
      <div className='absolute bottom-0 right-0 left-0'>
        <div className='px-2.5 py-3 bg-white rounded-lg'>
          <div className='flex justify-between items-center mx-2.5 py-1'>
            <p className='text-latest-black-300 font-semibold text-16'>
              {' '}
              Install MetaMask to Continue
            </p>
            {/* <button onClick={onClose}>
              <StyledImage src='/assets/svg/cross.svg' alt='' className='h-[14px] w-[14px] m-[2px]' />
            </button> */}
          </div>
          <div className='mt-4 mx-2.5'>
            <p className='text-latest-grey-600 text-14 mb-6'>
              To use our app seamlessly, please install MetaMask Wallet
            </p>

            <div className='bg-latest-grey-200 p-4 rounded-lg mb-6 flex items-center gap-4'>
              <div className='bg-white rounded-full p-2'>
                <StyledImage
                  src='/assets/svg/metamask.svg'
                  alt='MetaMask'
                  className='h-10 w-10'
                />
              </div>
              <p className='text-latest-grey-600 text-14'>
                MetaMask is the world’s most secure and flexible crypto wallet,
                trusted by millions of users to buy, sell, and swap digital
                assets.
              </p>
            </div>

            <TextButton onClick={handleInstallClick}>
              <StyledImage
                src='/assets/svg/chrome.svg'
                alt='Chrome'
                className='h-6 w-6'
              />
              <span>Go to Chrome Web Store</span>
            </TextButton>

            <div className='flex justify-center gap-2 mt-6'>
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
