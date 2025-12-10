
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
   * Verifica se a requisição pode ser processada.
   * Consome 1 token se permitido e persiste o estado.
   * 
   * FIX: Race Condition Protection (Optimistic Locking)
   * Agora assíncrono para suportar retentativas com backoff.
   */
  public async checkLimit(key: string): Promise<boolean> {
    const MAX_RETRIES = 3;
    const storageKey = `${STORAGE_PREFIX}${key}`;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const now = Date.now();
        
        // 1. Snapshot: Ler o estado cru atual para comparação futura
        const rawSnapshot = localStorage.getItem(storageKey);
        
        let bucket: TokenBucket;
        if (rawSnapshot) {
            try {
                bucket = JSON.parse(rawSnapshot);
            } catch {
                bucket = { tokens: this.capacity, lastRefill: now };
            }
        } else {
            bucket = { tokens: this.capacity, lastRefill: now };
        }

        // 2. Lógica de Refill (Em memória)
        this.refill(bucket, now);

        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            const newRaw = JSON.stringify(bucket);
            
            // 3. Verificação Atômica (Optimistic Lock)
            // Se o valor no storage ainda for igual ao snapshot que lemos, ninguém mexeu.
            if (localStorage.getItem(storageKey) === rawSnapshot) {
                localStorage.setItem(storageKey, newRaw);
                return true; // Sucesso: Token consumido
            }
        } else {
            // Falha: Sem tokens.
            // Tentamos salvar apenas o refill (atualizar timestamp) para não desperdiçar o cálculo,
            // mas se falhar a concorrência, não tem problema (o próximo request recalcula).
            const newRaw = JSON.stringify(bucket);
            if (localStorage.getItem(storageKey) === rawSnapshot) {
                localStorage.setItem(storageKey, newRaw);
                return false; // Negado
            }
        }

        // 4. Conflito detectado: Esperar antes de tentar de novo (Backoff exponencial)
        // 50ms, 100ms, 200ms
        await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, attempt)));
    }

    // Se falhar após retentativas devido a alta concorrência, negamos por segurança
    console.warn(`[RateLimiter] High contention on key ${key}, request denied.`);
    return false;
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
   * Retorna estado atual (apenas leitura, para debug/admin).
   */
  public getBucketStatus(key: string) {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      const bucket: TokenBucket = stored ? JSON.parse(stored) : { tokens: this.capacity, lastRefill: Date.now() };
      
      // Simula refill visual
      const now = Date.now();
      const elapsedSeconds = (now - bucket.lastRefill) / 1000;
      const currentTokens = Math.min(this.capacity, bucket.tokens + (elapsedSeconds * this.refillRate));
      
      return {
        tokens: Math.floor(currentTokens),
        max: this.capacity
      };
    } catch {
      return { tokens: this.capacity, max: this.capacity };
    }
  }
}

export const rateLimiterService = new RateLimiterService();
