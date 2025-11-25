import { inject, injectable } from "tsyringe";
import { FareCodeServiceContract } from "../domain/contracts/fare-code-service";
import { FareCodeRepositoryContract } from "../domain/contracts/fare-code-repository";
import { AppCustomError, logInfo } from "ms_nodejs_common";
import {
  Connection,
  REDIS_CONNECTION_INJECTION_TOKEN,
  REDIS_CONNECTION_INJECTION_TOKEN_MAIN,
} from "../../shared/infrastructure/cache-factory";
import { container } from "tsyringe";

/**
 * Implementación del servicio de códigos de tarifa
 * Mejoras implementadas:
 * - Caché de resultados
 * - Validación de formato antes de buscar
 */
@injectable()
export class FareCodeServiceImpl implements FareCodeServiceContract {
  private readonly CACHE_TTL = 3600; // 1 hora (códigos de tarifa cambian muy poco)
  private readonly CACHE_PREFIX = "fare_code:";

  constructor(
    @inject(FareCodeRepositoryContract.name)
    private readonly repository: FareCodeRepositoryContract
  ) {}

  /**
   * Obtiene el fare_code_key basado en el código de tarifa
   * Mejoras:
   * - Validación de formato antes de buscar
   * - Caché de resultados
   */
  async getFareCodeKey(fareCode: string): Promise<number | null> {
    try {
      // Validación temprana
      if (!fareCode || fareCode.trim() === "") {
        throw new AppCustomError({
          message: "fare_code es requerido",
          statusCode: 400,
        });
      }

      const trimmedFareCode = fareCode.trim().toUpperCase();

      // Validar que fare_code es una sola letra
      if (trimmedFareCode.length !== 1 || !/^[A-Z]$/.test(trimmedFareCode)) {
        throw new AppCustomError({
          message: `fare_code debe ser una sola letra (A-Z), recibido: ${trimmedFareCode}`,
          statusCode: 400,
        });
      }

      // Intentar obtener de caché
      const cacheKey = `${this.CACHE_PREFIX}${trimmedFareCode}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        const key = parseInt(cached, 10);
        return key || null;
      }

      // Buscar en base de datos
      const fareCodeKey = await this.repository.findKeyByCode(trimmedFareCode);

      // Guardar en caché (incluso si es null)
      await this.setCache(cacheKey, fareCodeKey?.toString() || "");

      if (!fareCodeKey) {
        logInfo(`Fare code not found: ${trimmedFareCode}`, "FareCodeService");
      }

      return fareCodeKey;
    } catch (error: any) {
      logInfo(
        `Error getting fare code key: ${error.message}`,
        "FareCodeService"
      );
      throw new AppCustomError({
        message: `Error obteniendo fare_code_key: ${error.message}`,
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
      logInfo(`Cache get failed for key: ${key}`, "FareCodeService");
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
      logInfo(`Cache set failed for key: ${key}`, "FareCodeService");
    }
  }
}
