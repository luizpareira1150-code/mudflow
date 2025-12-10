
import { SlotReservation } from '../types';

const RESERVATIONS_KEY = 'medflow_slot_reservations';
const RESERVATION_TIMEOUT_MS = 5 * 60 * 1000;

class SlotReservationService {
  private cleanupIntervalId: any = null;

  private getReservationsRaw(): string {
    return localStorage.getItem(RESERVATIONS_KEY) || '[]';
  }

  private getReservations(): SlotReservation[] {
    const stored = this.getReservationsRaw();
    const all = JSON.parse(stored);
    const now = Date.now();
    const valid = all.filter((r: SlotReservation) => new Date(r.expiresAt).getTime() > now);
    
    // Auto-clean on read if dirty (optimization)
    if (valid.length !== all.length) {
      // We don't save here to avoid race condition during read, purely in-memory clean for validation
      return valid; 
    }
    return valid;
  }

  private setReservations(reservations: SlotReservation[]) {
    localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(reservations));
  }

  /**
   * Tenta reservar um slot com proteção contra Race Condition (Optimistic Locking)
   */
  async reserveSlot(params: {
    doctorId: string;
    date: string;
    time: string;
    clinicId: string;
    reservedBy: 'WEB_APP' | 'N8N_WEBHOOK';
    userId?: string;
  }): Promise<{ success: boolean; reservation?: SlotReservation; conflict?: SlotReservation }> {
    const MAX_RETRIES = 3;
    const RETRY_BASE_DELAY_MS = 100;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        // 1. Snapshot do estado atual (String bruta para comparação atômica)
        const snapshotRaw = this.getReservationsRaw();
        const reservations = JSON.parse(snapshotRaw) as SlotReservation[];
        
        // Filtrar expirados apenas em memória para verificação correta
        const nowMs = Date.now();
        const activeReservations = reservations.filter(r => new Date(r.expiresAt).getTime() > nowMs);

        // 2. Verifica conflitos
        const existing = activeReservations.find(r => 
          r.doctorId === params.doctorId &&
          r.date === params.date &&
          r.time === params.time &&
          r.clinicId === params.clinicId
        );

        if (existing) {
          // Conflito real detectado (outro usuário ou aba já reservou)
          console.warn('[CONFLICT] Slot já reservado:', existing);
          return { success: false, conflict: existing };
        }

        // 3. Prepara nova reserva
        const now = new Date();
        const expiresAt = new Date(now.getTime() + RESERVATION_TIMEOUT_MS);
        
        const newReservation: SlotReservation = {
          id: crypto.randomUUID(),
          slotId: `${params.doctorId}_${params.date}_${params.time}`,
          doctorId: params.doctorId,
          date: params.date,
          time: params.time,
          clinicId: params.clinicId,
          reservedBy: params.reservedBy,
          reservedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          userId: params.userId,
          sessionId: crypto.randomUUID()
        };

        // 4. Adiciona à lista base (incluindo os expirados para não perder histórico se não limpamos ainda)
        // Nota: A limpeza real acontece no worker de cleanup
        reservations.push(newReservation);

        // 5. CHECAGEM ATÔMICA (Simulada)
        // Verifica se o localStorage mudou desde que lemos o snapshot
        const currentRaw = this.getReservationsRaw();

        if (currentRaw === snapshotRaw) {
            // ✅ Ninguém mexeu no storage entre o passo 1 e 5. Seguro salvar.
            this.setReservations(reservations);
            console.log('[RESERVATION] Slot reservado com sucesso:', newReservation);
            return { success: true, reservation: newReservation };
        }

        // ⚠️ CONCORRÊNCIA DETECTADA
        console.warn(`[SlotReservation] Race Condition detectada na tentativa ${attempt + 1}. Retentando...`);
        
        // Backoff exponencial (100ms, 200ms, 400ms) antes de tentar ler de novo
        const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // Falha após todas as tentativas
    console.error('[SlotReservation] Falha ao reservar após retentativas.');
    return { success: false };
  }

  async confirmReservation(reservationId: string): Promise<void> {
    // Para confirmação, a race condition é menos crítica (apenas remoção), 
    // mas idealmente seguiria o mesmo padrão. Mantido simples para o mock.
    const reservations = this.getReservations(); // Pega apenas válidos
    const filtered = reservations.filter(r => r.id !== reservationId);
    this.setReservations(filtered);
    console.log('[RESERVATION] Confirmada (removida da trava):', reservationId);
  }

  async cancelReservation(reservationId: string): Promise<void> {
    await this.confirmReservation(reservationId);
  }

  isSlotReserved(doctorId: string, date: string, time: string, clinicId: string): boolean {
    const reservations = this.getReservations();
    return reservations.some(r => 
      r.doctorId === doctorId &&
      r.date === date &&
      r.time === time &&
      r.clinicId === clinicId
    );
  }

  async cleanupExpiredReservations(): Promise<number> {
    const beforeRaw = this.getReservationsRaw();
    const before = JSON.parse(beforeRaw);
    
    const now = Date.now();
    const valid = before.filter((r: SlotReservation) => new Date(r.expiresAt).getTime() > now);
    
    if (before.length !== valid.length) {
        this.setReservations(valid);
        const removed = before.length - valid.length;
        console.log(`[CLEANUP] ${removed} reservas expiradas removidas`);
        return removed;
    }
    return 0;
  }

  startCleanup() {
      if (this.cleanupIntervalId) return;
      console.log('[RESERVATION] Starting Cleanup Service');
      this.cleanupIntervalId = setInterval(() => this.cleanupExpiredReservations(), 60 * 1000);
  }

  stopCleanup() {
      if (this.cleanupIntervalId) {
          clearInterval(this.cleanupIntervalId);
          this.cleanupIntervalId = null;
      }
  }
}

export const slotReservationService = new SlotReservationService();
