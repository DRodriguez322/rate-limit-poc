/* eslint-disable @typescript-eslint/naming-convention */
import { Redis } from "ioredis";
import { getEnv } from "ms_nodejs_common";

// Reutilizar el token de Redis del proyecto principal si está disponible
// Si no, usar este token específico para common
export const REDIS_CONNECTION_INJECTION_TOKEN = `rate-limit-poc/src/common/shared/infrastructure/cache-factory`;

// También exportar el token del proyecto principal para compatibilidad
export const REDIS_CONNECTION_INJECTION_TOKEN_MAIN = `rate-limit-poc/src/features/get-api/infrastructure/redis-connection-factory`;

export type Connection = Redis;

/**
 * Factory para crear conexión Redis compartida
 * Reutiliza la misma configuración que el proyecto principal
 */
export const initializeRedisConnection = () => {
  const [_, host, port] = getEnv(`REDIS_QUEUE_HOST`, true)?.split(`:`) ?? [];

  return new Redis({
    host: host.slice(2),
    port: parseInt(port.split(`?`)[0]),
    db: parseInt(port.split(`?`)[1].split(`=`)[1]),
    maxRetriesPerRequest: null,
    password: getEnv(`REDIS_QUEUE_PASSWORD`, false),
  });
};
