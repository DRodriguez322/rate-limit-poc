import { Passenger } from './passenger-service';

/**
 * Contrato para el repositorio de pasajeros
 */
export abstract class PassengerRepositoryContract {
  /**
   * Busca un pasajero por su clave
   * @param passengerKey - Clave del pasajero
   * @returns Objeto passenger o null si no existe
   */
  abstract findByKey(passengerKey: number): Promise<Passenger | null>;

  /**
   * Busca un pasajero por su identificador único
   * @param inkPassengerIdentifier - Identificador único del pasajero
   * @returns passenger_key o null si no existe
   */
  abstract findKeyByIdentifier(
    inkPassengerIdentifier: string
  ): Promise<number | null>;

  /**
   * Busca un pasajero por external_passenger_id
   * @param externalPassengerId - ID externo del pasajero
   * @returns passenger_key o null si no existe
   */
  abstract findKeyByExternalId(
    externalPassengerId: string
  ): Promise<number | null>;
}

