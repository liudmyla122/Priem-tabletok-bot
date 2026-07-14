import { bot, InlineKeyboard } from '../bot/instance'
import path from 'path'
import fs from 'fs'
import { InputFile } from 'grammy'
import { prisma } from '../db/client'
import { AccessibilityMode } from '@prisma/client'
import { generateSpeech } from './ttsService'
import { getMedicationProgress } from './medicationService'

// Папка с заготовленными анимациями (GIF/MP4). Положи туда свои файлы —
// см. README раздел "Анимации" за рекомендациями по созданию.
const ASSETS_DIR = path.join(__dirname, '..', 'assets')

const MED_ANIMATIONS = ['pill-morning.mp4', 'pill-day.mp4', 'pill-evening.mp4']
const APPT_ANIMATION = 'appointment-reminder.mp4'
const ESCALATION_ANIMATION = 'escalation-alert.mp4'

function pickAnimation(files: string[]): string | null {
  const file = files[Math.floor(Math.random() * files.length)]
  const fullPath = path.join(ASSETS_DIR, file)
  return fs.existsSync(fullPath) ? fullPath : null
}

interface DeliverOptions {
  telegramId: string
  captionHtml: string // HTML-текст для зрячих (с эмодзи-смыслом в тексте, не только в значке)
  plainText: string // чистый текст для голоса (без тегов и эмодзи)
  confirmButtonText?: string
  callbackData?: string
  animationFile?: string | null
}

/**
 * Единая доставка с учётом режима доступности получателя:
 *  - BLIND: голосовое сообщение (TTS) + текст с кнопкой подтверждения
 *  - DEAF:  визуально-акцентный текст + анимация, без звука
 *  - NONE:  текст + анимация (фолбэк на текст, если анимации нет)
 * Тексты строятся так, чтобы смысл был понятен и скринридером (без опоры только на эмодзи).
 */
async function deliverAccessible(opts: DeliverOptions): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { telegramId: opts.telegramId },
    select: { accessibilityMode: true },
  })
  const mode = user?.accessibilityMode ?? AccessibilityMode.NONE

  const keyboard =
    opts.confirmButtonText && opts.callbackData
      ? new InlineKeyboard().text(opts.confirmButtonText, opts.callbackData)
      : undefined

  // Незрячие: дублируем напоминание голосом
  if (mode === AccessibilityMode.BLIND) {
    const speech = await generateSpeech(opts.plainText)
    if (speech) {
      await bot.api.sendVoice(opts.telegramId, new InputFile(speech.audio))
    }
  }

  // Визуальное сообщение (текст + кнопка). Для глухих — всегда анимация, если есть.
  const useAnimation =
    Boolean(opts.animationFile) && mode !== AccessibilityMode.BLIND
  if (useAnimation) {
    const msg = await bot.api.sendAnimation(
      opts.telegramId,
      new InputFile(opts.animationFile!),
      { caption: opts.captionHtml, parse_mode: 'HTML', reply_markup: keyboard }
    )
    return msg.message_id
  }

  const msg = await bot.api.sendMessage(opts.telegramId, opts.captionHtml, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  })
  return msg.message_id
}

/** Возвращает строку прогресса курса для события напоминания (HTML и чистый текст) */
async function progressForEvent(
  reminderEventId: string
): Promise<{ html: string; plain: string }> {
  const event = await prisma.reminderEvent.findUnique({
    where: { id: reminderEventId },
    select: { medicationId: true },
  })
  if (!event?.medicationId) return { html: '', plain: '' }

  const p = await getMedicationProgress(event.medicationId)
  if (p.totalDays) {
    return {
      html: `\n📅 День ${p.dayNumber} из ${p.totalDays} (подтверждено ${p.confirmedDays} дн.).`,
      plain: ` День ${p.dayNumber} из ${p.totalDays}, подтверждено ${p.confirmedDays} дней.`,
    }
  }
  if (p.confirmedDays > 0) {
    return {
      html: `\n📅 Подтверждено ${p.confirmedDays} дн.`,
      plain: ` Подтверждено ${p.confirmedDays} дней.`,
    }
  }
  return { html: '', plain: '' }
}

export async function sendMedicationReminderToTelegram(params: {
  telegramId: string
  medName: string
  dosage?: string | null
  reminderEventId: string
}): Promise<number> {
  const animation = pickAnimation(MED_ANIMATIONS)
  const progress = await progressForEvent(params.reminderEventId)
  const dosageLine = params.dosage
    ? `\nДозировка: ${escapeHtml(params.dosage)}`
    : ''

  const captionHtml =
    `💊 <b>Пора принять лекарство!</b>\n\n` +
    `Название: <b>${escapeHtml(params.medName)}</b>${dosageLine}${
      progress.html
    }`
  const plainText =
    `Пора принять лекарство. Название: ${params.medName}.` +
    (params.dosage ? ` Дозировка: ${params.dosage}.` : '') +
    progress.plain +
    ` Нажмите кнопку подтверждения.`

  return deliverAccessible({
    telegramId: params.telegramId,
    captionHtml,
    plainText,
    confirmButtonText: '✅ Я принял(а) лекарство',
    callbackData: `confirm_med_${params.reminderEventId}`,
    animationFile: animation,
  })
}

export async function sendAppointmentReminderToTelegram(params: {
  telegramId: string
  title: string
  location?: string | null
  whenText: string
  reminderEventId: string
}): Promise<number> {
  const animation = pickAnimation([APPT_ANIMATION])
  const locationLine = params.location
    ? `\nГде: ${escapeHtml(params.location)}`
    : ''

  const captionHtml =
    `📅 <b>Напоминание о визите!</b>\n\n` +
    `${escapeHtml(params.title)}\n` +
    `Когда: ${params.whenText}${locationLine}`
  const plainText =
    `Напоминание о визите. ${params.title}. Когда: ${params.whenText}` +
    (params.location ? `. Где: ${params.location}` : '') +
    `. Нажмите кнопку подтверждения.`

  return deliverAccessible({
    telegramId: params.telegramId,
    captionHtml,
    plainText,
    confirmButtonText: '✅ Подтверждаю, иду',
    callbackData: `confirm_appt_${params.reminderEventId}`,
    animationFile: animation,
  })
}

/** Более настойчивое повторное сообщение, если подтверждения так и не было */
export async function sendEscalationReminder(params: {
  telegramId: string
  text: string
  callbackData: string
  confirmButtonText: string
}): Promise<void> {
  const animation = pickAnimation([ESCALATION_ANIMATION])
  const captionHtml = `⚠️ ${escapeHtml(params.text)}`
  const plainText = `${params.text}. Нажмите кнопку подтверждения.`

  await deliverAccessible({
    telegramId: params.telegramId,
    captionHtml,
    plainText,
    confirmButtonText: params.confirmButtonText,
    callbackData: params.callbackData,
    animationFile: animation,
  })
}

/** Уведомляет ребёнка (наблюдателя), что родитель подтвердил/пропустил приём */
export async function notifyChildAboutStatus(params: {
  childTelegramId: string
  elderName: string
  itemLabel: string
  confirmed: boolean
}): Promise<void> {
  const text = params.confirmed
    ? `${params.elderName} подтвердил(а): ${params.itemLabel} — вовремя.`
    : `${params.elderName} ещё не подтвердил(а): ${params.itemLabel}. Возможно, стоит позвонить и проверить.`
  const captionHtml = (params.confirmed ? '✅ ' : '❗️ ') + escapeHtml(text)
  const plainText = text

  await deliverAccessible({
    telegramId: params.childTelegramId,
    captionHtml,
    plainText,
  })
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
}
