import { type GetApiRepositoryContract } from '../domain/contracts/data-streamer-repository';
import { inject, injectable } from 'tsyringe';

@injectable()
export class GetApiRepositoryPrisma
  implements GetApiRepositoryContract {
  constructor() { }
}
