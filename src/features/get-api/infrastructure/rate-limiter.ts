// infrastructure/rate-limiter.ts
import { injectable, inject } from "tsyringe";
import {
  Connection,
  REDIS_CONNECTION_INJECTION_TOKEN,
} from "./redis-connection-factory";

const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local refill_rate = tonumber(ARGV[1])   -- tokens/seg
local capacity = tonumber(ARGV[2])      -- burst
local now_ms = tonumber(ARGV[3])
local need = tonumber(ARGV[4])          -- tokens por llamada

local data = redis.call("HMGET", key, "tokens", "ts")
local tokens = tonumber(data[1])
local ts = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  ts = now_ms
end

local delta = math.max(0, now_ms - ts) / 1000.0
tokens = math.min(capacity, tokens + delta * refill_rate)

local allowed = 0
local wait_ms = 0

if tokens >= need then
  tokens = tokens - need
  allowed = 1
else
  local deficit = need - tokens
  wait_ms = math.ceil((deficit / refill_rate) * 1000)
end

redis.call("HMSET", key, "tokens", tokens, "ts", now_ms)
redis.call("PEXPIRE", key, 2000) -- TTL corto para evitar basura
return {allowed, wait_ms}
`;

@injectable()
export class RateLimiter {
  private scriptSha?: string;

  constructor(
    @inject(REDIS_CONNECTION_INJECTION_TOKEN)
    private readonly redis: Connection
  ) {}

  private async ensureLoaded() {
    if (!this.scriptSha) {
      this.scriptSha = (await this.redis.script(
        "LOAD",
        LUA_TOKEN_BUCKET
      )) as string;
    }
  }

  /**
   * Adquiere permiso para iniciar una llamada respetando el RPS.
   * @returns tiempo de espera (ms) que se tuvo que aplicar antes de permitir (útil para métricas)
   */
  async acquire(options: {
    limitKey: string; // ej: "rl:pokeapi"
    tokens?: number; // default 1
    refillRate?: number; // tokens/seg (RPS) - default 5 en la POC
    capacity?: number; // burst permitido - default 5..10 en la POC
  }): Promise<number> {
    const { limitKey, tokens = 1, refillRate = 5, capacity = 8 } = options;
    await this.ensureLoaded();
    const now = Date.now();

    try {
      const res: [number, number] = (await this.redis.evalsha(
        this.scriptSha!,
        1,
        limitKey,
        String(refillRate),
        String(capacity),
        String(now),
        String(tokens)
      )) as unknown as [number, number];

      const allowed = Number(res[0]);
      const waitMs = Number(res[1]);

      if (allowed === 1) return 0;

      // Espera y reintenta (normalmente ya habrá tokens)
      await new Promise((r) => setTimeout(r, waitMs));
      return (
        waitMs +
        (await this.acquire({ limitKey, tokens, refillRate, capacity }))
      );
    } catch (err: any) {
      // Si hay problema con el script (p.ej. NOSCRIPT), recarga
      if (String(err?.message || err).includes("NOSCRIPT")) {
        this.scriptSha = (await this.redis.script(
          "LOAD",
          LUA_TOKEN_BUCKET
        )) as string;
        return this.acquire({ limitKey, tokens, refillRate, capacity });
      }
      // Fallback conservador: evita inundar si Redis falló
      await new Promise((r) => setTimeout(r, 50));
      return 50;
    }
  }
}
