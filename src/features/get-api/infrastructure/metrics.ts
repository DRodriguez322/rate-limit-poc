// infrastructure/metrics.ts
import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const rpsWaitMs = new client.Histogram({
  name: "rps_wait_ms",
  help: "Tiempo de espera (ms) impuesto por el rate limiter antes de permitir la llamada. NOTA: La suma (rps_wait_ms_sum) es la suma acumulada de tiempos de espera individuales de cada request, NO el tiempo real transcurrido del test. Con requests concurrentes, muchas esperan en paralelo, por lo que el tiempo real es mucho menor que la suma.",
  buckets: [0, 1, 5, 10, 20, 50, 100, 200, 500, 1000],
});

export const externalLatencyMs = new client.Histogram({
  name: "external_latency_ms",
  help: "Latencia (ms) de la llamada al proveedor externo",
  buckets: [5, 10, 20, 50, 100, 200, 500, 1000, 5000, 20000],
});

export const rpsAllowed = new client.Counter({
  name: "rps_allowed_total",
  help: "Llamadas admitidas por el rate limiter",
});

export const rpsThrottled = new client.Counter({
  name: "rps_throttled_total",
  help: "Veces que el limiter impuso espera (>0ms)",
});

export const stressTestElapsedMs = new client.Gauge({
  name: "stress_test_elapsed_ms",
  help: "Tiempo real transcurrido (ms) del último stress test ejecutado. Este es el tiempo real que tomó completar todas las requests concurrentes, considerando que muchas esperan en paralelo.",
});

register.registerMetric(rpsWaitMs);
register.registerMetric(externalLatencyMs);
register.registerMetric(rpsAllowed);
register.registerMetric(rpsThrottled);
register.registerMetric(stressTestElapsedMs);

/**
 * Resetea todas las métricas personalizadas para pruebas limpias.
 * No resetea las métricas por defecto del sistema Node.js.
 */
export function resetCustomMetrics(): void {
  rpsWaitMs.reset();
  externalLatencyMs.reset();
  rpsAllowed.reset();
  rpsThrottled.reset();
  stressTestElapsedMs.reset();
}
