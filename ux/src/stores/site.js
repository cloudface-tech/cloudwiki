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
      try {
        const resp = await APOLLO_CLIENT.query({
          query: gql`
            query getNavigationItems ($id: UUID!) {
              navigationById (id: $id) {
                id type label icon target openInNewWindow
                children {
                  id type label icon target openInNewWindow
                  children {
                    id type label icon target openInNewWindow
                    children {
                      id type label icon target openInNewWindow
                      children {
                        id type label icon target openInNewWindow
                        children {
                          id type label icon target openInNewWindow
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: { id }
        })

        // Flatten the recursive navigation into a flat list with depth
        const flatList = []
        function flatten (items, depth) {
          for (const item of items) {
            const hasChildren = item.children && item.children.length > 0
            if (hasChildren && item.type === 'link') {
              // Folder with a target — clickable link + expandable
              flatList.push({ id: item.id, type: 'folderLink', label: item.label, icon: item.icon, target: item.target, depth })
              flatten(item.children, depth + 1)
            } else if (hasChildren) {
              // Folder without target — just expandable
              flatList.push({ id: item.id, type: 'folder', label: item.label, icon: item.icon, depth })
              flatten(item.children, depth + 1)
            } else if (item.type === 'link') {
              flatList.push({ id: item.id, type: 'link', label: item.label, icon: item.icon, target: item.target, depth })
            } else if (item.type === 'header') {
              flatList.push({ id: item.id, type: 'header', label: item.label, depth })
            } else if (item.type === 'separator') {
              flatList.push({ id: item.id, type: 'separator', depth })
            }
          }
        }
        flatten(resp?.data?.navigationById ?? [], 0)

        this.$patch({
          nav: {
            currentId: id,
            items: flatList
          }
        })
      } catch (err) {
        console.warn(err.networkError?.result ?? err.message)
      }
    },
    _unused_buildNavTree (items) {
      // Build nested nav from flat tree items using page paths
      // Strategy: use pages only, derive folder structure from paths
      const root = { children: [] }
      const nodeMap = { '': root }

      // Collect folder titles from tree data first
      const folderTitles = {}
      for (const item of items) {
        if (item.__typename === 'TreeItemFolder') {
          const key = item.folderPath ? `${item.folderPath}/${item.fileName}` : item.fileName
          if (item.title && item.title !== item.fileName) {
            folderTitles[key] = item.title
          }
        }
      }

      // Prettify a folder name: 'gestao' -> 'Gestao', 'ci-cd' -> 'CI/CD'
      function prettifyName (name) {
        return name
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
      }

      // Ensure a folder node exists for a given ltree path
      function ensureFolder (ltreePath) {
        if (nodeMap[ltreePath]) return nodeMap[ltreePath]
        const parts = ltreePath.split('/')
        const name = parts[parts.length - 1]
        const parentLtree = parts.slice(0, -1).join('/')
        const parent = ensureFolder(parentLtree)
        const label = prettifyName(name)
        const folder = {
          id: `folder-${ltreePath}`,
          type: 'link',
          label,
          icon: 'las la-folder',
          target: '',
          children: []
        }
        parent.children.push(folder)
        nodeMap[ltreePath] = folder
        return folder
      }

      // Process pages — add each to its parent folder
      const pages = items.filter(i => i.__typename === 'TreeItemPage')
      pages.sort((a, b) => (a.title || '').localeCompare(b.title || ''))

      for (const page of pages) {
        const parentLtree = page.folderPath || ''
        const urlPath = parentLtree
          ? `/${parentLtree}/${page.fileName}`
          : `/${page.fileName}`

        const navItem = {
          id: page.id,
          type: 'link',
          label: page.title || page.fileName,
          icon: 'las la-file-alt',
          target: urlPath
        }

        if (parentLtree) {
          const parent = ensureFolder(parentLtree)
          parent.children.push(navItem)
        } else {
          root.children.push(navItem)
        }
      }

      // Sort children: folders first, then pages, alphabetically
      function sortChildren (node) {
        if (!node.children) return
        node.children.sort((a, b) => {
          const aIsFolder = a.children?.length > 0 ? 0 : 1
          const bIsFolder = b.children?.length > 0 ? 0 : 1
          if (aIsFolder !== bIsFolder) return aIsFolder - bIsFolder
          return (a.label || '').localeCompare(b.label || '')
        })
        for (const child of node.children) {
          sortChildren(child)
        }
      }
      sortChildren(root)

      // Flatten tree to a flat list with depth info for rendering
      const flatList = []
      function flatten (children, depth) {
        for (const child of children) {
          if (child.children && child.children.length > 0) {
            flatList.push({ id: child.id, type: 'folder', label: child.label, depth, expanded: false })
            flatten(child.children, depth + 1)
          } else {
            flatList.push({ id: child.id, type: 'link', label: child.label, target: child.target, icon: child.icon, depth })
          }
        }
      }
      flatten(root.children, 0)

      return flatList
    }
  }
})
