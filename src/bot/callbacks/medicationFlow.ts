import type { MyContext } from '../instance'
import { prisma } from '../../db/client'
import { isValidTimeFormat } from '../../services/timeUtils'
import { scheduleMedicationJob } from '../../scheduler/queues'

export async function handleMedForSelection(ctx: MyContext) {
  const match = ctx.callbackQuery?.data?.match(/^med_for_(.+)$/)
  if (!match) return
  const elderId = match[1]

  await ctx.answerCallbackQuery()
  ctx.session.draftMedication = { elderId }
  ctx.session.step = 'awaiting_med_name'
  await ctx.editMessageReplyMarkup(undefined)
  await ctx.reply('Как называется лекарство?')
}

export async function handleMedNameInput(ctx: MyContext, text: string) {
  ctx.session.draftMedication.name = text.trim()
  ctx.session.step = 'awaiting_med_dosage'
  await ctx.reply(
    'Укажи дозировку (например "1 таблетка" или "500 мг"). Если не важно — напиши "-"'
  )
}

export async function handleMedDosageInput(ctx: MyContext, text: string) {
  ctx.session.draftMedication.dosage =
    text.trim() === '-' ? undefined : text.trim()
  ctx.session.step = 'awaiting_med_time'
  await ctx.reply(
    'Во сколько принимать? Укажи одно или несколько времён через запятую в формате ЧЧ:ММ.\n' +
      'Например: 09:00 или 09:00, 21:00'
  )
}

export async function handleMedTimeInput(ctx: MyContext, text: string) {
  const times = text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const invalid = times.filter((t) => !isValidTimeFormat(t))
  if (invalid.length > 0 || times.length === 0) {
    await ctx.reply(
      'Некорректный формат времени. Пример: 09:00 или 09:00, 21:00. Попробуй ещё раз.'
    )
    return
  }

  ctx.session.draftMedication.times = times
  ctx.session.step = 'awaiting_med_duration'
  await ctx.reply(
    'На сколько дней курс приёма? Введи число дней, например 14.\n' +
      'Если лекарство принимать постоянно (без срока) — напиши 0.'
  )
}

/** Шаг ввода длительности курса: сохраняет лекарство с startDate/durationDays/endDate */
export async function handleMedDurationInput(ctx: MyContext, text: string) {
  const raw = text.trim()
  let durationDays: number | null = null
  if (raw !== '0') {
    const n = Number(raw)
    if (!Number.isInteger(n) || n <= 0 || n > 3650) {
      await ctx.reply(
        'Введи целое число дней (например 14) или 0, если принимать постоянно.'
      )
      return
    }
    durationDays = n
  }

  const draft = ctx.session.draftMedication
  const times = draft.times
  if (!draft.elderId || !draft.name || !times || times.length === 0) {
    await ctx.reply(
      'Что-то пошло не так, начни заново командой /add_medication'
    )
    ctx.session.step = 'idle'
    return
  }

  const elder = await prisma.user.findUnique({ where: { id: draft.elderId } })
  if (!elder) {
    await ctx.reply(
      'Подопечный не найден. Начни заново командой /add_medication'
    )
    ctx.session.step = 'idle'
    return
  }

  const creator = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from!.id) },
  })
  if (!creator) return

  const startDate = new Date()
  const endDate = durationDays
    ? new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
    : null
  const cronSchedule = times.join(',') // исходный список времён, напр. "09:00,21:30"

  const medication = await prisma.medication.create({
    data: {
      elderId: elder.id,
      createdById: creator.id,
      name: draft.name,
      dosage: draft.dosage,
      cronSchedule,
      startDate,
      durationDays,
      endDate,
    },
  })

  await scheduleMedicationJob(medication.id, cronSchedule, elder.timezone)

  ctx.session.step = 'idle'
  ctx.session.draftMedication = {}

  const courseText = durationDays
    ? `Курс на ${durationDays} дн. (до ${endDate!.toLocaleDateString('ru-RU')})`
    : 'Постоянный приём (без срока)'
  await ctx.reply(
    `✅ Готово! Лекарство "${medication.name}" будет напоминать в: ${times.join(
      ', '
    )} каждый день для ${elder.name}.\n${courseText}.`
  )
}
