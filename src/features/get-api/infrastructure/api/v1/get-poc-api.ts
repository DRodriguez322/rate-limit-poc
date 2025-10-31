import { GetApiServiceContract } from "../../../domain/contracts/data-streamer-service";
import { type Handler, type Response, Router, Request } from "express";
import expressAsyncHandler from "express-async-handler";
import { type ValidationError } from "express-validator";
import { autoInjectable, inject } from "tsyringe";
import { getEnv, logInfo } from "ms_nodejs_common";
import {
  register,
  resetCustomMetrics,
  stressTestElapsedMs,
} from "../../metrics";

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
    routerV1.get(`/metrics`, this.getMetrics);
    routerV1.post(`/metrics/reset`, this.resetMetrics);
    routerV1.get(`/poke-api/stress`, this.stressPoc);

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
        const result = await this.getApiService.getApi(
          Number(req.query.idPokemon)
        );
        res.status(200).json({ result: result });
      } catch (error: any) {
        res.status(400).json(error.message);
      }
    }
  );

  /**
   * @swagger
   * /api/v1/metrics:
   *   get:
   *     summary: Obtener métricas de Prometheus
   *     description: Endpoint que expone las métricas de la aplicación en formato Prometheus. Incluye métricas de rate limiter, latencia externa y contadores de requests permitidos/throttled.
   *     tags:
   *       - Metrics
   *     responses:
   *       200:
   *         description: Métricas en formato Prometheus
   *         content:
   *           text/plain:
   *             schema:
   *               type: string
   *               description: Métricas de Prometheus en formato texto plano
   *               example: |
   *                 # HELP rps_wait_ms Tiempo de espera (ms) impuesto por el rate limiter antes de permitir la llamada
   *                 # TYPE rps_wait_ms histogram
   *                 rps_wait_ms_bucket{le="0"} 10
   *                 rps_wait_ms_bucket{le="1"} 15
   *                 # HELP external_latency_ms Latencia (ms) de la llamada al proveedor externo
   *                 # TYPE external_latency_ms histogram
   *                 external_latency_ms_bucket{le="50"} 20
   */
  readonly getMetrics: Handler = expressAsyncHandler(
    async (req: Request, res: Response) => {
      res.set("Content-Type", register.contentType);
      res.send(await register.metrics());
    }
  );

  /**
   * @swagger
   * /api/v1/metrics/reset:
   *   post:
   *     summary: Resetear métricas personalizadas
   *     description: Endpoint para resetear las métricas personalizadas (rate limiter y latencia externa) para realizar pruebas limpias. No resetea las métricas por defecto del sistema Node.js.
   *     tags:
   *       - Metrics
   *     responses:
   *       200:
   *         description: Métricas reseteadas exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   description: Mensaje de confirmación
   *                   example: "Métricas personalizadas reseteadas exitosamente"
   */
  readonly resetMetrics: Handler = expressAsyncHandler(
    async (req: Request, res: Response) => {
      resetCustomMetrics();
      res.status(200).json({
        message: "Métricas personalizadas reseteadas exitosamente",
      });
    }
  );

  /**
   * @swagger
   * /api/v1/poke-api/stress:
   *   get:
   *     summary: Stress test del rate limiter
   *     description: Endpoint para realizar pruebas de stress disparando múltiples llamadas concurrentes al API de Pokemon. Todas las llamadas pasan por el rate limiter configurado (5 RPS), por lo que serán throttled según corresponda. Cada llamada consultará un pokemon aleatorio.
   *     tags:
   *       - Stress Test
   *     parameters:
   *       - name: count
   *         in: query
   *         description: Número de llamadas concurrentes a disparar. Por defecto 40.
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 40
   *           example: 40
   *     responses:
   *       200:
   *         description: Resultado del stress test
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 requested:
   *                   type: integer
   *                   description: Número de requests solicitados
   *                   example: 40
   *                 ok:
   *                   type: integer
   *                   description: Número de requests exitosos
   *                   example: 40
   *                 fail:
   *                   type: integer
   *                   description: Número de requests fallidos
   *                   example: 0
   *                 elapsed_ms:
   *                   type: integer
   *                   description: Tiempo total transcurrido en milisegundos
   *                   example: 8500
   *                 note:
   *                   type: string
   *                   description: Nota informativa sobre el comportamiento del rate limiter
   *                   example: "Todas estas llamadas respetaron el rate limiter (5 RPS) aunque se dispararon juntas."
   *       400:
   *         description: Bad Request
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: Mensaje de error
   */
  readonly stressPoc: Handler = expressAsyncHandler(async (req, res) => {
    const count = Number(req.query.count ?? 40); // por defecto 40

    // Resetea métricas para pruebas limpias
    resetCustomMetrics();

    // Dispara 'count' llamadas concurrentes (todas pasan por RateLimiter en invoke)
    // Cada llamada consultará un pokemon aleatorio
    const tasks = Array.from({ length: count }, () =>
      this.getApiService.getApi()
    );
    const t0 = Date.now();
    const results = await Promise.allSettled(tasks);
    const t1 = Date.now();

    const elapsed = t1 - t0;
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;

    // Registra el tiempo real del test como métrica
    stressTestElapsedMs.set(elapsed);

    res.status(200).json({
      requested: count,
      ok,
      fail,
      elapsed_ms: elapsed,
      note: "Todas estas llamadas respetaron el rate limiter (5 RPS) aunque se dispararon juntas.",
    });
  });
}
