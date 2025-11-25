import { inject, injectable } from "tsyringe";
import {
  EditPassengerServiceContract,
  PassengerUpdateData,
  UpdatedPassenger,
  ValidationResult,
} from "../domain/contracts/edit-passenger-service";
import { EditPassengerRepositoryContract } from "../domain/contracts/edit-passenger-repository";
import {
  PassengerServiceContract,
  Passenger,
} from "../../../common/passenger/domain/contracts/passenger-service";
import { CarrierServiceContract } from "../../../common/carrier/domain/contracts/carrier-service";
import { FareCodeServiceContract } from "../../../common/fare-code/domain/contracts/fare-code-service";
import { AppCustomError, logInfo } from "ms_nodejs_common";

/**
 * Códigos de error específicos para edición de pasajeros
 */
export enum EditPassengerErrorCode {
  PASSENGER_NOT_FOUND = "PASSENGER_NOT_FOUND",
  FLIGHT_NOT_FOUND = "FLIGHT_NOT_FOUND",
  CARRIER_NOT_FOUND = "CARRIER_NOT_FOUND",
  FARE_CODE_INVALID = "FARE_CODE_INVALID",
  FARE_CODE_NOT_FOUND = "FARE_CODE_NOT_FOUND",
  CARRIER_CLASS_NOT_FOUND = "CARRIER_CLASS_NOT_FOUND",
  PASSENGER_NAME_FORMAT_INVALID = "PASSENGER_NAME_FORMAT_INVALID",
  PASSENGER_NAME_LENGTH_INVALID = "PASSENGER_NAME_LENGTH_INVALID",
  NO_ASSOCIATION = "NO_ASSOCIATION",
  EMPTY_REQUEST = "EMPTY_REQUEST",
  FLIGHT_CLOSED = "FLIGHT_CLOSED",
}

/**
 * Constantes de validación
 */
const MAX_NAME_LENGTH = 50; // Ajustar según WS_PAX_DATA_MAX_LENGTH_NAME del legacy
const MIN_NAME_LENGTH = 1;

/**
 * Implementación del servicio de edición de pasajeros
 * Sigue el flujo del código legacy pero con mejoras:
 * - Validaciones más granulares
 * - Manejo de errores estructurado
 * - Uso de servicios comunes
 */
@injectable()
export class EditPassengerServiceImpl
  implements EditPassengerServiceContract
{
  constructor(
    @inject(PassengerServiceContract.name)
    private readonly passengerService: PassengerServiceContract,
    @inject(CarrierServiceContract.name)
    private readonly carrierService: CarrierServiceContract,
    @inject(FareCodeServiceContract.name)
    private readonly fareCodeService: FareCodeServiceContract,
    @inject(EditPassengerRepositoryContract.name)
    private readonly repository: EditPassengerRepositoryContract
  ) {}

  /**
   * Actualiza un pasajero existente
   * Flujo:
   * 1. Obtener y validar pasajero
   * 2. Validar que tiene asociación con vuelo
   * 3. Validar campos a actualizar
   * 4. Actualizar en base de datos
   * 5. Crear registro de auditoría
   */
  async updatePassenger(
    inkPassengerIdentifier: string,
    updateData: PassengerUpdateData
  ): Promise<UpdatedPassenger> {
    try {
      // Validación temprana: al menos un campo debe estar presente
      if (!updateData.fareCode && !updateData.passengerNameIata) {
        throw new AppCustomError({
          message: "At least one field (fare_code or passenger_name_iata) must be provided",
          statusCode: 400,
          errorCode: EditPassengerErrorCode.EMPTY_REQUEST,
        });
      }

      // 1. Obtener y validar pasajero
      const passenger = await this.passengerService.getPassengerByIdentifier(
        inkPassengerIdentifier
      );

      if (!passenger) {
        throw new AppCustomError({
          message: `Passenger with identifier ${inkPassengerIdentifier} does not exist`,
          statusCode: 404,
          errorCode: EditPassengerErrorCode.PASSENGER_NOT_FOUND,
        });
      }

      // 2. Validar asociación con vuelo
      const flight = await this.passengerService.getFlightForPassenger(
        passenger
      );

      if (!flight) {
        throw new AppCustomError({
          message: "Passenger has no flight association",
          statusCode: 409,
          errorCode: EditPassengerErrorCode.NO_ASSOCIATION,
        });
      }

      // Validar que el vuelo está habilitado para web services
      if (flight.isEnabledForWs === false) {
        throw new AppCustomError({
          message: "Cannot update passenger on flight that is not enabled for web services",
          statusCode: 409,
          errorCode: EditPassengerErrorCode.FLIGHT_CLOSED,
        });
      }

      // 3. Validar campos a actualizar
      const validationResults: {
        fareCode?: ValidationResult;
        passengerNameIata?: ValidationResult;
      } = {};

      let fareCodeKey: number | null = null;
      let carrierClassKey: number | null = null;

      // Validar fare_code si está presente
      if (updateData.fareCode) {
        const fareCodeValidation = await this.validateFareCode(
          updateData.fareCode,
          passenger,
          flight
        );
        validationResults.fareCode = fareCodeValidation;

        if (!fareCodeValidation.isValid) {
          throw new AppCustomError({
            message: fareCodeValidation.errorMessage || "Invalid fare_code",
            statusCode: 400,
            errorCode: fareCodeValidation.errorCode || EditPassengerErrorCode.FARE_CODE_INVALID,
          });
        }

        // Obtener las claves necesarias
        fareCodeKey = await this.fareCodeService.getFareCodeKey(
          updateData.fareCode
        );

        const carrierKey = await this.passengerService.getCarrierKey(passenger);
        if (!carrierKey) {
          throw new AppCustomError({
            message: "Carrier not found for passenger",
            statusCode: 404,
            errorCode: EditPassengerErrorCode.CARRIER_NOT_FOUND,
          });
        }

        carrierClassKey =
          await this.carrierService.getCarrierClassKeyByFareCode(
            carrierKey,
            updateData.fareCode
          );

        if (!carrierClassKey) {
          throw new AppCustomError({
            message: `Carrier class not found for fare_code ${updateData.fareCode} and carrier ${carrierKey}`,
            statusCode: 404,
            errorCode: EditPassengerErrorCode.CARRIER_CLASS_NOT_FOUND,
          });
        }
      }

      // Validar passenger_name_iata si está presente
      let passengerName: string | undefined;
      let passengerNameUnformatted: string | undefined;

      if (updateData.passengerNameIata) {
        const nameValidation = this.validatePassengerNameIata(
          updateData.passengerNameIata
        );
        validationResults.passengerNameIata = nameValidation;

        if (!nameValidation.isValid) {
          throw new AppCustomError({
            message: nameValidation.errorMessage || "Invalid passenger_name_iata format",
            statusCode: 400,
            errorCode:
              nameValidation.errorCode ||
              EditPassengerErrorCode.PASSENGER_NAME_FORMAT_INVALID,
          });
        }

        // Sanitizar y formatear el nombre
        const sanitized = this.sanitizePassengerName(
          updateData.passengerNameIata
        );
        passengerName = sanitized.formatted;
        passengerNameUnformatted = sanitized.unformatted;
      }

      // 4. Actualizar en base de datos
      const updateFields: {
        fareCodeKey?: number;
        initialCarrierClassKey?: number;
        actualCarrierClassKey?: number;
        passengerName?: string;
        passengerNameUnformatted?: string;
      } = {};

      if (fareCodeKey && carrierClassKey) {
        updateFields.fareCodeKey = fareCodeKey;
        updateFields.initialCarrierClassKey = carrierClassKey;
        updateFields.actualCarrierClassKey = carrierClassKey; // Ambos se actualizan al mismo valor
      }

      if (passengerName) {
        updateFields.passengerName = passengerName;
        updateFields.passengerNameUnformatted = passengerNameUnformatted;
      }

      const updated = await this.repository.updatePassengerFields(
        passenger.passengerKey,
        updateFields
      );

      if (!updated) {
        throw new AppCustomError({
          message: "Failed to update passenger",
          statusCode: 500,
        });
      }

      // 5. Crear registro de auditoría
      await this.repository.createAuditLog(
        passenger.passengerKey,
        updateData
      );

      // Retornar resultado
      const result: UpdatedPassenger = {
        inkPassengerIdentifier,
        updatedAt: new Date(),
      };

      if (updateData.fareCode) {
        result.fareCode = updateData.fareCode;
      }

      if (updateData.passengerNameIata) {
        result.passengerNameIata = passengerName;
      }

      logInfo(
        `Passenger ${inkPassengerIdentifier} updated successfully`,
        "EditPassengerService"
      );

      return result;
    } catch (error: any) {
      logInfo(
        `Error updating passenger ${inkPassengerIdentifier}: ${error.message}`,
        "EditPassengerService"
      );

      // Re-lanzar AppCustomError tal cual
      if (error instanceof AppCustomError) {
        throw error;
      }

      // Convertir otros errores
      throw new AppCustomError({
        message: `Error updating passenger: ${error.message}`,
        error: error as Error,
        statusCode: error.statusCode || 500,
      });
    }
  }

  /**
   * Valida el código de tarifa (fare_code)
   * Reglas:
   * - Debe ser exactamente una letra mayúscula (A-Z)
   * - Debe existir en la tabla fare_code
   * - Debe tener una clase carrier asociada para el carrier del vuelo
   */
  private async validateFareCode(
    fareCode: string,
    passenger: Passenger,
    flight: Passenger["flight"]
  ): Promise<ValidationResult> {
    // Validar formato: una sola letra mayúscula
    const trimmed = fareCode.trim().toUpperCase();
    if (!/^[A-Z]{1}$/.test(trimmed)) {
      return {
        isValid: false,
        errorCode: EditPassengerErrorCode.FARE_CODE_INVALID,
        errorMessage: "fare_code must be exactly one uppercase letter (A-Z)",
      };
    }

    // Validar que existe en base de datos
    const fareCodeKey = await this.fareCodeService.getFareCodeKey(trimmed);
    if (!fareCodeKey) {
      return {
        isValid: false,
        errorCode: EditPassengerErrorCode.FARE_CODE_NOT_FOUND,
        errorMessage: `fare_code ${trimmed} does not exist in database`,
      };
    }

    // Validar que tiene clase carrier asociada
    const carrierKey = await this.passengerService.getCarrierKey(passenger);
    if (!carrierKey) {
      return {
        isValid: false,
        errorCode: EditPassengerErrorCode.CARRIER_NOT_FOUND,
        errorMessage: "Carrier not found for passenger",
      };
    }

    const carrierClassKey =
      await this.carrierService.getCarrierClassKeyByFareCode(
        carrierKey,
        trimmed
      );

    if (!carrierClassKey) {
      return {
        isValid: false,
        errorCode: EditPassengerErrorCode.CARRIER_CLASS_NOT_FOUND,
        errorMessage: `No carrier class found for fare_code ${trimmed} and carrier ${carrierKey}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Valida el nombre IATA del pasajero (passenger_name_iata)
   * Reglas:
   * - Debe contener exactamente un carácter `/` (formato: LAST/FIRST TITLE)
   * - Se convierte a mayúsculas automáticamente
   * - No puede contener caracteres no occidentales (solo Latin/Common Unicode)
   * - Cada parte (surname y first_name) debe tener longitud válida
   */
  private validatePassengerNameIata(
    passengerNameIata: string
  ): ValidationResult {
    const trimmed = passengerNameIata.trim().toUpperCase();

    // Validar que contiene exactamente un `/`
    const slashCount = (trimmed.match(/\//g) || []).length;
    if (slashCount !== 1) {
      return {
        isValid: false,
        errorCode: EditPassengerErrorCode.PASSENGER_NAME_FORMAT_INVALID,
        errorMessage:
          "passenger_name_iata must contain exactly one '/' (format: LAST/FIRST TITLE)",
      };
    }

    // Dividir en partes
    const parts = trimmed.split("/");
    const surname = parts[0].trim();
    const firstPart = parts[1].trim();

    // Validar longitud de surname
    if (
      surname.length < MIN_NAME_LENGTH ||
      surname.length > MAX_NAME_LENGTH
    ) {
      return {
        isValid: false,
        errorCode: EditPassengerErrorCode.PASSENGER_NAME_LENGTH_INVALID,
        errorMessage: `Surname length must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters`,
      };
    }

    // Validar longitud de first_name (puede incluir TITLE)
    if (
      firstPart.length < MIN_NAME_LENGTH ||
      firstPart.length > MAX_NAME_LENGTH * 2
    ) {
      return {
        isValid: false,
        errorCode: EditPassengerErrorCode.PASSENGER_NAME_LENGTH_INVALID,
        errorMessage: `First name length must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH * 2} characters`,
      };
    }

    // Validar caracteres permitidos (solo Latin/Common Unicode)
    const latinRegex = /^[A-Z\s\.\-\']+$/;
    if (!latinRegex.test(surname) || !latinRegex.test(firstPart)) {
      return {
        isValid: false,
        errorCode: EditPassengerErrorCode.PASSENGER_NAME_FORMAT_INVALID,
        errorMessage:
          "passenger_name_iata can only contain Latin characters, spaces, dots, hyphens, and apostrophes",
      };
    }

    return { isValid: true };
  }

  /**
   * Sanitiza el nombre del pasajero
   * Similar a passenger::sanatise_passenger_name() del legacy
   */
  private sanitizePassengerName(
    passengerNameIata: string
  ): { formatted: string; unformatted: string } {
    const trimmed = passengerNameIata.trim().toUpperCase();

    // Remover espacios múltiples
    const normalized = trimmed.replace(/\s+/g, " ");

    // Formatear: LAST/FIRST TITLE
    const formatted = normalized;

    // Unformatted: mismo valor por ahora (puede tener lógica adicional)
    const unformatted = normalized;

    return { formatted, unformatted };
  }
}

