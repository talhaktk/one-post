const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { v4: uuidv4 } = require('uuid')
const auth = require('../middleware/auth')
const { cropAndResize, extractAudio, burnSubtitles, extractFrames, cutClip, getVideoInfo } = require('../services/ffmpeg')
const { generateSRT } = require('../services/whisper')

const router = express.Router()
const supabase = require('../lib/supabase')

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => cb(null, `upload_${uuidv4()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 * 1024 }
})

router.post('/upload', auth, upload.single('video'), async (req, res) => {
  try {
    const { title, description, category, media_type = 'video' } = req.body
    const file = req.file
    if (!file) return res.status(400).json({ error: 'No file uploaded' })

    const isImage = media_type === 'image'
    let duration = 0
    if (!isImage) {
      const videoInfo = await getVideoInfo(file.path)
      duration = Math.round(videoInfo.duration || 0)
    }

    const fileBuffer = fs.readFileSync(file.path)
    const bucket = isImage ? 'images' : 'videos'
    const storagePath = `${bucket}/${req.user.id}/${uuidv4()}${path.extname(file.originalname)}`

    const { error: uploadErr } = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, { contentType: file.mimetype })
    if (uploadErr) throw uploadErr

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath)

    const { data: videoData } = await supabase.from('videos').insert({
      user_id: req.user.id,
      original_url: urlData.publicUrl,
      title, description, category,
      duration_seconds: duration,
      file_size_mb: parseFloat((file.size / 1024 / 1024).toFixed(2)),
      media_type
    }).select().single()

    fs.unlinkSync(file.path)
    res.json({ video_id: videoData.id, original_url: urlData.publicUrl, video: videoData })
  } catch (err) {
    console.error('Upload error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/process', auth, async (req, res) => {
  try {
    const { video_id, crop, cut, captions, highlights, thumbnail, caption_language } = req.body
    const { data: video } = await supabase.from('videos').select('*').eq('id', video_id).eq('user_id', req.user.id).single()
    if (!video) return res.status(404).json({ error: 'Video not found' })

    const platforms = ['youtube', 'youtube_short', 'instagram_reels', 'instagram_feed', 'facebook', 'tiktok', 'twitter']
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onepost-process-'))

    // Download original
    const fetch = require('node-fetch')
    const origResponse = await fetch(video.original_url)
    const origPath = path.join(tmpDir, 'original.mp4')
    fs.writeFileSync(origPath, await origResponse.buffer())

    const clips = []
    let thumbnails = []
    let srtPath = null

    // Generate captions if requested
    if (captions) {
      const audioPath = path.join(tmpDir, 'audio.mp3')
      await extractAudio(origPath, audioPath)
      srtPath = path.join(tmpDir, 'captions.srt')
      await generateSRT(audioPath, srtPath, caption_language)
    }

    // Process per platform
    if (crop || cut) {
      for (const platform of platforms) {
        const outputPath = path.join(tmpDir, `${platform}.mp4`)
        let inputPath = origPath

        if (captions && srtPath) {
          const captionedPath = path.join(tmpDir, `${platform}_captioned.mp4`)
          await burnSubtitles(inputPath, srtPath, captionedPath)
          inputPath = captionedPath
        }

        await cropAndResize(inputPath, platform, outputPath)

        // Upload to Supabase
        const clipPath = `clips/${req.user.id}/${video_id}/${platform}_${uuidv4()}.mp4`
        const { error } = await supabase.storage.from('clips').upload(clipPath, fs.readFileSync(outputPath), { contentType: 'video/mp4' })
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from('clips').getPublicUrl(clipPath)
          const { data: clipData } = await supabase.from('processed_clips').insert({
            video_id, platform, clip_url: publicUrl,
            aspect_ratio: ['youtube', 'facebook', 'twitter'].includes(platform) ? '16:9' : platform === 'instagram_feed' ? '1:1' : '9:16',
            has_captions: captions,
            processing_status: 'done'
          }).select().single()
          clips.push(clipData)
        }
      }
    }

    // Thumbnails
    if (thumbnail) {
      const frames = await extractFrames(origPath, 5)
      for (const framePath of frames) {
        const thumbName = `thumbnails/${req.user.id}/${video_id}/${uuidv4()}.jpg`
        await supabase.storage.from('thumbnails').upload(thumbName, fs.readFileSync(framePath), { contentType: 'image/jpeg' })
        const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(thumbName)
        thumbnails.push(publicUrl)
      }
      if (thumbnails[0]) {
        await supabase.from('videos').update({ thumbnail_url: thumbnails[0] }).eq('id', video_id)
      }
    }

    // Highlights
    let highlightData = null
    if (highlights && process.env.GOOGLE_CLOUD_API_KEY) {
      try {
        const { detectHighlights } = require('../services/googleVideoAI')
        highlightData = await detectHighlights(`gs://.../${video_id}`)
      } catch (err) {
        console.error('Highlights error:', err.message)
      }
    }

    // Cleanup tmp
    fs.rmSync(tmpDir, { recursive: true, force: true })

    res.json({ clips, thumbnails, highlights: highlightData })
  } catch (err) {
    console.error('Process error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
