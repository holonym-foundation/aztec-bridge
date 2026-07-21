'use client'

import Link from 'next/link'
import React from 'react'
import { Icon } from '@iconify/react'

interface FooterProps {
  className?: string
}

interface SocialLink {
  label: string
  href: string
  icon: string
}

const SOCIAL_LINKS: SocialLink[] = [
  { label: 'X (Twitter)', href: 'https://x.com/0xHolonym', icon: 'simple-icons:x' },
  { label: 'Bluesky', href: 'https://bsky.app/profile/human.tech', icon: 'simple-icons:bluesky' },
  { label: 'Telegram', href: 'https://t.me/humantechofficial', icon: 'simple-icons:telegram' },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/channel/UCHxAfIjbgcWzYUepyvBdUZQ',
    icon: 'simple-icons:youtube',
  },
  { label: 'Discord', href: 'https://discord.com/invite/zfGqjA5pxU', icon: 'simple-icons:discord' },
  { label: 'GitHub', href: 'https://github.com/holonym-foundation', icon: 'simple-icons:github' },
]

interface TextLink {
  label: string
  href: string
  external?: boolean
}

const RESOURCE_LINKS: TextLink[] = [
  { label: 'Docs', href: '/docs' },
  { label: 'Blog', href: 'https://human.tech/blog', external: true },
  {
    label: 'Press & Media Kit',
    href: 'https://holonym.notion.site/human-tech-Media-Brand-Guidelines-18babe540a8f809f869ef817713db597',
    external: true,
  },
  // NOTE: /privacy and /terms pages are assumed on human.tech and may not exist yet — confirm before shipping.
  { label: 'Privacy Policy', href: 'https://human.tech/privacy', external: true },
  { label: 'Terms of Use', href: 'https://human.tech/terms', external: true },
]

const SocialIcons: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`flex items-center gap-x-4 ${className || ''}`}>
    {SOCIAL_LINKS.map(({ label, href, icon }) => (
      <Link
        key={label}
        href={href}
        target='_blank'
        rel='noopener noreferrer'
        aria-label={label}
        title={label}
        className='text-latest-grey-600 hover:text-shield transition-colors'>
        <Icon icon={icon} width={16} height={16} aria-hidden='true' />
      </Link>
    ))}
  </div>
)

const ResourceLinks: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`flex gap-x-4 gap-y-2 flex-wrap ${className || ''}`}>
    {RESOURCE_LINKS.map(({ label, href, external }) => (
      <Link
        key={label}
        href={href}
        className='text-latest-grey-600 hover:text-black transition-colors'
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {label}
      </Link>
    ))}
  </div>
)

const Footer: React.FC<FooterProps> = ({ className }) => {
  return (
    <footer className={`relative w-full text-xs ${className || ''}`}>
      {/* Desktop Footer */}
      <div className='hidden md:flex justify-between items-center w-full px-10 relative'>
        {/* Left Side Social Icons */}
        <SocialIcons />

        {/* Center Text */}
        <div className='absolute left-1/2 transform -translate-x-1/2 text-latest-grey-700 whitespace-nowrap'>
          © 2025 Human Tech. All rights reserved.
        </div>

        {/* Right Side Links */}
        <ResourceLinks className='justify-end' />
      </div>

      {/* Mobile Footer */}
      <div className='md:hidden flex flex-col items-center w-full px-4 py-6 gap-6'>
        {/* Top Social Icons */}
        <SocialIcons className='justify-center flex-wrap' />

        {/* Middle Resource Links */}
        <ResourceLinks className='justify-center' />

        {/* Bottom Copyright */}
        <div className='text-latest-grey-700 text-center'>
          © 2025 Human Tech. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

export default Footer
