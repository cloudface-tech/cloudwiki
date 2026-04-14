import DOMPurify from 'dompurify'

/**
 * Sanitize HTML to prevent XSS attacks.
 * Use this for ALL v-html bindings.
 */
export function sanitizeHtml (html) {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'blockquote', 'pre', 'code',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'a', 'img', 'figure', 'figcaption',
      'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
      'sub', 'sup', 'mark', 'abbr', 'kbd', 'var',
      'span', 'div', 'section', 'article',
      'details', 'summary',
      'input', // for task lists
      'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon' // for diagrams
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'name',
      'width', 'height', 'style', 'target', 'rel',
      'colspan', 'rowspan', 'align', 'valign',
      'type', 'checked', 'disabled', // for checkboxes
      'data-*',
      'viewBox', 'xmlns', 'd', 'fill', 'stroke', 'stroke-width', // SVG
      'loading' // lazy loading images
    ],
    ALLOW_DATA_ATTR: true,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  })
}
