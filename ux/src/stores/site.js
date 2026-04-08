import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { clone, sortBy } from 'lodash-es'

import { useUserStore } from './user'

export const useSiteStore = defineStore('site', {
  state: () => ({
    id: null,
    hostname: '',
    company: '',
    contentLicense: '',
    footerExtra: '',
    dark: false,
    title: '',
    description: '',
    logoText: true,
    search: '',
    searchLastQuery: '',
    searchIsLoading: false,
    printView: false,
    pageDataTemplates: [],
    showSideNav: true,
    showSidebar: true,
    overlay: null,
    overlayOpts: {},
    features: {
      profile: false,
      ratingsMode: 'off',
      reasonForChange: 'required',
      search: false
    },
    editors: {
      asciidoc: false,
      markdown: false,
      wysiwyg: false
    },
    locales: {
      primary: 'en',
      active: [{
        code: 'en',
        language: 'en',
        name: 'English',
        nativeName: 'English'
      }]
    },
    tags: [],
    tagsLoaded: false,
    theme: {
      dark: false,
      injectCSS: '',
      injectHead: '',
      injectBody: '',
      colorPrimary: '#1976D2',
      colorSecondary: '#02C39A',
      colorAccent: '#f03a47',
      colorHeader: '#000',
      colorSidebar: '#1976D2',
      codeBlocksTheme: '',
      sidebarPosition: 'left',
      tocPosition: 'right',
      showSharingMenu: true,
      showPrintBtn: true
    },
    sideDialogShown: false,
    sideDialogComponent: '',
    docsBase: 'https://wiki.cloudface.tech/docs',
    nav: {
      currentId: null,
      items: []
    }
  }),
  getters: {
    overlayIsShown: (state) => Boolean(state.overlay),
    sideNavIsDisabled: (state) => Boolean(state.theme.sidebarPosition === 'off'),
    scrollStyle: (state) => {
      const userStore = useUserStore()
      let isDark = false
      if (userStore.appearance === 'site') {
        isDark = state.theme.dark
      } else if (userStore.appearance === 'dark') {
        isDark = true
      }
      return {
        thumb: {
          right: '2px',
          borderRadius: '5px',
          backgroundColor: isDark ? '#FFF' : '#000',
          width: '5px',
          opacity: isDark ? 0.25 : 0.15
        },
        bar: {
          backgroundColor: isDark ? '#000' : '#FAFAFA',
          width: '9px',
          opacity: isDark ? 0.25 : 1
        }
      }
    },
    useLocales: (state) => {
      return state.locales?.active?.length > 1
    }
  },
  actions: {
    openFileManager (opts) {
      this.$patch({
        overlay: 'FileManager',
        overlayOpts: {
          insertMode: opts?.insertMode ?? false
        }
      })
    },
    async loadSite (hostname) {
      try {
        const resp = await APOLLO_CLIENT.query({
          query: gql`
            query getSiteInfo ($hostname: String!) {
              siteByHostname (
                hostname: $hostname
                exact: false
                ) {
                company
                contentLicense
                description
                editors {
                  asciidoc {
                    isActive
                  }
                  markdown {
                    isActive
                  }
                  wysiwyg {
                    isActive
                  }
                }
                features {
                  browse
                  profile
                  ratingsMode
                  reasonForChange
                  search
                }
                footerExtra
                hostname
                id
                locales {
                  primary
                  active {
                    code
                    language
                    name
                    nativeName
                  }
                }
                logoText
                theme {
                  dark
                  colorPrimary
                  colorSecondary
                  colorAccent
                  colorHeader
                  colorSidebar
                  codeBlocksTheme
                  sidebarPosition
                  tocPosition
                  showSharingMenu
                  showPrintBtn
                  baseFont
                  contentFont
                }
                title
              }
            }
          `,
          variables: {
            hostname
          }
        })
        const siteInfo = resp.data.siteByHostname
        if (siteInfo) {
          this.$patch({
            id: clone(siteInfo.id),
            hostname: clone(siteInfo.hostname),
            title: clone(siteInfo.title),
            description: clone(siteInfo.description),
            logoText: clone(siteInfo.logoText),
            company: clone(siteInfo.company),
            contentLicense: clone(siteInfo.contentLicense),
            footerExtra: clone(siteInfo.footerExtra),
            features: {
              ...this.features,
              ...clone(siteInfo.features)
            },
            editors: {
              asciidoc: clone(siteInfo.editors.asciidoc.isActive),
              markdown: clone(siteInfo.editors.markdown.isActive),
              wysiwyg: clone(siteInfo.editors.wysiwyg.isActive)
            },
            locales: {
              primary: clone(siteInfo.locales.primary),
              active: sortBy(clone(siteInfo.locales.active), ['nativeName', 'name'])
            },
            tags: [],
            tagsLoaded: false,
            theme: {
              ...this.theme,
              ...clone(siteInfo.theme)
            }
          })
        } else {
          throw new Error('Invalid Site')
        }
      } catch (err) {
        console.warn(err.networkError?.result ?? err.message)
        throw err
      }
    },
    async fetchTags (forceRefresh = false) {
      if (this.tagsLoaded && !forceRefresh) { return }
      try {
        const resp = await APOLLO_CLIENT.query({
          query: gql`
            query getSiteTags ($siteId: UUID!) {
              tags (
                siteId: $siteId
                ) {
                tag
                usageCount
              }
            }
          `,
          variables: {
            siteId: this.id
          }
        })
        this.$patch({
          tags: resp.data.tags ?? [],
          tagsLoaded: true
        })
      } catch (err) {
        console.warn(err.networkError?.result ?? err.message)
        throw err
      }
    },
    async fetchNavigation (id) {
      // Load navigation from tree (auto-generated from pages)
      try {
        const resp = await APOLLO_CLIENT.query({
          query: gql`
            query getTreeNav ($siteId: UUID!) {
              tree (
                siteId: $siteId
                types: [folder, page]
                depth: 10
                orderBy: title
                orderByDirection: asc
                limit: 1000
              ) {
                __typename
                ... on TreeItemFolder {
                  id
                  folderPath
                  fileName
                  title
                }
                ... on TreeItemPage {
                  id
                  folderPath
                  fileName
                  title
                }
              }
            }
          `,
          variables: { siteId: this.id },
          fetchPolicy: 'network-only'
        })

        const items = resp?.data?.tree ?? []
        const navTree = this._buildNavTree(items)

        this.$patch({
          nav: {
            currentId: id,
            items: navTree
          }
        })
      } catch (err) {
        console.warn('[Nav] Tree load failed, falling back to manual nav:', err.message)
        // Fallback to manual navigation
        try {
          const resp = await APOLLO_CLIENT.query({
            query: gql`
              query getNavigationItems ($id: UUID!) {
                navigationById (id: $id) {
                  id type label icon target openInNewWindow
                  children { id type label icon target openInNewWindow }
                }
              }
            `,
            variables: { id }
          })
          this.$patch({
            nav: {
              currentId: id,
              items: resp?.data?.navigationById ?? []
            }
          })
        } catch (err2) {
          console.warn(err2.message)
        }
      }
    },
    _buildNavTree (items) {
      // Build a nested nav structure from flat tree items
      const folders = {}
      const pages = []

      // Separate folders and pages
      for (const item of items) {
        if (item.__typename === 'TreeItemFolder') {
          const fullPath = item.folderPath ? `${item.folderPath}.${item.fileName}` : item.fileName
          folders[fullPath] = {
            id: item.id,
            type: 'link',
            label: item.title || item.fileName,
            icon: 'las la-folder',
            target: '',
            folderPath: fullPath,
            children: []
          }
        } else {
          pages.push(item)
        }
      }

      // Add pages to their parent folders or root
      const rootItems = []

      for (const page of pages) {
        const parentPath = page.folderPath || ''
        const pagePath = parentPath ? `${parentPath.replace(/\./g, '/')}/${page.fileName}` : page.fileName
        const navItem = {
          id: page.id,
          type: 'link',
          label: page.title || page.fileName,
          icon: 'las la-file-alt',
          target: `/${pagePath}`
        }

        if (parentPath && folders[parentPath]) {
          folders[parentPath].children.push(navItem)
        } else {
          rootItems.push(navItem)
        }
      }

      // Nest folders into their parents
      const rootFolders = []
      const sortedPaths = Object.keys(folders).sort((a, b) => b.length - a.length) // deepest first

      for (const path of sortedPaths) {
        const folder = folders[path]
        const parts = path.split('.')
        if (parts.length > 1) {
          const parentPath = parts.slice(0, -1).join('.')
          if (folders[parentPath]) {
            folders[parentPath].children.unshift(folder)
            continue
          }
        }
        rootFolders.push(folder)
      }

      // Sort root folders by label
      rootFolders.sort((a, b) => a.label.localeCompare(b.label))

      // Combine: root folders first, then root pages
      return [...rootFolders, ...rootItems]
    }
  }
})
