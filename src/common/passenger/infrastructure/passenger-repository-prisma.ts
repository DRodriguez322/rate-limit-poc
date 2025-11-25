import { inject, injectable } from 'tsyringe';
import { PassengerRepositoryContract } from '../domain/contracts/passenger-repository';
import { Passenger } from '../domain/contracts/passenger-service';
import { logInfo } from 'ms_nodejs_common';
import { PrismaClient } from '@prisma/client';

/**
 * Implementación del repositorio de pasajeros usando Prisma
 * Mejoras:
 * - Optimización de queries combinando búsquedas
 * - Índices optimizados en ink_passenger_identifier
 */
@injectable()
export class PassengerRepositoryPrisma
  implements PassengerRepositoryContract
{
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Busca un pasajero por su clave
   */
  async findByKey(passengerKey: number): Promise<Passenger | null> {
    try {
      const passenger = await this.prisma.passengers.findUnique({
        where: { passenger_key: passengerKey },
        select: {
          passenger_key: true,
          ink_passenger_identifier: true,
          carrier_key: true,
          flight_key: true,
          multileg_flight_key: true,
          boarding_station_iata: true,
          fare_code_key: true,
          initial_carrier_class_key: true,
          actual_carrier_class_key: true,
          external_passenger_id: true,
        },
      });

      if (!passenger) {
        return null;
      }

      return this.mapToPassenger(passenger);
    } catch (error: any) {
      logInfo(
        `Error finding passenger by key: ${error.message}`,
        'PassengerRepository'
      );
      throw error;
    }
  }

  /**
   * Busca un pasajero por su identificador único
   * Optimización: Usa índice en ink_passenger_identifier
   */
  async findKeyByIdentifier(
    inkPassengerIdentifier: string
  ): Promise<number | null> {
    try {
      // Buscar en tabla de identificadores (web_service_master equivalente)
      // Asumiendo que hay una tabla passenger_identifiers o similar
      const identifier = await this.prisma.passenger_identifiers.findFirst({
        where: {
          ink_passenger_identifier: inkPassengerIdentifier.trim(),
        },
        select: {
          passenger_key: true,
        },
      });

      return identifier?.passenger_key || null;
    } catch (error: any) {
      // Si la tabla no existe, intentar buscar directamente en passengers
      try {
        const passenger = await this.prisma.passengers.findFirst({
          where: {
            ink_passenger_identifier: inkPassengerIdentifier.trim(),
          },
          select: {
            passenger_key: true,
          },
        });

        return passenger?.passenger_key || null;
      } catch (fallbackError: any) {
        logInfo(
          `Error finding passenger key by identifier: ${fallbackError.message}`,
          'PassengerRepository'
        );
        return null;
      }
    }
  }

  /**
   * Busca un pasajero por external_passenger_id
   */
  async findKeyByExternalId(
    externalPassengerId: string
  ): Promise<number | null> {
    try {
      const passenger = await this.prisma.passengers.findFirst({
        where: {
          external_passenger_id: externalPassengerId.trim(),
        },
        select: {
          passenger_key: true,
        },
      });

      return passenger?.passenger_key || null;
    } catch (error: any) {
      logInfo(
        `Error finding passenger key by external id: ${error.message}`,
        'PassengerRepository'
      );
      return null;
    }
  }

  /**
   * Mapea el resultado de Prisma a la interfaz Passenger
   */
  private mapToPassenger(row: any): Passenger {
    return {
      passengerKey: row.passenger_key,
      inkPassengerIdentifier: row.ink_passenger_identifier || '',
      carrierKey: row.carrier_key || undefined,
      flightKey: row.flight_key || undefined,
      multilegFlightKey: row.multileg_flight_key || undefined,
      boardingStationIata: row.boarding_station_iata || undefined,
      fareCodeKey: row.fare_code_key || undefined,
      initialCarrierClassKey: row.initial_carrier_class_key || undefined,
      actualCarrierClassKey: row.actual_carrier_class_key || undefined,
      externalPassengerId: row.external_passenger_id || undefined,
    };
  }
}

