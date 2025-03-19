// /* eslint-disable sonarjs/no-duplicate-string */
// import React, { useState } from 'react';

// import { motion } from 'framer-motion';
// import { useRouter } from 'next/router';

// import StyledImage from '@/components/StyedImage';
// import AccountSettings from '@/section/Settings/AccountSettings';
// import clsxm from '@/utils/clsxm';

// const SIDE_NAVBAR_ITEMS = [
//   {
//     id: 1,
//     imgUrl: '/assets/svg/NetworksLogo.svg',
//     title: 'Networks',
//     imgUrlTwo: '/assets/svg/NewRightArrow.svg',
//   },
//   {
//     id: 2,
//     imgUrl: '/assets/svg/ConnectedAppsLogo.svg',
//     title: 'Connected Apps',
//     imgUrlTwo: '/assets/svg/NewRightArrow.svg',
//   },
//   {
//     id: 3,
//     imgUrl: '/assets/svg/PasswordLogo.svg',
//     title: 'Privacy & Security',
//     imgUrlTwo: '/assets/svg/NewRightArrow.svg',
//   },
//   {
//     id: 4,
//     imgUrl: '/assets/svg/PreferencesLogo.svg',
//     title: 'Preferences',
//     imgUrlTwo: '/assets/svg/NewRightArrow.svg',
//   },
//   {
//     id: 5,
//     imgUrl: '/assets/svg/AddressBookLogo.svg',
//     title: 'Address Book',
//     imgUrlTwo: '/assets/svg/NewRightArrow.svg',
//   }
// ];

// interface IProps {
//   setIsOpen: (value: boolean) => void;
//   isOpen: boolean;
// }

// export default function Sidebar({ setIsOpen, isOpen, }: IProps) {
//   const router = useRouter();
//   const [ isOpenAccountSettings,setIsOpenAccountSettings ] = useState();

//   return (
//     <div>
//       {isOpen && (
//         <div className='w-full h-full left-0 bottom-0 bg-white top-0 right-0 rounded-[12px] absolute z-50'>
//           <motion.div
//             style={{
//               backgroundColor: '#fff',
//               zIndex: '9',
//               paddingBottom: '24px',
//             }}
//             animate={
//               {
//                 // x: !isOpen ? -300 : 10,
//               }
//             }
//             transition={{
//               stiffness: 200,
//               duration: 0.2,
//             }}
//           >
//             <div className='rounded-full flex items-center justify-between '>
//               <span></span>

//               <p className='text-neutral-500 text-16 font-medium '>Settings</p>

//               <div className='bg-neutral-200 hover:bg-neutral-300 rounded-full p-1 cursor-pointer '>
//                 <StyledImage
//                   src='/assets/svg/GrayCloseIcon.svg'
//                   className='w-[22px] h-[22px] cursor-pointer '
//                   onClick={() => {
//                     setIsOpen(!isOpen);
//                   }}
//                   alt=''
//                 />
//               </div>
//             </div>

//             <div
//               style={{
//                 boxShadow: ' 0px 2px 40px 0px rgba(0, 0, 0, 0.06)',
//               }}
//               className=' bg-base-300 rounded-[12px] p-1 mt-3 '
//             >
//               <div className='flex items-center justify-between rounded-[12px] cursor-pointer hover:bg-neutral-200 gap-2 w-full px-2 py-[10px] '>
//                 <div className='flex items-center gap-2 '>
//                   <div
//                     className={clsxm(
//                       'w-12 h-12 flex items-center justify-center bg-silk-400 rounded-full'
//                     )}
//                   >
//                     <span className='text-neutral-main font-medium text-[28px]'>
//                       A
//                     </span>
//                   </div>

//                   <div>
//                     <p className='text-16 font-inter font-medium '>Amelia</p>

//                     <p className='text-12 font-inter font-medium text-gray '>
//                       0xB5D...e643
//                     </p>
//                   </div>
//                 </div>

//                 <StyledImage
//                   src='/assets/svg/NewRightArrow.svg'
//                   alt=''
//                   className='w-[22px] h-[22px] '
//                 />
//               </div>

//               <button
//                 onClick={() => setIsOpenAccountSettings(!isOpenAccountSettings)}
//                 className='flex items-center w-full gap-2 bg-base-400 rounded-[12px] py-2 px-[10px] mt-1 cursor-pointer '
//               >
//                 <StyledImage
//                   src='/assets/svg/BlueRightArrow.svg'
//                   alt=''
//                   className='w-[22px] h-[22px] '
//                 />

//                 <p className='text-16 font-medium leading-6 text-blue-200 '>
//                   Finish account setup
//                 </p>
//               </button>
//             </div>

//             <div
//               style={{
//                 boxShadow: '0px 2px 40px 0px rgba(0, 0, 0, 0.06',
//               }}
//               className='mt-4 bg-base-300 p-1 rounded-[16px] '
//             >
//               {SIDE_NAVBAR_ITEMS.map((item, idx) => {
//                 return (
//                   <div
//                     key={idx}
//                     className='flex items-center justify-between p-[10px] hover:bg-neutral-200 rounded-[12px] cursor-pointer '
//                   >
//                     <div className='flex items-center gap-2  '>
//                       <StyledImage
//                         src={item.imgUrl}
//                         className='w-5 h-5 '
//                         alt=''
//                       />

//                       <p className='text-16 font-medium font-inter text-neutral-700 '>
//                         {item.title}
//                       </p>
//                     </div>

//                     <StyledImage
//                       src={item.imgUrlTwo}
//                       alt=''
//                       className='w-5 h-5 '
//                     />
//                   </div>
//                 );
//               })}
//             </div>

//             <div
//               style={{
//                 boxShadow: '0px 2px 40px 0px rgba(0, 0, 0, 0.06',
//               }}
//               className='mt-4 bg-base-300 p-1 rounded-[16px] '
//             >
//               <div className='flex items-center justify-between p-2 hover:bg-neutral-200 rounded-[8px] cursor-pointer '>
//                 <div className='flex items-center gap-2 '>
//                   <StyledImage
//                     src='/assets/svg/HelpLogo.svg'
//                     alt=''
//                     className='w-5 h-5 '
//                   />

//                   <p className='text-16 font-medium font-inter text-neutral-700  '>
//                     Help & Support{' '}
//                   </p>
//                 </div>

//                 <StyledImage
//                   src='/assets/svg/NewRightUpArrow.svg'
//                   alt=''
//                   className='w-5 h-5 '
//                 />
//               </div>

//               <div className='flex items-center gap-2 p-2 hover:bg-neutral-200 rounded-[8px] cursor-pointer '>
//                 <StyledImage
//                   src='/assets/svg/AboutSilkLogo.svg'
//                   alt=''
//                   className='w-5 h-5 '
//                 />

//                 <p className='text-16 font-medium font-inter text-neutral-700  '>
//                   About Silk{' '}
//                 </p>
//               </div>
//             </div>

//             <AccountSettings
//               isOpenAccountSettings={isOpenAccountSettings}
//               setIsOpenAccountSettings={setIsOpenAccountSettings}
//             />
//           </motion.div>
//         </div>
//       )}
//     </div>
//   );
// }
