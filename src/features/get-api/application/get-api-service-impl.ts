import { GetApiRepositoryContract } from "../domain/contracts/data-streamer-repository";
import { type GetApiServiceContract } from "../domain/contracts/data-streamer-service";

import {
  AppCustomError,
  HttpMethod,
  IInvokeServiceParams,
  LockComponentContract,
  logInfo,
  StateManagerComponentContract,
} from "ms_nodejs_common";
import { container, inject, injectable } from "tsyringe";
import axios, { AxiosError } from "axios";
import {
  Connection,
  REDIS_CONNECTION_INJECTION_TOKEN,
} from "../infrastructure/redis-connection-factory";
import { RateLimiter } from "../infrastructure/rate-limiter";
import {
  externalLatencyMs,
  rpsAllowed,
  rpsThrottled,
  rpsWaitMs,
} from "../infrastructure/metrics";

@injectable()
export class GetApiServiceImpl implements GetApiServiceContract {
  constructor(
    @inject(GetApiRepositoryContract.name)
    private readonly repository: GetApiRepositoryContract,

    @inject(LockComponentContract.INJECTION_TOKEN)
    private readonly lockComponent: LockComponentContract,

    @inject(StateManagerComponentContract.name)
    private readonly stateManagerComponent: StateManagerComponentContract,

    private readonly rateLimiter: RateLimiter
  ) {}
  async getApi(idPokemon?: number): Promise<any> {
    const randomNumber = Math.floor(Math.random() * 200) + 1;

    idPokemon = idPokemon || randomNumber;

    const redis = container.resolve<Connection>(
      REDIS_CONNECTION_INJECTION_TOKEN
    );

    const result = await redis.get(`${idPokemon}_pokemon`);

    if (result) {
      return JSON.parse(result);
    }

    const response = await this.invoke<any>({
      appId: "get-api",
      methodName: `/v2/pokemon/${idPokemon}`,
      httpMethod: HttpMethod.GET,
      body: { idPokemon: idPokemon },
      headers: {},
      externalUrl: { url: "https://pokeapi.co/api", authToken: "" },
    });

    await redis.setex(`${idPokemon}_pokemon`, 60, JSON.stringify(response));
    return response;
  }

  async invoke<TValue>({
    appId,
    methodName,
    httpMethod,
    body,
    headers,
    externalUrl,
  }: IInvokeServiceParams): Promise<TValue> {
    try {
      const { url, authToken } = externalUrl || {};
      const limitKey = "rl:pokeapi"; // clave global compartida para la POC
      const waited = await this.rateLimiter.acquire({
        limitKey,
        tokens: 1, // POC: 1 token por request
        refillRate: 5, // *** 5 RPS ***
        capacity: 8, // pequeño burst permitido
      });
      rpsWaitMs.observe(waited);
      if (waited > 0) rpsThrottled.inc();
      else rpsAllowed.inc();

      const t0 = Date.now();
      const response = (
        await axios
          .request({
            url: `${url}/${methodName}`,
            method: httpMethod,
            data: body,
            headers: { ...headers, Authorization: `${authToken}` },
            timeout: 10000,
          })
          .catch((error: AxiosError) => {
            console.log(
              `Error service invocation: appId=${appId}, methodName=${methodName}, error=${error.message}`
            );
            throw new AppCustomError({
              message: `Error invoking service appId=${appId}
                methodName=${methodName}
                error: ${JSON.stringify(error?.toJSON?.() ?? error.message)}`,
              error: error as Error,
              statusCode: (error as any)?.status,
            });
          })
      ).data;

      externalLatencyMs.observe(Date.now() - t0);
      return response as TValue;
    } catch (error: any) {
      throw new AppCustomError({
        message: error.message,
        error: error as Error,
      });
    }
  }
}
