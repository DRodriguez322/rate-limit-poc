import { AppCustomError, IAppCustomErrorParams } from "ms_nodejs_common";

/**
 * Parámetros extendidos para EditPassengerError que incluyen errorCode
 */
export interface IEditPassengerErrorParams extends IAppCustomErrorParams {
  errorCode?: string;
}

/**
 * Clase de error personalizada para el feature edit-passenger
 * Extiende AppCustomError de ms_nodejs_common y agrega soporte para errorCode
 */
export class EditPassengerError extends AppCustomError {
  public readonly errorCode?: string;

  constructor(params: IEditPassengerErrorParams) {
    super({
      message: params.message,
      statusCode: params.statusCode,
      error: params.error,
    });
    this.errorCode = params.errorCode;
    Object.setPrototypeOf(this, EditPassengerError.prototype);
  }
}
