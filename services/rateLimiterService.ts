
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

class RateLimiterService {
  private buckets = new Map<string, TokenBucket>();
  
  // Configuração Padrão
  private readonly capacity: number = 20;      // Máximo de requisições instantâneas (Burst)
  private readonly refillRate: number = 2;     // Tokens adicionados por segundo
  private readonly cleanupInterval: number = 60 * 60 * 1000; // 1 hora

  constructor() {
    // Limpeza periódica para evitar vazamento de memória em tenants inativos
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  /**
   * Verifica se a requisição pode ser processada.
   * Consome 1 token se permitido.
   */
  public checkLimit(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: this.capacity,
        lastRefill: now
      };
      this.buckets.set(key, bucket);
    } else {
      this.refill(bucket, now);
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true; // Permitido
    }

    return false; // Bloqueado (Rate Limit Exceeded)
  }

  /**
   * Recarrega tokens baseado no tempo decorrido
   */
  private refill(bucket: TokenBucket, now: number): void {
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    
    if (elapsedSeconds > 0) {
      const newTokens = elapsedSeconds * this.refillRate;
      bucket.tokens = Math.min(this.capacity, bucket.tokens + newTokens);
      bucket.lastRefill = now;
    }
  }

  /**
   * Remove buckets que não são usados há muito tempo
   */
  private cleanup() {
    const now = Date.now();
    const expiryTime = 24 * 60 * 60 * 1000; // 24 horas

    this.buckets.forEach((bucket, key) => {
      if (now - bucket.lastRefill > expiryTime) {
        this.buckets.delete(key);
      }
    });
  }

  /**
   * Retorna estado atual (para debug/admin)
   */
  public getBucketStatus(key: string) {
    const bucket = this.buckets.get(key);
    if (!bucket) return null;
    
    // Simula um refill visual sem alterar estado
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const currentTokens = Math.min(this.capacity, bucket.tokens + (elapsedSeconds * this.refillRate));
    
    return {
      tokens: Math.floor(currentTokens),
      max: this.capacity
    };
  }
}

export const rateLimiterService = new RateLimiterService();
