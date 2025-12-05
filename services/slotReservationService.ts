import { SlotReservation } from '../types';

const RESERVATIONS_KEY = 'medflow_slot_reservations';
const RESERVATION_TIMEOUT_MS = 5 * 60 * 1000;

class SlotReservationService {
  private getReservations(): SlotReservation[] {
    const stored = localStorage.getItem(RESERVATIONS_KEY);
    if (!stored) return [];
    const all = JSON.parse(stored);
    const now = Date.now();
    const valid = all.filter((r: SlotReservation) => new Date(r.expiresAt).getTime() > now);
    if (valid.length !== all.length) {
      localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(valid));
    }
    return valid;
  }

  private setReservations(reservations: SlotReservation[]) {
    localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(reservations));
  }

  async reserveSlot(params: {
    doctorId: string;
    date: string;
    time: string;
    clinicId: string;
    reservedBy: 'WEB_APP' | 'N8N_WEBHOOK';
    userId?: string;
  }): Promise<{ success: boolean; reservation?: SlotReservation; conflict?: SlotReservation }> {
    const reservations = this.getReservations();
    const sessionId = Math.random().toString(36).substr(2, 9);
    
    // SOLUTION B LOGIC: Strict check. If it exists, it's a conflict.
    // No check for "if (existing.userId === params.userId)"
    const existing = reservations.find(r => 
      r.doctorId === params.doctorId &&
      r.date === params.date &&
      r.time === params.time &&
      r.clinicId === params.clinicId
    );

    if (existing) {
      console.warn('[CONFLICT] Slot já reservado:', existing);
      return { success: false, conflict: existing };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESERVATION_TIMEOUT_MS);
    
    const newReservation: SlotReservation = {
      id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      slotId: `${params.doctorId}_${params.date}_${params.time}`,
      doctorId: params.doctorId,
      date: params.date,
      time: params.time,
      clinicId: params.clinicId,
      reservedBy: params.reservedBy,
      reservedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      userId: params.userId,
      sessionId
    };

    reservations.push(newReservation);
    this.setReservations(reservations);
    console.log('[RESERVATION] Slot reservado:', newReservation);
    return { success: true, reservation: newReservation };
  }

  async confirmReservation(reservationId: string): Promise<void> {
    const reservations = this.getReservations();
    const filtered = reservations.filter(r => r.id !== reservationId);
    this.setReservations(filtered);
    console.log('[RESERVATION] Confirmada:', reservationId);
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
    const before = this.getReservations();
    const now = Date.now();
    const valid = before.filter(r => new Date(r.expiresAt).getTime() > now);
    this.setReservations(valid);
    const removed = before.length - valid.length;
    if (removed > 0) console.log(`[CLEANUP] ${removed} reservas expiradas removidas`);
    return removed;
  }
}

export const slotReservationService = new SlotReservationService();
setInterval(() => slotReservationService.cleanupExpiredReservations(), 60 * 1000);