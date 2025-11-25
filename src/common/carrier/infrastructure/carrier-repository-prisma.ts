import { inject, injectable } from 'tsyringe';
import { CarrierRepositoryContract } from '../domain/contracts/carrier-repository';
import { Carrier } from '../../passenger/domain/contracts/passenger-service';
import { logInfo } from 'ms_nodejs_common';
import { PrismaClient } from '@prisma/client';

/**
 * Implementación del repositorio de carriers usando Prisma
 * Mejoras:
 * - Búsqueda mejorada usando FIND_IN_SET en lugar de INSTR
 * - Evita falsos positivos (ej: buscar "Y" no encuentra "YJ", "YW", etc.)
 */
@injectable()
export class CarrierRepositoryPrisma
  implements CarrierRepositoryContract
{
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Busca un carrier por su clave
   */
  async findByKey(carrierKey: number): Promise<Carrier | null> {
    try {
      const carrier = await this.prisma.carriers.findUnique({
        where: { carrier_key: carrierKey },
        select: {
          carrier_key: true,
          carrier_name: true,
        },
      });

      if (!carrier) {
        return null;
      }

      return {
        carrierKey: carrier.carrier_key,
        carrierName: carrier.carrier_name || undefined,
      };
    } catch (error: any) {
      logInfo(`Error finding carrier by key: ${error.message}`, 'CarrierRepository');
      throw error;
    }
  }

  /**
   * Busca carrier_class_key por carrier_key y fare_class
   * Mejora: Usa FIND_IN_SET para búsqueda más precisa que INSTR
   * 
   * Nota: Si la base de datos usa JSON array en fare_codes, se puede mejorar
   * usando operadores JSON. Por ahora asumimos que fare_codes es un string
   * separado por comas o sin separador.
   */
  async findCarrierClassKeyByFareCode(
    carrierKey: number,
    fareClass: string
  ): Promise<number | null> {
    try {
      // Opción 1: Si fare_codes es un string separado por comas
      // Usar FIND_IN_SET (MySQL) o similar
      const result = await this.prisma.$queryRaw<Array<{ carrier_class_key: number }>>`
        SELECT carrier_class_key
        FROM carrier_classes
        WHERE carrier_key = ${carrierKey}
        AND (
          FIND_IN_SET(${fareClass}, fare_codes) > 0
          OR fare_codes = ${fareClass}
        )
        LIMIT 1
      `;

      if (result && result.length > 0) {
        return result[0].carrier_class_key;
      }

      // Opción 2: Si FIND_IN_SET no está disponible, usar búsqueda exacta
      // o búsqueda con LIKE para códigos individuales
      // Esto es más seguro que INSTR pero menos ideal que FIND_IN_SET
      const fallbackResult = await this.prisma.carrier_classes.findFirst({
        where: {
          carrier_key: carrierKey,
          OR: [
            { fare_codes: fareClass }, // Exact match
            { fare_codes: { contains: `,${fareClass},` } }, // En medio de lista
            { fare_codes: { startsWith: `${fareClass},` } }, // Al inicio
            { fare_codes: { endsWith: `,${fareClass}` } }, // Al final
          ],
        },
        select: {
          carrier_class_key: true,
        },
      });

      return fallbackResult?.carrier_class_key || null;
    } catch (error: any) {
      // Si $queryRaw falla, usar búsqueda con Prisma normal
      try {
        // Búsqueda más conservadora: solo exact match o como parte de lista separada por comas
        const carrierClass = await this.prisma.carrier_classes.findFirst({
          where: {
            carrier_key: carrierKey,
            fare_codes: {
              contains: fareClass,
            },
          },
          select: {
            carrier_class_key: true,
            fare_codes: true,
          },
        });

        if (carrierClass) {
          // Validar que el fare_class está realmente en la lista
          // Esto evita falsos positivos como "Y" en "YJ"
          const fareCodesList = carrierClass.fare_codes
            .split(',')
            .map((code) => code.trim());
          if (fareCodesList.includes(fareClass)) {
            return carrierClass.carrier_class_key;
          }
        }

        return null;
      } catch (fallbackError: any) {
        logInfo(
          `Error finding carrier class key by fare code: ${fallbackError.message}`,
          'CarrierRepository'
        );
        return null;
      }
    }
  }
}

