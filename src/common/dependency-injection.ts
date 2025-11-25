import "reflect-metadata";
import { container } from "tsyringe";
import { PrismaClient } from "@prisma/client";
import {
  PassengerServiceContract,
  PassengerServiceImpl,
} from "./passenger/application/passenger-service-impl";
import {
  PassengerRepositoryContract,
  PassengerRepositoryPrisma,
} from "./passenger/infrastructure/passenger-repository-prisma";
import {
  FlightServiceContract,
  FlightServiceImpl,
} from "./flight/application/flight-service-impl";
import {
  FlightRepositoryContract,
  FlightRepositoryPrisma,
} from "./flight/infrastructure/flight-repository-prisma";
import {
  CarrierServiceContract,
  CarrierServiceImpl,
} from "./carrier/application/carrier-service-impl";
import {
  CarrierRepositoryContract,
  CarrierRepositoryPrisma,
} from "./carrier/infrastructure/carrier-repository-prisma";
import {
  FareCodeServiceContract,
  FareCodeServiceImpl,
} from "./fare-code/application/fare-code-service-impl";
import {
  FareCodeRepositoryContract,
  FareCodeRepositoryPrisma,
} from "./fare-code/infrastructure/fare-code-repository-prisma";
import {
  initializeRedisConnection,
  REDIS_CONNECTION_INJECTION_TOKEN,
  REDIS_CONNECTION_INJECTION_TOKEN_MAIN,
} from "./shared/infrastructure/cache-factory";

/**
 * Configura la inyección de dependencias para los servicios comunes
 * Debe ser llamado al inicio de la aplicación
 */
export function configureCommonServices(): void {
  // Inicializar Prisma Client (singleton)
  const prisma = new PrismaClient();
  container.registerInstance(PrismaClient, prisma);

  // Inicializar Redis Connection (singleton)
  // Intentar usar la conexión Redis existente del proyecto principal
  let redis;
  try {
    redis = container.resolve(REDIS_CONNECTION_INJECTION_TOKEN_MAIN);
    // Registrar también con el token común para compatibilidad
    container.registerInstance(REDIS_CONNECTION_INJECTION_TOKEN, redis);
  } catch {
    // Si no existe, crear una nueva
    redis = initializeRedisConnection();
    container.registerInstance(REDIS_CONNECTION_INJECTION_TOKEN, redis);
    // También registrar como token principal para compatibilidad
    container.registerInstance(REDIS_CONNECTION_INJECTION_TOKEN_MAIN, redis);
  }

  // Registrar Repositorios
  container.register<PassengerRepositoryContract>(
    PassengerRepositoryContract.name,
    {
      useFactory: () => new PassengerRepositoryPrisma(prisma),
    }
  );

  container.register<FlightRepositoryContract>(FlightRepositoryContract.name, {
    useFactory: () => new FlightRepositoryPrisma(prisma),
  });

  container.register<CarrierRepositoryContract>(
    CarrierRepositoryContract.name,
    {
      useFactory: () => new CarrierRepositoryPrisma(prisma),
    }
  );

  container.register<FareCodeRepositoryContract>(
    FareCodeRepositoryContract.name,
    {
      useFactory: () => new FareCodeRepositoryPrisma(prisma),
    }
  );

  // Registrar Servicios
  container.register<PassengerServiceContract>(
    PassengerServiceContract.name,
    PassengerServiceImpl
  );

  container.register<FlightServiceContract>(
    FlightServiceContract.name,
    FlightServiceImpl
  );

  container.register<CarrierServiceContract>(
    CarrierServiceContract.name,
    CarrierServiceImpl
  );

  container.register<FareCodeServiceContract>(
    FareCodeServiceContract.name,
    FareCodeServiceImpl
  );
}
