import { EditPassengerServiceContract } from "../../../domain/contracts/edit-passenger-service";
import { type Handler, type Response, Router, Request } from "express";
import expressAsyncHandler from "express-async-handler";
import { autoInjectable, inject } from "tsyringe";
import { AppCustomError, logInfo } from "ms_nodejs_common";
import { EditPassengerError } from "../../../domain/errors/edit-passenger-error";
import { body, param, validationResult } from "express-validator";

/**
 * Request body para actualizar pasajero
 */
interface UpdatePassengerRequest {
  fare_code?: string;
  passenger_name_iata?: string;
}

/**
 * API Controller para edición de pasajeros
 * Endpoint: PATCH /api/v1/passengers/{ink_passenger_identifier}
 */
@autoInjectable()
export class EditPassengerApi {
  private readonly router: Router = Router();

  /**
   * Constructs the EditPassengerApi.
   * Initializes the API routes for the edit passenger service.
   *
   * @param editPassengerService - Injected service for editing passengers.
   */
  constructor(
    @inject(EditPassengerServiceContract.name)
    private readonly editPassengerService: EditPassengerServiceContract
  ) {
    this.registerV1Routes();
  }

  /**
   * Retrieves the router with registered routes.
   */
  getRouter() {
    return this.router;
  }

  /**
   * Registers version 1 routes for the API.
   */
  private registerV1Routes() {
    const routerV1 = Router();

    routerV1.patch(
      `/passengers/:ink_passenger_identifier`,
      [
        param("ink_passenger_identifier")
          .notEmpty()
          .withMessage("ink_passenger_identifier is required")
          .trim(),
        body("fare_code")
          .optional()
          .isString()
          .withMessage("fare_code must be a string")
          .isLength({ min: 1, max: 1 })
          .withMessage("fare_code must be exactly one character")
          .matches(/^[A-Z]$/)
          .withMessage("fare_code must be an uppercase letter (A-Z)")
          .trim()
          .toUpperCase(),
        body("passenger_name_iata")
          .optional()
          .isString()
          .withMessage("passenger_name_iata must be a string")
          .trim(),
        body().custom((value) => {
          // Al menos uno de los campos opcionales debe estar presente
          if (!value.fare_code && !value.passenger_name_iata) {
            throw new Error(
              "At least one field (fare_code or passenger_name_iata) must be provided"
            );
          }
          return true;
        }),
      ],
      this.updatePassenger
    );

    this.router.use(`/v1`, routerV1);
  }

  /**
   * @swagger
   * /api/v1/passengers/{ink_passenger_identifier}:
   *   patch:
   *     summary: Update passenger details
   *     description: Updates fare_code and/or passenger_name_iata for an existing passenger
   *     tags:
   *       - Passengers
   *     parameters:
   *       - name: ink_passenger_identifier
   *         in: path
   *         required: true
   *         description: Unique identifier of the passenger
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               fare_code:
   *                 type: string
   *                 description: Fare code (one uppercase letter)
   *                 example: "Y"
   *               passenger_name_iata:
   *                 type: string
   *                 description: Passenger name in IATA format (LAST/FIRST TITLE)
   *                 example: "DOE/JOHN MR"
   *     responses:
   *       200:
   *         description: Passenger updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ink_passenger_identifier:
   *                   type: string
   *                 fare_code:
   *                   type: string
   *                 passenger_name_iata:
   *                   type: string
   *                 updated_at:
   *                   type: string
   *                   format: date-time
   *       400:
   *         description: Bad Request - Validation error
   *       404:
   *         description: Passenger not found
   *       409:
   *         description: Conflict - Flight closed or no association
   *       500:
   *         description: Internal Server Error
   */
  readonly updatePassenger: Handler = expressAsyncHandler(
    async (req: Request, res: Response) => {
      try {
        // Validar resultados de express-validator
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({
            error_code: "VALIDATION_ERROR",
            message: "Invalid request format",
            details: errors.array().map((err) => ({
              field: err.type === "field" ? err.path : "unknown",
              message: err.msg,
            })),
          });
          return;
        }

        const { ink_passenger_identifier } = req.params;
        const { fare_code, passenger_name_iata } = req.body;

        logInfo(
          `Updating passenger ${ink_passenger_identifier}`,
          "EditPassengerApi"
        );

        const result = await this.editPassengerService.updatePassenger(
          ink_passenger_identifier,
          {
            fareCode: fare_code,
            passengerNameIata: passenger_name_iata,
          }
        );

        res.status(200).json({
          ink_passenger_identifier: result.inkPassengerIdentifier,
          fare_code: result.fareCode,
          passenger_name_iata: result.passengerNameIata,
          updated_at: result.updatedAt.toISOString(),
        });
      } catch (error: any) {
        logInfo(
          `Error in updatePassenger endpoint: ${error.message}`,
          "EditPassengerApi"
        );

        // Manejar EditPassengerError (tiene errorCode)
        if (error instanceof EditPassengerError) {
          const statusCode = error.statusCode || 500;
          res.status(statusCode).json({
            error_code: error.errorCode || "INTERNAL_ERROR",
            message: error.message,
            ...(error.errorCode === "PASSENGER_NOT_FOUND" && {
              ink_passenger_identifier: req.params.ink_passenger_identifier,
            }),
          });
          return;
        }

        // Manejar AppCustomError (sin errorCode)
        if (error instanceof AppCustomError) {
          const statusCode = error.statusCode || 500;
          res.status(statusCode).json({
            error_code: "INTERNAL_ERROR",
            message: error.message,
          });
          return;
        }

        // Error genérico
        res.status(500).json({
          error_code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        });
      }
    }
  );
}
