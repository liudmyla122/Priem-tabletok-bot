/**
 * Преобразует одно время приёма "ЧЧ:ММ" в cron-выражение "m h * * *".
 * Каждое время планируется отдельной повторяющейся задачей BullMQ,
 * поэтому напоминания с разными минутами (например 09:00 и 21:30) не теряются.
 */
export function timeToCron(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr ?? "0");
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Некорректное время: ${time}. Используй формат ЧЧ:ММ, например 09:00`);
  }
  return `${m} ${h} * * *`;
}

export function isValidTimeFormat(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
}
