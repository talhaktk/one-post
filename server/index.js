require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000'
    ]
    if (!origin || allowed.includes(origin) || /\.vercel\.app$/.test(origin)) return cb(null, true)
    cb(new Error('CORS: ' + origin))
  },
  credentials: true
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Routes
app.use('/api/video', require('./routes/video'))
app.use('/api/publish', require('./routes/publish'))
app.use('/api/hashtags', require('./routes/hashtags'))
app.use('/api/accounts', require('./routes/accounts'))
app.use('/api/facebook-pages', require('./routes/facebook-pages'))
app.use('/api/tiktok-accounts', require('./routes/accounts'))
app.use('/api/posts', require('./routes/posts'))
app.use('/api/auth', require('./routes/auth'))
app.use('/api/news', require('./routes/news'))
app.use('/api/schedule', require('./routes/schedule'))

app.use('/api/admin', require('./routes/admin'))

// Health check — verify which version is actually running (deploy verification)
const SERVER_BOOT = new Date().toISOString()
const SERVER_VERSION = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || process.env.GIT_COMMIT?.slice(0, 7) || 'dev'
app.get('/health', (req, res) => res.json({
  status: 'ok',
  time: new Date().toISOString(),
  bootedAt: SERVER_BOOT,
  version: SERVER_VERSION,
  features: {
    sseBuffer: true,
    facebookTimeout: true,
    diagnoseFacebook: true
  }
}))
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  time: new Date().toISOString(),
  bootedAt: SERVER_BOOT,
  version: SERVER_VERSION,
  features: {
    sseBuffer: true,
    facebookTimeout: true,
    diagnoseFacebook: true
  }
}))

app.listen(PORT, () => {
  console.log(`OnePost server running on port ${PORT}`)
  // Start background services
  require('./services/rssMonitor').start()
  require('./services/scheduler').start()
})
