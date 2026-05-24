const wait = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000))

const retry = async (fn, maxRetries = 3, delaySeconds = 15, onRetry) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries) throw err
      console.log(`Attempt ${attempt} failed: ${err.message}. Retrying in ${delaySeconds}s...`)
      if (onRetry) try { onRetry({ attempt, maxRetries, error: err.message, nextDelay: delaySeconds }) } catch {}
      await wait(delaySeconds)
    }
  }
}

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

module.exports = { wait, retry, formatBytes }
