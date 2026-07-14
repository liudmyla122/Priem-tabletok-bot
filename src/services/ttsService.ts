import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { config } from '../config'

const TTS_CACHE_DIR = path.join(__dirname, '..', '..', '.tts-cache')

export interface TtsResult {
  audio: Buffer
  mimeType: string // "audio/mpeg" для mp3
}

/**
 * Генерирует голосовое сообщение из текста (для незрячих пользователей).
 *
 * Провайдер настраивается через env:
 *   TTS_PROVIDER=openai + OPENAI_API_KEY  -> OpenAI TTS (tts-1, голос из TTS_VOICE)
 *
 * Если провайдер не настроен или генерация упала — возвращает null,
 * и слой уведомлений отправляет обычный текст (фолбэк).
 */
export async function generateSpeech(text: string): Promise<TtsResult | null> {
  if (config.tts.provider === 'openai' && config.tts.apiKey) {
    try {
      return await generateWithOpenAi(text)
    } catch (err) {
      console.error('[ttsService] Не удалось сгенерировать голос:', err)
      return null
    }
  }
  return null
}

async function generateWithOpenAi(text: string): Promise<TtsResult> {
  const cacheKey = crypto
    .createHash('sha1')
    .update(`${config.tts.voice}:${text}`)
    .digest('hex')

  // Простой файловый кэш, чтобы не платить за повтор те же напоминания
  if (!fs.existsSync(TTS_CACHE_DIR))
    fs.mkdirSync(TTS_CACHE_DIR, { recursive: true })
  const cacheFile = path.join(TTS_CACHE_DIR, `${cacheKey}.mp3`)
  if (fs.existsSync(cacheFile)) {
    return { audio: fs.readFileSync(cacheFile), mimeType: 'audio/mpeg' }
  }

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.tts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: config.tts.voice || 'alloy',
      response_format: 'mp3',
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenAI TTS ошибка ${res.status}: ${await res.text()}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  fs.writeFileSync(cacheFile, buffer)
  return { audio: buffer, mimeType: 'audio/mpeg' }
}
