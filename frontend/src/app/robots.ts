import type { MetadataRoute } from 'next'

const SITE_URL = 'https://shield.human.tech'

// Transactional app states carry no indexable content and can expose tx params in URLs.
const APP_STATE_PATHS = ['/progress', '/claim-fuel', '/complete', '/fee-juice', '/activity', '/api/']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: APP_STATE_PATHS,
      },
      {
        // Explicitly welcome AI crawlers so the /docs guides are citable by agents.
        userAgent: [
          'GPTBot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'ClaudeBot',
          'Claude-Web',
          'PerplexityBot',
          'Google-Extended',
          'CCBot',
        ],
        allow: '/',
        disallow: APP_STATE_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
