import _ from 'lodash-es'
import { generateError, generateSuccess } from '../../helpers/graph.mjs'
import { v4 as uuid } from 'uuid'

export default {
  Query: {
    async storageTargets (obj, args, context, info) {
      const dbTargets = await WIKI.db.storage.getTargets({ siteId: args.siteId })
      // targets = _.sortBy(targets.map(tgt => {
      //   const targetInfo = _.find(WIKI.data.storage, ['module', tgt.key]) || {}
      //   return {
      //     ...targetInfo,
      //     ...tgt,
      //     hasSchedule: (targetInfo.schedule !== false),
      //     syncInterval: targetInfo.syncInterval || targetInfo.schedule || 'P0D',
      //     syncIntervalDefault: targetInfo.schedule,
      //     config: _.sortBy(_.transform(tgt.config, (res, value, key) => {
      //       const configData = _.get(targetInfo.props, key, false)
      //       if (configData) {
      //         res.push({
      //           key,
      //           value: JSON.stringify({
      //             ...configData,
      //             value: (configData.sensitive && value.length > 0) ? '********' : value
      //           })
      //         })
      //       }
      //     }, []), 'key')
      //   }
      // }), ['title', 'key'])
      return _.sortBy(WIKI.storage.defs.map(md => {
        const dbTarget = dbTargets.find(tg => tg.module === md.key)
        return {
          id: dbTarget?.id ?? uuid(),
          isEnabled: dbTarget?.isEnabled ?? false,
          module: md.key,
          title: md.title,
          description: md.description,
          icon: md.icon,
          banner: md.banner,
          vendor: md.vendor,
          website: md.website,
          contentTypes: {
            activeTypes: dbTarget?.contentTypes?.activeTypes ?? md.contentTypes.defaultTypesEnabled,
            largeThreshold: dbTarget?.contentTypes?.largeThreshold ?? md.contentTypes.defaultLargeThreshold
          },
          assetDelivery: {
            isStreamingSupported: md?.assetDelivery?.isStreamingSupported ?? false,
            isDirectAccessSupported: md?.assetDelivery?.isDirectAccessSupported ?? false,
            streaming: dbTarget?.assetDelivery?.streaming ?? md?.assetDelivery?.defaultStreamingEnabled ?? false,
            directAccess: dbTarget?.assetDelivery?.directAccess ?? md?.assetDelivery?.defaultDirectAccessEnabled ?? false
          },
          versioning: {
            isSupported: md?.versioning?.isSupported ?? false,
            isForceEnabled: md?.versioning?.isForceEnabled ?? false,
            enabled: dbTarget?.versioning?.enabled ?? md?.versioning?.defaultEnabled ?? false
          },
          sync: {},
          status: {},
          setup: {
            handler: md?.setup?.handler,
            state: dbTarget?.state?.setup ?? 'notconfigured',
            values: md.setup?.handler ?
              _.transform(md.setup.defaultValues,
                (r, v, k) => {
                  r[k] = dbTarget?.config?.[k] ?? v
                }, {}) :
              {}
          },
          config: _.transform(md.props, (r, v, k) => {
            const cfValue = dbTarget?.config?.[k] ?? v.default
            r[k] = {
              ...v,
              value: v.sensitive && cfValue ? '********' : cfValue,
              ...v.enum && {
                enum: v.enum.map(o => {
                  if (o.indexOf('|') > 0) {
                    const oParsed = o.split('|')
                    return {
                      value: oParsed[0],
                      label: oParsed[1]
                    }
                  } else {
                    return {
                      value: o,
                      label: o
                    }
                  }
                })
              }
            }
          }, {}),
          actions: md.actions
        }
      }), ['title'])
    }
  },
  Mutation: {
    async updateStorageTargets (obj, args, context) {
      WIKI.logger.debug(`Updating storage targets for site ${args.siteId}...`)
      try {
        const dbTargets = await WIKI.db.storage.getTargets({ siteId: args.siteId })
        for (const tgt of args.targets) {
          const md = _.find(WIKI.storage.defs, ['key', tgt.module])
          if (!md) {
            throw new Error('Invalid module key for non-existent storage target.')
          }

          const dbTarget = _.find(dbTargets, ['id', tgt.id])

          // -> Build update config object
          const updatedConfig = dbTarget?.config ?? {}
          if (tgt.config) {
            for (const [key, prop] of Object.entries(md.props)) {
              if (prop.readOnly) { continue }
              if (!Object.prototype.hasOwnProperty.call(tgt.config, key)) { continue }
              if (prop.sensitive && tgt.config[key] === '********') { continue }
              updatedConfig[key] = tgt.config[key]
            }
          }

          // -> Target doesn't exist yet in the DB, let's create it
          if (!dbTarget) {
            WIKI.logger.debug(`No existing DB configuration for module ${tgt.module}. Creating a new one...`)
            await WIKI.db.storage.query().insert({
              id: tgt.id,
              module: tgt.module,
              siteId: args.siteId,
              isEnabled: tgt.isEnabled ?? false,
              contentTypes: {
                activeTypes: tgt.contentTypes ?? md.contentTypes.defaultTypesEnabled ?? [],
                largeThreshold: tgt.largeThreshold ?? md.contentTypes.defaultLargeThreshold ?? '5MB'
              },
              assetDelivery: {
                streaming: tgt.assetDeliveryFileStreaming ?? md?.assetDelivery?.defaultStreamingEnabled ?? false,
                directAccess: tgt.assetDeliveryDirectAccess ?? md?.assetDelivery?.defaultDirectAccessEnabled ?? false
              },
              versioning: {
                enabled: tgt.useVersioning ?? md?.versioning?.defaultEnabled ?? false
              },
              state: {
                current: 'ok'
              },
              config: updatedConfig
            })
          } else {
            WIKI.logger.debug(`Updating DB configuration for module ${tgt.module}...`)
            await WIKI.db.storage.query().patch({
              isEnabled: tgt.isEnabled ?? dbTarget.isEnabled ?? false,
              contentTypes: {
                activeTypes: tgt.contentTypes ?? dbTarget?.contentTypes?.activeTypes ?? [],
                largeThreshold: tgt.largeThreshold ?? dbTarget?.contentTypes?.largeThreshold ?? '5MB'
              },
              assetDelivery: {
                streaming: tgt.assetDeliveryFileStreaming ?? dbTarget?.assetDelivery?.streaming ?? false,
                directAccess: tgt.assetDeliveryDirectAccess ?? dbTarget?.assetDelivery?.directAccess ?? false
              },
              versioning: {
                enabled: tgt.useVersioning ?? dbTarget?.versioning?.enabled ?? false
              },
              config: updatedConfig
            }).where('id', tgt.id)
          }
        }
        // await WIKI.db.storage.initTargets()
        return {
          operation: generateSuccess('Storage targets updated successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    async setupStorageTarget (obj, args, context) {
      try {
        const tgt = await WIKI.db.storage.query().findById(args.targetId)
        if (!tgt) {
          throw new Error('Not storage target matching this ID')
        }
        const md = _.find(WIKI.storage.defs, ['key', tgt.module])
        if (!md) {
          throw new Error('No matching storage module installed.')
        }
        if (!await WIKI.db.storage.ensureModule(md.key)) {
          throw new Error('Failed to load storage module. Check logs for details.')
        }
        const result = await WIKI.storage.modules[md.key].setup(args.targetId, args.state)

        return {
          operation: generateSuccess('Storage target setup step succeeded'),
          state: result
        }
      } catch (err) {
        return generateError(err)
      }
    },
    async destroyStorageTargetSetup (obj, args, context) {
      try {
        const tgt = await WIKI.db.storage.query().findById(args.targetId)
        if (!tgt) {
          throw new Error('Not storage target matching this ID')
        }
        const md = _.find(WIKI.storage.defs, ['key', tgt.module])
        if (!md) {
          throw new Error('No matching storage module installed.')
        }
        if (!await WIKI.db.storage.ensureModule(md.key)) {
          throw new Error('Failed to load storage module. Check logs for details.')
        }
        await WIKI.storage.modules[md.key].setupDestroy(args.targetId)

        return {
          operation: generateSuccess('Storage target setup configuration destroyed succesfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    async executeStorageAction (obj, args, context) {
      try {
        const target = await WIKI.db.knex('storage').where('id', args.targetId).first()
        if (!target || !target.isEnabled) {
          throw new Error('Invalid or Inactive Storage Target')
        }

        if (target.module === 's3' && args.handler === 'exportAll') {
          // Custom v3-compatible S3 export (upstream CJS uses v2 schema)
          const S3 = (await import('aws-sdk/clients/s3.js')).default
          const isCustomMode = target.config.mode === 'custom'
          const s3Opts = {
            region: target.config.region,
            accessKeyId: target.config.accessKeyId,
            secretAccessKey: target.config.secretAccessKey
          }
          if (isCustomMode && target.config.endpoint) {
            s3Opts.endpoint = target.config.endpoint
            s3Opts.s3ForcePathStyle = target.config.s3ForcePathStyle || false
          }
          const s3 = new S3(s3Opts)
          const bucket = target.config.bucket

          WIKI.logger.info(`(STORAGE/s3) Exporting all pages to S3 bucket ${bucket}...`)
          const pages = await WIKI.db.knex('pages')
            .where('publishState', 'published')
            .select('path', 'locale', 'title', 'description', 'contentType', 'content', 'updatedAt', 'createdAt')

          for (const page of pages) {
            const ext = page.contentType === 'markdown' ? 'md' : page.contentType === 'html' ? 'html' : 'txt'
            const key = `${page.locale}/${page.path}.${ext}`
            WIKI.logger.info(`(STORAGE/s3) Uploading ${key}...`)
            await s3.putObject({
              Bucket: bucket,
              Key: key,
              Body: page.content || '',
              ContentType: 'text/plain; charset=utf-8',
              Metadata: {
                title: page.title || '',
                description: page.description || '',
                locale: page.locale || 'en'
              }
            }).promise()
          }
          WIKI.logger.info(`(STORAGE/s3) Export complete. ${pages.length} pages uploaded.`)
        } else {
          // Generic handler — try loading the module
          const modulePath = `../../modules/storage/${target.module}/storage.mjs`
          const StorageClass = (await import(modulePath)).default
          const instance = typeof StorageClass === 'function' ? new StorageClass() : StorageClass
          instance.config = target.config
          instance.mode = target.mode
          instance.storageName = target.module
          if (typeof instance[args.handler] === 'function') {
            await instance[args.handler]()
          } else {
            throw new Error(`Invalid handler: ${args.handler}`)
          }
        }

        return {
          operation: generateSuccess('Action completed.')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
