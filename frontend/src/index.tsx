import { Hono } from 'hono'
import { Layout } from './components/Layout.js'

const app = new Hono()

// Redirect /static/public/ filenames to Cloudflare static assets root
app.get('/static/public/:filename', (c) => {
  const filename = c.req.param('filename')
  return c.redirect(`/${filename}`)
})

app.get('/favicon.ico', (c) => {
  return c.redirect('/logo.png')
})

app.get('/', (c) => {
  return c.html(<Layout />)
})

export default app
