import IORedis from "ioredis";
import { config } from "../config";

// BullMQ требует maxRetriesPerRequest: null для стабильной работы очередей
export const redisConnection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
});
