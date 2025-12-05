
import { Appointment, AppointmentStatus, AvailableSlot, AuditAction, AuditSource, UserRole, DayOfWeek } from '../types';
import { STORAGE_KEYS, getStorage, setStorage, delay, initialAppointments } from './storage';
import { systemLogService } from './auditService';
import { patientService } from './patientService';
import { settingsService } from './settingsService';
import { doctorAvailabilityService } from './doctorAvailabilityService';
import { notificationService } from './notificationService';
import { slotReservationService } from './slotReservationService';
import { AppointmentSchema } from '../utils/validationSchemas';
import { validate } from '../utils/validator';
import { z } from 'zod';
import { N8NIntegrationService } from './n8nIntegration';
import { doctorService } from './doctorService';

// Helper to construct Rich Context and Trigger Webhook
// This is decoupled from the main thread to avoid blocking UI response
const triggerRichWebhook = async (
    event: 'APPOINTMENT_CREATED' | 'STATUS_CHANGED',
    appointment: Appointment,
    patientName: string,
    patientPhone: string
) => {
    try {
        // 1. Fetch Context in Parallel (Optimization)
        const [settings, doctor, org] = await Promise.all([
            settingsService.getClinicSettings(appointment.clinicId),
            doctorService.getDoctors(appointment.clinicId).then(docs => docs.find(d => d.id === appointment.doctorId)),
            doctorService.getOrganization(appointment.clinicId)
        ]);

        if (settings.n8nWebhookUrl) {
            // 2. Send Rich Payload
            N8NIntegrationService.sendToN8N({
                event,
                data: {
                    ...appointment,
                    patientName,
                    patientPhone
                },
                context: {
                    doctor: doctor ? { 
                        id: doctor.id, 
                        name: doctor.name, 
                        specialty: doctor.specialty 
                    } : undefined,
                    organization: org ? { 
                        id: org.id, 
                        name: org.name, 
                        type: org.accountType 
                    } : undefined,
                    evolution: {
                        instanceName: settings.evolutionInstanceName,
                        apiKey: settings.evolutionApiKey // Facilitates N8N config
                    },
                    system: {
                        timestamp: new Date().toISOString(),
                        timezone: 'America/Sao_Paulo', // Mocked standard
                        env: settings.n8nProductionMode ? 'production' : 'development'
                    }
                }
            }, settings);
        }
    } catch (e) {
        console.error('[N8N] Failed to trigger rich webhook', e);
        // We log the failure but do NOT throw, to prevent breaking the UI flow
    }
};

export const appointmentService = {
  getAvailableSlots: async (clinicId: string, doctorId: string, date: string): Promise<AvailableSlot[]> => {
      await delay(300);
      
      const validation = await doctorAvailabilityService.validateAvailability(doctorId, clinicId, date);

      if (!validation.isAvailable) {
          console.warn(`[AVAILABILITY] ${validation.reason}`);
          return [];
      }

      const [legacyConfig, availability] = await Promise.all([
          settingsService.getAgendaConfig(clinicId, doctorId),
          doctorAvailabilityService.getDoctorAvailability(doctorId, clinicId)
      ]);

      const allAppts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
      const doctorAppts = allAppts.filter(a => a.clinicId === clinicId && a.doctorId === doctorId && a.date === date && a.status !== AppointmentStatus.NAO_VEIO);
      
      const slots: AvailableSlot[] = [];
      const [year, month, day] = date.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay() as DayOfWeek; 

      let startH, startM, endH, endM, interval;
      const dayConfig = availability?.weekSchedule[dayOfWeek];

      if (dayConfig && dayConfig.enabled) {
          [startH, startM] = dayConfig.startTime.split(':').map(Number);
          [endH, endM] = dayConfig.endTime.split(':').map(Number);
          interval = dayConfig.intervalMinutes || legacyConfig.intervalMinutes;
      } else {
          [startH, startM] = legacyConfig.startHour.split(':').map(Number);
          [endH, endM] = legacyConfig.endHour.split(':').map(Number);
          interval = legacyConfig.intervalMinutes;
      }

      let current = new Date(); current.setHours(startH, startM, 0, 0);
      const end = new Date(); end.setHours(endH, endM, 0, 0);

      while (current < end) {
        const timeStr = current.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const timeValidation = await doctorAvailabilityService.validateAvailability(doctorId, clinicId, date, timeStr);
        
        if (timeValidation.isAvailable) {
            const booking = doctorAppts.find(a => a.time === timeStr);
            const isReserved = slotReservationService.isSlotReserved(doctorId, date, timeStr, clinicId);

            slots.push({
                id: `slot_${date}_${timeStr}`,
                doctorId: doctorId,
                date: date,
                time: timeStr,
                isBooked: !!booking,
                isReserved: isReserved && !booking,
                appointment: booking,
                appointmentId: booking?.id
            });
        }
        
        current.setMinutes(current.getMinutes() + interval);
      }
      return slots;
  },
  
  getAppointments: async (clinicId: string, date: string, doctorId?: string): Promise<Appointment[]> => {
      await delay(200);
      const appts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
      const patients = await patientService.getAllPatients(clinicId);
      
      let filtered = appts.filter(a => a.clinicId === clinicId && a.date === date);
      if (doctorId) filtered = filtered.filter(a => a.doctorId === doctorId);
      
      return filtered.map(a => ({ ...a, patient: patients.find(p => p.id === a.patientId) }));
  },
  
  getPatientAppointments: async (patientId: string): Promise<Appointment[]> => {
    await delay(150);
    const appts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
    return appts.filter(a => a.patientId === patientId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
  
  createAppointment: async (appt: Omit<Appointment, 'id' | 'patient'>, source: AuditSource = AuditSource.WEB_APP, reservationId?: string): Promise<Appointment> => {
    await delay(300);
    const validatedAppt = validate(AppointmentSchema, appt) as z.infer<typeof AppointmentSchema>;
    
    const availabilityCheck = await doctorAvailabilityService.validateAvailability(
        validatedAppt.doctorId, 
        validatedAppt.clinicId, 
        validatedAppt.date, 
        validatedAppt.time
    );

    if (!availabilityCheck.isAvailable) {
        throw new Error(`Indisponível: ${availabilityCheck.reason}`);
    }

    const appts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
    
    const conflictCheck = appts.some(a => 
      a.clinicId === validatedAppt.clinicId && 
      a.doctorId === validatedAppt.doctorId && 
      a.date === validatedAppt.date && 
      a.time === validatedAppt.time && 
      a.status !== AppointmentStatus.NAO_VEIO
    );
    
    if (conflictCheck) {
      await systemLogService.createLog({
        organizationId: validatedAppt.clinicId,
        source: source,
        action: AuditAction.APPOINTMENT_CREATED,
        entityType: 'Appointment',
        entityId: 'conflict',
        entityName: 'CONFLICT DETECTED',
        description: `Conflito: ${validatedAppt.date} ${validatedAppt.time}`,
        metadata: { conflictReason: 'double_check_failed', source, doctorId: validatedAppt.doctorId }
      });
      throw new Error("CONFLICT_DETECTED:Horário já ocupado. Escolha outro horário.");
    }
    
    const patient = await patientService.getPatientById(validatedAppt.patientId);
    if (!patient) throw new Error("Paciente não encontrado.");
    
    const newAppt: Appointment = { 
      ...validatedAppt, 
      id: Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString()
    };
    
    appts.push(newAppt);
    setStorage(STORAGE_KEYS.APPOINTMENTS, appts);
    
    if (reservationId) {
      await slotReservationService.confirmReservation(reservationId);
    }

    const actionType = newAppt.status === AppointmentStatus.EM_CONTATO 
      ? AuditAction.CONTACT_CREATED 
      : AuditAction.APPOINTMENT_CREATED;
    
    const description = actionType === AuditAction.CONTACT_CREATED
      ? `Lead/Contato CRM: ${patient.name}`
      : `Agendou consulta para ${newAppt.date} às ${newAppt.time}`;

    const createdVia = newAppt.status === AppointmentStatus.EM_CONTATO ? 'contact_flow' : 'direct_booking';

    systemLogService.createLog({
      organizationId: newAppt.clinicId,
      source: source,
      action: actionType,
      entityType: 'Appointment',
      entityId: newAppt.id,
      entityName: patient.name,
      description,
      newValues: newAppt,
      metadata: { createdVia, hadReservation: !!reservationId }
    });

    if (source === AuditSource.N8N_WEBHOOK && actionType === AuditAction.APPOINTMENT_CREATED) {
        notificationService.notify({
            title: 'Novo Agendamento (Bot)',
            message: `${patient.name} agendou para ${newAppt.date} às ${newAppt.time}.`,
            type: 'info',
            clinicId: newAppt.clinicId,
            targetRole: [UserRole.SECRETARY],
            priority: 'medium',
            actionLink: 'view:Agenda',
            metadata: { appointmentId: newAppt.id }
        });
    } else if (source === AuditSource.WEB_APP && actionType === AuditAction.APPOINTMENT_CREATED) {
        // TRIGGER OUTBOUND WEBHOOK (Async)
        // Fire and forget, don't await blocking the UI
        triggerRichWebhook('APPOINTMENT_CREATED', newAppt, patient.name, patient.phone);
    }
    
    return newAppt;
  },
  
  updateAppointmentStatus: async (id: string, newStatus: AppointmentStatus, source: AuditSource = AuditSource.WEB_APP): Promise<Appointment> => {
      await delay(500); 

      const appts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
      const index = appts.findIndex(a => a.id === id);
      if (index === -1) throw new Error("Agendamento não encontrado");
      
      const oldStatus = appts[index].status;
      
      // If no change, return early
      if (oldStatus === newStatus) return { ...appts[index] };

      appts[index].status = newStatus;
      appts[index].updatedAt = new Date().toISOString();
      setStorage(STORAGE_KEYS.APPOINTMENTS, appts);

      const patient = await patientService.getPatientById(appts[index].patientId);

      systemLogService.createLog({
        organizationId: appts[index].clinicId,
        source: source,
        action: AuditAction.STATUS_CHANGED,
        entityType: 'Appointment',
        entityId: id,
        entityName: patient?.name || 'Paciente',
        description: `Alterou status para ${newStatus}`,
        metadata: { oldStatus, newStatus }
      });
      
      if (source === AuditSource.N8N_WEBHOOK && (newStatus === AppointmentStatus.NAO_VEIO || newStatus === AppointmentStatus.BLOQUEADO)) {
           notificationService.notify({
               title: 'Cancelamento Automático',
               message: `O agendamento de ${patient?.name} foi alterado para ${newStatus}.`,
               type: 'warning',
               clinicId: appts[index].clinicId,
               targetRole: [UserRole.SECRETARY],
               priority: 'medium',
               metadata: { appointmentId: id }
           });
      } else if (source === AuditSource.WEB_APP && patient) {
           // TRIGGER OUTBOUND WEBHOOK (Async) for important status changes
           // Useful for: Patient arrived (ATENDIDO), send Google Review link
           // Useful for: Patient missed (NAO_VEIO), send recovery message
           triggerRichWebhook('STATUS_CHANGED', appts[index], patient.name, patient.phone);
      }

      return { ...appts[index], patient };
  },
  
  updateAppointment: async (updated: Appointment): Promise<Appointment> => {
      await delay(300);
      const appts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
      const index = appts.findIndex(a => a.id === updated.id);
      if (index === -1) throw new Error("Agendamento não encontrado");
      
      const oldValues = { ...appts[index] };
      appts[index] = { ...updated, updatedAt: new Date().toISOString() };
      setStorage(STORAGE_KEYS.APPOINTMENTS, appts);
      
      systemLogService.createLog({
        organizationId: updated.clinicId,
        action: AuditAction.APPOINTMENT_UPDATED,
        entityType: 'Appointment',
        entityId: updated.id,
        entityName: updated.patient?.name || 'Paciente',
        description: `Editou detalhes do agendamento`,
        oldValues: oldValues as any,
        newValues: updated as any,
        source: AuditSource.WEB_APP
      });

      return appts[index];
  },
  
  deleteAppointment: async (id: string, reason: string): Promise<void> => {
      await delay(300);
      const appts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
      const appt = appts.find(a => a.id === id);
      if (!appt) throw new Error("Agendamento não encontrado");
      
      const patient = await patientService.getPatientById(appt.patientId);
      
      setStorage(STORAGE_KEYS.APPOINTMENTS, appts.filter(a => a.id !== id));
      
      systemLogService.createLog({
        organizationId: appt.clinicId,
        source: AuditSource.WEB_APP,
        action: AuditAction.APPOINTMENT_DELETED,
        entityType: 'Appointment',
        entityId: id,
        entityName: patient?.name || 'Paciente',
        description: `Cancelou agendamento: ${reason}`,
        metadata: { reason, appointmentDate: appt.date, appointmentTime: appt.time }
      });

      notificationService.notify({
        title: 'Paciente Cancelou',
        message: `${patient?.name} cancelou o agendamento de ${appt.date} às ${appt.time}. Motivo: ${reason}`,
        type: 'warning',
        priority: 'high',
        clinicId: appt.clinicId,
        targetRole: [UserRole.DOCTOR_ADMIN],
        metadata: { reason, patientId: appt.patientId }
      });
  },
  
  createBatchAppointments: async (appointments: Omit<Appointment, 'id' | 'patient'>[], source: AuditSource = AuditSource.WEB_APP): Promise<void> => {
      const appts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
      const newAppts = appointments.map(a => ({
          ...a,
          id: Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString()
      }));
      
      appts.push(...newAppts);
      setStorage(STORAGE_KEYS.APPOINTMENTS, appts);

      systemLogService.createLog({
        organizationId: appointments[0].clinicId,
        source: source,
        action: AuditAction.AGENDA_BLOCKED,
        entityType: 'Schedule',
        entityId: 'batch_block',
        entityName: 'Bloqueio de Agenda',
        description: `Bloqueou ${newAppts.length} horários em lote`,
        metadata: { count: newAppts.length, date: appointments[0].date }
      });
  },
  
  subscribeToAppointments: (clinicId: string, date: string, doctorId: string, callback: (data: Appointment[]) => void) => {
      const fetch = async () => {
          const data = await appointmentService.getAppointments(clinicId, date, doctorId);
          callback(data);
      };
      fetch();
      const interval = setInterval(fetch, 5000);
      return () => clearInterval(interval);
  }
};
