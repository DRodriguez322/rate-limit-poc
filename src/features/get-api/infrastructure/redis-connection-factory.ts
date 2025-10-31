/* eslint-disable @typescript-eslint/naming-convention */
import { Redis } from 'ioredis';
import { getEnv } from 'ms_nodejs_common';

export const REDIS_CONNECTION_INJECTION_TOKEN = `rate-limit-poc/src/features/get-api/infrastructure/redis-connection-factory`;

export type Connection = Redis;

export const initializeRedisConnection = () => {

  const [_, host, port] = getEnv(`REDIS_QUEUE_HOST`, true)?.split(`:`) ?? [];

  return new Redis({
    host: host.slice(2),
    port: parseInt(port.split(`?`)[0]),
    db: parseInt(port.split(`?`)[1].split(`=`)[1]),
    // port: +getEnv(`BULLMQ_REDIS_PORT`, true)!,
    maxRetriesPerRequest: null,
    password: getEnv(`REDIS_QUEUE_PASSWORD`, false),
  });

};
