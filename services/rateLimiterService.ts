
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const STORAGE_PREFIX = 'medflow_rl_';

class RateLimiterService {
  // Configuração Padrão
  private readonly capacity: number = 20;      // Máximo de requisições instantâneas (Burst)
  private readonly refillRate: number = 2;     // Tokens adicionados por segundo
  private readonly cleanupInterval: number = 60 * 60 * 1000; // 1 hora
  private readonly expiryTime: number = 24 * 60 * 60 * 1000; // 24 horas
  private cleanupIntervalId: any = null;

  constructor() {
    // No side-effects in constructor
  }

  public startCleanup() {
      if (this.cleanupIntervalId) return;
      console.log('[RateLimiter] Starting Cleanup Service');
      this.cleanup(); // Run immediately
      this.cleanupIntervalId = setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  public stopCleanup() {
      if (this.cleanupIntervalId) {
          clearInterval(this.cleanupIntervalId);
          this.cleanupIntervalId = null;
          console.log('[RateLimiter] Stopped Cleanup Service');
      }
  }

  /**
   * Carrega o bucket do localStorage ou cria um novo se não existir.
   */
  private loadBucket(key: string): TokenBucket {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('RateLimiter: Error parsing bucket', e);
    }

    // Default: Novo bucket cheio
    return {
      tokens: this.capacity,
      lastRefill: Date.now()
    };
  }

  /**
   * Salva o estado do bucket no localStorage.
   */
  private saveBucket(key: string, bucket: TokenBucket): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(bucket));
    } catch (e) {
      console.warn('RateLimiter: Error saving bucket', e);
    }
  }

  /**
   * Verifica se a requisição pode ser processada.
   * Consome 1 token se permitido e persiste o estado.
   */
  public checkLimit(key: string): boolean {
    const now = Date.now();
    let bucket = this.loadBucket(key);

    // Recarrega tokens antes de verificar
    this.refill(bucket, now);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.saveBucket(key, bucket); // Persiste o consumo
      return true; // Permitido
    }

    this.saveBucket(key, bucket); // Persiste o estado atual (mesmo vazio)
    return false; // Bloqueado (Rate Limit Exceeded)
  }

  /**
   * Recarrega tokens baseado no tempo decorrido.
   * Modifica o objeto bucket por referência.
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
   * Remove buckets do localStorage que não são usados há muito tempo.
   */
  private cleanup() {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const bucket: TokenBucket = JSON.parse(raw);
            if (now - bucket.lastRefill > this.expiryTime) {
              keysToRemove.push(key);
            }
          }
        } catch (e) {
          keysToRemove.push(key); // Remove se estiver corrompido
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Retorna estado atual (para debug/admin).
   * Calcula a projeção atual sem persistir.
   */
  public getBucketStatus(key: string) {
    const bucket = this.loadBucket(key);
    
    // Simula um refill visual sem alterar estado persistido
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
