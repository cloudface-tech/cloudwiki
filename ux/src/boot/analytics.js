import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || ''
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

export function initAnalytics () {
  if (!POSTHOG_KEY || import.meta.env.SSR) return

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    persistence: 'localStorage',
    loaded: (ph) => {
      if (import.meta.env.DEV) {
        ph.opt_out_capturing()
      }
    }
  })
}

export function trackEvent (event, properties = {}) {
  if (!POSTHOG_KEY || import.meta.env.SSR) return
  posthog.capture(event, properties)
}

export function identifyUser (userId, traits = {}) {
  if (!POSTHOG_KEY || import.meta.env.SSR) return
  posthog.identify(userId, traits)
}
