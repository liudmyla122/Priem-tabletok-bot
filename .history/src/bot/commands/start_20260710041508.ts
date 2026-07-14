import type { MyContext } from '../instance'
import { findOrCreateTelegramUser } from '../../services/userService'
import { getRemainingTrialDays } from '../../services/subscriptionService'

export async function startCommand(ctx: MyContext) {
  if (!ctx.from) return

  const name = ctx.from.first_name || ctx.from.username || 'Пользователь'
  const user = await findOrCreateTelegramUser(String(ctx.from.id), name)
  const trialDays = await getRemainingTrialDays(user.id)

  await ctx.reply(
    `👋 Привет, ${name}!\n\n` +
      `Я помогу не забывать про приём лекарств и визиты к врачу — тебе или человеку, о котором ` +
      `ты заботишься: пожилому родителю, ребёнку или взрослому с инвалидностью — независимо от возраста ` +
      `и от того, умеет ли этот человек пользоваться Telegram.\n\n` +
      `🎁 Тебе доступен бесплатный пробный период: <b>${trialDays} дн.</b>\n\n` +
      `<b>Что я умею:</b>\n` +
      `/add_elder — добавить подопечного (даже если у него нет Telegram — тогда напоминания пойдут по SMS)\n` +
      `/add_medication — добавить напоминание о лекарстве\n` +
      `/add_appointment — добавить напоминание о визите к врачу\n` +
      `/my_elders — список подопечных\n` +
      `/my_plan — полный план приёма лекарств на сегодня (со счётом дней курса)\n` +
      `/accessibility — настройки доступности (режимы для незрячих и глухих)\n` +
      `/status — статус подписки\n` +
      `/subscribe — оформить платную подписку после пробного периода\n` +
      `/help — справка`,
    { parse_mode: 'HTML' }
  )
}

export async function helpCommand(ctx: MyContext) {
  await ctx.reply(
    `<b>Справка</b>\n\n` +
      `1️⃣ Если ты заботишься о ком-то — пожилом родителе, ребёнке или взрослом с инвалидностью — ` +
      `используй /add_elder, чтобы добавить его как подопечного.\n` +
      `   Если у него есть Telegram и он умеет им пользоваться — попроси его сначала нажать /start у ` +
      `этого бота, затем свяжи через /add_elder.\n` +
      `   Если Telegram нет, или человеку сложно им пользоваться — укажи его номер телефона, и ` +
      `напоминания будут приходить простым SMS, а подтвердить приём можно одним словом в ответ.\n\n` +
      `2️⃣ Добавь лекарство командой /add_medication — укажи название, дозировку и время приёма.\n\n` +
      `3️⃣ Добавь визит к врачу командой /add_appointment — укажи название и дату/время.\n\n` +
      `4️⃣ Когда придёт напоминание — нужно нажать кнопку подтверждения (в Telegram) или ответить словом ` +
      `на SMS. Если не подтвердить вовремя — придёт повторное, более настойчивое напоминание, и ты как ` +
      `наблюдающий сразу об этом узнаешь.`,
    { parse_mode: 'HTML' }
  )
}
