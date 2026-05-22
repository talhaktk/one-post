import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { Upload, Video, Image, X, ChevronRight } from 'lucide-react'
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
      // Apply profile auto-edit defaults
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
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ padding: '20px 0 16px' }}>
        <div style={{ fontSize: 22, fontFamily: 'Syne', fontWeight: 800 }}>Upload Media</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Step 1 of {isImage ? '3' : '4'}</div>
      </div>

      {/* Video / Image toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 12 }}>
        {[{ mode: 'video', icon: <Video size={15} />, label: 'Video' }, { mode: 'image', icon: <Image size={15} />, label: 'Image' }].map(({ mode, icon, label }) => (
          <button key={mode} onClick={() => switchMode(mode)}
            style={{ flex: 1, padding: '9px 4px', borderRadius: 8, border: 'none', background: postState.mediaType === mode ? '#7c3aed' : 'transparent', color: postState.mediaType === mode ? 'white' : 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Dropzone */}
      {!postState.videoFile ? (
        <div {...getRootProps()} style={{ border: `2px dashed ${isDragActive ? '#7c3aed' : 'rgba(255,255,255,0.15)'}`, borderRadius: 20, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)', transition: 'all 0.2s', marginBottom: 20 }}>
          <input {...getInputProps()} />
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            {isDragActive ? <Upload size={36} color="#7c3aed" /> : isImage ? <Image size={36} color="#7c3aed" /> : <Video size={36} color="#7c3aed" />}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
            {isDragActive ? 'Drop here' : isImage ? 'Tap to select image' : 'Tap to select video'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            {isImage ? 'JPG, PNG, GIF, WebP — up to 10GB' : 'MP4, MOV, AVI, MKV, WebM — up to 10GB'}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          {isImage ? (
            <img src={postState.videoMeta.previewUrl} alt="preview"
              style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 12, marginBottom: 12, background: 'rgba(0,0,0,0.3)' }} />
          ) : (
            <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <ReactPlayer url={postState.videoMeta.previewUrl} width="100%" height="100%" controls light />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{postState.videoMeta.name}</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                <span>📁 {postState.videoMeta.size}MB</span>
                {!isImage && <span>⏱ {formatDuration(postState.videoMeta.duration)}</span>}
              </div>
            </div>
            <button onClick={removeFile} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Title *</label>
          <input className="input" type="text" placeholder="Enter title..." value={postState.title} onChange={e => updatePost({ title: e.target.value })} maxLength={200} />
        </div>

        <div>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Caption / Description</label>
          <textarea className="input" rows={4} placeholder="Write a caption (optional)..." value={postState.description} onChange={e => updatePost({ description: e.target.value })} maxLength={500} />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, textAlign: 'right' }}>{postState.description?.length || 0}/500</div>
        </div>

        <div>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Category</label>
          <select className="input" value={postState.category} onChange={e => updatePost({ category: e.target.value })}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {!isImage && (
          <div>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Video Quality</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {['original', 'compressed'].map(q => (
                <button key={q} onClick={() => updatePost({ quality: q })} style={{ flex: 1, padding: '12px', borderRadius: 10, border: `1px solid ${postState.quality === q ? '#7c3aed' : 'rgba(255,255,255,0.1)'}`, background: postState.quality === q ? 'rgba(124,58,237,0.15)' : 'transparent', color: postState.quality === q ? '#c4b5fd' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>
                  {q === 'original' ? '🎬 Original' : '⚡ Compressed'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {uploading && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span>Uploading...</span><span>{uploadProgress}%</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${uploadProgress}%` }} /></div>
          </div>
        )}
        <button className="btn-primary" onClick={handleNext} disabled={uploading || !postState.videoFile} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {uploading ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Uploading...</>
            : isImage ? <>Next: Select Targets <ChevronRight size={18} /></>
            : <>Next: Auto Edit <ChevronRight size={18} /></>}
        </button>
      </div>
    </div>
  )
}
