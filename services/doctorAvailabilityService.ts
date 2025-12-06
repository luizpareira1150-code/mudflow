

import { DoctorAvailability, DoctorAbsence, DayOfWeek, AvailabilityValidationResult } from '../types';
import { STORAGE_KEYS, getStorage, setStorage, initialAvailability } from './storage';
import { getDayOfWeekBR } from '../utils/dateUtils';

class DoctorAvailabilityService {
  
  private getAvailabilities(): DoctorAvailability[] {
    return getStorage<DoctorAvailability[]>(STORAGE_KEYS.DOCTOR_AVAILABILITY, initialAvailability);
  }

  private setAvailabilities(availabilities: DoctorAvailability[]) {
    setStorage(STORAGE_KEYS.DOCTOR_AVAILABILITY, availabilities);
  }

  /**
   * Busca disponibilidade de um médico
   */
  async getDoctorAvailability(doctorId: string, organizationId: string): Promise<DoctorAvailability | null> {
    const availabilities = this.getAvailabilities();
    return availabilities.find(a => a.doctorId === doctorId && a.organizationId === organizationId) || null;
  }

  /**
   * Cria ou atualiza disponibilidade do médico
   */
  async saveDoctorAvailability(availability: Omit<DoctorAvailability, 'id' | 'createdAt' | 'updatedAt'>): Promise<DoctorAvailability> {
    const availabilities = this.getAvailabilities();
    const existingIndex = availabilities.findIndex(a => 
      a.doctorId === availability.doctorId && 
      a.organizationId === availability.organizationId
    );

    let result: DoctorAvailability;

    if (existingIndex >= 0) {
      result = {
        ...availabilities[existingIndex],
        weekSchedule: availability.weekSchedule,
        absences: availability.absences,
        advanceBookingDays: availability.advanceBookingDays,
        maxAppointmentsPerDay: availability.maxAppointmentsPerDay,
        updatedAt: new Date().toISOString()
      };
      availabilities[existingIndex] = result;
    } else {
      result = {
        ...availability,
        id: `avail_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      availabilities.push(result);
    }
    
    this.setAvailabilities(availabilities);
    return result;
  }

  /**
   * Adiciona período de ausência
   */
  async addAbsence(absence: Omit<DoctorAbsence, 'id' | 'createdAt'>): Promise<DoctorAbsence> {
    const availability = await this.getDoctorAvailability(absence.doctorId, '');
    if (availability) {
        const newAbsence: DoctorAbsence = {
            ...absence,
            id: `abs_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            createdAt: new Date().toISOString()
        };
        availability.absences.push(newAbsence);
        
        // Save via main method to handle persistence
        await this.saveDoctorAvailability(availability);
        return newAbsence;
    }
    throw new Error("Disponibilidade não encontrada para este médico.");
  }

  /**
   * Remove período de ausência
   */
  async removeAbsence(absenceId: string, doctorId: string, clinicId: string): Promise<void> {
    const availability = await this.getDoctorAvailability(doctorId, clinicId);
    if (availability) {
        availability.absences = availability.absences.filter(a => a.id !== absenceId);
        await this.saveDoctorAvailability(availability);
    }
  }

  /**
   * Valida se médico está disponível em determinada data
   * @param computeSuggestions Se true, calcula próximas datas em caso de falha. Se false, apenas retorna status (evita recursão infinita).
   */
  async validateAvailability(
    doctorId: string, 
    organizationId: string, 
    date: string,
    time?: string,
    computeSuggestions: boolean = true
  ): Promise<AvailabilityValidationResult> {
    const availability = await this.getDoctorAvailability(doctorId, organizationId);
    
    if (!availability) {
      return { isAvailable: true }; // Se não configurou, permite tudo (fallback)
    }

    // Timezone safe logic
    const dayOfWeek = getDayOfWeekBR(date) as DayOfWeek;

    // 1. Verificar períodos de ausência
    const absences = availability.absences;
    for (const absence of absences) {
      if (date >= absence.startDate && date <= absence.endDate) {
        // CORREÇÃO DE LOOP INFINITO: Só busca sugestões se a flag permitir
        const nextAvailableDates = computeSuggestions 
            ? await this.getNextAvailableDates(doctorId, organizationId, absence.endDate, 5)
            : [];
            
        return {
          isAvailable: false,
          reason: `Médico em ${absence.type.toLowerCase()}: ${absence.reason}`,
          suggestedDates: nextAvailableDates
        };
      }
    }

    // 2. Verificar se o dia da semana está configurado
    const dayConfig = availability.weekSchedule[dayOfWeek];
    if (!dayConfig || !dayConfig.enabled) {
      const nextAvailableDates = computeSuggestions 
        ? await this.getNextAvailableDates(doctorId, organizationId, date, 5)
        : [];
        
      return {
        isAvailable: false,
        reason: `Médico não atende às ${this.getDayName(dayOfWeek)}s`,
        suggestedDates: nextAvailableDates
      };
    }

    // 3. Verificar horário (se fornecido)
    if (time && dayConfig.startTime && dayConfig.endTime) {
      const timeNum = this.timeToMinutes(time);
      const startNum = this.timeToMinutes(dayConfig.startTime);
      const endNum = this.timeToMinutes(dayConfig.endTime);
      
      if (timeNum < startNum || timeNum >= endNum) {
        return {
          isAvailable: false,
          reason: `Horário fora do expediente. Médico atende das ${dayConfig.startTime} às ${dayConfig.endTime}`
        };
      }
    }

    // 4. Verificar limite de antecedência
    if (availability.advanceBookingDays) {
      // Comparação simples de string data para evitar timezone shift
      const today = new Date().toISOString().split('T')[0];
      
      // Cálculo aproximado de diferença em dias
      const d1 = new Date(today);
      const d2 = new Date(date);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays > availability.advanceBookingDays) {
        return {
          isAvailable: false,
          reason: `Agendamento permitido até ${availability.advanceBookingDays} dias de antecedência`
        };
      }
    }

    return { isAvailable: true };
  }

  /**
   * Retorna próximas datas disponíveis
   */
  async getNextAvailableDates(
    doctorId: string, 
    organizationId: string, 
    fromDate: string, 
    count: number = 5
  ): Promise<string[]> {
    const availableDates: string[] = [];
    
    // Parse input date
    const [y, m, d] = fromDate.split('-').map(Number);
    let currentDate = new Date(y, m - 1, d);
    
    let attempts = 0;
    const maxAttempts = 60; // Buscar até 60 dias à frente

    while (availableDates.length < count && attempts < maxAttempts) {
      currentDate.setDate(currentDate.getDate() + 1);
      attempts++;

      // Format back to YYYY-MM-DD
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // CRITICAL FIX: Pass false to avoid recursion loop
      const validation = await this.validateAvailability(doctorId, organizationId, dateStr, undefined, false);
      
      if (validation.isAvailable) {
        availableDates.push(dateStr);
      }
    }

    return availableDates;
  }

  /**
   * Helper: Converte HH:MM para minutos
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Helper: Nome do dia da semana
   */
  private getDayName(day: DayOfWeek): string {
    const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return names[day];
  }

  /**
   * Gera template de disponibilidade padrão
   */
  getDefaultAvailability(): DoctorAvailability['weekSchedule'] {
    return {
      [DayOfWeek.MONDAY]: { enabled: true, startTime: '08:00', endTime: '18:00' },
      [DayOfWeek.TUESDAY]: { enabled: true, startTime: '08:00', endTime: '18:00' },
      [DayOfWeek.WEDNESDAY]: { enabled: true, startTime: '08:00', endTime: '18:00' },
      [DayOfWeek.THURSDAY]: { enabled: true, startTime: '08:00', endTime: '18:00' },
      [DayOfWeek.FRIDAY]: { enabled: true, startTime: '08:00', endTime: '18:00' },
      [DayOfWeek.SATURDAY]: { enabled: false, startTime: '08:00', endTime: '12:00' },
      [DayOfWeek.SUNDAY]: { enabled: false, startTime: '08:00', endTime: '12:00' }
    };
  }
}

export const doctorAvailabilityService = new DoctorAvailabilityService();
