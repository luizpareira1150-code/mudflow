
import { appointmentService } from './appointmentService';
import { AvailableSlot, RecommendedSlot } from '../types';

export const recommendationService = {
  suggestOptimalSlots: async (
    clinicId: string,
    doctorId: string,
    patientId: string
  ): Promise<RecommendedSlot[]> => {
    // 1. Analyze Patient History
    const history = await appointmentService.getPatientAppointments(patientId);
    
    // Default values if no history
    let preferredDayOfWeek: number | null = null;
    let preferredPeriod: 'morning' | 'afternoon' | null = null;

    if (history.length > 0) {
        // Calculate Day preference (0-6)
        const dayCounts: Record<number, number> = {};
        history.forEach(apt => {
            const day = new Date(apt.date).getDay(); // getDay is 0 (Sun) to 6 (Sat)
            // Fix: getDay uses local time, but date string is YYYY-MM-DD.
            // Better to parse manually to avoid timezone shifts
            const [y, m, d] = apt.date.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const realDay = dateObj.getDay();
            
            dayCounts[realDay] = (dayCounts[realDay] || 0) + 1;
        });
        
        const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
        if (sortedDays.length > 0) {
            preferredDayOfWeek = Number(sortedDays[0][0]);
        }

        // Calculate Time preference
        let morningCount = 0;
        let afternoonCount = 0;
        history.forEach(apt => {
            const hour = parseInt(apt.time.split(':')[0], 10);
            if (hour < 12) morningCount++; else afternoonCount++;
        });
        
        if (morningCount !== afternoonCount) {
            preferredPeriod = morningCount > afternoonCount ? 'morning' : 'afternoon';
        }
    }

    // 2. Scan Next 15 Days
    const candidates: RecommendedSlot[] = [];
    const today = new Date();
    
    // We limit to 15 days lookahead
    for(let i=1; i<=15; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
        // Fetch slots for this day
        const slots = await appointmentService.getAvailableSlots(clinicId, doctorId, dateStr);
        const available = slots.filter(s => !s.isBooked && !s.isReserved);
        
        const dayOfWeek = d.getDay();
        
        available.forEach(slot => {
            let score = 0;
            const hour = parseInt(slot.time.split(':')[0], 10);
            const period = hour < 12 ? 'morning' : 'afternoon';
            
            // Scoring Logic
            if (preferredDayOfWeek !== null && dayOfWeek === preferredDayOfWeek) {
                score += 30; // High weight for correct day
            }
            if (preferredPeriod !== null && period === preferredPeriod) {
                score += 20; // Medium weight for time of day
            }
            // Bonus for sooner slots (decaying)
            score += Math.max(0, 15 - i); 

            // Construct reason
            let reasonParts = [];
            if (preferredDayOfWeek !== null && dayOfWeek === preferredDayOfWeek) {
                const dayName = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                reasonParts.push(`Costuma vir às ${dayName}s`);
            }
            if (preferredPeriod !== null && period === preferredPeriod) {
                reasonParts.push(`Prefere ${period === 'morning' ? 'manhã' : 'tarde'}`);
            }
            if (reasonParts.length === 0) reasonParts.push('Horário disponível próximo');

            candidates.push({
                slot,
                score,
                reason: reasonParts.join(' • ')
            });
        });
    }

    // Sort by score desc and take top 3
    return candidates
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
  }
}
