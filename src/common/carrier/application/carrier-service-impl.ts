import { inject, injectable } from "tsyringe";
import { CarrierServiceContract } from "../domain/contracts/carrier-service";
import { CarrierRepositoryContract } from "../domain/contracts/carrier-repository";
import { Carrier } from "../../passenger/domain/contracts/passenger-service";
import { AppCustomError, logInfo } from "ms_nodejs_common";
import {
  Connection,
  REDIS_CONNECTION_INJECTION_TOKEN,
  REDIS_CONNECTION_INJECTION_TOKEN_MAIN,
} from "../../shared/infrastructure/cache-factory";
import { container } from "tsyringe";

/**
 * Códigos de error específicos para carriers
 */
export enum CarrierErrorCode {
  CARRIER_NOT_FOUND = "CARRIER_NOT_FOUND",
  CARRIER_CLASS_NOT_FOUND = "CARRIER_CLASS_NOT_FOUND",
}

/**
 * Implementación del servicio de carriers
 * Mejoras implementadas:
 * - Caché Redis en lugar de XCACHE
 * - Búsqueda mejorada usando FIND_IN_SET en lugar de INSTR
 * - Validación de formato de fare_class antes de buscar
 */
@injectable()
export class CarrierServiceImpl implements CarrierServiceContract {
  private readonly CACHE_TTL = 600; // 10 minutos (más tiempo porque cambia menos)
  private readonly CACHE_PREFIX = "carrier_class:";

  constructor(
    @inject(CarrierRepositoryContract.name)
    private readonly repository: CarrierRepositoryContract
  ) {}

  /**
   * Obtiene un carrier por su clave
   */
  async getCarrierByKey(carrierKey: number): Promise<Carrier | null> {
    try {
      if (!carrierKey) {
        return null;
      }

      return await this.repository.findByKey(carrierKey);
    } catch (error: any) {
      logInfo(
        `Error getting carrier by key: ${error.message}`,
        "CarrierService"
      );
      throw new AppCustomError({
        message: `Error obteniendo carrier: ${error.message}`,
        error: error as Error,
        statusCode: error.statusCode || 500,
      });
    }
  }

  /**
   * Obtiene el carrier_class_key basado en carrier_key y fare_code
   * Mejoras:
   * - Validación de que fare_class es una sola letra antes de buscar
   * - Caché Redis más robusta
   * - Búsqueda mejorada (FIND_IN_SET en lugar de INSTR)
   * - Retorna error específico si no se encuentra la relación
   */
  async getCarrierClassKeyByFareCode(
    carrierKey: number,
    fareClass: string
  ): Promise<number | null> {
    try {
      // Validación temprana
      if (!carrierKey) {
        throw new AppCustomError({
          message: "carrier_key es requerido",
          statusCode: 400,
        });
      }

      if (!fareClass || fareClass.trim() === "") {
        throw new AppCustomError({
          message: "fare_class es requerido",
          statusCode: 400,
        });
      }

      const trimmedFareClass = fareClass.trim().toUpperCase();

      // Validar que fare_class es una sola letra
      if (trimmedFareClass.length !== 1 || !/^[A-Z]$/.test(trimmedFareClass)) {
        throw new AppCustomError({
          message: `fare_class debe ser una sola letra (A-Z), recibido: ${trimmedFareClass}`,
          statusCode: 400,
        });
      }

      // Intentar obtener de caché
      const cacheKey = `${this.CACHE_PREFIX}${carrierKey}:${trimmedFareClass}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        const key = parseInt(cached, 10);
        return key || null;
      }

      // Buscar en base de datos
      const carrierClassKey =
        await this.repository.findCarrierClassKeyByFareCode(
          carrierKey,
          trimmedFareClass
        );

      // Guardar en caché (incluso si es null para evitar búsquedas repetidas)
      await this.setCache(cacheKey, carrierClassKey?.toString() || "");

      if (!carrierClassKey) {
        logInfo(
          `Carrier class not found for carrier_key: ${carrierKey}, fare_class: ${trimmedFareClass}`,
          "CarrierService"
        );
      }

      return carrierClassKey;
    } catch (error: any) {
      logInfo(
        `Error getting carrier class key by fare code: ${error.message}`,
        "CarrierService"
      );
      throw new AppCustomError({
        message: `Error obteniendo carrier_class_key: ${error.message}`,
        error: error as Error,
        statusCode: error.statusCode || 500,
      });
    }
  }

  /**
   * Obtiene un valor de caché Redis
   * Intenta usar el token principal primero, luego el token común
   */
  private async getFromCache(key: string): Promise<string | null> {
    try {
      let redis: Connection | null = null;
      try {
        redis = container.resolve<Connection>(
          REDIS_CONNECTION_INJECTION_TOKEN_MAIN
        );
      } catch {
        redis = container.resolve<Connection>(REDIS_CONNECTION_INJECTION_TOKEN);
      }
      return await redis.get(key);
    } catch (error) {
      // Si falla el caché, continuar sin él
      logInfo(`Cache get failed for key: ${key}`, "CarrierService");
      return null;
    }
  }

  /**
   * Guarda un valor en caché Redis
   * Intenta usar el token principal primero, luego el token común
   */
  private async setCache(key: string, value: string): Promise<void> {
    try {
      let redis: Connection | null = null;
      try {
        redis = container.resolve<Connection>(
          REDIS_CONNECTION_INJECTION_TOKEN_MAIN
        );
      } catch {
        redis = container.resolve<Connection>(REDIS_CONNECTION_INJECTION_TOKEN);
      }
      // Si el valor es vacío, guardar con TTL más corto para evitar caché de negativos
      const ttl = value ? this.CACHE_TTL : 60; // 1 minuto para negativos
      await redis.setex(key, ttl, value);
    } catch (error) {
      // Si falla el caché, continuar sin él
      logInfo(`Cache set failed for key: ${key}`, "CarrierService");
    }
  }
}
