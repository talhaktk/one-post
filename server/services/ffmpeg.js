const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('ffmpeg-static')
const path = require('path')
const fs = require('fs')
const os = require('os')

ffmpeg.setFfmpegPath(ffmpegPath)

const PLATFORM_SPECS = {
  youtube: { width: 1920, height: 1080, aspectRatio: '16:9', maxDuration: null },
  youtube_short: { width: 1080, height: 1920, aspectRatio: '9:16', maxDuration: 60 },
  instagram_reels: { width: 1080, height: 1920, aspectRatio: '9:16', maxDuration: 90 },
  instagram_feed: { width: 1080, height: 1080, aspectRatio: '1:1', maxDuration: 60 },
  facebook: { width: 1920, height: 1080, aspectRatio: '16:9', maxDuration: null },
  facebook_reels: { width: 1080, height: 1920, aspectRatio: '9:16', maxDuration: 90 },
  tiktok: { width: 1080, height: 1920, aspectRatio: '9:16', maxDuration: 600 },
  twitter: { width: 1280, height: 720, aspectRatio: '16:9', maxDuration: 140 }
}

const cropAndResize = (inputPath, platform, outputPath) => {
  return new Promise((resolve, reject) => {
    const spec = PLATFORM_SPECS[platform]
    if (!spec) { reject(new Error(`Unknown platform: ${platform}`)); return }

    let cmd = ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        `-vf scale=${spec.width}:${spec.height}:force_original_aspect_ratio=decrease,pad=${spec.width}:${spec.height}:(ow-iw)/2:(oh-ih)/2`,
        '-crf 23',
        '-preset fast',
        '-movflags +faststart'
      ])

    if (spec.maxDuration) cmd = cmd.duration(spec.maxDuration)

    cmd.output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run()
  })
}

const extractAudio = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run()
  })
}

const burnSubtitles = (inputPath, srtPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`subtitles=${srtPath}:force_style='FontSize=20,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Bold=1'`)
      .videoCodec('libx264')
      .audioCodec('copy')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run()
  })
}

const extractFrames = (inputPath, count = 5) => {
  return new Promise((resolve, reject) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onepost-frames-'))
    ffmpeg(inputPath)
      .screenshots({ count, folder: tmpDir, filename: 'frame-%i.jpg', size: '1280x720' })
      .on('end', () => {
        const frames = fs.readdirSync(tmpDir).map(f => path.join(tmpDir, f))
        resolve(frames)
      })
      .on('error', reject)
  })
}

const cutClip = (inputPath, startSeconds, durationSeconds, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(startSeconds)
      .duration(durationSeconds)
      .videoCodec('libx264')
      .audioCodec('aac')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run()
  })
}

const getVideoInfo = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, meta) => {
      if (err) { reject(err); return }
      const vs = meta.streams.find(s => s.codec_type === 'video')
      resolve({
        duration: meta.format.duration,
        width: vs?.width,
        height: vs?.height,
        size: meta.format.size,
        bitrate: meta.format.bit_rate
      })
    })
  })
}

module.exports = { cropAndResize, extractAudio, burnSubtitles, extractFrames, cutClip, getVideoInfo, PLATFORM_SPECS }
