import { describe, it, expect } from 'vitest'
import WIKI_ERROR from '../../helpers/error.mjs'

describe('error helpers', () => {
  describe('named error constructors', () => {
    const namedErrors = [
      ['AuthLoginFailed', 'Invalid email / username or password.'],
      ['AuthAccountBanned', 'Your account has been disabled.'],
      ['AuthAccountAlreadyExists', 'An account already exists using this email address.'],
      ['AuthAccountNotVerified', 'You must verify your account before your can login.'],
      ['AuthGenericError', 'An unexpected error occured during login.'],
      ['AuthPasswordInvalid', 'Password is incorrect.'],
      ['AuthProviderInvalid', 'Invalid authentication provider.'],
      ['AuthRegistrationDisabled', 'Registration is disabled. Contact your system administrator.'],
      ['AuthRegistrationDomainUnauthorized', 'You are not authorized to register. Your domain is not whitelisted.'],
      ['AuthRequired', 'You must be authenticated to access this resource.'],
      ['AuthTFAFailed', 'Incorrect TFA Security Code.'],
      ['AuthTFAInvalid', 'Invalid TFA Security Code or Login Token.'],
      ['AuthValidationTokenInvalid', 'Invalid validation token.'],
      ['PageNotFound', 'This page does not exist.'],
      ['PageCreateForbidden', 'You are not authorized to create this page.'],
      ['PageDeleteForbidden', 'You are not authorized to delete this page.'],
      ['PageGenericError', 'An unexpected error occured during a page operation.'],
      ['PageDuplicateCreate', 'Cannot create this page because an entry already exists at the same path.'],
      ['PageEmptyContent', 'Page content cannot be empty.'],
      ['PageHistoryForbidden', 'You are not authorized to view the history of this page.'],
      ['PageIllegalPath', 'Page path cannot contains illegal characters.'],
      ['PageMoveForbidden', 'You are not authorized to move this page.'],
      ['PagePathCollision', 'Destination page path already exists.'],
      ['PageRestoreForbidden', 'You are not authorized to restore this page version.'],
      ['PageUpdateForbidden', 'You are not authorized to update this page.'],
      ['PageViewForbidden', 'You are not authorized to view this page.'],
      ['UserNotFound', 'This user does not exist.'],
      ['UserCreationFailed', 'An unexpected error occured during user creation.'],
      ['UserDeleteForeignConstraint', 'Cannot delete user because of content relational constraints.'],
      ['UserDeleteProtected', 'Cannot delete a protected system account.'],
      ['AssetDeleteForbidden', 'You are not authorized to delete this asset.'],
      ['AssetFolderExists', 'An asset folder with the same name already exists.'],
      ['AssetGenericError', 'An unexpected error occured during asset operation.'],
      ['AssetInvalid', 'This asset does not exist or is invalid.'],
      ['AssetRenameCollision', 'An asset with the same filename in the same folder already exists.'],
      ['AssetRenameForbidden', 'You are not authorized to rename this asset.'],
      ['AssetRenameInvalid', 'The new asset filename is invalid.'],
      ['AssetRenameInvalidExt', 'The file extension cannot be changed on an existing asset.'],
      ['AssetRenameTargetForbidden', 'You are not authorized to rename this asset to the requested name.'],
      ['CommentContentMissing', 'Comment content is missing or too short.'],
      ['CommentGenericError', 'An unexpected error occured.'],
      ['CommentManageForbidden', 'You are not authorized to manage comments on this page.'],
      ['CommentNotFound', 'This comment does not exist.'],
      ['CommentPostForbidden', 'You are not authorized to post a comment on this page.'],
      ['CommentViewForbidden', 'You are not authorized to view comments for this page.'],
      ['BruteInstanceIsInvalid', 'Invalid Brute Force Instance.'],
      ['BruteTooManyAttempts', 'Too many attempts! Try again later.'],
      ['InputInvalid', 'Input data is invalid.'],
      ['LocaleGenericError', 'An unexpected error occured during locale operation.'],
      ['LocaleInvalidNamespace', 'Invalid locale or namespace.'],
      ['MailGenericError', 'An unexpected error occured during mail operation.'],
      ['MailInvalidRecipient', 'The recipient email address is invalid.'],
      ['MailNotConfigured', 'The mail configuration is incomplete or invalid.'],
      ['MailTemplateFailed', 'Mail template failed to load.'],
      ['SearchActivationFailed', 'Search Engine activation failed.'],
      ['SearchGenericError', 'An unexpected error occured during search operation.'],
      ['SystemGenericError', 'An unexpected error occured.'],
      ['SystemSSLDisabled', 'SSL is not enabled.'],
      ['SystemSSLLEUnavailable', "Let's Encrypt is not initialized."],
      ['SystemSSLRenewInvalidProvider', 'Current provider does not support SSL certificate renewal.']
    ]

    for (const [name, defaultMessage] of namedErrors) {
      it(`${name} is a constructor`, () => {
        expect(WIKI_ERROR[name]).toBeDefined()
        expect(typeof WIKI_ERROR[name]).toBe('function')
      })

      it(`${name} instance has correct name`, () => {
        const err = new WIKI_ERROR[name]()
        expect(err.name).toBe(name)
      })

      it(`${name} instance has default message`, () => {
        const err = new WIKI_ERROR[name]()
        expect(err.message).toBe(defaultMessage)
      })

      it(`${name} is an instance of Error`, () => {
        const err = new WIKI_ERROR[name]()
        expect(err).toBeInstanceOf(Error)
      })
    }
  })

  describe('Custom error factory', () => {
    it('creates a named custom error constructor', () => {
      const MyError = WIKI_ERROR.Custom('MyCustomError', 'custom message')
      expect(typeof MyError).toBe('function')
    })

    it('custom error instance has correct name', () => {
      const MyError = WIKI_ERROR.Custom('SpecialError', 'special')
      const err = new MyError()
      expect(err.name).toBe('SpecialError')
    })

    it('custom error instance has provided message', () => {
      const MyError = WIKI_ERROR.Custom('MsgError', 'my message')
      const err = new MyError()
      expect(err.message).toBe('my message')
    })

    it('custom error instance is an Error', () => {
      const MyError = WIKI_ERROR.Custom('AnotherError', 'another')
      const err = new MyError()
      expect(err).toBeInstanceOf(Error)
    })
  })
})
