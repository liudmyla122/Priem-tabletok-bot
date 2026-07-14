import IORedis from 'ioredis'
import { config } from '../config'

// BullMQ требует maxRetriesPerRequest: null для стабильной работы очередей
// Приведение к any: BullMQ поставляет собственную копию ioredis, из-за чего
// тип корня ioredis из node_modules конфликтует с ожидаемым ConnectionOptions.
export const redisConnection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
}) as any
