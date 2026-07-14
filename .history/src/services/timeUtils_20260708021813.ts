/**
 * Преобразует список времён приёма ["09:00", "21:00"] в cron-выражение "0 9,21 * * *"
 * Работает только для времён, кратных минутам (без секунд).
 */
export function timesToCron(times: string[]): string {
  const hours = new Set<number>();
  const minutesByHour: Record<number, number[]> = {};

  for (const t of times) {
    const [hStr, mStr] = t.split(":");
    const h = Number(hStr);
    const m = Number(mStr ?? "0");
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      throw new Error(`Некорректное время: ${t}. Используй формат ЧЧ:ММ, например 09:00`);
    }
    hours.add(h);
    minutesByHour[h] = minutesByHour[h] || [];
    minutesByHour[h].push(m);
  }

  // Упрощение: берём общий набор минут (обычно у всех приёмов минута одинаковая, например :00)
  const allMinutes = new Set<number>();
  Object.values(minutesByHour).forEach((arr) => arr.forEach((m) => allMinutes.add(m)));

  if (allMinutes.size === 1) {
    const minute = [...allMinutes][0];
    const hourList = [...hours].sort((a, b) => a - b).join(",");
    return `${minute} ${hourList} * * *`;
  }

  // Если минуты разные — строим через запятую по каждому часу отдельно не получится одним cron,
  // поэтому в этом случае берём минуту 0 по умолчанию (упрощение для MVP)
  const hourList = [...hours].sort((a, b) => a - b).join(",");
  return `0 ${hourList} * * *`;
}

export function isValidTimeFormat(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
}
