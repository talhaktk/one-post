const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let isRunning = false

const checkDuePosts = async () => {
  if (isRunning) return
  isRunning = true
  try {
    const { data: posts } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())

    if (!posts?.length) return

    for (const post of posts) {
      await processScheduledPost(post)
    }
  } catch (err) {
    console.error('[Scheduler] Error:', err.message)
  } finally {
    isRunning = false
  }
}

const processScheduledPost = async (post) => {
  try {
    console.log(`[Scheduler] Processing post ${post.id}`)
    await supabase.from('scheduled_posts').update({ status: 'publishing' }).eq('id', post.id)

    // Dynamically import publish service to avoid circular deps
    const publishService = require('./publishService')
    const results = await publishService.publishScheduledPost(post)

    await supabase.from('scheduled_posts').update({
      status: 'published',
      published_at: new Date().toISOString()
    }).eq('id', post.id)

    // Save results
    if (results?.length) {
      await supabase.from('scheduled_post_results').insert(
        results.map(r => ({ scheduled_post_id: post.id, ...r }))
      )
    }

    // Handle recurrence
    if (post.is_recurring && post.recurrence_rule) {
      await createNextRecurrence(post)
    }
  } catch (err) {
    console.error(`[Scheduler] Post ${post.id} failed:`, err.message)
    await supabase.from('scheduled_posts').update({
      status: 'failed',
      failure_reason: err.message
    }).eq('id', post.id)
  }
}

const createNextRecurrence = async (post) => {
  const baseDate = new Date(post.scheduled_at)
  const next = new Date(baseDate)

  if (post.recurrence_rule === 'daily') next.setDate(next.getDate() + 1)
  else if (post.recurrence_rule === 'weekly') next.setDate(next.getDate() + 7)
  else if (post.recurrence_rule === 'monthly') next.setMonth(next.getMonth() + 1)

  await supabase.from('scheduled_posts').insert({
    ...post,
    id: undefined,
    status: 'scheduled',
    scheduled_at: next.toISOString(),
    created_at: undefined,
    published_at: null,
    failure_reason: null
  })
}

const start = () => {
  console.log('[Scheduler] Starting — checks every 1 minute')
  checkDuePosts()
  setInterval(checkDuePosts, 60 * 1000)
}

module.exports = { start, checkDuePosts }
