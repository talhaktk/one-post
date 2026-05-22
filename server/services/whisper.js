const OpenAI = require('openai')
const fs = require('fs')
const path = require('path')

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const transcribeAudio = async (audioPath, language = 'auto') => {
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1',
    response_format: 'srt',
    language: language === 'auto' ? undefined : language === 'urdu' ? 'ur' : 'en'
  })
  return response
}

const generateSRT = async (audioPath, outputSrtPath, language = 'both') => {
  if (language === 'both') {
    const srt = await transcribeAudio(audioPath, 'auto')
    fs.writeFileSync(outputSrtPath, srt)
    return outputSrtPath
  } else {
    const srt = await transcribeAudio(audioPath, language)
    fs.writeFileSync(outputSrtPath, srt)
    return outputSrtPath
  }
}

module.exports = { transcribeAudio, generateSRT }
