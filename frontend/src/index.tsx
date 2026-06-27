import { Hono } from 'hono'
import { Layout } from './components/Layout.js'

const app = new Hono()

// Serve static files from public/ directory (works in both Cloudflare and local/Docker)
app.get('/static/public/:filename', async (c) => {
  const filename = c.req.param('filename')
  // In Cloudflare Workers, assets are served from root via binding
  // In local/Docker mode, we serve from the filesystem
  try {
    const { promises: fs } = await import('fs')
    const { join } = await import('path')
    const filePath = join(process.cwd(), 'public', filename)
    const content = await fs.readFile(filePath)
    const ext = filename.split('.').pop()
    const mimeTypes: Record<string, string> = {
      'css': 'text/css', 'js': 'application/javascript',
      'png': 'image/png', 'jpg': 'image/jpeg', 'svg': 'image/svg+xml'
    }
    c.header('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream')
    return c.body(content)
  } catch {
    return c.redirect(`/${filename}`)
  }
})

app.get('/favicon.ico', (c) => {
  return c.redirect('/logo.png')
})

app.get('/', (c) => {
  const apiBase = (typeof process !== 'undefined' && process.env?.API_BASE) || (c.env as any)?.API_BASE || '';
  return c.html(<Layout apiBase={apiBase} />)
})

export default app
