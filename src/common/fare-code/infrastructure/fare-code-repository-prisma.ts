import { inject, injectable } from 'tsyringe';
import { FareCodeRepositoryContract } from '../domain/contracts/fare-code-repository';
import { logInfo } from 'ms_nodejs_common';
import { PrismaClient } from '@prisma/client';

/**
 * Implementación del repositorio de códigos de tarifa usando Prisma
 */
@injectable()
export class FareCodeRepositoryPrisma
  implements FareCodeRepositoryContract
{
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Busca fare_code_key por código de tarifa
   */
  async findKeyByCode(fareCode: string): Promise<number | null> {
    try {
      const fareCodeRecord = await this.prisma.fare_code.findFirst({
        where: {
          fare_code: fareCode.trim().toUpperCase(),
        },
        select: {
          fare_code_key: true,
        },
      });

      return fareCodeRecord?.fare_code_key || null;
    } catch (error: any) {
      logInfo(
        `Error finding fare code key by code: ${error.message}`,
        'FareCodeRepository'
      );
      return null;
    }
  }
}

