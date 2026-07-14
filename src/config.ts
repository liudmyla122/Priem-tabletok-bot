import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Отсутствует обязательная переменная окружения: ${name}. Проверь .env файл.`
    )
  }
  return value
}

export const config = {
  botToken: required('BOT_TOKEN'),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    enabled: Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ),
  },

  telegramPayments: {
    // provider_token выдаёт @BotFather после подключения LiqPay в разделе Payments (см. README)
    liqpayProviderToken: process.env.TELEGRAM_LIQPAY_PROVIDER_TOKEN || '',
    enabled: Boolean(process.env.TELEGRAM_LIQPAY_PROVIDER_TOKEN),
  },

  port: Number(process.env.PORT || 3000),
  publicUrl: process.env.PUBLIC_URL || '',

  trialDays: Number(process.env.TRIAL_DAYS || 3),
  subscriptionPriceEur: Number(process.env.SUBSCRIPTION_PRICE_EUR || 3),
  subscriptionCurrency: process.env.SUBSCRIPTION_CURRENCY || 'EUR',
  billingReminderDaysBefore: 1,

  // Голосовой синтез (TTS) для незрячих пользователей (режим BLIND).
  // Провайдер: "openai" (нужен OPENAI_API_KEY). Если не задан — голос не генерируется,
  // уведомления отправляются только текстом (фолбэк).
  tts: {
    provider: process.env.TTS_PROVIDER || '',
    apiKey: process.env.OPENAI_API_KEY || process.env.TTS_API_KEY || '',
    voice: process.env.TTS_VOICE || 'alloy',
  },

  // Пока false — бот полностью бесплатен для всех, независимо от триала/подписки.
  // Когда наберётся достаточно пользователей, поставь true в .env и перезапусти бота — включится
  // обычная логика (пробный период → просьба оформить платную подписку).
  billingEnabled:
    (process.env.BILLING_ENABLED || 'false').toLowerCase() === 'true',
}
