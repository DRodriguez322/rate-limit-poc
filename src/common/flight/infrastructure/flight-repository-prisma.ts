import { inject, injectable } from 'tsyringe';
import { FlightRepositoryContract } from '../domain/contracts/flight-repository';
import { Flight } from '../../passenger/domain/contracts/passenger-service';
import { logInfo } from 'ms_nodejs_common';
import { PrismaClient } from '@prisma/client';

/**
 * Implementación del repositorio de vuelos usando Prisma
 * Mejoras:
 * - Índices optimizados en multileg_flight_key + origin_station_iata
 */
@injectable()
export class FlightRepositoryPrisma implements FlightRepositoryContract {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Busca un vuelo por su clave
   */
  async findByKey(flightKey: number): Promise<Flight | null> {
    try {
      const flight = await this.prisma.flights.findUnique({
        where: { flight_key: flightKey },
        select: {
          flight_key: true,
          multileg_flight_key: true,
          origin_station_iata: true,
          carrier_key: true,
          flight_name: true,
          is_enabled_for_ws: true,
        },
      });

      if (!flight) {
        return null;
      }

      return this.mapToFlight(flight);
    } catch (error: any) {
      logInfo(`Error finding flight by key: ${error.message}`, 'FlightRepository');
      throw error;
    }
  }

  /**
   * Busca un vuelo por multileg_flight_key y boarding_station_iata
   * Mejora: Usa índice compuesto optimizado
   */
  async findKeyByMultilegAndStation(
    multilegFlightKey: number,
    boardingStationIata: string
  ): Promise<number | null> {
    try {
      const flight = await this.prisma.flights.findFirst({
        where: {
          multileg_flight_key: multilegFlightKey,
          origin_station_iata: boardingStationIata.trim(),
        },
        select: {
          flight_key: true,
        },
      });

      return flight?.flight_key || null;
    } catch (error: any) {
      logInfo(
        `Error finding flight key by multileg and station: ${error.message}`,
        'FlightRepository'
      );
      return null;
    }
  }

  /**
   * Mapea el resultado de Prisma a la interfaz Flight
   */
  private mapToFlight(row: any): Flight {
    return {
      flightKey: row.flight_key,
      multilegFlightKey: row.multileg_flight_key || undefined,
      originStationIata: row.origin_station_iata || undefined,
      carrierKey: row.carrier_key || undefined,
      flightName: row.flight_name || undefined,
      isEnabledForWs: row.is_enabled_for_ws ?? undefined,
    };
  }
}

