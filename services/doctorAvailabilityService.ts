
import { DoctorAvailability, DoctorAbsence, DayOfWeek, AvailabilityValidationResult } from '../types';
import { STORAGE_KEYS, getStorage, setStorage, initialAvailability } from './storage';
import { getDayOfWeekBR, timeToMinutes, addDays } from '../utils/dateUtils';

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
        // GOVERNANCE: Use crypto.randomUUID()
        id: crypto.randomUUID(),
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
            // GOVERNANCE: Use crypto.randomUUID()
            id: crypto.randomUUID(),
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
   * Internal pure function to check availability rules without side effects or fetching.
   * Optimized for usage inside loops.
   */
  private checkAvailabilityRules(
    availability: DoctorAvailability | null, 
    date: string, 
    time?: string
  ): AvailabilityValidationResult {
    if (!availability) {
      return { isAvailable: true }; // Se não configurou, permite tudo (fallback)
    }

    const dayOfWeek = getDayOfWeekBR(date) as DayOfWeek;

    // 1. Verificar períodos de ausência
    for (const absence of availability.absences) {
      if (date >= absence.startDate && date <= absence.endDate) {
        return {
          isAvailable: false,
          reason: `Médico em ${absence.type.toLowerCase()}: ${absence.reason}`
        };
      }
    }

    // 2. Verificar se o dia da semana está configurado
    const dayConfig = availability.weekSchedule[dayOfWeek];
    const dayNameMap = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const dayName = dayNameMap[dayOfWeek];

    if (!dayConfig || !dayConfig.enabled) {
      return {
        isAvailable: false,
        reason: `Médico não atende às ${dayName}s`
      };
    }

    // 3. Verificar horário (se fornecido)
    if (time && dayConfig.startTime && dayConfig.endTime) {
      const timeNum = timeToMinutes(time);
      const startNum = timeToMinutes(dayConfig.startTime);
      const endNum = timeToMinutes(dayConfig.endTime);
      
      if (timeNum < startNum || timeNum >= endNum) {
        return {
          isAvailable: false,
          reason: `Horário fora do expediente. Médico atende das ${dayConfig.startTime} às ${dayConfig.endTime}`
        };
      }
    }

    // 4. Verificar limite de antecedência
    if (availability.advanceBookingDays) {
      const today = new Date().toISOString().split('T')[0];
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
   * Valida se médico está disponível em determinada data
   * @param computeSuggestions Se true, calcula próximas datas em caso de falha.
   */
  async validateAvailability(
    doctorId: string, 
    organizationId: string, 
    date: string,
    time?: string,
    computeSuggestions: boolean = true
  ): Promise<AvailabilityValidationResult> {
    const availability = await this.getDoctorAvailability(doctorId, organizationId);
    
    // Reuse internal optimized logic
    const result = this.checkAvailabilityRules(availability, date, time);

    if (!result.isAvailable && computeSuggestions) {
        // If reason was absence, try to suggest starting from end of absence
        let startSearchDate = date;
        
        if (availability) {
            const absence = availability.absences.find(a => date >= a.startDate && date <= a.endDate);
            if (absence) {
                startSearchDate = absence.endDate;
            }
        }

        // Avoid infinite recursion by calling optimized getNextAvailableDates (which uses checkAvailabilityRules)
        result.suggestedDates = await this.getNextAvailableDates(doctorId, organizationId, startSearchDate, 5);
    }

    return result;
  }

  /**
   * Retorna próximas datas disponíveis.
   * OPTIMIZED: Fetches availability once and uses sync check in loop.
   */
  async getNextAvailableDates(
    doctorId: string, 
    organizationId: string, 
    fromDate: string, 
    count: number = 5
  ): Promise<string[]> {
    const availableDates: string[] = [];
    
    // OPTIMIZATION: Fetch once, reuse in loop
    const availability = await this.getDoctorAvailability(doctorId, organizationId);

    let currentDateStr = fromDate;
    let attempts = 0;
    const maxAttempts = 60; // Buscar até 60 dias à frente

    while (availableDates.length < count && attempts < maxAttempts) {
      currentDateStr = addDays(currentDateStr, 1);
      attempts++;

      // Use optimized synchronous check
      const result = this.checkAvailabilityRules(availability, currentDateStr);
      
      if (result.isAvailable) {
        availableDates.push(currentDateStr);
      }

      // PREVENTION: Yield to event loop every 10 iterations to prevent UI blocking
      if (attempts % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return availableDates;
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
