import type { MyContext } from '../instance'
import { prisma } from '../../db/client'
import { AccessibilityMode } from '@prisma/client'
import { confirmLatestPendingReminderByTelegramId } from '../../services/reminderService'

/**
 * Голосовое подтверждение приёма для незрячих пользователей (режим BLIND).
 * Любое входящее голосовое сообщение подтверждает последнее
 * неподтверждённое напоминание этого пользователя.
 * Для остальных режимов голос игнорируется (есть кнопка/ответ SMS).
 */
export async function handleVoiceConfirmation(ctx: MyContext) {
  if (!ctx.from) return

  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
    select: { accessibilityMode: true },
  })
  if (user?.accessibilityMode !== AccessibilityMode.BLIND) return

  const confirmed = await confirmLatestPendingReminderByTelegramId(
    String(ctx.from.id)
  )

  if (confirmed) {
    await ctx.reply('✅ Приём подтверждён. Спасибо!')
  } else {
    await ctx.reply(
      'Не нашёл активного напоминания для подтверждения. ' +
        'Если ошибка — нажмите кнопку в последнем сообщении.'
    )
  }
}
