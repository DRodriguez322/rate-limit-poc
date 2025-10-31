import { GetApiRepositoryContract } from '../domain/contracts/data-streamer-repository';
import { type GetApiServiceContract } from '../domain/contracts/data-streamer-service';

import {
  AppCustomError,
  HttpMethod,
  IInvokeServiceParams,
  LockComponentContract,
  logInfo,
  StateManagerComponentContract,
} from 'ms_nodejs_common';
import { container, inject, injectable } from 'tsyringe';
import axios, { AxiosError } from 'axios';
import { Connection, REDIS_CONNECTION_INJECTION_TOKEN } from '../infrastructure/redis-connection-factory';

@injectable()
export class GetApiServiceImpl implements GetApiServiceContract {
  constructor(
    @inject(GetApiRepositoryContract.name)
    private readonly repository: GetApiRepositoryContract,

    @inject(LockComponentContract.INJECTION_TOKEN)
    private readonly lockComponent: LockComponentContract,

    @inject(StateManagerComponentContract.name)
    private readonly stateManagerComponent: StateManagerComponentContract
  ) { }
  async getApi(idPokemon?: number): Promise<any> {

    const randomNumber = Math.floor(Math.random() * 200) + 1;

    idPokemon = idPokemon || randomNumber;

    const redis = container.resolve<Connection>(REDIS_CONNECTION_INJECTION_TOKEN);

    const result = await redis.get(`${idPokemon}_pokemon`);

    if (result) {
      return JSON.parse(result);
    }

    const response = await this.invoke<any>({
      appId: 'get-api',
      methodName: `/v2/pokemon/${idPokemon}`,
      httpMethod: HttpMethod.GET,
      body: { idPokemon: idPokemon },
      headers: {},
      externalUrl: { url: "https://pokeapi.co/api", authToken: '' },
    });

    await redis.setex(`${idPokemon}_pokemon`, 5, JSON.stringify(response));
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
      logInfo(
        `Invoke request: `,
        appId,
        methodName,
        httpMethod,
        JSON.stringify(body),
        headers
      );
      logInfo(`Invoke request path: `, methodName);

      // if (externalUrl) {
      const { url, authToken } = externalUrl || {};
      logInfo(`Axios invoke request path: `, `${url}/${methodName}`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const response = (
        await axios
          .request({
            url: `${url}/${methodName}`,
            method: httpMethod,
            data: body,
            headers: {
              ...headers,
              Authorization: `${authToken}`,
            },
          })
          .catch((error: AxiosError) => {
            console.log(
              `Error service invocation: appId=${appId}, methodName=${methodName}, error=${error.message}`
            );
            throw new AppCustomError({
              message: `Error invoking service appId=${appId}
                methodName=${methodName}
                error: ${JSON.stringify(error)}`,
              error: error as Error,
              statusCode: error.status,
            });
          })
      ).data;
      logInfo(`Invoke request external response: `, { response });
      return response as TValue;
      // }
    } catch (error: any) {
      throw new AppCustomError({
        message: error.message,
        error: error as Error,
      });
    }
  }
}



