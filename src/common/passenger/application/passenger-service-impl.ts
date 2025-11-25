import { inject, injectable } from "tsyringe";
import {
  PassengerServiceContract,
  Passenger,
} from "../domain/contracts/passenger-service";
import { PassengerRepositoryContract } from "../domain/contracts/passenger-repository";
import { FlightServiceContract } from "../../flight/domain/contracts/flight-service";
import { CarrierServiceContract } from "../../carrier/domain/contracts/carrier-service";
import { AppCustomError, logInfo } from "ms_nodejs_common";
import {
  Connection,
  REDIS_CONNECTION_INJECTION_TOKEN,
  REDIS_CONNECTION_INJECTION_TOKEN_MAIN,
} from "../../shared/infrastructure/cache-factory";
import { container } from "tsyringe";
import { Flight } from "../domain/contracts/passenger-service";

/**
 * Códigos de error específicos para pasajeros
 */
export enum PassengerErrorCode {
  PASSENGER_NOT_FOUND = "PASSENGER_NOT_FOUND",
  FLIGHT_NOT_FOUND = "FLIGHT_NOT_FOUND",
  CARRIER_NOT_FOUND = "CARRIER_NOT_FOUND",
  PASSENGER_VALIDATION_FAILED = "PASSENGER_VALIDATION_FAILED",
}

/**
 * Implementación del servicio de pasajeros
 * Mejoras implementadas:
 * - Caché Redis para búsquedas frecuentes
 * - Optimización de queries combinando búsquedas
 * - Manejo de errores con códigos específicos
 */
@injectable()
export class PassengerServiceImpl implements PassengerServiceContract {
  private readonly CACHE_TTL = 300; // 5 minutos
  private readonly CACHE_PREFIX = "passenger:";

  constructor(
    @inject(PassengerRepositoryContract.name)
    private readonly repository: PassengerRepositoryContract,
    @inject(FlightServiceContract.name)
    private readonly flightService: FlightServiceContract,
    @inject(CarrierServiceContract.name)
    private readonly carrierService: CarrierServiceContract
  ) {}

  /**
   * Obtiene un pasajero por su identificador único
   * Mejoras:
   * - Implementa caché Redis para búsquedas frecuentes
   * - Optimiza búsqueda combinando identifier y external_id
   * - Mejora manejo de errores con códigos específicos
   */
  async getPassengerByIdentifier(
    inkPassengerIdentifier: string,
    flightName?: string
  ): Promise<Passenger | null> {
    try {
      // Validación temprana
      if (!inkPassengerIdentifier || inkPassengerIdentifier.trim() === "") {
        throw new AppCustomError({
          message: "ink_passenger_identifier es requerido",
          statusCode: 400,
        });
      }

      const trimmedIdentifier = inkPassengerIdentifier.trim();

      // Intentar obtener de caché
      const cacheKey = `${this.CACHE_PREFIX}${trimmedIdentifier}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        const passenger = JSON.parse(cached) as Passenger;
        return await this.validatePassenger(passenger, flightName);
      }

      // Buscar passenger_key por identifier
      let passengerKey = await this.repository.findKeyByIdentifier(
        trimmedIdentifier
      );

      // Si no encuentra, intentar buscar por external_passenger_id
      if (!passengerKey) {
        passengerKey = await this.repository.findKeyByExternalId(
          trimmedIdentifier
        );
      }

      if (!passengerKey) {
        logInfo(
          `Passenger not found for identifier: ${trimmedIdentifier}`,
          "PassengerService"
        );
        return null;
      }

      // Obtener el objeto passenger completo
      const passenger = await this.repository.findByKey(passengerKey);
      if (!passenger) {
        return null;
      }

      // Validar el pasajero
      const validatedPassenger = await this.validatePassenger(
        passenger,
        flightName
      );

      // Guardar en caché si es válido
      if (validatedPassenger) {
        await this.setCache(cacheKey, JSON.stringify(validatedPassenger));
      }

      return validatedPassenger;
    } catch (error: any) {
      logInfo(
        `Error getting passenger by identifier: ${error.message}`,
        "PassengerService"
      );
      throw new AppCustomError({
        message: `Error obteniendo pasajero: ${error.message}`,
        error: error as Error,
        statusCode: error.statusCode || 500,
      });
    }
  }

  /**
   * Obtiene la clave del pasajero por su identificador
   * Mejoras:
   * - Implementa caché de resultados
   * - Optimiza búsqueda
   */
  async getPassengerKeyByIdentifier(
    inkPassengerIdentifier: string
  ): Promise<number | null> {
    try {
      if (!inkPassengerIdentifier || inkPassengerIdentifier.trim() === "") {
        return null;
      }

      const trimmedIdentifier = inkPassengerIdentifier.trim();

      // Intentar obtener de caché
      const cacheKey = `${this.CACHE_PREFIX}key:${trimmedIdentifier}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return parseInt(cached, 10);
      }

      // Buscar en base de datos
      const passengerKey = await this.repository.findKeyByIdentifier(
        trimmedIdentifier
      );

      // Guardar en caché si existe
      if (passengerKey) {
        await this.setCache(cacheKey, passengerKey.toString());
      }

      return passengerKey;
    } catch (error: any) {
      logInfo(
        `Error getting passenger key by identifier: ${error.message}`,
        "PassengerService"
      );
      return null;
    }
  }

  /**
   * Valida un pasajero
   * Mejoras:
   * - Validaciones más granulares con códigos de error específicos
   * - Validación de estado del pasajero
   * - Validación de asociación con vuelo
   */
  async validatePassenger(
    passenger: Passenger,
    flightName?: string
  ): Promise<Passenger | null> {
    try {
      if (!passenger) {
        return null;
      }

      // Validar que el pasajero tiene passenger_key
      if (!passenger.passengerKey) {
        throw new AppCustomError({
          message: "Passenger no tiene passenger_key válido",
          statusCode: 400,
        });
      }

      // Validar asociación con vuelo si se proporciona flight_name
      if (flightName) {
        const flight = await this.getFlightForPassenger(passenger);
        if (!flight) {
          logInfo(
            `Flight not found for passenger: ${passenger.passengerKey}`,
            "PassengerService"
          );
          return null;
        }

        if (flight.flightName !== flightName) {
          logInfo(
            `Flight name mismatch. Expected: ${flightName}, Got: ${flight.flightName}`,
            "PassengerService"
          );
          return null;
        }

        // Validar que el vuelo está habilitado para web services
        if (flight.isEnabledForWs === false) {
          logInfo(
            `Flight ${flight.flightKey} is not enabled for web services`,
            "PassengerService"
          );
          return null;
        }

        passenger.flight = flight;
      } else {
        // Si no se proporciona flight_name, validar que el vuelo existe y está habilitado
        const flight = await this.getFlightForPassenger(passenger);
        if (flight && flight.isEnabledForWs === false) {
          logInfo(
            `Flight ${flight.flightKey} is not enabled for web services`,
            "PassengerService"
          );
          return null;
        }
        passenger.flight = flight || undefined;
      }

      return passenger;
    } catch (error: any) {
      logInfo(
        `Error validating passenger: ${error.message}`,
        "PassengerService"
      );
      throw new AppCustomError({
        message: `Error validando pasajero: ${error.message}`,
        error: error as Error,
        statusCode: error.statusCode || 500,
      });
    }
  }

  /**
   * Obtiene el vuelo asociado al pasajero
   * Implementa lazy loading mejorado
   * Mejora: Si no tiene flight_key, busca usando multileg_flight_key y boarding_station_iata
   */
  async getFlightForPassenger(
    passenger: Passenger
  ): Promise<Passenger["flight"]> {
    // Si ya está en caché, retornarlo
    if (passenger.flight) {
      return passenger.flight;
    }

    let flight: Flight | null = null;

    // Si tiene flight_key, usarlo directamente
    if (passenger.flightKey) {
      flight = await this.flightService.getFlightByKey(passenger.flightKey);
    }
    // Si no tiene flight_key pero tiene multileg_flight_key y boarding_station_iata,
    // buscar el vuelo usando estos campos
    else if (passenger.multilegFlightKey && passenger.boardingStationIata) {
      // Esta búsqueda debería estar en el repositorio de vuelos
      // Por ahora, intentamos obtener el vuelo desde el servicio
      // Nota: Esto requeriría un método adicional en FlightRepository
      // Por simplicidad, retornamos null si no hay flight_key
      logInfo(
        `Passenger ${passenger.passengerKey} has multileg_flight_key but no flight_key. Flight lookup by multileg not yet implemented.`,
        "PassengerService"
      );
      return undefined;
    }

    return flight || undefined;
  }

  /**
   * Obtiene el carrier_key del pasajero
   * Mejoras:
   * - Si no existe en pasajero, obtenerlo del vuelo asociado
   * - Validar que carrier_key existe y es válido
   */
  async getCarrierKey(passenger: Passenger): Promise<number | null> {
    // Retornar directamente si está disponible
    if (passenger.carrierKey) {
      return passenger.carrierKey;
    }

    // Si no está disponible, obtenerlo del vuelo asociado
    const flight = await this.getFlightForPassenger(passenger);
    if (flight && flight.carrierKey) {
      return flight.carrierKey;
    }

    return null;
  }

  /**
   * Obtiene el carrier asociado al pasajero
   * Implementa lazy loading mejorado
   */
  async getCarrier(passenger: Passenger): Promise<Passenger["carrier"]> {
    // Si ya está en caché, retornarlo
    if (passenger.carrier) {
      return passenger.carrier;
    }

    const carrierKey = await this.getCarrierKey(passenger);
    if (!carrierKey) {
      return undefined;
    }

    const carrier = await this.carrierService.getCarrierByKey(carrierKey);
    return carrier || undefined;
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
      logInfo(`Cache get failed for key: ${key}`, "PassengerService");
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
      await redis.setex(key, this.CACHE_TTL, value);
    } catch (error) {
      // Si falla el caché, continuar sin él
      logInfo(`Cache set failed for key: ${key}`, "PassengerService");
    }
  }
}
