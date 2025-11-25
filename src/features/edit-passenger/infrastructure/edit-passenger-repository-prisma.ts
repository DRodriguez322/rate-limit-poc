import { inject, injectable } from "tsyringe";
import { EditPassengerRepositoryContract } from "../domain/contracts/edit-passenger-repository";
import { PassengerUpdateData } from "../domain/contracts/edit-passenger-service";
import { logInfo } from "ms_nodejs_common";
import { PrismaClient } from "@prisma/client";

/**
 * Implementación del repositorio de edición de pasajeros usando Prisma
 */
@injectable()
export class EditPassengerRepositoryPrisma
  implements EditPassengerRepositoryContract
{
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Actualiza los campos de un pasajero en la base de datos
   */
  async updatePassengerFields(
    passengerKey: number,
    updateData: {
      fareCodeKey?: number;
      initialCarrierClassKey?: number;
      actualCarrierClassKey?: number;
      passengerName?: string;
      passengerNameUnformatted?: string;
    }
  ): Promise<boolean> {
    try {
      const updateFields: any = {
        is_web_service: true, // Marcar como editado por web service
        updated_at: new Date(),
      };

      if (updateData.fareCodeKey !== undefined) {
        updateFields.fare_code_key = updateData.fareCodeKey;
      }

      if (updateData.initialCarrierClassKey !== undefined) {
        updateFields.initial_carrier_class_key = updateData.initialCarrierClassKey;
      }

      if (updateData.actualCarrierClassKey !== undefined) {
        updateFields.actual_carrier_class_key = updateData.actualCarrierClassKey;
      }

      if (updateData.passengerName !== undefined) {
        updateFields.passenger_name = updateData.passengerName;
      }

      if (updateData.passengerNameUnformatted !== undefined) {
        updateFields.passenger_name_unformatted = updateData.passengerNameUnformatted;
      }

      await this.prisma.passengers.update({
        where: { passenger_key: passengerKey },
        data: updateFields,
      });

      logInfo(
        `Passenger ${passengerKey} fields updated successfully`,
        "EditPassengerRepository"
      );

      return true;
    } catch (error: any) {
      logInfo(
        `Error updating passenger fields: ${error.message}`,
        "EditPassengerRepository"
      );
      throw error;
    }
  }

  /**
   * Crea un registro de auditoría para la actualización
   * Similar a factory_status_change() del legacy
   */
  async createAuditLog(
    passengerKey: number,
    updateData: PassengerUpdateData,
    userId?: string
  ): Promise<void> {
    try {
      // Crear registro de auditoría
      // Nota: Ajustar según la estructura de tu tabla de auditoría
      await this.prisma.passenger_status_changes.create({
        data: {
          passenger_key: passengerKey,
          status_change_type: "WEB_SERVICE_EDIT",
          changed_by: userId || "WEB_SERVICE",
          change_data: JSON.stringify(updateData),
          created_at: new Date(),
        },
      });

      logInfo(
        `Audit log created for passenger ${passengerKey}`,
        "EditPassengerRepository"
      );
    } catch (error: any) {
      // No fallar si la auditoría falla, solo loguear
      logInfo(
        `Error creating audit log: ${error.message}`,
        "EditPassengerRepository"
      );
    }
  }
}

