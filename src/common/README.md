# Common Services & Methods

Este módulo contiene servicios y métodos comunes utilizados por múltiples features del sistema. Está organizado por dominio siguiendo los principios de Domain-Driven Design (DDD).

## Estructura

```
common/
├── passenger/          # Dominio de Pasajeros
│   ├── domain/
│   │   └── contracts/  # Contratos (interfaces)
│   ├── application/    # Lógica de negocio
│   └── infrastructure/ # Implementación de acceso a datos
├── flight/             # Dominio de Vuelos
├── carrier/             # Dominio de Carriers
├── fare-code/          # Dominio de Códigos de Tarifa
└── shared/             # Infraestructura compartida
    └── infrastructure/ # Cache, conexiones, etc.
```

## Dominios

### Passenger (Pasajeros)

Servicios disponibles:
- `getPassengerByIdentifier()` - Obtiene un pasajero por su identificador único
- `getPassengerKeyByIdentifier()` - Obtiene la clave del pasajero por identificador
- `validatePassenger()` - Valida un pasajero
- `getFlight()` - Obtiene el vuelo asociado al pasajero (lazy loading)
- `getCarrierKey()` - Obtiene el carrier_key del pasajero
- `getCarrier()` - Obtiene el carrier asociado al pasajero (lazy loading)

**Mejoras implementadas:**
- ✅ Caché Redis para búsquedas frecuentes
- ✅ Optimización de queries combinando búsquedas por identifier y external_id
- ✅ Manejo de errores con códigos específicos
- ✅ Validaciones tempranas

### Flight (Vuelos)

Servicios disponibles:
- `getFlightByKey()` - Obtiene un vuelo por su clave
- `getCarrierKey()` - Obtiene el carrier_key asociado al vuelo

**Mejoras implementadas:**
- ✅ Lazy loading mejorado
- ✅ Manejo de casos donde el vuelo no existe

### Carrier (Carriers)

Servicios disponibles:
- `getCarrierByKey()` - Obtiene un carrier por su clave
- `getCarrierClassKeyByFareCode()` - Obtiene carrier_class_key por carrier_key y fare_code

**Mejoras implementadas:**
- ✅ Caché Redis en lugar de XCACHE
- ✅ Búsqueda mejorada usando FIND_IN_SET en lugar de INSTR (evita falsos positivos)
- ✅ Validación de formato de fare_class antes de buscar
- ✅ Retorna error específico si no se encuentra la relación

### Fare Code (Códigos de Tarifa)

Servicios disponibles:
- `getFareCodeKey()` - Obtiene el fare_code_key por código de tarifa

**Mejoras implementadas:**
- ✅ Caché de resultados
- ✅ Validación de formato antes de buscar

## Uso

### 1. Configurar inyección de dependencias

En el archivo principal de la aplicación (ej: `src/server.ts`):

```typescript
import { configureCommonServices } from './common/dependency-injection';

// Al inicio de la aplicación
configureCommonServices();
```

### 2. Usar los servicios en tus features

```typescript
import { inject, injectable } from 'tsyringe';
import {
  PassengerServiceContract,
  Passenger,
} from '../common';

@injectable()
export class MyFeatureService {
  constructor(
    @inject(PassengerServiceContract.name)
    private readonly passengerService: PassengerServiceContract
  ) {}

  async doSomething(identifier: string) {
    // Obtener pasajero
    const passenger = await this.passengerService.getPassengerByIdentifier(
      identifier
    );

    if (!passenger) {
      throw new Error('Passenger not found');
    }

    // Obtener vuelo asociado (lazy loading)
    const flight = await this.passengerService.getFlightForPassenger(passenger);

    // Obtener carrier_key
    const carrierKey = await this.passengerService.getCarrierKey(passenger);

    // ... resto de la lógica
  }
}
```

### 3. Ejemplo completo: Actualizar fare_code

```typescript
import {
  PassengerServiceContract,
  CarrierServiceContract,
  FareCodeServiceContract,
} from '../common';

async function updateFareCode(
  passengerService: PassengerServiceContract,
  carrierService: CarrierServiceContract,
  fareCodeService: FareCodeServiceContract,
  inkPassengerIdentifier: string,
  fareCode: string
) {
  // 1. Obtener el pasajero
  const passenger = await passengerService.getPassengerByIdentifier(
    inkPassengerIdentifier
  );

  if (!passenger) {
    throw new Error('PASSENGER_NOT_FOUND');
  }

  // 2. Obtener el vuelo asociado
  const flight = await passengerService.getFlightForPassenger(passenger);
  if (!flight) {
    throw new Error('FLIGHT_NOT_FOUND');
  }

  // 3. Obtener el carrier_key
  const carrierKey = await passengerService.getCarrierKey(passenger);
  if (!carrierKey) {
    throw new Error('CARRIER_NOT_FOUND');
  }

  // 4. Validar el fare_code
  const fareCodeKey = await fareCodeService.getFareCodeKey(fareCode);
  if (!fareCodeKey) {
    throw new Error('FARE_CODE_NOT_FOUND');
  }

  // 5. Obtener el carrier_class_key
  const carrierClassKey = await carrierService.getCarrierClassKeyByFareCode(
    carrierKey,
    fareCode
  );
  if (!carrierClassKey) {
    throw new Error('CARRIER_CLASS_NOT_FOUND');
  }

  // 6. Actualizar los campos del pasajero
  // (esto dependería de tu repositorio de actualización)
  // await passengerRepository.update({
  //   passengerKey: passenger.passengerKey,
  //   fareCodeKey,
  //   initialCarrierClassKey: carrierClassKey,
  //   actualCarrierClassKey: carrierClassKey,
  // });
}
```

## Caché

Todos los servicios implementan caché Redis con los siguientes TTLs:
- **Passenger**: 5 minutos
- **Carrier Class**: 10 minutos
- **Fare Code**: 1 hora

El caché se invalida automáticamente después del TTL. Si el caché falla, los servicios continúan funcionando sin él (graceful degradation).

## Códigos de Error

Los servicios utilizan códigos de error específicos:

- `PASSENGER_NOT_FOUND` - Pasajero no existe
- `FLIGHT_NOT_FOUND` - Vuelo asociado no existe
- `CARRIER_NOT_FOUND` - Carrier no existe
- `FARE_CODE_NOT_FOUND` - Código de tarifa no existe
- `CARRIER_CLASS_NOT_FOUND` - No hay clase carrier asociada al fare_code para ese carrier

## Mejoras vs Código Legacy

### Passenger
- ✅ Caché Redis en lugar de sin caché
- ✅ Búsqueda optimizada combinando identifier y external_id
- ✅ Validaciones tempranas con códigos de error específicos

### Carrier Class
- ✅ Caché Redis en lugar de XCACHE
- ✅ Búsqueda mejorada (FIND_IN_SET) que evita falsos positivos
- ✅ Validación de formato antes de buscar

### Performance
- ✅ Lazy loading mejorado para relaciones
- ✅ Índices optimizados en queries
- ✅ Caché estratégico para reducir carga en base de datos

## Testing

Para testing, puedes mockear los contratos:

```typescript
import { PassengerServiceContract } from '../common';

const mockPassengerService: Partial<PassengerServiceContract> = {
  getPassengerByIdentifier: jest.fn().mockResolvedValue(mockPassenger),
};

container.register<PassengerServiceContract>(
  PassengerServiceContract.name,
  { useValue: mockPassengerService as PassengerServiceContract }
);
```

## Notas

- Los servicios están diseñados para ser stateless y thread-safe
- El caché es opcional y los servicios funcionan sin él
- Todos los métodos son async y retornan Promises
- Los errores se lanzan como `AppCustomError` con códigos de estado HTTP apropiados

