import { GetApiServiceContract } from '../../../domain/contracts/data-streamer-service';
import { type Handler, type Response, Router, Request } from 'express';
import expressAsyncHandler from 'express-async-handler';
import { type ValidationError } from 'express-validator';
import { autoInjectable, inject } from 'tsyringe';
import { getEnv, logInfo } from 'ms_nodejs_common';

@autoInjectable()
export class GetPocApi {
  private readonly router: Router = Router();

  /**
   * Constructs the GetPocApi.
   * Initializes the API routes for the get api service.
   *
   * @param getApiService - Injected service for getting the api.
   */
  constructor(
    @inject(GetApiServiceContract.name)
    private readonly getApiService: GetApiServiceContract
  ) {
    this.registerV1Routes();
  }

  /**
   * Retrieves the router with registered routes.
   * This method returns the Express router containing all the configured routes for this API.
   *
   * @returns The instance of the Express router used by this API.
   */
  getRouter() {
    return this.router;
  }

  /**
   * Registers version 1 routes for the API.
   * Sets up the API endpoints for starting the data streamer process
   * The routes are prefixed with `/v1` to denote the API version.
   *
   * Usage:
   * This method is called within the constructor to set up the initial routes for the API.
   */
  private registerV1Routes() {
    const routerV1 = Router();

    routerV1.get(`/poke-api`, this.getPoc);

    this.router.use(`/v1`, routerV1);
  }

  /**
   * @swagger
   * /api/v1/poke-api:
   *   get:
   *     summary: Get pokemon data
   *     description: Endpoint to get pokemon data.
   *     parameters:
   *       - name: idPokemon
   *         in: query
   *         description: The id of the pokemon to get.
   *         required: false
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Success
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 result:
   *                   type: object
   *                   description: Pokemon data
   *                 errors:
   *                   type: array
   *                   items:
   *                     type: string
   *                     description: Error message
   *       500:
   *         description: Internal Server Error
   *       400:
   *         description: Bad Request
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: Error message
   *                 errors:
   *                   type: array
   *                   items:
   *                     type: string
   *                     description: Error message
   */

  readonly getPoc: Handler = expressAsyncHandler(
    async (
      req: Request,
      res: Response<{
        result: string;
        errors?: ValidationError[];
      }>
    ) => {
      try {
        const result = await this.getApiService.getApi(Number(req.query.idPokemon));
        res.status(200).json({ result: result });
      } catch (error: any) {
        res.status(400).json(error.message);
      }
    }
  );
}
