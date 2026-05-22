require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
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

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }))

app.listen(PORT, () => {
  console.log(`OnePost server running on port ${PORT}`)
  // Start background services
  require('./services/rssMonitor').start()
  require('./services/scheduler').start()
})
