import { datadogLogs } from '@datadog/browser-logs'
import { datadogRum } from '@datadog/browser-rum'

export function init() {
  // Only initialize on client-side
  if (typeof window === 'undefined') {
    return
  }

  if (process.env.NODE_ENV === 'development') {
    return
  }

  datadogRum.init({
    applicationId: process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID!,
    clientToken: process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN!,
    site: process.env.NEXT_PUBLIC_DATADOG_SITE!,
    service: process.env.NEXT_PUBLIC_DATADOG_SERVICE!,
    env: process.env.NEXT_PUBLIC_DATADOG_ENV ?? process?.env?.NODE_ENV ?? 'production',
    // Specify a version number to identify the deployed version of your application in Datadog
    // version: '1.0.0',
    sessionSampleRate: 100,
    premiumSampleRate: 100,
    trackUserInteractions: true,
    defaultPrivacyLevel: 'mask-user-input'
  })

  datadogLogs.init({
    clientToken: process.env.NEXT_PUBLIC_DATADOG_LOGS_CLIENT_TOKEN!,
    site: process.env.NEXT_PUBLIC_DATADOG_SITE!,
    service: process.env.NEXT_PUBLIC_DATADOG_SERVICE!,
    env: process.env.NEXT_PUBLIC_DATADOG_ENV ?? process?.env?.NODE_ENV ?? 'production',
    forwardErrorsToLogs: true,
    forwardConsoleLogs: ['error'],
    sessionSampleRate: 100
  })

  datadogRum.startSessionReplayRecording()
}

export function logInfo(
  message: string,
  messageContext?: object | undefined,
  error?: Error | undefined
) {
  // Only log on client-side
  if (typeof window === 'undefined') {
    console.log('logInfo (server):', message, messageContext)
    return
  }

  datadogLogs.logger.info(
    message,
    {
      ...messageContext,
      src: 'aztec-bridge'
    },
    error
  )
}

export function logError(
  message: string,
  messageContext?: object | undefined,
  error?: Error | undefined
) {
  // Only log on client-side
  if (typeof window === 'undefined') {
    console.error('logError (server):', message, messageContext, error)
    return
  }

  datadogLogs.logger.error(
    message,
    {
      ...messageContext,
      src: 'aztec-bridge'
    },
    error as Error
  )
}
