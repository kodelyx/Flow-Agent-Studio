import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { promises as fs } from 'fs'
import { join } from 'path'
import { Layout } from './components/Layout'

const app = new Hono()

// Explicit static route handlers for guaranteed local resolution
app.get('/static/public/style.css', async (c) => {
  try {
    const cssPath = join(process.cwd(), 'public', 'style.css')
    const content = await fs.readFile(cssPath, 'utf-8')
    c.header('Content-Type', 'text/css')
    return c.body(content)
  } catch (e) {
    console.error('Error serving style.css:', e)
    return c.text('Style sheet not found', 404)
  }
})

app.get('/static/public/app.js', async (c) => {
  try {
    const jsPath = join(process.cwd(), 'public', 'app.js')
    const content = await fs.readFile(jsPath, 'utf-8')
    c.header('Content-Type', 'application/javascript')
    return c.body(content)
  } catch (e) {
    console.error('Error serving app.js:', e)
    return c.text('Script not found', 404)
  }
})

app.get('/static/public/logo.png', async (c) => {
  try {
    const logoPath = join(process.cwd(), 'public', 'logo.png')
    const content = await fs.readFile(logoPath)
    c.header('Content-Type', 'image/png')
    return c.body(content)
  } catch (e) {
    console.error('Error serving logo.png:', e)
    return c.text('Logo not found', 404)
  }
})

app.get('/', (c) => {
  return c.html(<Layout />)
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
