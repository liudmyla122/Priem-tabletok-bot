import type { MyContext } from '../instance'
import { InlineKeyboard } from '../instance'
import { prisma } from '../../db/client'
import { AccessibilityMode } from '@prisma/client'

const MODE_LABELS: Record<AccessibilityMode, string> = {
  [AccessibilityMode.NONE]: 'Обычный режим',
  [AccessibilityMode.BLIND]: 'Незрячий (голосовые уведомления)',
  [AccessibilityMode.DEAF]: 'Глухой/слабослышащий (визуально-акцентные)',
}

/** Команда /accessibility — выбор режима доступности */
export async function accessibilityCommand(ctx: MyContext) {
  if (!ctx.from) return
  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
  })
  if (!user) {
    await ctx.reply('Сначала выполни /start')
    return
  }

  const keyboard = new InlineKeyboard()
  keyboard
    .text('👁 Обычный', 'access_mode_' + AccessibilityMode.NONE)
    .row()
    .text('🗣 Незрячий (голос)', 'access_mode_' + AccessibilityMode.BLIND)
    .row()
    .text('👁‍🗨 Глухой (визуально)', 'access_mode_' + AccessibilityMode.DEAF)
    .row()

  const current = MODE_LABELS[user.accessibilityMode]
  await ctx.reply(
    `Текущий режим доступности: ${current}.\n\n` +
      `Выбери подходящий:\n` +
      `• Обычный — текст и кнопки.\n` +
      `• Незрячий — напоминания дублируются голосом, подтвердить приём можно голосовым сообщением.\n` +
      `• Глухой — акцент на визуальное (текст/анимация), без звука.`,
    { reply_markup: keyboard }
  )
}

/** Обработка выбора режима доступности */
export async function handleAccessibilityMode(ctx: MyContext) {
  const match = ctx.callbackQuery?.data?.match(/^access_mode_(.+)$/)
  if (!match) return
  const mode = match[1] as AccessibilityMode
  if (!Object.values(AccessibilityMode).includes(mode)) return

  if (!ctx.from) return
  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
  })
  if (!user) return

  await prisma.user.update({
    where: { id: user.id },
    data: { accessibilityMode: mode },
  })
  await ctx.answerCallbackQuery()
  await ctx.editMessageReplyMarkup(undefined)
  await ctx.reply(`✅ Режим доступности установлен: ${MODE_LABELS[mode]}.`)
}
