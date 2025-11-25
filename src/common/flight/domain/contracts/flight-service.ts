import { Flight } from '../../passenger/domain/contracts/passenger-service';

/**
 * Contrato para el servicio de vuelos
 */
export abstract class FlightServiceContract {
  /**
   * Obtiene un vuelo por su clave
   * @param flightKey - Clave del vuelo
   * @returns Objeto flight o null si no existe
   */
  abstract getFlightByKey(flightKey: number): Promise<Flight | null>;

  /**
   * Obtiene el carrier_key asociado al vuelo
   * @param flight - Objeto flight
   * @returns carrier_key (number) o null si no existe
   */
  abstract getCarrierKey(flight: Flight): Promise<number | null>;
}

