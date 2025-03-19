import Network from '@/components/model/Network';
import TokensModal from '@/components/model/TokensModal';
import RootStyle from '@/components/RootStyle';
import StyledImage from '@/components/StyedImage';
import TextButton from '@/components/TextButton';
import clsxm from '@/utils/clsxm';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';

const networks = {
  send: {
    id: 3,
    img: '/assets/images/svg/polygon.svg',
    title: 'Polygon',
  },
  received: {
    id: 5,
    img: '/assets/images/svg/gn.svg',
    title: 'Gnosis',
  },
};

const tokens = {
  send: {
    id: 1,
    img: '/assets/images/svg/USDC.svg',
    title: 'USDC',
    about: 'Ethereum',
    amount: '$50.27',
    percentage: '+0.62%',
  },
  received: {
    id: 3,
    img: '/assets/images/svg/ETH.svg',
    title: 'ETH',
    about: 'Ethereum',
    amount: '$970.10',
    percentage: '+1.05%',
  },
};

export default function Home() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectNetwork, setSelectNetwork] = useState<boolean>(false);
  const [selectToken, setSelectToken] = useState<boolean>(false);
  const [isSend, setIsSend] = useState<null | string>(null);
  const { isConnected, address, connect, disconnect } = useWallet();

  const [networkData, setNetworkData] = useState(networks);
  const [tokensData, setTokensData] = useState(tokens);

  const handleSwap = () => {
    setTokensData({ send: tokensData?.received, received: tokensData?.send });
    setNetworkData({ send: networkData?.received, received: networkData?.send });
  };

  const handleConnectWallet = async () => {
    try {
      if (isConnected) {
        await disconnect();
      } else {
        await connect();
      }
    } catch (error) {
      console.error('Failed to handle wallet connection:', error);
    }
  };

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

        <div className=''>
          <div className=' bg-latest-grey-200 p-5'>
            <p className='text-center text-20 '> Bridge</p>
            <div className='mt-5 bg-white rounded-md p-4 relative'>
              <p className='text-14 font-semibold   text-latest-grey-100'>From</p>
              {/* section1 */}
              <div className='flex justify-between'>
                <div
                  onClick={() => {
                    setSelectNetwork(true);
                    setIsSend('send');
                  }}
                  className='mt-4 flex gap-2 items-center rounded-[12px]  cursor-pointer bg-latest-grey-200 p-[2px] max-w-[172px] '>
                  <StyledImage
                    src={networkData?.send?.img || '/assets/images/svg/ethLogo.svg'}
                    alt=''
                    className='h-6 w-6'
                  />
                  <p className='text-16 font-medium text-latest-black-100  w-[106px]'>{networkData?.send?.title}</p>
                  <StyledImage src='/assets/images/svg/dropDown.svg' alt='' className='h-2.5 w-1.5 p-1.5 mr-1.5 ' />
                </div>
                <div
                  onClick={() => {
                    setSelectToken(true);
                    setIsSend('send');
                  }}
                  className='mt-4 flex gap-2  items-center rounded-md cursor-pointer bg-latest-grey-200 p-[2px]  '>
                  <StyledImage
                    src={tokensData?.send?.img || '/assets/images/svg/ethLogo.svg'}
                    alt=''
                    className='h-6 w-6'
                  />
                  <p className='text-16 font-medium text-latest-black-100  '>{tokensData?.send?.title}</p>
                  <StyledImage src='/assets/images/svg/dropDown.svg' alt='' className='h-2.5 w-1.5 p-1.5 mr-1.5 ' />
                </div>
              </div>
              <hr className=' text-latest-grey-300 my-3' />
              <div className='flex justify-between my-1'>
                <input
                  type='numbers'
                  placeholder='0.00'
                  className=' max-w-[210px] placeholder-latest-grey-400 outline-none bg-[transparent] text-32 font-medium'
                />
                <div className='pr-6'>
                  <p className=' text-latest-grey-500 text-12 font-medium'>Balance:</p>
                  <p className=' text-latest-grey-500 pl-2.5 text-12 font-medium'>0 ETH</p>
                </div>
              </div>
              <div className='flex justify-between mt-2'>
                <p className='text-16 font-medium text-latest-grey-500'>$0.00</p>
                <p className='text-14 font-medium text-latest-black-200  bg-latest-grey-200 px-2.5 rounded-[32px] h-5'>
                  Max
                </p>
              </div>
              <div className='absolute mb-0 bottom-[-30px] left-0 right-0 text-center '>
                <button onClick={handleSwap} className='mx-auto w-10 h-10   '>
                  <StyledImage src='/assets/images/svg/swap.svg' alt='' className='h-10 w-10' />{' '}
                </button>
              </div>
            </div>

            {/* section2 */}
            <div className='mt-2 bg-white rounded-md  p-4'>
              <p className='text-14 font-regular text-latest-grey-100 '>To</p>
              <div className='flex justify-between'>
                <div
                  onClick={() => {
                    setSelectNetwork(true);

                    setIsSend('received');
                  }}
                  className='mt-4 flex gap-2 items-center rounded-[12px] cursor-pointer bg-latest-grey-200  p-[2px] max-w-[172px] '>
                  <StyledImage
                    // src={networkData?.received?.img || '/assets/images/svg/aztec.svg'}
                    src={'/assets/images/svg/aztec.svg'}
                    alt=''
                    className='h-6 w-6'
                  />
                  {/* <p className='text-16 font-medium text-latest-black-100  w-[106px]'>{networkData?.received?.title}</p> */}
                  <p className='text-16 font-medium text-latest-black-100  w-[106px]'>Aztec</p>
                  <StyledImage src='/assets/images/svg/dropDown.svg' alt='' className='h-2.5 w-1.5 p-1.5 mr-1.5 ' />
                </div>
                <div
                  onClick={() => {
                    setSelectToken(true);
                    setIsSend('received');
                  }}
                  className='mt-4 flex gap-2 items-center rounded-md cursor-pointer bg-latest-grey-200  p-[2px]  '>
                  <StyledImage
                    src={tokensData?.received?.img || '/assets/images/svg/ethLogo.svg'}
                    alt=''
                    className='h-6 w-6'
                  />
                  <p className='text-16 font-medium text-latest-black-100 '>{tokensData?.received?.title}</p>
                  <StyledImage src='/assets/images/svg/dropDown.svg' alt='' className='h-2.5 w-1.5 p-1.5 mr-1.5 ' />
                </div>
              </div>
              <hr className=' text-latest-grey-300  my-3' />
              <div className='flex justify-between'>
                <p className='text-14 font-medium text-latest-grey-100 '>You will receive</p>
                <p className='text-black text-14 font-semibold'>0,00 ETH</p>
              </div>
            </div>

            <div
              className={clsxm(
                'rounded-md bg-white mt-4 p-4 transition-all duration-400 ease-in-out',
                isOpen ? 'h-[244px]' : 'h-[54px]',
              )}>
              <button className='flex justify-between font-semibold w-full' onClick={() => setIsOpen(!isOpen)}>
                Transaction breakdown
                <span className=''>
                  <StyledImage
                    src='/assets/images/svg/buttons.svg'
                    className={clsxm('w-6 h-6 ', isOpen && ' transition-transform duration-200 ease-in-out rotate-90')}
                    alt='open'
                  />
                </span>
              </button>
              {isOpen && (
                <div>
                  <div className='mt-4 flex justify-between'>
                    <p className='text-sm font-medium text-latest-grey-700'>Time to Aztec</p>
                    <p className='text-latest-black-300 text-14 font-medium'>~2 mins</p>
                  </div>
                  <div className='mt-[14px] flex justify-between'>
                    <p className='text-sm font-medium text-latest-grey-700'>Net fee</p>
                    <p className='text-latest-black-300 text-14 font-medium'>$ 0.04</p>
                  </div>
                  <div className='mt-[14px] flex justify-between'>
                    <div className='flex gap-1 items-center text-center'>
                      {' '}
                      <p className='text-sm font-medium text-latest-grey-700'>Bridge fee</p>
                      <StyledImage src='/assets/images/svg/iconContainer.svg' alt='' className='h-4 w-4' />
                    </div>
                    <p className=' text-latest-grey-100 text-14 font-medium'>
                      $ 0.01 <span className='text-latest-black-300'> 0.0000029 ETH</span>
                    </p>
                  </div>
                  <div className='mt-[14px] flex justify-between'>
                    <div className='flex gap-1 items-center '>
                      {' '}
                      <p className='text-sm font-medium text-latest-grey-700'>
                        Destination <br /> Gas fee
                      </p>
                      <StyledImage src='/assets/images/svg/iconContainer.svg' alt='' className='h-4 w-4' />
                    </div>
                    <p className=' text-latest-grey-100 text-14 font-medium'>
                      $ 0.03 <span className='text-latest-black-300'> 0.0000103 ETH</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className='bg-white rounded-md  px-5'>
            <div className='py-4  '>
              <TextButton onClick={handleConnectWallet}>
                {isConnected ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Connect Wallet'}
              </TextButton>
            </div>
            <div className='flex   justify-center gap-2 pb-3'>
              <StyledImage src='/assets/images/svg/silk0.4.svg' alt='' className='h-4 w-[14px]' />
              <p className='text-12 font-medium text-latest-grey-600  '>Secured by Human Wallet</p>
            </div>
          </div>
        </div>
      </RootStyle>
    </>
  );
}
