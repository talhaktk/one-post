import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { Upload, Video, Image as ImageIcon, X, ChevronRight, FileVideo, FileImage, Clock } from 'lucide-react'
import ReactPlayer from 'react-player'
import { usePost } from '../context/PostContext'
import { useAuth } from '../context/AuthContext'
import { uploadVideo } from '../lib/api'
import toast from 'react-hot-toast'

const CATEGORIES = ['Politics', 'News', 'Education', 'Sports', 'Entertainment', 'Technology', 'Business', 'Health', 'Religion', 'Current Affairs']

export default function UploadVideo() {
  const navigate = useNavigate()
  const { postState, updatePost } = usePost()
  const { profile } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const isImage = postState.mediaType === 'image'

  const switchMode = (mode) => {
    if (postState.videoFile) {
      if (postState.videoMeta?.previewUrl) URL.revokeObjectURL(postState.videoMeta.previewUrl)
      updatePost({ videoFile: null, videoMeta: null, videoId: null })
    }
    updatePost({ mediaType: mode })
  }

  const onDrop = useCallback((accepted) => {
    const file = accepted[0]
    if (!file) return
    const url = URL.createObjectURL(file)

    if (file.type.startsWith('image/')) {
      updatePost({
        videoFile: file,
        videoMeta: { name: file.name, size: (file.size / 1024 / 1024).toFixed(1), type: file.type, previewUrl: url, duration: 0 }
      })
    } else {
      const video = document.createElement('video')
      video.src = url
      video.onloadedmetadata = () => {
        updatePost({
          videoFile: file,
          videoMeta: { name: file.name, size: (file.size / 1024 / 1024).toFixed(1), duration: Math.round(video.duration), type: file.type, previewUrl: url }
        })
      }
    }
  }, [updatePost])

  const accept = isImage
    ? { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] }
    : { 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'] }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept, maxSize: 10 * 1024 * 1024 * 1024, multiple: false
  })

  const handleNext = async () => {
    if (!postState.videoFile) { toast.error(`Please select a ${isImage ? 'image' : 'video'} first`); return }
    if (!postState.title.trim()) { toast.error('Please enter a title'); return }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('video', postState.videoFile)
      formData.append('title', postState.title)
      formData.append('description', postState.description || '')
      formData.append('category', postState.category)
      formData.append('media_type', isImage ? 'image' : 'video')

      const { video_id, original_url } = await uploadVideo(formData, setUploadProgress)
      const editOptions = {
        crop: profile?.auto_crop ?? true,
        cut: profile?.auto_cut ?? true,
        captions: profile?.auto_captions ?? false,
        highlights: profile?.auto_highlights ?? false,
        thumbnail: profile?.auto_thumbnail ?? true,
        caption_language: profile?.default_caption_language || 'both'
      }
      updatePost({ videoId: video_id, originalUrl: original_url, editOptions })
      navigate(isImage ? '/hashtags' : '/edit')
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const removeFile = () => {
    if (postState.videoMeta?.previewUrl) URL.revokeObjectURL(postState.videoMeta.previewUrl)
    updatePost({ videoFile: null, videoMeta: null, videoId: null })
  }

  const formatDuration = (s) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`

  return (
    <div className="screen-pad">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div className="t-label" style={{ marginBottom: 6 }}>Step 1 of {isImage ? '3' : '4'}</div>
        <div className="t-display">Upload media</div>
        <div className="t-body-sm" style={{ marginTop: 4 }}>Pick a file and add the basics.</div>
      </div>

      {/* Segmented control: Video / Image */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
        background: 'var(--bg-elevated)',
        padding: 4, borderRadius: 12,
        border: '1px solid var(--border-subtle)',
        marginBottom: 20
      }}>
        {[
          { mode: 'video', icon: <Video size={15} />, label: 'Video' },
          { mode: 'image', icon: <ImageIcon size={15} />, label: 'Image' }
        ].map(({ mode, icon, label }) => {
          const active = postState.mediaType === mode
          return (
            <button
              key={mode}
              onClick={() => switchMode(mode)}
              style={{
                minHeight: 40, border: 'none', borderRadius: 9,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'white' : 'var(--text-secondary)',
                fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s, color 0.15s'
              }}
            >
              {icon} {label}
            </button>
          )
        })}
      </div>

      {/* Dropzone */}
      {!postState.videoFile ? (
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border-strong)'}`,
            borderRadius: 16,
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragActive ? 'var(--accent-soft)' : 'var(--bg-elevated)',
            transition: 'all 0.15s',
            marginBottom: 24
          }}
        >
          <input {...getInputProps()} />
          <div className="avatar-icon" style={{ width: 56, height: 56, margin: '0 auto 14px' }}>
            {isDragActive ? <Upload size={26} /> : isImage ? <FileImage size={26} /> : <FileVideo size={26} />}
          </div>
          <div className="t-h2" style={{ marginBottom: 6 }}>
            {isDragActive ? 'Drop to upload' : isImage ? 'Tap to select image' : 'Tap to select video'}
          </div>
          <div className="t-body-sm">
            {isImage ? 'JPG, PNG, GIF, WebP · up to 10 GB' : 'MP4, MOV, AVI, MKV, WebM · up to 10 GB'}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 12, marginBottom: 24 }}>
          {isImage ? (
            <img
              src={postState.videoMeta.previewUrl}
              alt="preview"
              style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, marginBottom: 12, background: 'var(--bg-sunken)' }}
            />
          ) : (
            <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: 'var(--bg-sunken)' }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <ReactPlayer url={postState.videoMeta.previewUrl} width="100%" height="100%" controls light />
              </div>
            </div>
          )}
          <div className="row-between" style={{ padding: '4px 4px 0' }}>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="t-h3 truncate-1">{postState.videoMeta.name}</div>
              <div className="row" style={{ marginTop: 4, gap: 12 }}>
                <span className="t-caption">{postState.videoMeta.size} MB</span>
                {!isImage && postState.videoMeta.duration > 0 && (
                  <span className="t-caption row" style={{ gap: 4 }}>
                    <Clock size={11} /> {formatDuration(postState.videoMeta.duration)}
                  </span>
                )}
              </div>
            </div>
            <button onClick={removeFile} className="btn-danger btn-sm" style={{ width: 'auto', padding: '0 12px' }}>
              <X size={14} /> Remove
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="stack-lg">
        <div>
          <label className="input-label">Title <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input className="input" type="text" placeholder="Enter a clear title…" value={postState.title} onChange={e => updatePost({ title: e.target.value })} maxLength={200} />
        </div>

        <div>
          <label className="input-label">Caption / description</label>
          <textarea className="input" rows={4} placeholder="Write a caption (optional)…" value={postState.description} onChange={e => updatePost({ description: e.target.value })} maxLength={500} />
          <div className="t-caption" style={{ marginTop: 6, textAlign: 'right' }}>{postState.description?.length || 0} / 500</div>
        </div>

        <div>
          <label className="input-label">Category</label>
          <select className="input" value={postState.category} onChange={e => updatePost({ category: e.target.value })}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {!isImage && (
          <div>
            <label className="input-label">Video quality</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { key: 'original', label: 'Original' },
                { key: 'compressed', label: 'Compressed' }
              ].map(({ key, label }) => {
                const active = postState.quality === key
                return (
                  <button
                    key={key}
                    onClick={() => updatePost({ quality: key })}
                    style={{
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 10,
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
                      background: active ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 14, fontWeight: 600
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ marginTop: 28 }}>
        {uploading && (
          <div style={{ marginBottom: 12 }}>
            <div className="row-between" style={{ marginBottom: 6 }}>
              <span className="t-body-sm">Uploading…</span>
              <span className="t-body-sm t-mono">{uploadProgress}%</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${uploadProgress}%` }} /></div>
          </div>
        )}
        <button className="btn-primary" onClick={handleNext} disabled={uploading || !postState.videoFile}>
          {uploading ? (
            <><div className="spinner" style={{ width: 16, height: 16 }} /> Uploading…</>
          ) : (
            <>Continue <ChevronRight size={18} /></>
          )}
        </button>
      </div>
    </div>
  )
}
