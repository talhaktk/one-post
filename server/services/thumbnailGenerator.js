const { createCanvas, loadImage } = require('canvas')
const { createClient } = require('@supabase/supabase-js')
const { v4: uuidv4 } = require('uuid')
const fs = require('fs')
const os = require('os')
const path = require('path')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const PRIORITY_COLORS = {
  urgent: '#CC0000',
  breaking: '#E65C00',
  important: '#B8A500',
  normal: '#1a7a3e'
}

const generateBreakingThumbnail = async ({ headline, sourceName, priority = 'breaking', backgroundImagePath = null }) => {
  const canvas = createCanvas(1280, 720)
  const ctx = canvas.getContext('2d')

  // Layer 1 — Background
  if (backgroundImagePath) {
    try {
      const img = await loadImage(backgroundImagePath)
      ctx.drawImage(img, 0, 0, 1280, 720)
      // Dark gradient overlay
      const grad = ctx.createLinearGradient(0, 400, 0, 720)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,0.9)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 1280, 720)
    } catch {
      ctx.fillStyle = '#111111'
      ctx.fillRect(0, 0, 1280, 720)
    }
  } else {
    ctx.fillStyle = '#111111'
    ctx.fillRect(0, 0, 1280, 720)
    // Subtle gradient
    const grad = ctx.createLinearGradient(0, 0, 1280, 720)
    grad.addColorStop(0, '#1a1a2e')
    grad.addColorStop(1, '#0a0a1a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1280, 720)
  }

  const barColor = PRIORITY_COLORS[priority] || '#CC0000'

  // Layer 2 — Breaking bar (top)
  ctx.fillStyle = barColor
  ctx.fillRect(0, 0, 1280, 70)

  // Red dot
  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.arc(30, 35, 10, 0, Math.PI * 2)
  ctx.fill()

  // Breaking text
  ctx.fillStyle = 'white'
  ctx.font = 'bold 28px Arial'
  ctx.fillText(priority === 'urgent' ? '⚠ URGENT NEWS' : 'BREAKING NEWS', 55, 45)

  // Layer 3 — Headline text (center)
  ctx.fillStyle = 'white'
  ctx.font = 'bold 52px Arial'
  const maxWidth = 1100
  const words = headline.split(' ')
  let lines = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const { width } = ctx.measureText(testLine)
    if (width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  lines = lines.slice(0, 3)

  const lineHeight = 68
  const totalTextHeight = lines.length * lineHeight
  const startY = (720 - 70 - 50) / 2 + 70 - totalTextHeight / 2 + 30

  ctx.shadowColor = 'rgba(0,0,0,0.8)'
  ctx.shadowBlur = 8
  lines.forEach((line, i) => {
    const { width } = ctx.measureText(line)
    ctx.fillText(line, (1280 - width) / 2, startY + i * lineHeight)
  })
  ctx.shadowBlur = 0

  // Layer 4 — Source bar (bottom)
  ctx.fillStyle = 'rgba(20,20,20,0.92)'
  ctx.fillRect(0, 670, 1280, 50)

  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '20px Arial'
  ctx.fillText(sourceName, 20, 700)

  const now = new Date()
  const timeStr = now.toLocaleString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
  const timeWidth = ctx.measureText(timeStr).width
  ctx.fillText(timeStr, (1280 - timeWidth) / 2, 700)

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = 'bold 18px Arial'
  const watermarkWidth = ctx.measureText('OnePost').width
  ctx.fillText('OnePost', 1280 - watermarkWidth - 20, 700)

  // Layer 5 — LIVE badge (top right)
  ctx.fillStyle = '#CC0000'
  ctx.beginPath()
  ctx.roundRect(1180, 10, 80, 42, 8)
  ctx.fill()
  ctx.fillStyle = 'white'
  ctx.font = 'bold 22px Arial'
  ctx.fillText('LIVE', 1197, 38)

  // Export to temp file and upload
  const buffer = canvas.toBuffer('image/png')
  const tmpPath = path.join(os.tmpdir(), `thumb_${uuidv4()}.png`)
  fs.writeFileSync(tmpPath, buffer)

  // Upload to Supabase Storage
  const fileName = `thumbnails/${uuidv4()}.png`
  const { error } = await supabase.storage.from('thumbnails').upload(fileName, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw error

  const { data } = supabase.storage.from('thumbnails').getPublicUrl(fileName)
  fs.unlinkSync(tmpPath)
  return data.publicUrl
}

module.exports = { generateBreakingThumbnail }
