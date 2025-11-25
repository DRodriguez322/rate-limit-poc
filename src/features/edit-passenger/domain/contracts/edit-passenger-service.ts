/**
 * Contrato para el servicio de edición de pasajeros
 */
export abstract class EditPassengerServiceContract {
  /**
   * Actualiza un pasajero existente
   * @param inkPassengerIdentifier - Identificador único del pasajero
   * @param updateData - Datos a actualizar (fare_code y/o passenger_name_iata)
   * @returns Pasajero actualizado
   */
  abstract updatePassenger(
    inkPassengerIdentifier: string,
    updateData: PassengerUpdateData
  ): Promise<UpdatedPassenger>;
}

/**
 * Datos para actualizar un pasajero
 */
export interface PassengerUpdateData {
  fareCode?: string;
  passengerNameIata?: string;
}

/**
 * Pasajero actualizado
 */
export interface UpdatedPassenger {
  inkPassengerIdentifier: string;
  fareCode?: string;
  passengerNameIata?: string;
  updatedAt: Date;
}

/**
 * Resultado de validación de un campo
 */
export interface ValidationResult {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

