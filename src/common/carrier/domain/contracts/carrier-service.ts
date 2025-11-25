import { Carrier } from '../../passenger/domain/contracts/passenger-service';

/**
 * Contrato para el servicio de carriers
 */
export abstract class CarrierServiceContract {
  /**
   * Obtiene un carrier por su clave
   * @param carrierKey - Clave del carrier
   * @returns Objeto carrier o null si no existe
   */
  abstract getCarrierByKey(carrierKey: number): Promise<Carrier | null>;

  /**
   * Obtiene el carrier_class_key basado en carrier_key y fare_code
   * @param carrierKey - Clave del carrier
   * @param fareClass - Código de tarifa (una letra: "Y", "J", "F", etc.)
   * @returns carrier_class_key (number) o null si no existe
   */
  abstract getCarrierClassKeyByFareCode(
    carrierKey: number,
    fareClass: string
  ): Promise<number | null>;
}

