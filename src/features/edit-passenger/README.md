# Edit Passenger Feature

Feature para actualizar información de pasajeros existentes mediante API REST.

## Endpoint

**PATCH** `/api/v1/passengers/{ink_passenger_identifier}`

## Descripción

Permite actualizar dos campos opcionales de un pasajero:
- `fare_code`: Código de tarifa/clase de servicio
- `passenger_name_iata`: Nombre del pasajero en formato IATA

## Request

### Path Parameters

- `ink_passenger_identifier` (string, required) - Identificador único del pasajero

### Request Body

```json
{
  "fare_code": "Y",
  "passenger_name_iata": "DOE/JOHN MR"
}
```

**Campos:**
- `fare_code` (string, optional) - Código de tarifa (una letra mayúscula: A-Z)
- `passenger_name_iata` (string, optional) - Nombre en formato IATA (LAST/FIRST TITLE)

**Nota:** Al menos uno de los dos campos debe estar presente.

### Ejemplo de Request

```bash
curl -X PATCH http://localhost:3000/api/v1/passengers/PAX001 \
  -H "Content-Type: application/json" \
  -d '{
    "fare_code": "J",
    "passenger_name_iata": "SMITH/JANE MS"
  }'
```

## Response

### 200 OK - Success

```json
{
  "ink_passenger_identifier": "PAX001",
  "fare_code": "J",
  "passenger_name_iata": "SMITH/JANE MS",
  "updated_at": "2025-01-19T15:03:00.000Z"
}
```

### 400 Bad Request - Validation Error

```json
{
  "error_code": "VALIDATION_ERROR",
  "message": "Invalid request format",
  "details": [
    {
      "field": "fare_code",
      "message": "fare_code must be an uppercase letter (A-Z)"
    }
  ]
}
```

### 404 Not Found - Passenger Not Found

```json
{
  "error_code": "PASSENGER_NOT_FOUND",
  "message": "Passenger with identifier PAX999 does not exist",
  "ink_passenger_identifier": "PAX999"
}
```

### 409 Conflict - Flight Closed or No Association

```json
{
  "error_code": "FLIGHT_CLOSED",
  "message": "Cannot update passenger on flight that is not enabled for web services"
}
```

## Validaciones

### fare_code

- Debe ser exactamente una letra mayúscula (A-Z)
- Debe existir en la tabla `fare_code`
- Debe tener una clase carrier asociada para el carrier del vuelo del pasajero
- Al actualizar `fare_code`, se actualizan automáticamente:
  - `fare_code_key`
  - `initial_carrier_class_key`
  - `actual_carrier_class_key`

### passenger_name_iata

- Debe contener exactamente un carácter `/` (formato: LAST/FIRST TITLE)
- Se convierte a mayúsculas automáticamente
- Solo puede contener caracteres Latin (A-Z, espacios, puntos, guiones, apostrofes)
- Cada parte (surname y first_name) debe tener longitud válida (1 a 50 caracteres)

## Flujo de Ejecución

1. **Validación de Request**: Verificar que al menos un campo esté presente
2. **Obtener Pasajero**: Usar `PassengerService.getPassengerByIdentifier()`
3. **Validar Asociación**: Verificar que el pasajero tiene vuelo asociado y está habilitado
4. **Validar Campos**:
   - `fare_code`: Validar formato, existencia, y clase carrier asociada
   - `passenger_name_iata`: Validar formato y longitud
5. **Actualizar Base de Datos**: Actualizar campos en tabla `passengers`
6. **Crear Auditoría**: Registrar cambio en tabla de auditoría
7. **Retornar Resultado**: Retornar pasajero actualizado

## Dependencias

Este feature utiliza los servicios comunes:
- `PassengerService` - Para obtener y validar pasajeros
- `CarrierService` - Para obtener carrier_class_key por fare_code
- `FareCodeService` - Para validar códigos de tarifa

## Estructura del Código

```
edit-passenger/
├── domain/
│   └── contracts/
│       ├── edit-passenger-service.ts      # Contrato del servicio
│       └── edit-passenger-repository.ts    # Contrato del repositorio
├── application/
│   └── edit-passenger-service-impl.ts    # Implementación del servicio
├── infrastructure/
│   ├── api/
│   │   └── v1/
│   │       └── edit-passenger-api.ts      # API Controller
│   └── edit-passenger-repository-prisma.ts # Repositorio Prisma
└── README.md
```

## Códigos de Error

- `PASSENGER_NOT_FOUND` - Pasajero no existe
- `FLIGHT_NOT_FOUND` - Vuelo asociado no existe
- `CARRIER_NOT_FOUND` - Carrier no existe
- `FARE_CODE_INVALID` - Formato de fare_code inválido
- `FARE_CODE_NOT_FOUND` - Código de tarifa no existe
- `CARRIER_CLASS_NOT_FOUND` - No hay clase carrier asociada
- `PASSENGER_NAME_FORMAT_INVALID` - Formato de nombre inválido
- `PASSENGER_NAME_LENGTH_INVALID` - Longitud de nombre inválida
- `NO_ASSOCIATION` - Pasajero no tiene asociación con vuelo
- `EMPTY_REQUEST` - Request body vacío
- `FLIGHT_CLOSED` - Vuelo no habilitado para web services

## Testing

Para probar el endpoint:

```bash
# Actualizar solo fare_code
curl -X PATCH http://localhost:3000/api/v1/passengers/PAX001 \
  -H "Content-Type: application/json" \
  -d '{"fare_code": "J"}'

# Actualizar solo passenger_name_iata
curl -X PATCH http://localhost:3000/api/v1/passengers/PAX001 \
  -H "Content-Type: application/json" \
  -d '{"passenger_name_iata": "DOE/JOHN MR"}'

# Actualizar ambos campos
curl -X PATCH http://localhost:3000/api/v1/passengers/PAX001 \
  -H "Content-Type: application/json" \
  -d '{
    "fare_code": "Y",
    "passenger_name_iata": "SMITH/JANE MS"
  }'
```

## Notas

- El pasajero debe existir y tener asociación con un vuelo
- El vuelo debe estar habilitado para web services
- Los cambios se registran en la tabla de auditoría
- El campo `is_web_service` se marca como `true` al actualizar

