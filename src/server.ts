import "reflect-metadata";
import dotenv from "dotenv";

dotenv.config();

import { GetApiServiceImpl } from "./features/get-api/application/get-api-service-impl";
import { GetPocApi } from "./features/get-api/infrastructure/api/v1/get-poc-api";
import { GetApiRepositoryPrisma } from "./features/get-api/infrastructure/get-api-repository-prisma";
import { type Express } from "express";
import {
  logError,
  registerAllCommonDependenciesAndComponents,
  startDaprServer,
} from "ms_nodejs_common";
import { container } from "tsyringe";
import { GetApiRepositoryContract } from "./features/get-api/domain/contracts/data-streamer-repository";
import { GetApiServiceContract } from "./features/get-api/domain/contracts/data-streamer-service";
import {
  Connection,
  initializeRedisConnection,
  REDIS_CONNECTION_INJECTION_TOKEN,
} from "./features/get-api/infrastructure/redis-connection-factory";
import { EditPassengerServiceImpl } from "./features/edit-passenger/application/edit-passenger-service-impl";
import { EditPassengerApi } from "./features/edit-passenger/infrastructure/api/v1/edit-passenger-api";
import { EditPassengerRepositoryPrisma } from "./features/edit-passenger/infrastructure/edit-passenger-repository-prisma";
import { EditPassengerRepositoryContract } from "./features/edit-passenger/domain/contracts/edit-passenger-repository";
import { EditPassengerServiceContract } from "./features/edit-passenger/domain/contracts/edit-passenger-service";
import { configureCommonServices } from "./common/dependency-injection";
import { PrismaClient } from "@prisma/client";

export const MICROSERVICE_NAME = "POC RPS";

export const initializeAppDependencies = async () => {
  await registerAllCommonDependenciesAndComponents();

  // Configurar servicios comunes (passenger, flight, carrier, fare-code)
  // Esto también registra PrismaClient
  configureCommonServices();

  // Obtener PrismaClient registrado por configureCommonServices
  const prisma = container.resolve(PrismaClient);

  // Registrar repositorios y servicios de get-api
  container.registerSingleton<GetApiRepositoryContract>(
    GetApiRepositoryContract.name,
    GetApiRepositoryPrisma
  );
  container.registerSingleton<GetApiServiceContract>(
    GetApiServiceContract.name,
    GetApiServiceImpl
  );

  // Registrar repositorios y servicios de edit-passenger
  container.register<EditPassengerRepositoryContract>(
    EditPassengerRepositoryContract.name,
    {
      useFactory: () => new EditPassengerRepositoryPrisma(prisma),
    }
  );
  container.register<EditPassengerServiceContract>(
    EditPassengerServiceContract.name,
    EditPassengerServiceImpl
  );
};

const setupExpressApp = (app: Express) => {
  // Registrar rutas de get-api
  app.use(`/api/`, (req, res, next) => {
    const api = container.resolve(GetPocApi);
    api.getRouter()(req, res, next);
  });

  // Registrar rutas de edit-passenger
  app.use(`/api/`, (req, res, next) => {
    const api = container.resolve(EditPassengerApi);
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
