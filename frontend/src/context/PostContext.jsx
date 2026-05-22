import { createContext, useContext, useState } from 'react'

const PostContext = createContext(null)

const defaultState = {
  mediaType: 'video',
  videoFile: null,
  videoMeta: null,
  videoId: null,
  title: '',
  description: '',
  category: 'Politics',
  quality: 'original',
  editOptions: { crop: true, cut: true, captions: false, highlights: false, thumbnail: true, caption_language: 'both' },
  processedClips: [],
  thumbnailOptions: [],
  selectedThumbnail: null,
  hashtags: { youtube: [], instagram: [], facebook: [], tiktok: [], twitter: [] },
  targets: { youtube: false, instagram_reels: false, instagram_feed: false, facebook: false, tiktok: false, twitter: false },
  selectedFacebookPages: [],
  selectedTikTokAccounts: [],
  scheduledAt: null
}

export function PostProvider({ children }) {
  const [postState, setPostState] = useState(defaultState)

  const updatePost = (updates) => setPostState(prev => ({ ...prev, ...updates }))
  const resetPost = () => setPostState(defaultState)

  return (
    <PostContext.Provider value={{ postState, updatePost, resetPost }}>
      {children}
    </PostContext.Provider>
  )
}

export const usePost = () => useContext(PostContext)
