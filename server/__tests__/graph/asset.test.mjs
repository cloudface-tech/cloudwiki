import { describe, it, expect, vi, beforeEach } from 'vitest'
import resolvers from '../../graph/resolvers/asset.mjs'

const { Query, Mutation } = resolvers

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext (overrides = {}) {
  return {
    req: {
      user: { id: 42 },
      isAuthenticated: true,
      ...overrides.req
    },
    ...overrides
  }
}

function makeQueryChain (finalValue) {
  const chain = {
    findById: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    patch: vi.fn().mockReturnThis(),
    deleteById: vi.fn().mockReturnThis(),
    withGraphFetched: vi.fn().mockReturnThis(),
    first: vi.fn().mockReturnThis(),
    then (resolve, reject) {
      return Promise.resolve(finalValue).then(resolve, reject)
    }
  }
  return chain
}

// ---------------------------------------------------------------------------
// Query: assetById
// ---------------------------------------------------------------------------

describe('Query.assetById', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('throws ERR_ASSET_NOT_FOUND when asset does not exist', async () => {
    WIKI.db.assets = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockReturnThis(),
        withGraphFetched: vi.fn().mockResolvedValue(null)
      })
    }
    await expect(Query.assetById({}, { id: 'nonexistent' }, makeContext())).rejects.toThrow('ERR_ASSET_NOT_FOUND')
  })

  it('throws ERR_FORBIDDEN when user lacks read:assets permission', async () => {
    const asset = {
      id: 'a-1',
      tree: { folderPath: '', fileName: 'image.png' }
    }
    WIKI.db.assets = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockReturnThis(),
        withGraphFetched: vi.fn().mockResolvedValue(asset)
      })
    }
    WIKI.auth.checkAccess.mockReturnValue(false)

    await expect(Query.assetById({}, { id: 'a-1' }, makeContext())).rejects.toThrow('ERR_FORBIDDEN')
  })

  it('returns asset when access granted (root-level file)', async () => {
    const asset = {
      id: 'a-1',
      fileName: 'image.png',
      tree: { folderPath: '', fileName: 'image.png' }
    }
    WIKI.db.assets = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockReturnThis(),
        withGraphFetched: vi.fn().mockResolvedValue(asset)
      })
    }
    WIKI.auth.checkAccess.mockReturnValue(true)

    const result = await Query.assetById({}, { id: 'a-1' }, makeContext())
    expect(result.id).toBe('a-1')
    expect(WIKI.auth.checkAccess).toHaveBeenCalledWith(
      expect.anything(),
      ['read:assets'],
      { path: 'image.png' }
    )
  })

  it('returns asset and builds path with folder prefix when folderPath is set', async () => {
    // folderPath uses dot-encoded paths — decodeTreePath converts them
    const asset = {
      id: 'a-2',
      fileName: 'report.pdf',
      tree: { folderPath: 'documents.2025', fileName: 'report.pdf' }
    }
    WIKI.db.assets = {
      query: vi.fn().mockReturnValue({
        findById: vi.fn().mockReturnThis(),
        withGraphFetched: vi.fn().mockResolvedValue(asset)
      })
    }
    WIKI.auth.checkAccess.mockReturnValue(true)

    const result = await Query.assetById({}, { id: 'a-2' }, makeContext())
    expect(result.id).toBe('a-2')
    // checkAccess should have been called with a path containing the file name
    expect(WIKI.auth.checkAccess).toHaveBeenCalledWith(
      expect.anything(),
      ['read:assets'],
      expect.objectContaining({ path: expect.stringContaining('report.pdf') })
    )
  })
})

// ---------------------------------------------------------------------------
// Mutation: renameAsset
// ---------------------------------------------------------------------------

describe('Mutation.renameAsset', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.events = { outbound: { emit: vi.fn() } }
  })

  it('returns error when asset not found', async () => {
    WIKI.db.assets = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(null) })
    }
    WIKI.db.tree = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(null) })
    }

    const result = await Mutation.renameAsset({}, { id: 'bad-id', fileName: 'new.png' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_INVALID_ASSET/)
  })

  it('returns error when file extension does not match', async () => {
    const asset = { id: 'a-1', fileExt: '.png' }
    const treeItem = { id: 'a-1', folderPath: '', fileName: 'image.png' }
    WIKI.db.assets = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(asset) })
    }
    WIKI.db.tree = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(treeItem) })
    }

    const result = await Mutation.renameAsset({}, { id: 'a-1', fileName: 'image.jpg' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_ASSET_EXT_MISMATCH/)
  })

  it('returns error when new filename would become a dotfile', async () => {
    const asset = { id: 'a-1', fileExt: '.png' }
    const treeItem = { id: 'a-1', folderPath: '', fileName: 'image.png' }
    WIKI.db.assets = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(asset) })
    }
    WIKI.db.tree = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(treeItem) })
    }

    // filename is just ".png" — name portion is empty
    const result = await Mutation.renameAsset({}, { id: 'a-1', fileName: '.png' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_ASSET_INVALID_DOTFILE/)
  })

  it('returns error when renamed file already exists (collision)', async () => {
    const asset = { id: 'a-1', fileExt: '.png' }
    const treeItem = { id: 'a-1', folderPath: '', fileName: 'image.png' }
    const collision = { id: 'a-2', fileName: 'new-name.png' }

    WIKI.db.assets = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(asset) })
    }
    WIKI.db.tree = {
      query: vi.fn()
        .mockReturnValueOnce({ findById: vi.fn().mockResolvedValue(treeItem) })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(collision)
        })
    }

    const result = await Mutation.renameAsset({}, { id: 'a-1', fileName: 'new-name.png' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_ASSET_ALREADY_EXISTS/)
  })

  it('returns error when user lacks manage:assets on source path', async () => {
    const asset = { id: 'a-1', fileExt: '.png' }
    const treeItem = { id: 'a-1', folderPath: '', fileName: 'image.png' }

    WIKI.db.assets = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(asset) })
    }
    WIKI.db.tree = {
      query: vi.fn()
        .mockReturnValueOnce({ findById: vi.fn().mockResolvedValue(treeItem) })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null)
        })
    }
    WIKI.auth.checkAccess.mockReturnValue(false)

    const result = await Mutation.renameAsset({}, { id: 'a-1', fileName: 'renamed.png' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_FORBIDDEN/)
  })

  it('renames asset and emits purgeItemCache on success', async () => {
    const asset = { id: 'a-1', fileExt: '.png' }
    const treeItem = { id: 'a-1', folderPath: '', fileName: 'image.png', hash: 'old-hash' }

    const assetPatchChain = { patch: vi.fn().mockReturnThis(), findById: vi.fn().mockResolvedValue(1) }
    const treePatchChain = { patch: vi.fn().mockReturnThis(), findById: vi.fn().mockResolvedValue(1) }

    let assetCallCount = 0
    WIKI.db.assets = {
      query: vi.fn(() => {
        assetCallCount++
        if (assetCallCount === 1) return { findById: vi.fn().mockResolvedValue(asset) }
        return assetPatchChain
      })
    }

    let treeCallCount = 0
    WIKI.db.tree = {
      query: vi.fn(() => {
        treeCallCount++
        if (treeCallCount === 1) return { findById: vi.fn().mockResolvedValue(treeItem) }
        if (treeCallCount === 2) return { where: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) }
        return treePatchChain
      })
    }

    WIKI.auth.checkAccess.mockReturnValue(true)

    const result = await Mutation.renameAsset({}, { id: 'a-1', fileName: 'renamed.png' }, makeContext())
    expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('purgeItemCache', expect.any(String))
    expect(result.operation.succeeded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mutation: deleteAsset
// ---------------------------------------------------------------------------

describe('Mutation.deleteAsset', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
    WIKI.events = { outbound: { emit: vi.fn() } }
  })

  it('returns error when tree item not found', async () => {
    WIKI.db.tree = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(null) })
    }

    const result = await Mutation.deleteAsset({}, { id: 'bad-id' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_INVALID_ASSET/)
  })

  it('returns error when user lacks manage:assets permission', async () => {
    const treeItem = { id: 'a-1', folderPath: '', fileName: 'image.png', hash: 'abc123' }
    WIKI.db.tree = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(treeItem) })
    }
    WIKI.auth.checkAccess.mockReturnValue(false)

    const result = await Mutation.deleteAsset({}, { id: 'a-1' }, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_FORBIDDEN/)
  })

  it('deletes asset and tree item, emits purgeItemCache on success', async () => {
    const treeItem = { id: 'a-1', folderPath: '', fileName: 'image.png', hash: 'abc123' }
    const assetDeleteChain = { deleteById: vi.fn().mockResolvedValue(1) }
    const treeDeleteChain = { deleteById: vi.fn().mockResolvedValue(1) }

    let treeCallCount = 0
    WIKI.db.tree = {
      query: vi.fn(() => {
        treeCallCount++
        if (treeCallCount === 1) return { findById: vi.fn().mockResolvedValue(treeItem) }
        return treeDeleteChain
      })
    }
    WIKI.db.assets = {
      query: vi.fn().mockReturnValue(assetDeleteChain)
    }
    WIKI.auth.checkAccess.mockReturnValue(true)

    const result = await Mutation.deleteAsset({}, { id: 'a-1' }, makeContext())
    expect(assetDeleteChain.deleteById).toHaveBeenCalledWith('a-1')
    expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('purgeItemCache', 'abc123')
    expect(result.operation.succeeded).toBe(true)
  })

  it('builds path correctly for asset in a folder', async () => {
    const treeItem = { id: 'a-2', folderPath: 'photos.2025', fileName: 'vacation.jpg', hash: 'xyz' }
    WIKI.db.tree = {
      query: vi.fn().mockReturnValue({ findById: vi.fn().mockResolvedValue(treeItem) })
    }
    WIKI.auth.checkAccess.mockReturnValue(false) // force path check to fire

    await Mutation.deleteAsset({}, { id: 'a-2' }, makeContext())
    expect(WIKI.auth.checkAccess).toHaveBeenCalledWith(
      expect.anything(),
      ['manage:assets'],
      expect.objectContaining({ path: expect.stringContaining('vacation.jpg') })
    )
  })
})

// ---------------------------------------------------------------------------
// Mutation: flushTempUploads
// ---------------------------------------------------------------------------

describe('Mutation.flushTempUploads', () => {
  beforeEach(() => {
    WIKI.auth.checkAccess = vi.fn()
  })

  it('returns error when user lacks manage:system permission', async () => {
    WIKI.auth.checkAccess.mockReturnValue(false)
    const result = await Mutation.flushTempUploads({}, {}, makeContext())
    expect(result.operation.succeeded).toBe(false)
    expect(result.operation.message).toMatch(/ERR_FORBIDDEN/)
  })

  it('flushes temp uploads and returns success', async () => {
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.db.assets = { flushTempUploads: vi.fn().mockResolvedValue(undefined) }

    const result = await Mutation.flushTempUploads({}, {}, makeContext())
    expect(WIKI.db.assets.flushTempUploads).toHaveBeenCalledOnce()
    expect(result.operation.succeeded).toBe(true)
  })
})
