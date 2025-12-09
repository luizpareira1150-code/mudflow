
import { AgendaReleaseSchedule, AgendaReleaseType, DayOfWeek } from '../types';
import { createDateAtHour } from '../utils/dateUtils';

const RELEASE_SCHEDULE_KEY = 'medflow_agenda_release_schedule';

class AgendaReleaseService {
  
  private getSchedules(): AgendaReleaseSchedule[] {
    const stored = localStorage.getItem(RELEASE_SCHEDULE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private setSchedules(schedules: AgendaReleaseSchedule[]) {
    localStorage.setItem(RELEASE_SCHEDULE_KEY, JSON.stringify(schedules));
  }

  async getSchedule(doctorId: string, organizationId: string): Promise<AgendaReleaseSchedule | null> {
    const schedules = this.getSchedules();
    return schedules.find(s => s.doctorId === doctorId && s.organizationId === organizationId) || null;
  }

  async saveSchedule(schedule: Omit<AgendaReleaseSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgendaReleaseSchedule> {
    const schedules = this.getSchedules();
    const existingIndex = schedules.findIndex(s => s.doctorId === schedule.doctorId && s.organizationId === schedule.organizationId);

    if (existingIndex >= 0) {
      const existing = schedules[existingIndex];
      const updated = {
        ...existing,
        ...schedule,
        updatedAt: new Date().toISOString()
      };
      schedules[existingIndex] = updated;
      this.setSchedules(schedules);
      return updated;
    } else {
      const newSchedule: AgendaReleaseSchedule = {
        ...schedule,
        // GOVERNANCE: Use crypto.randomUUID()
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      schedules.push(newSchedule);
      this.setSchedules(schedules);
      return newSchedule;
    }
  }

  /**
   * Verifica se uma data específica está liberada para agendamento
   * Esta função responde: "Para agendar 'targetDate', já passamos da data de liberação?"
   */
  async isDateReleased(doctorId: string, organizationId: string, targetDate: string): Promise<{
    released: boolean;
    reason?: string;
    releaseDate?: string;
  }> {
    const schedule = await this.getSchedule(doctorId, organizationId);
    
    if (!schedule || !schedule.enabled || schedule.releaseType === AgendaReleaseType.ALWAYS_OPEN) {
      return { released: true };
    }

    const now = new Date();
    // ✅ FIX: Use consistent timezone helper to ensure 00:00 aligns with -03:00 (Brasilia)
    const target = createDateAtHour(targetDate, '00:00');

    switch (schedule.releaseType) {
      case AgendaReleaseType.WEEKLY_RELEASE:
        return this.checkWeeklyRelease(schedule, now, target);
      
      case AgendaReleaseType.MONTHLY_RELEASE:
        return this.checkMonthlyRelease(schedule, now, target);
      
      case AgendaReleaseType.CUSTOM_DATE:
        return this.checkCustomRelease(schedule, now, target);
      
      default:
        return { released: true };
    }
  }

  /**
   * Calcula a janela válida de agendamento atual para dar dicas na UI
   * Ex: "Agendamento permitido até 15/12"
   */
  async getValidBookingWindow(
    doctorId: string, 
    organizationId: string, 
    currentDate: Date
  ): Promise<{ startDate: Date; endDate: Date } | null> {
    
    const schedule = await this.getSchedule(doctorId, organizationId);
    
    if (!schedule || !schedule.enabled) {
      return null; // Sem restrições
    }

    switch (schedule.releaseType) {
      case AgendaReleaseType.ALWAYS_OPEN:
        return null;
      
      case AgendaReleaseType.WEEKLY_RELEASE:
        return this.calculateWeeklyWindow(schedule, currentDate);
      
      case AgendaReleaseType.MONTHLY_RELEASE:
        return this.calculateMonthlyWindow(schedule, currentDate);
      
      default:
        return null;
    }
  }

  // --- LÓGICA DR. ANDRÉ (SEMANAL) ---
  // Agenda abre Segunda 07:00 para a Quarta da mesma semana.
  private checkWeeklyRelease(
    schedule: AgendaReleaseSchedule, 
    now: Date, 
    target: Date
  ): { released: boolean; reason?: string; releaseDate?: string } {
    
    if (!schedule.weeklyConfig) return { released: true };
    
    const { dayOfWeek, hour } = schedule.weeklyConfig;
    
    // Passo 1: Encontrar o "Início da Semana" da DATA ALVO (Domingo)
    const targetWeekStart = new Date(target);
    targetWeekStart.setDate(target.getDate() - target.getDay()); 
    targetWeekStart.setHours(0,0,0,0);
    
    // Passo 2: Calcular a Data de Liberação para ESSA semana específica
    const releaseDateForTarget = new Date(targetWeekStart);
    releaseDateForTarget.setDate(targetWeekStart.getDate() + dayOfWeek);
    
    const [releaseHour, releaseMinute] = hour.split(':').map(Number);
    releaseDateForTarget.setHours(releaseHour, releaseMinute, 0, 0);
    
    // Passo 3: Comparar AGORA com a Data de Liberação
    if (now >= releaseDateForTarget) {
      return { released: true };
    } else {
      return {
        released: false,
        reason: `Agenda desta semana abre ${releaseDateForTarget.toLocaleDateString('pt-BR')} às ${hour}`,
        releaseDate: releaseDateForTarget.toISOString()
      };
    }
  }

  // --- LÓGICA DR. JOÃO (MENSAL) ---
  // Agenda abre dia 21 para o mês seguinte.
  private checkMonthlyRelease(
    schedule: AgendaReleaseSchedule,
    now: Date,
    target: Date
  ): { released: boolean; reason?: string; releaseDate?: string } {
    
    if (!schedule.monthlyConfig) return { released: true };
    
    const { releaseDay, fallbackToWeekday, hour, targetMonthOffset } = schedule.monthlyConfig;
    
    const targetYear = target.getFullYear();
    const targetMonth = target.getMonth(); // 0-11
    
    let releaseMonth = targetMonth - targetMonthOffset;
    let releaseYear = targetYear;
    
    while (releaseMonth < 0) {
        releaseMonth += 12;
        releaseYear -= 1;
    }
    
    let releaseDateForTarget = new Date(releaseYear, releaseMonth, releaseDay);
    
    if (fallbackToWeekday) {
      const day = releaseDateForTarget.getDay();
      if (day === 6) {
        releaseDateForTarget.setDate(releaseDateForTarget.getDate() + 2);
      } else if (day === 0) {
        releaseDateForTarget.setDate(releaseDateForTarget.getDate() + 1);
      }
    }
    
    const [releaseHour, releaseMinute] = hour.split(':').map(Number);
    releaseDateForTarget.setHours(releaseHour, releaseMinute, 0, 0);
    
    if (now >= releaseDateForTarget) {
      return { released: true };
    } else {
      return {
        released: false,
        reason: `Agenda para este mês abre em ${releaseDateForTarget.toLocaleDateString('pt-BR')} às ${hour}`,
        releaseDate: releaseDateForTarget.toISOString()
      };
    }
  }

  private checkCustomRelease(
    schedule: AgendaReleaseSchedule,
    now: Date,
    target: Date
  ): { released: boolean; reason?: string; releaseDate?: string } {
    
    if (!schedule.customDates || schedule.customDates.length === 0) {
      return { released: true };
    }
    
    for (const custom of schedule.customDates) {
      // ✅ FIX: Use timezone helper
      const start = createDateAtHour(custom.targetStartDate, '00:00');
      const end = createDateAtHour(custom.targetEndDate, '23:59');
      
      // Se a data alvo está dentro deste intervalo customizado
      if (target >= start && target <= end) {
        const releaseDate = createDateAtHour(custom.releaseDate, '00:00');
        
        if (now >= releaseDate) {
          return { released: true };
        } else {
          return {
            released: false,
            reason: `Agenda especial abre em ${releaseDate.toLocaleDateString('pt-BR')}`,
            releaseDate: releaseDate.toISOString()
          };
        }
      }
    }
    
    return { released: true };
  }

  private calculateWeeklyWindow(
    schedule: AgendaReleaseSchedule, 
    now: Date
  ): { startDate: Date; endDate: Date } {
    if (!schedule.weeklyConfig) throw new Error('Config missing');
    const { dayOfWeek } = schedule.weeklyConfig;

    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    currentWeekStart.setHours(0,0,0,0);

    const releaseThisWeek = new Date(currentWeekStart);
    releaseThisWeek.setDate(currentWeekStart.getDate() + dayOfWeek); 

    let activeReleaseDate = releaseThisWeek;
    if (now < releaseThisWeek) {
        activeReleaseDate.setDate(activeReleaseDate.getDate() - 7);
    }

    const targetWeekEnd = new Date(activeReleaseDate);
    targetWeekEnd.setDate(activeReleaseDate.getDate() + (6 - dayOfWeek)); 
    targetWeekEnd.setHours(23,59,59,999);

    return { startDate: now, endDate: targetWeekEnd };
  }

  private calculateMonthlyWindow(
    schedule: AgendaReleaseSchedule,
    now: Date
  ): { startDate: Date; endDate: Date } {
    if (!schedule.monthlyConfig) throw new Error('Config missing');
    const { targetMonthOffset } = schedule.monthlyConfig;

    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    
    const checkNext = this.checkMonthlyRelease(schedule, now, nextMonth);
    
    if (checkNext.released) {
        const nextMonthEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0, 23, 59, 59);
        return { startDate: now, endDate: nextMonthEnd };
    } else {
        return { startDate: now, endDate: currentMonthEnd };
    }
  }
}

export const agendaReleaseService = new AgendaReleaseService();
