import { Carrier } from '../../passenger/domain/contracts/passenger-service';

/**
 * Contrato para el repositorio de carriers
 */
export abstract class CarrierRepositoryContract {
  /**
   * Busca un carrier por su clave
   * @param carrierKey - Clave del carrier
   * @returns Objeto carrier o null si no existe
   */
  abstract findByKey(carrierKey: number): Promise<Carrier | null>;

  /**
   * Busca carrier_class_key por carrier_key y fare_class
   * Mejora: Usa FIND_IN_SET para búsqueda más precisa que INSTR
   * @param carrierKey - Clave del carrier
   * @param fareClass - Código de tarifa (una letra)
   * @returns carrier_class_key o null si no existe
   */
  abstract findCarrierClassKeyByFareCode(
    carrierKey: number,
    fareClass: string
  ): Promise<number | null>;
}

