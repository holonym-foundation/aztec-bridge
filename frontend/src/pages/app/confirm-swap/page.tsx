
import RootStyle from '@/components/RootStyle';
import TextButton from '@/components/TextButton';
import { useRouter } from 'next/navigation';

function Page() {
  const router = useRouter();
  // const setActiveTab = useGlobalStates(state=> state.setActiveTab)

  return (
    <div>
      <RootStyle>
        <div className=''>
          <div className='relative flex items-center'>
            <button>
              <img src='/assets/images/navIcon.png' alt='' className='absolute top-0 left-0' />
            </button>
            <p className='w-full text-center text-16 font-medium   font-inter'>Confirm Swap</p>
          </div>

          <div>
            <div className=' mt-5 bg-neutral-100 p-1 rounded-lg'>
              <div className=' border border-neutral-300 rounded-lg flex justify-center items-center  bg-white  '>
                <div className='py-6'>
                  <div className='flex justify-center'>
                    <img src='/assets/images/confirmSwapIcon.png' alt='' />
                  </div>
                  <p className='mt-2  text-24 font-medium   text-center  font-inter'>Swap 0.5 ETH</p>
                  <p className=' text-16 font-medium text-center  font-inter mt-[2px]'>Receive $1,580 in USDC </p>

                  {/* pending section */}

                  {/* <div className='mt-5 mx-2 '>
                    <div className='flex items-center gap-[60px] w-full bg-neutral-200 rounded-lg p-2.5'>
                      <div className='flex items-center gap-1.5'>
                        <img src='/assets/svg/pending.svg' alt='' />
                        <p className=' text-14 font-inter font-medium'>Pending</p>
                      </div>
                      <div className='flex gap-1.5'>
                        <p className=' text-14 font-inter font-medium'>Apr 20, 2024</p>
                        <p className=' text-14 font-inter font-medium'>.</p>
                        <p className=' text-14 font-inter font-medium'>21:30</p>
                      </div>
                    </div>
                  </div> */}

                  {/* success  */}

                  {/* <div className='mt-5 mx-2 '>
                    <div className='flex items-center gap-[60px] w-full bg-neutral-200 rounded-lg p-2.5'>
                      <div className='flex items-center gap-1.5'>
                        <img src='/assets/svg/success.svg' alt='' />
                        <p className='text-green-200 text-14 font-inter font-medium'>Success</p>
                      </div>
                      <div className='flex gap-1.5'>
                        <p className='text-green-200 text-14 font-inter font-medium'>Apr 20, 2024</p>
                        <p className='text-green-200 text-14 font-inter font-medium'>.</p>
                        <p className='text-green-200 text-14 font-inter font-medium'>21:31</p>
                      </div>
                    </div>
                  </div> */}
                </div>
              </div>
            
              <div className=''>
                <div className='flex justify-between py-[6px] px-[10px] mt-2 '>
                  <p className='text-neutral-500 font-inter font-medium text-14'>Fee</p>
                  <p className='text-neutral-900 font-inter font-medium text-14'>$4.50</p>
                </div>
                <div className='flex justify-between py-[6px] px-[10px]'>
                  <p className='text-neutral-500 font-inter font-medium text-14'>Rate</p>
                  <p className='text-neutral-900 font-inter font-medium text-14'>1 ETH ≈ $3,130.77</p>
                </div>
                <div className='flex justify-between py-[6px] px-[10px]'>
                  <p className='text-neutral-500 font-inter font-medium text-14'>Network</p>
                  <p className='text-neutral-900 font-inter font-medium text-14'>Ethereum</p>
                </div>
                <div className='flex justify-between py-[6px] px-[10px]'>
                  <p className='text-neutral-500 font-inter font-medium text-14'>Route</p>
                  <div className='flex items-center gap-2'>
                    <p className='text-neutral-900 font-inter font-medium text-14'>UniSwap V3</p>
                    <img src='/assets/svg/backRight.svg' alt='' />
                  </div>
                </div>
                <div className='flex justify-between py-[6px] px-[10px]'>
                  <p className='text-neutral-500 font-inter font-medium text-14'>Slippage</p>
                  <div className='flex items-center gap-2 '>
                    <p className='text-neutral-900 font-inter font-medium text-14'>0.5%</p>
                    <img src='/assets/svg/backRight.svg' alt='' />
                  </div>
                </div>
              </div>
            </div>
            <div className='mt-[84px]'>
              <TextButton onClick={() => {
                router.push('/')
                // setActiveTab(tabsData[3])
                }}>Swap ETH to USDC</TextButton>
              <div className='mt-4 flex justify-center gap-1'>
                <img src='/assets/svg/securedsilk.svg' alt='' />
                <p className='text-12 font-medium font-inter text-neutral-500'>Secured by Silk</p>
              </div>
            </div>
          </div>
        </div>
      </RootStyle>
    </div>
  );
}

export default Page;
