import { Flight } from '../../passenger/domain/contracts/passenger-service';

/**
 * Contrato para el repositorio de vuelos
 */
export abstract class FlightRepositoryContract {
  /**
   * Busca un vuelo por su clave
   * @param flightKey - Clave del vuelo
   * @returns Objeto flight o null si no existe
   */
  abstract findByKey(flightKey: number): Promise<Flight | null>;

  /**
   * Busca un vuelo por multileg_flight_key y boarding_station_iata
   * @param multilegFlightKey - Clave del vuelo multi-segmento
   * @param boardingStationIata - Estación de embarque
   * @returns flight_key o null si no existe
   */
  abstract findKeyByMultilegAndStation(
    multilegFlightKey: number,
    boardingStationIata: string
  ): Promise<number | null>;
}

