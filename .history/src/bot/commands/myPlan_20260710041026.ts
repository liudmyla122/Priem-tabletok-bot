import type { MyContext } from '../instance'
import { InlineKeyboard } from '../instance'
import { prisma } from '../../db/client'
import { DateTime } from 'luxon'
import { getEldersForChild } from '../../services/userService'
import { getDailyPlan } from '../../services/medicationService'

/** Команда /my_plan — показывает полный план приёма на сегодня */
export async function myPlanCommand(ctx: MyContext) {
  if (!ctx.from) return
  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
  })
  if (!user) {
    await ctx.reply('Сначала выполни /start')
    return
  }

  const elders = await getEldersForChild(user.id)
  const keyboard = new InlineKeyboard()
  keyboard.text('Себе', 'plan_for_' + user.id).row()
  for (const elder of elders) {
    keyboard.text(elder.name, 'plan_for_' + elder.id).row()
  }

  await ctx.reply('Чей план приёма на сегодня показать?', {
    reply_markup: keyboard,
  })
}

/** Обработка выбора подопечного для плана */
export async function handlePlanForSelection(ctx: MyContext) {
  const match = ctx.callbackQuery?.data?.match(/^plan_for_(.+)$/)
  if (!match) return
  const elderId = match[1]

  await ctx.answerCallbackQuery()
  await ctx.editMessageReplyMarkup(undefined)

  const elder = await prisma.user.findUnique({ where: { id: elderId } })
  if (!elder) {
    await ctx.reply('Подопечный не найден.')
    return
  }

  const plan = await getDailyPlan(elderId)
  const whenText = DateTime.now()
    .setZone(elder.timezone)
    .setLocale('ru')
    .toFormat('d MMMM')

  if (plan.length === 0) {
    await ctx.reply(
      `📋 План приёма для ${elder.name} на ${whenText}: пока нет запланированных лекарств.`
    )
    return
  }

  const lines: string[] = [`📋 План приёма для ${elder.name} на ${whenText}:`]
  for (const item of plan) {
    lines.push(`\n🕒 ${item.time}`)
    for (const med of item.medications) {
      const dosage = med.dosage ? ` (${med.dosage})` : ''
      const progress = med.progress.totalDays
        ? `День ${med.progress.dayNumber} из ${med.progress.totalDays}, подтверждено ${med.progress.confirmedDays} дн.`
        : `Постоянный приём, подтверждено ${med.progress.confirmedDays} дн.`
      lines.push(`• ${med.name}${dosage} — ${progress}`)
    }
  }

  await ctx.reply(lines.join('\n'))
}
