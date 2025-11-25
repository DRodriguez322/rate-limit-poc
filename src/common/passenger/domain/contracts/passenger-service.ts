/**
 * Contrato para el servicio de pasajeros
 */
export abstract class PassengerServiceContract {
  /**
   * Obtiene un pasajero por su identificador único
   * @param inkPassengerIdentifier - Identificador único del pasajero
   * @param flightName - (opcional) Nombre del vuelo para validación
   * @returns Objeto passenger o null si no existe
   */
  abstract getPassengerByIdentifier(
    inkPassengerIdentifier: string,
    flightName?: string
  ): Promise<Passenger | null>;

  /**
   * Obtiene la clave del pasajero por su identificador
   * @param inkPassengerIdentifier - Identificador único del pasajero
   * @returns passenger_key (number) o null si no existe
   */
  abstract getPassengerKeyByIdentifier(
    inkPassengerIdentifier: string
  ): Promise<number | null>;

  /**
   * Valida un pasajero
   * @param passenger - Objeto passenger a validar
   * @param flightName - (opcional) Nombre del vuelo
   * @returns Objeto passenger validado o null
   */
  abstract validatePassenger(
    passenger: Passenger,
    flightName?: string
  ): Promise<Passenger | null>;
}

/**
 * Modelo de datos del pasajero
 */
export interface Passenger {
  passengerKey: number;
  inkPassengerIdentifier: string;
  carrierKey?: number;
  flightKey?: number;
  multilegFlightKey?: number;
  boardingStationIata?: string;
  fareCodeKey?: number;
  initialCarrierClassKey?: number;
  actualCarrierClassKey?: number;
  externalPassengerId?: string;
  flight?: Flight;
  carrier?: Carrier;
}

/**
 * Modelo de datos del vuelo
 */
export interface Flight {
  flightKey: number;
  multilegFlightKey?: number;
  originStationIata?: string;
  carrierKey?: number;
  flightName?: string;
  isEnabledForWs?: boolean;
}

/**
 * Modelo de datos del carrier
 */
export interface Carrier {
  carrierKey: number;
  carrierName?: string;
}

