/**
 * Contrato para el servicio de códigos de tarifa
 */
export abstract class FareCodeServiceContract {
  /**
   * Obtiene el fare_code_key basado en el código de tarifa
   * @param fareCode - Código de tarifa (una letra: "Y", "J", "F", etc.)
   * @returns fare_code_key (number) o null si no existe
   */
  abstract getFareCodeKey(fareCode: string): Promise<number | null>;
}

