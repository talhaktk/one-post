const video = require('@google-cloud/video-intelligence')

const client = new video.VideoIntelligenceServiceClient()

const detectHighlights = async (gcsUri) => {
  const [operation] = await client.annotateVideo({
    inputUri: gcsUri,
    features: ['SHOT_CHANGE_DETECTION', 'LABEL_DETECTION']
  })

  const [result] = await operation.promise()
  const annotations = result.annotationResults[0]

  const shots = annotations.shotAnnotations || []
  const labels = annotations.shotLabelAnnotations || []

  // Score each shot by label confidence
  const scoredShots = shots.map((shot, i) => {
    const start = shot.startTimeOffset?.seconds || 0
    const end = shot.endTimeOffset?.seconds || 0
    const duration = end - start

    // Find labels that overlap with this shot
    let score = 0
    labels.forEach(label => {
      label.segments?.forEach(seg => {
        const sStart = seg.segment?.startTimeOffset?.seconds || 0
        const sEnd = seg.segment?.endTimeOffset?.seconds || 0
        if (sStart <= end && sEnd >= start) {
          score += (seg.confidence || 0.5) * 10
        }
      })
    })

    return { index: i, start, end, duration, score }
  })

  // Sort by score, take top highlights
  const sorted = scoredShots.sort((a, b) => b.score - a.score)
  const top = sorted.slice(0, 10)

  // Build 30s and 60s highlight windows
  const highlights30 = buildHighlightWindow(top, 30)
  const highlights60 = buildHighlightWindow(top, 60)

  return { highlights: top, highlights30, highlights60, allShots: scoredShots }
}

const buildHighlightWindow = (shots, targetDuration) => {
  if (!shots.length) return null
  const best = shots[0]
  const start = Math.max(0, best.start - targetDuration / 4)
  return { start, duration: targetDuration, end: start + targetDuration, score: best.score }
}

module.exports = { detectHighlights }
