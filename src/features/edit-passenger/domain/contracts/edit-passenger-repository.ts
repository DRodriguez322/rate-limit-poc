import { PassengerUpdateData } from './edit-passenger-service';

/**
 * Contrato para el repositorio de edición de pasajeros
 */
export abstract class EditPassengerRepositoryContract {
  /**
   * Actualiza los campos de un pasajero en la base de datos
   * @param passengerKey - Clave del pasajero
   * @param updateData - Datos a actualizar
   * @returns true si la actualización fue exitosa
   */
  abstract updatePassengerFields(
    passengerKey: number,
    updateData: {
      fareCodeKey?: number;
      initialCarrierClassKey?: number;
      actualCarrierClassKey?: number;
      passengerName?: string;
      passengerNameUnformatted?: string;
    }
  ): Promise<boolean>;

  /**
   * Crea un registro de auditoría para la actualización
   * @param passengerKey - Clave del pasajero
   * @param updateData - Datos que se actualizaron
   * @param userId - ID del usuario que realizó la actualización (opcional)
   */
  abstract createAuditLog(
    passengerKey: number,
    updateData: PassengerUpdateData,
    userId?: string
  ): Promise<void>;
}

