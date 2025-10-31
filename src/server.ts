import 'reflect-metadata';
import dotenv from 'dotenv';

dotenv.config();

import { GetApiServiceImpl } from './features/get-api/application/get-api-service-impl';
import { GetPocApi } from './features/get-api/infrastructure/api/v1/get-poc-api';
import { GetApiRepositoryPrisma } from './features/get-api/infrastructure/get-api-repository-prisma';
import { type Express } from 'express';
import {
  logError,
  registerAllCommonDependenciesAndComponents,
  startDaprServer,
} from 'ms_nodejs_common';
import { container } from 'tsyringe';
import { GetApiRepositoryContract } from './features/get-api/domain/contracts/data-streamer-repository';
import { GetApiServiceContract } from './features/get-api/domain/contracts/data-streamer-service';
import { Connection, initializeRedisConnection, REDIS_CONNECTION_INJECTION_TOKEN } from './features/get-api/infrastructure/redis-connection-factory';

export const MICROSERVICE_NAME = 'Data streamer';

export const initializeAppDependencies = async () => {
  await registerAllCommonDependenciesAndComponents();

  container.registerSingleton<GetApiRepositoryContract>(
    GetApiRepositoryContract.name,
    GetApiRepositoryPrisma
  );
  container.registerSingleton<GetApiServiceContract>(
    GetApiServiceContract.name,
    GetApiServiceImpl
  );
};

const setupExpressApp = (app: Express) => {
  app.use(`/api/`, (req, res, next) => {
    const api = container.resolve(GetPocApi);
    api.getRouter()(req, res, next);
  });
};

export const buildRedisConnection = () => {
  const connection = initializeRedisConnection();
  container.registerInstance<Connection>(
    REDIS_CONNECTION_INJECTION_TOKEN,
    connection
  );
};

const main = async () => {
  await initializeAppDependencies();

  await startDaprServer({
    swaggerParams: {
      title: MICROSERVICE_NAME,
      version: `1.0.0`,
      description: `Data streamer microservice`,
    },
    onAppInitializedFunc: async () => {
      buildRedisConnection();
    },
    appExtendFunc: setupExpressApp,
    pubsubSubscriptionsByServiceList: [],
  });
};

main().catch((e: Error) => {
  logError(`main`, e);
});

