import { prisma } from '../db/client'

const DAY_MS = 24 * 60 * 60 * 1000

export interface MedicationProgress {
  elapsedDays: number // сколько полных дней прошло с начала курса
  dayNumber: number // текущий день курса (elapsedDays + 1), ограничен totalDays
  confirmedDays: number // сколько уникальных дней фактически подтверждено
  totalDays: number | null // длительность курса; null = постоянно
  finished: boolean // курс завершён
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / DAY_MS))
}

/** Считает прогресс курса: прошло дней + подтверждено дней */
export async function getMedicationProgress(
  medicationId: string
): Promise<MedicationProgress> {
  const med = await prisma.medication.findUnique({
    where: { id: medicationId },
    select: { startDate: true, durationDays: true, endDate: true },
  })
  if (!med) {
    return {
      elapsedDays: 0,
      dayNumber: 0,
      confirmedDays: 0,
      totalDays: null,
      finished: false,
    }
  }

  const now = new Date()
  const courseEnd = med.endDate ?? now
  const elapsedDays = daysBetween(
    med.startDate,
    courseEnd > now ? now : courseEnd
  )
  const totalDays = med.durationDays ?? null
  const dayNumber = totalDays
    ? Math.min(elapsedDays + 1, totalDays)
    : elapsedDays + 1
  const finished = Boolean(med.endDate && med.endDate < now)

  // Количество уникальных дней с подтверждённым приёмом
  const rows = await prisma.$queryRawUnsafe<{ confirmed_days: number }[]>(
    `SELECT COUNT(DISTINCT DATE("scheduledFor"))::int AS confirmed_days
     FROM "ReminderEvent"
     WHERE "medicationId" = $1 AND "confirmedAt" IS NOT NULL`,
    medicationId
  )
  const confirmedDays = Number(rows[0]?.confirmed_days ?? 0)

  return { elapsedDays, dayNumber, confirmedDays, totalDays, finished }
}

export interface PlanMedication {
  id: string
  name: string
  dosage: string | null
  progress: MedicationProgress
}

export interface PlanItem {
  time: string // "09:00"
  medications: PlanMedication[]
}

/**
 * Возвращает полный план приёма на день: активные лекарства подопечного,
 * сгруппированные по времени приёма. Учитывает только курсы, актуальные на эту дату.
 */
export async function getDailyPlan(
  elderId: string,
  when: Date = new Date()
): Promise<PlanItem[]> {
  const dayStart = new Date(when)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart.getTime() + DAY_MS)

  const meds = await prisma.medication.findMany({
    where: {
      elderId,
      active: true,
      startDate: { lte: dayEnd },
      OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
    },
    orderBy: { createdAt: 'asc' },
  })

  const byTime = new Map<string, PlanMedication[]>()
  for (const med of meds) {
    const times = med.cronSchedule
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const progress = await getMedicationProgress(med.id)
    for (const time of times) {
      if (!byTime.has(time)) byTime.set(time, [])
      byTime.get(time)!.push({
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        progress,
      })
    }
  }

  return Array.from(byTime.entries())
    .map(([time, medications]) => ({ time, medications }))
    .sort((a, b) => a.time.localeCompare(b.time))
}
