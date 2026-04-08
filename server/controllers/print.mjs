import express from 'express'

export default function () {
  const router = express.Router()

  /**
   * Print-friendly page view for PDF export
   * GET /_print/:id
   */
  router.get('/_print/:id', async (req, res, next) => {
    try {
      const pageId = req.params.id

      const page = await WIKI.db.knex('pages')
        .where('id', pageId)
        .select('id', 'title', 'description', 'render', 'updatedAt')
        .first()

      if (!page) {
        return res.status(404).send('Page not found')
      }

      const render = page.render || ''
      const title = page.title || 'Untitled'
      const description = page.description || ''
      const updatedAt = page.updatedAt ? new Date(page.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #111;
      background: #fff;
      margin: 0;
      padding: 0;
    }

    .print-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 48px;
    }

    .print-header {
      border-bottom: 2px solid #111;
      padding-bottom: 16px;
      margin-bottom: 32px;
    }

    .print-title {
      font-size: 24pt;
      font-weight: 700;
      margin: 0 0 8px 0;
      line-height: 1.2;
    }

    .print-description {
      font-size: 12pt;
      color: #444;
      margin: 0 0 8px 0;
      font-style: italic;
    }

    .print-meta {
      font-size: 9pt;
      color: #666;
    }

    .print-content h1,
    .print-content h2,
    .print-content h3,
    .print-content h4,
    .print-content h5,
    .print-content h6 {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      margin-top: 24px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }

    .print-content h1 { font-size: 18pt; }
    .print-content h2 { font-size: 15pt; }
    .print-content h3 { font-size: 13pt; }

    .print-content p {
      margin: 0 0 12px 0;
    }

    .print-content a {
      color: #111;
      text-decoration: underline;
    }

    .print-content pre {
      background: #f4f4f4;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 12px;
      font-size: 9pt;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      page-break-inside: avoid;
    }

    .print-content code {
      font-family: 'Courier New', monospace;
      font-size: 9pt;
      background: #f4f4f4;
      padding: 1px 4px;
      border-radius: 2px;
    }

    .print-content pre code {
      background: none;
      padding: 0;
    }

    .print-content blockquote {
      border-left: 4px solid #ccc;
      margin: 0 0 12px 0;
      padding: 4px 0 4px 16px;
      color: #555;
      font-style: italic;
    }

    .print-content table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
      font-size: 10pt;
      page-break-inside: avoid;
    }

    .print-content table th,
    .print-content table td {
      border: 1px solid #ccc;
      padding: 6px 10px;
      text-align: left;
    }

    .print-content table th {
      background: #f0f0f0;
      font-weight: 700;
    }

    .print-content ul,
    .print-content ol {
      margin: 0 0 12px 0;
      padding-left: 24px;
    }

    .print-content li {
      margin-bottom: 4px;
    }

    .print-content img {
      max-width: 100%;
      height: auto;
    }

    .print-content hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 24px 0;
    }

    .print-footer {
      margin-top: 48px;
      padding-top: 12px;
      border-top: 1px solid #ccc;
      font-size: 9pt;
      color: #888;
      text-align: center;
    }

    @media print {
      body { font-size: 11pt; }

      .print-container { padding: 0; max-width: 100%; }

      .no-print { display: none !important; }

      a[href]::after {
        content: ' (' attr(href) ')';
        font-size: 8pt;
        color: #555;
      }

      a[href^="#"]::after,
      a[href^="javascript:"]::after {
        content: '';
      }

      @page {
        margin: 2cm;
      }
    }

    .print-actions {
      text-align: right;
      margin-bottom: 24px;
    }

    .btn-print {
      background: #111;
      color: #fff;
      border: none;
      padding: 8px 20px;
      font-size: 11pt;
      cursor: pointer;
      border-radius: 4px;
      font-family: 'Helvetica Neue', Arial, sans-serif;
    }

    .btn-print:hover {
      background: #333;
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="print-actions no-print">
      <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
    </div>
    <div class="print-header">
      <h1 class="print-title">${escapeHtml(title)}</h1>
      ${description ? `<p class="print-description">${escapeHtml(description)}</p>` : ''}
      ${updatedAt ? `<p class="print-meta">Last updated: ${updatedAt}</p>` : ''}
    </div>
    <div class="print-content">
      ${render}
    </div>
    <div class="print-footer no-print">
      CloudWiki &mdash; ${escapeHtml(title)}
    </div>
  </div>
</body>
</html>`

      res.set('Content-Type', 'text/html; charset=utf-8')
      res.send(html)
    } catch (err) {
      WIKI.logger.warn(`Print route failed for page ${req.params.id}: ${err.message}`)
      next(err)
    }
  })

  return router
}

function escapeHtml (str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
