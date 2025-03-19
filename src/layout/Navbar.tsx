/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */

import { useRouter } from 'next/navigation';

// import Networks from '@/components/dropdown/Networks';
import StyledImage from '@/components/StyedImage';

// import Sidebar from './Sidebar';

export default function Navbar({ title, }: any) {
  // const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <div className='flex items-center justify-between pb-6'>
      {/* <Networks /> */}

      <p className='text-18 font-medium '>{title}</p>

      <div className='bg-neutral-200 cursor-pointer hover:bg-neutral-300 p-1 rounded-full w-fit'>
        <StyledImage
          onClick={() => router.push('/settings')}
          src='/assets/svg/DescDots.svg'
          alt=''
          className=' h-[22px] w-[22px]'
        />

        {/* <Sidebar
          isOpen={isOpen}
          setIsOpen={setIsOpen}
        /> */}
      </div>
    </div>
  );
}
