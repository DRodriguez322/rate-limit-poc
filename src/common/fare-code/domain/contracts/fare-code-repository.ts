/**
 * Contrato para el repositorio de códigos de tarifa
 */
export abstract class FareCodeRepositoryContract {
  /**
   * Busca fare_code_key por código de tarifa
   * @param fareCode - Código de tarifa (una letra)
   * @returns fare_code_key o null si no existe
   */
  abstract findKeyByCode(fareCode: string): Promise<number | null>;
}

