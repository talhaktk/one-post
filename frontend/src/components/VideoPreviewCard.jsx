import ReactPlayer from 'react-player'

const ASPECT_RATIOS = {
  youtube: '16/9', youtube_short: '9/16', instagram_reels: '9/16',
  instagram_feed: '1/1', facebook: '16/9', facebook_reels: '9/16',
  tiktok: '9/16', twitter: '16/9'
}

const PLATFORM_LABELS = {
  youtube: 'YouTube (16:9)', youtube_short: 'YouTube Shorts (9:16)',
  instagram_reels: 'Instagram Reels (9:16)', instagram_feed: 'Instagram Feed (1:1)',
  facebook: 'Facebook Video (16:9)', facebook_reels: 'Facebook Reels (9:16)',
  tiktok: 'TikTok (9:16)', twitter: 'X / Twitter (16:9)'
}

export default function VideoPreviewCard({ platform, url, thumbnail }) {
  const ratio = ASPECT_RATIOS[platform] || '16/9'
  const label = PLATFORM_LABELS[platform] || platform
  const [num, den] = ratio.split('/').map(Number)
  const paddingTop = `${(den / num) * 100}%`

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ position: 'relative', paddingTop, background: '#000', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          {url ? (
            <ReactPlayer url={url} width="100%" height="100%" light={thumbnail} controls pip playing={false} />
          ) : thumbnail ? (
            <img src={thumbnail} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 40 }}>🎬</div>
          )}
        </div>
      </div>
    </div>
  )
}
