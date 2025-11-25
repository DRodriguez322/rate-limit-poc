/**
 * Módulo común - Shared Services & Common Methods
 * 
 * Este módulo contiene servicios y métodos comunes utilizados por múltiples features.
 * Está organizado por dominio: passenger, flight, carrier, fare-code
 */

// Passenger Domain
export * from './passenger/domain/contracts/passenger-service';
export * from './passenger/domain/contracts/passenger-repository';
export * from './passenger/application/passenger-service-impl';
export * from './passenger/infrastructure/passenger-repository-prisma';

// Flight Domain
export * from './flight/domain/contracts/flight-service';
export * from './flight/domain/contracts/flight-repository';
export * from './flight/application/flight-service-impl';
export * from './flight/infrastructure/flight-repository-prisma';

// Carrier Domain
export * from './carrier/domain/contracts/carrier-service';
export * from './carrier/domain/contracts/carrier-repository';
export * from './carrier/application/carrier-service-impl';
export * from './carrier/infrastructure/carrier-repository-prisma';

// Fare Code Domain
export * from './fare-code/domain/contracts/fare-code-service';
export * from './fare-code/domain/contracts/fare-code-repository';
export * from './fare-code/application/fare-code-service-impl';
export * from './fare-code/infrastructure/fare-code-repository-prisma';

// Shared Infrastructure
export * from './shared/infrastructure/cache-factory';

