import { prisma } from "../db/client";
import { SubscriptionStatus } from "@prisma/client";

export interface AccessCheckResult {
  allowed: boolean;
  reason?: "TRIAL_ACTIVE" | "SUBSCRIPTION_ACTIVE" | "TRIAL_EXPIRED" | "NO_SUBSCRIPTION" | "PAST_DUE";
  trialEndsAt?: Date;
}

/** Проверяет, может ли пользователь пользоваться функциями бота (триал или активная подписка) */
export async function checkAccess(userId: string): Promise<AccessCheckResult> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return { allowed: false, reason: "NO_SUBSCRIPTION" };

  const now = new Date();

  if (sub.status === SubscriptionStatus.ACTIVE) {
    if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
      await prisma.subscription.update({
        where: { userId },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      return { allowed: false, reason: "TRIAL_EXPIRED" };
    }
    return { allowed: true, reason: "SUBSCRIPTION_ACTIVE" };
  }

  if (sub.status === SubscriptionStatus.TRIALING) {
    if (sub.trialEndsAt > now) {
      return { allowed: true, reason: "TRIAL_ACTIVE", trialEndsAt: sub.trialEndsAt };
    }
    // Триал истёк — переводим статус
    await prisma.subscription.update({
      where: { userId },
      data: { status: SubscriptionStatus.EXPIRED },
    });
    return { allowed: false, reason: "TRIAL_EXPIRED" };
  }

  if (sub.status === SubscriptionStatus.PAST_DUE) {
    return { allowed: false, reason: "PAST_DUE" };
  }

  return { allowed: false, reason: "NO_SUBSCRIPTION" };
}

export async function getRemainingTrialDays(userId: string): Promise<number> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return 0;
  const diffMs = sub.trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}
