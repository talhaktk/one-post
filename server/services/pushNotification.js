let admin
try {
  admin = require('firebase-admin')
  if (!admin.apps.length && process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      })
    })
  }
} catch (err) {
  console.log('[Push] Firebase not configured:', err.message)
}

const sendBreakingAlert = async (alert) => {
  if (!admin?.apps?.length) return
  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Get all FCM tokens
  const { data: users } = await supabase.from('users').select('fcm_token').not('fcm_token', 'is', null)
  if (!users?.length) return

  const tokens = users.map(u => u.fcm_token).filter(Boolean)
  if (!tokens.length) return

  const message = {
    notification: {
      title: `${alert.priority === 'urgent' ? '🔴' : '🟠'} ${alert.priority.toUpperCase()} — ${alert.source_name}`,
      body: alert.headline.slice(0, 80) + (alert.headline.length > 80 ? '...' : '')
    },
    data: { alert_id: alert.id, priority: alert.priority },
    tokens
  }

  try {
    const response = await admin.messaging().sendEachForMulticast(message)
    console.log(`[Push] Sent to ${response.successCount}/${tokens.length} devices`)
  } catch (err) {
    console.error('[Push] Error:', err.message)
  }
}

module.exports = { sendBreakingAlert }
