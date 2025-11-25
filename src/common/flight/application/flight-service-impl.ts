import { inject, injectable } from 'tsyringe';
import { FlightServiceContract } from '../domain/contracts/flight-service';
import { FlightRepositoryContract } from '../domain/contracts/flight-repository';
import { Flight } from '../../passenger/domain/contracts/passenger-service';
import { AppCustomError, logInfo } from 'ms_nodejs_common';

/**
 * Implementación del servicio de vuelos
 */
@injectable()
export class FlightServiceImpl implements FlightServiceContract {
  constructor(
    @inject(FlightRepositoryContract.name)
    private readonly repository: FlightRepositoryContract
  ) {}

  /**
   * Obtiene un vuelo por su clave
   */
  async getFlightByKey(flightKey: number): Promise<Flight | null> {
    try {
      if (!flightKey) {
        return null;
      }

      return await this.repository.findByKey(flightKey);
    } catch (error: any) {
      logInfo(`Error getting flight by key: ${error.message}`, 'FlightService');
      throw new AppCustomError({
        message: `Error obteniendo vuelo: ${error.message}`,
        error: error as Error,
        statusCode: error.statusCode || 500,
      });
    }
  }

  /**
   * Obtiene el carrier_key asociado al vuelo
   */
  async getCarrierKey(flight: Flight): Promise<number | null> {
    try {
      if (!flight) {
        return null;
      }

      // Retornar directamente si está disponible
      if (flight.carrierKey) {
        return flight.carrierKey;
      }

      // Si no está disponible, obtener el vuelo completo
      if (flight.flightKey) {
        const fullFlight = await this.repository.findByKey(flight.flightKey);
        return fullFlight?.carrierKey || null;
      }

      return null;
    } catch (error: any) {
      logInfo(`Error getting carrier key from flight: ${error.message}`, 'FlightService');
      return null;
    }
  }
}

