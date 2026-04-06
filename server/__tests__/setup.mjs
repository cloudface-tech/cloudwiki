/**
 * Global test setup — mock the WIKI global object
 */
import { vi } from 'vitest'

globalThis.WIKI = {
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  config: {
    lang: { code: 'en' },
    auth: {
      autoLogin: false,
      enforce2FA: false
    },
    search: {
      dictOverrides: {}
    },
    mail: {}
  },
  data: {
    reservedPaths: ['_admin', '_assets', '_site', 'login', 'logout', 'register'],
    tsDictMappings: {
      en: 'english',
      pt: 'portuguese',
      es: 'spanish',
      fr: 'french',
      de: 'german'
    }
  },
  version: '3.0.0',
  IS_DEBUG: false,
  db: {},
  auth: {},
  Error: {}
}

globalThis.APOLLO_CLIENT = {
  query: vi.fn(),
  mutate: vi.fn()
}
