/**
 * Tests for server/core/mail.mjs
 * Mocks nodemailer and @vue-email/compiler to avoid SMTP/filesystem I/O.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mocks declared before module import ---

const mockSendMail = vi.fn()
const mockCreateTransport = vi.fn(() => ({ sendMail: mockSendMail }))

vi.mock('nodemailer', () => ({
  default: { createTransport: mockCreateTransport }
}))

const mockRender = vi.fn()
const mockVueEmailConfig = vi.fn(() => ({ render: mockRender }))

vi.mock('@vue-email/compiler', () => ({
  config: mockVueEmailConfig
}))

// Import after mocks are declared
const { default: mail } = await import('../../core/mail.mjs')

describe('mail.init', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset transport between tests
    mail.transport = null
    mail.vueEmail = null

    WIKI.SERVERPATH = '/fake/server'
    WIKI.config.mail = {}
  })

  it('sets transport to null and logs warning when host is empty', () => {
    WIKI.config.mail = { host: '' }
    mail.init()
    expect(mail.transport).toBeNull()
    expect(WIKI.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Mail is not setup'))
  })

  it('sets transport to null when host is too short (<=2 chars)', () => {
    WIKI.config.mail = { host: 'ab' }
    mail.init()
    expect(mail.transport).toBeNull()
  })

  it('creates transport when host is valid', () => {
    WIKI.config.mail = {
      host: 'smtp.example.com',
      port: 587,
      name: 'wiki',
      secure: false,
      verifySSL: true,
      defaultBaseURL: 'https://wiki.example.com'
    }
    mail.init()
    expect(mockCreateTransport).toHaveBeenCalledOnce()
    expect(mail.transport).not.toBeNull()
  })

  it('includes auth block when user is set', () => {
    WIKI.config.mail = {
      host: 'smtp.example.com',
      port: 587,
      name: 'wiki',
      secure: false,
      verifySSL: true,
      user: 'user@example.com',
      pass: 'secret',
      defaultBaseURL: 'https://wiki.example.com'
    }
    mail.init()
    const conf = mockCreateTransport.mock.calls[0][0]
    expect(conf.auth).toMatchObject({ user: 'user@example.com', pass: 'secret' })
  })

  it('omits auth block when user is empty', () => {
    WIKI.config.mail = {
      host: 'smtp.example.com',
      port: 587,
      name: 'wiki',
      secure: false,
      verifySSL: true,
      user: '',
      defaultBaseURL: 'https://wiki.example.com'
    }
    mail.init()
    const conf = mockCreateTransport.mock.calls[0][0]
    expect(conf.auth).toBeUndefined()
  })

  it('includes DKIM config when useDKIM is true', () => {
    WIKI.config.mail = {
      host: 'smtp.example.com',
      port: 587,
      name: 'wiki',
      secure: false,
      verifySSL: true,
      useDKIM: true,
      dkimDomainName: 'example.com',
      dkimKeySelector: 'mail',
      dkimPrivateKey: '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----',
      defaultBaseURL: 'https://wiki.example.com'
    }
    mail.init()
    const conf = mockCreateTransport.mock.calls[0][0]
    expect(conf.dkim).toMatchObject({
      domainName: 'example.com',
      keySelector: 'mail'
    })
  })

  it('sets rejectUnauthorized to true when verifySSL is true', () => {
    WIKI.config.mail = {
      host: 'smtp.example.com',
      port: 587,
      name: 'wiki',
      secure: true,
      verifySSL: true,
      defaultBaseURL: 'https://wiki.example.com'
    }
    mail.init()
    const conf = mockCreateTransport.mock.calls[0][0]
    expect(conf.tls.rejectUnauthorized).toBe(true)
  })

  it('sets rejectUnauthorized to false when verifySSL is false', () => {
    WIKI.config.mail = {
      host: 'smtp.example.com',
      port: 587,
      name: 'wiki',
      secure: false,
      verifySSL: false,
      defaultBaseURL: 'https://wiki.example.com'
    }
    mail.init()
    const conf = mockCreateTransport.mock.calls[0][0]
    expect(conf.tls.rejectUnauthorized).toBe(false)
  })

  it('returns this (for chaining)', () => {
    WIKI.config.mail = { host: '' }
    const result = mail.init()
    expect(result).toBe(mail)
  })
})

describe('mail.send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mail.transport = null
    mail.vueEmail = { render: mockRender }
    WIKI.config.mail = {
      senderName: 'CloudWiki',
      senderEmail: 'no-reply@example.com'
    }
  })

  it('throws ERR_MAIL_NOT_CONFIGURED when transport is null', async () => {
    mail.transport = null
    await expect(mail.send({ to: 'a@b.com', subject: 'Test', template: 'welcome', data: {} }))
      .rejects.toThrow('ERR_MAIL_NOT_CONFIGURED')
  })

  it('uses "CloudWiki" as x-mailer header', async () => {
    mail.transport = { sendMail: mockSendMail }
    mockRender.mockResolvedValue({ html: '<p>Hello</p>', text: 'Hello' })
    mockSendMail.mockResolvedValue({ messageId: 'abc123' })

    await mail.send({ to: 'user@example.com', subject: 'Hello', template: 'welcome', data: {} })

    const callArgs = mockSendMail.mock.calls[0][0]
    expect(callArgs.headers['x-mailer']).toBe('CloudWiki')
  })

  it('sends to correct recipient', async () => {
    mail.transport = { sendMail: mockSendMail }
    mockRender.mockResolvedValue('<p>Hello</p>')
    mockSendMail.mockResolvedValue({})

    await mail.send({ to: 'recipient@example.com', subject: 'Hi', template: 'test', data: {} })

    expect(mockSendMail.mock.calls[0][0].to).toBe('recipient@example.com')
  })

  it('sends with correct subject', async () => {
    mail.transport = { sendMail: mockSendMail }
    mockRender.mockResolvedValue('<p>body</p>')
    mockSendMail.mockResolvedValue({})

    await mail.send({ to: 'x@y.com', subject: 'My Subject', template: 'test', data: {} })

    expect(mockSendMail.mock.calls[0][0].subject).toBe('My Subject')
  })

  it('formats from field with senderName and senderEmail', async () => {
    mail.transport = { sendMail: mockSendMail }
    mockRender.mockResolvedValue('<p>body</p>')
    mockSendMail.mockResolvedValue({})

    await mail.send({ to: 'x@y.com', subject: 'Test', template: 'test', data: {} })

    expect(mockSendMail.mock.calls[0][0].from).toBe('"CloudWiki" <no-reply@example.com>')
  })
})

describe('mail.loadTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mail.vueEmail = { render: mockRender }
  })

  it('returns html string from render result object', async () => {
    mockRender.mockResolvedValue({ html: '<h1>Welcome</h1>', text: 'Welcome' })
    const result = await mail.loadTemplate('welcome', {})
    expect(result).toBe('<h1>Welcome</h1>')
  })

  it('returns render result directly when it is already a string', async () => {
    mockRender.mockResolvedValue('<p>direct string</p>')
    const result = await mail.loadTemplate('welcome', {})
    expect(result).toBe('<p>direct string</p>')
  })

  it('throws ERR_MAIL_RENDER_FAILED when render rejects', async () => {
    mockRender.mockRejectedValue(new Error('template not found'))
    await expect(mail.loadTemplate('nonexistent', {})).rejects.toThrow('ERR_MAIL_RENDER_FAILED')
  })

  it('calls render with correct template name', async () => {
    mockRender.mockResolvedValue({ html: '', text: '' })
    await mail.loadTemplate('password-reset', { user: 'bob' })
    expect(mockRender).toHaveBeenCalledWith('password-reset.vue', { props: { user: 'bob' } })
  })
})
