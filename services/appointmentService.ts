
import { Appointment, AppointmentStatus, AvailableSlot, AuditAction, AuditSource, UserRole, DayOfWeek, Patient, PatientStatus, User } from '../types';
import { STORAGE_KEYS, getStorage, setStorage, delay, initialAppointments } from './storage';
import { systemLogService } from './auditService';
import { patientService } from './patientService';
import { settingsService } from './settingsService';
import { doctorAvailabilityService } from './doctorAvailabilityService';
import { notificationService } from './notificationService';
import { slotReservationService } from './slotReservationService';
import { AppointmentSchema, PatientSchema } from '../utils/validationSchemas';
import { validate, validateSafe } from '../utils/validator';
import { z } from 'zod';
import { N8NIntegrationService } from './n8nIntegration';
import { doctorService } from './doctorService';
import { monitoringService } from './monitoring';
import { getDayOfWeekBR, createDateAtHour, formatTimeBR } from '../utils/dateUtils';
import { agendaReleaseService } from './agendaReleaseService';
import { socketServer, SocketEvent } from '../lib/socketServer';
import { sanitizeInput } from '../utils/sanitizer';

// Helper to avoid circular dependency
const getCurrentUserId = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        return stored ? JSON.parse(stored).id : 'system';
    } catch { return 'system'; }
};

const validateAuthorization = (actingUser: User, targetClinicId: string) => {
    if (actingUser.role === UserRole.OWNER) return; // Super Admin bypass
    if (actingUser.clinicId !== targetClinicId) {
        throw new Error(`SECURITY_VIOLATION: User ${actingUser.username} attempted to modify resource in unauthorized clinic ${targetClinicId}.`);
    }
};

// Helper to construct Rich Context and Trigger Webhook
const triggerRichWebhook = async (
    event: 'APPOINTMENT_CREATED' | 'STATUS_CHANGED',
    appointment: Appointment,
    patientName: string,
    patientPhone: string
) => {
    try {
        const [settings, doctor, org] = await Promise.all([
            settingsService.getClinicSettings(appointment.clinicId),
            doctorService.getDoctors(appointment.clinicId).then(docs => docs.find(d => d.id === appointment.doctorId)),
            doctorService.getOrganization(appointment.clinicId)
        ]);

        if (settings.n8nWebhookUrl) {
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
                    },
                    system: {
                        timestamp: new Date().toISOString(),
                        timezone: 'America/Sao_Paulo',
                        env: settings.n8nProductionMode ? 'production' : 'development'
                    }
                }
            }, settings);
        }
    } catch (e) {
        monitoringService.trackError(e as Error, { context: 'TriggerRichWebhook', appointmentId: appointment.id });
    }
};

interface BookingTransactionParams {
    clinicId: string;
    doctorId: string;
    date: string;
    time: string;
    procedure?: string;
    notes?: string;
    patientId?: string;
    newPatientData?: {
        name: string;
        phone: string;
        cpf?: string;
        birthDate?: string;
        notes?: string;
    };
    currentUser: User; // Full User object now required for auth check
    source?: AuditSource;
}

export const appointmentService = {
  
  processBookingTransaction: async (params: BookingTransactionParams): Promise<{ appointment: Appointment, patient: Patient }> => {
      const { clinicId, doctorId, date, time, currentUser, source = AuditSource.WEB_APP } = params;
      
      // Security Check (Early fail)
      validateAuthorization(currentUser, clinicId);

      let reservationId: string | undefined;
      let patientId = params.patientId;
      let createdPatient: Patient | null = null;

      try {
          if (!date || !time || !doctorId) throw new Error("Dados incompletos para agendamento.");

          const reservationResult = await slotReservationService.reserveSlot({
              doctorId,
              date,
              time,
              clinicId,
              reservedBy: source === AuditSource.N8N_WEBHOOK ? 'N8N_WEBHOOK' : 'WEB_APP',
              userId: currentUser.id
          });

          if (!reservationResult.success) {
              const conflictOwner = reservationResult.conflict?.reservedBy === 'N8N_WEBHOOK' 
                  ? 'automação externa' 
                  : 'outro usuário';
              throw new Error(`CONFLICT_DETECTED:Este horário acabou de ser reservado por ${conflictOwner}.`);
          }
          reservationId = reservationResult.reservation!.id;

          if (!patientId && params.newPatientData) {
              const patientValidation = validateSafe(PatientSchema, {
                  ...params.newPatientData,
                  organizationId: clinicId
              });
              
              if (!patientValidation.success) {
                  throw new Error(`Dados do paciente inválidos: ${patientValidation.errors?.join(', ')}`);
              }

              // Schema validated above, but createPatient also applies sanitization logic via manual updates or trusting input if schema used correctly
              createdPatient = await patientService.createPatient({
                  ...params.newPatientData,
                  organizationId: clinicId,
                  status: PatientStatus.Active
              }, source, currentUser);
              
              patientId = createdPatient.id;
          }

          if (!patientId) {
              throw new Error("Identificação do paciente é obrigatória.");
          }

          const appointment = await appointmentService.createAppointment({
              clinicId,
              doctorId,
              patientId,
              date,
              time,
              status: AppointmentStatus.AGENDADO,
              procedure: params.procedure || 'Consulta',
              notes: params.notes || '',
              createdAt: new Date().toISOString()
          }, source, reservationId, currentUser);

          const finalPatient = createdPatient || (await patientService.getPatientById(patientId))!;
          
          return { appointment, patient: finalPatient };

      } catch (error) {
          if (reservationId) {
              await slotReservationService.cancelReservation(reservationId);
          }
          throw error;
      }
  },

  getAppointmentsInRange: async (clinicId: string, startDate: string, endDate: string): Promise<Appointment[]> => {
      await delay(200);
      const appts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
      return appts.filter(a => a.clinicId === clinicId && a.date >= startDate && a.date <= endDate);
  },

  getAvailableSlots: async (clinicId: string, doctorId: string, date: string): Promise<AvailableSlot[]> => {
      await delay(300);
      
      const validation = await doctorAvailabilityService.validateAvailability(doctorId, clinicId, date);
      if (!validation.isAvailable) return [];

      const releaseCheck = await agendaReleaseService.isDateReleased(doctorId, clinicId, date);
      if (!releaseCheck.released) return [];

      const bookingWindow = await agendaReleaseService.getValidBookingWindow(doctorId, clinicId, new Date());
      if (bookingWindow) {
        const targetDate = createDateAtHour(date, '00:00');
        const safeEndDate = new Date(bookingWindow.endDate);
        safeEndDate.setHours(23, 59, 59, 999);
        if (targetDate > safeEndDate) return [];
      }

      const [legacyConfig, availability] = await Promise.all([
          settingsService.getAgendaConfig(clinicId, doctorId),
          doctorAvailabilityService.getDoctorAvailability(doctorId, clinicId)
      ]);

      const patients = await patientService.getAllPatients(clinicId);
      const allAppts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
      
      const doctorAppts = allAppts
        .filter(a => a.clinicId === clinicId && a.doctorId === doctorId && a.date === date && a.status !== AppointmentStatus.NAO_VEIO)
        .map(a => ({ ...a, patient: patients.find(p => p.id === a.patientId) }));
      
      const dayOfWeek = getDayOfWeekBR(date) as DayOfWeek; 

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

      let current = createDateAtHour(date, `${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}`);
      const end = createDateAtHour(date, `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`);

      const candidateTimes: string[] = [];
      while (current < end) {
          candidateTimes.push(formatTimeBR(current));
          current.setMinutes(current.getMinutes() + interval);
      }

      const validationResults = await Promise.all(
          candidateTimes.map(timeStr => 
              doctorAvailabilityService.validateAvailability(doctorId, clinicId, date, timeStr)
          )
      );

      const slots: AvailableSlot[] = [];

      for (let i = 0; i < candidateTimes.length; i++) {
          const timeStr = candidateTimes[i];
          const isValid = validationResults[i].isAvailable;

          if (isValid) {
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
  
  createAppointment: async (appt: Omit<Appointment, 'id' | 'patient'>, source: AuditSource = AuditSource.WEB_APP, reservationId: string | undefined, actingUser: User): Promise<Appointment> => {
    const startTime = performance.now();
    try {
        await delay(300);
        
        // Security Check
        validateAuthorization(actingUser, appt.clinicId);

        // ✅ SECURITY: Zod schema now includes sanitization transforms
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
                metadata: { conflictReason: 'double_check_failed', source, doctorId: validatedAppt.doctorId },
                userId: actingUser.id,
                userName: actingUser.name
            });
            throw new Error("CONFLICT_DETECTED:Horário já ocupado. Escolha outro horário.");
        }
        
        const patient = await patientService.getPatientById(validatedAppt.patientId);
        if (!patient) throw new Error("Paciente não encontrado.");
        
        const newAppt: Appointment = { 
            ...validatedAppt, 
            // SECURITY UPGRADE: Use crypto.randomUUID for ID
            id: crypto.randomUUID(),
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
            metadata: { createdVia, hadReservation: !!reservationId },
            userId: actingUser.id,
            userName: actingUser.name
        });

        socketServer.emit(
            SocketEvent.APPOINTMENT_CREATED,
            { ...newAppt, patient }, 
            newAppt.clinicId,
            getCurrentUserId()
        );

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
            triggerRichWebhook('APPOINTMENT_CREATED', newAppt, patient.name, patient.phone);
        }
        
        const duration = performance.now() - startTime;
        monitoringService.trackMetric('appointment_creation_latency', duration, { source });
        
        return newAppt;

    } catch (error) {
        monitoringService.trackError(error as Error, { 
            action: 'create_appointment', 
            clinicId: appt.clinicId, 
            source 
        });
        throw error;
    }
  },
  
  updateAppointmentStatus: async (id: string, newStatus: AppointmentStatus, source: AuditSource = AuditSource.WEB_APP, actingUser: User): Promise<Appointment> => {
      await delay(500); 

      const appts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
      const index = appts.findIndex(a => a.id === id);
      if (index === -1) throw new Error("Agendamento não encontrado");
      
      const oldStatus = appts[index].status;
      
      // Security Check
      validateAuthorization(actingUser, appts[index].clinicId);

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
        metadata: { oldStatus, newStatus },
        userId: actingUser.id,
        userName: actingUser.name
      });

      socketServer.emit(
        SocketEvent.APPOINTMENT_STATUS_CHANGED,
        { 
            id, 
            oldStatus, 
            newStatus, 
            appointment: { ...appts[index], patient }
        },
        appts[index].clinicId,
        getCurrentUserId()
      );
      
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
           triggerRichWebhook('STATUS_CHANGED', appts[index], patient.name, patient.phone);
      }

      return { ...appts[index], patient };
  },
  
  updateAppointment: async (updated: Appointment, actingUser: User): Promise<Appointment> => {
      await delay(300);
      
      // Security Check
      validateAuthorization(actingUser, updated.clinicId);

      const appts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
      const index = appts.findIndex(a => a.id === updated.id);
      if (index === -1) throw new Error("Agendamento não encontrado");
      
      // ✅ SECURITY FIX: Enforce manual sanitization on user-editable text fields
      // This is critical because `updated` is a full object and schemas might be strict about other fields.
      const safeUpdated = {
          ...updated,
          procedure: sanitizeInput(updated.procedure),
          notes: sanitizeInput(updated.notes)
      };

      const oldValues = { ...appts[index] };
      appts[index] = { ...safeUpdated, updatedAt: new Date().toISOString() };
      setStorage(STORAGE_KEYS.APPOINTMENTS, appts);
      
      systemLogService.createLog({
        organizationId: safeUpdated.clinicId,
        action: AuditAction.APPOINTMENT_UPDATED,
        entityType: 'Appointment',
        entityId: safeUpdated.id,
        entityName: safeUpdated.patient?.name || 'Paciente',
        description: `Editou detalhes do agendamento`,
        oldValues: oldValues as any,
        newValues: safeUpdated as any,
        source: AuditSource.WEB_APP,
        userId: actingUser.id,
        userName: actingUser.name
      });

      socketServer.emit(
        SocketEvent.APPOINTMENT_UPDATED,
        safeUpdated,
        safeUpdated.clinicId,
        getCurrentUserId()
      );

      return appts[index];
  },
  
  deleteAppointment: async (id: string, reason: string, actingUser: User): Promise<void> => {
      await delay(300);
      const appts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
      const appt = appts.find(a => a.id === id);
      if (!appt) throw new Error("Agendamento não encontrado");
      
      // Security Check
      validateAuthorization(actingUser, appt.clinicId);

      const patient = await patientService.getPatientById(appt.patientId);
      
      setStorage(STORAGE_KEYS.APPOINTMENTS, appts.filter(a => a.id !== id));
      
      // ✅ SECURITY FIX: Sanitize Reason
      const safeReason = sanitizeInput(reason);

      systemLogService.createLog({
        organizationId: appt.clinicId,
        source: AuditSource.WEB_APP,
        action: AuditAction.APPOINTMENT_DELETED,
        entityType: 'Appointment',
        entityId: id,
        entityName: patient?.name || 'Paciente',
        description: `Cancelou agendamento: ${safeReason}`,
        metadata: { reason: safeReason, appointmentDate: appt.date, appointmentTime: appt.time },
        userId: actingUser.id,
        userName: actingUser.name
      });

      socketServer.emit(
        SocketEvent.APPOINTMENT_DELETED,
        { id, appointment: appt },
        appt.clinicId,
        getCurrentUserId()
      );

      notificationService.notify({
        title: 'Paciente Cancelou',
        message: `${patient?.name} cancelou o agendamento de ${appt.date} às ${appt.time}. Motivo: ${safeReason}`,
        type: 'warning',
        priority: 'high',
        clinicId: appt.clinicId,
        targetRole: [UserRole.DOCTOR_ADMIN],
        metadata: { reason: safeReason, patientId: appt.patientId }
      });
  },
  
  createBatchAppointments: async (appointments: Omit<Appointment, 'id' | 'patient'>[], actingUser: User, source: AuditSource = AuditSource.WEB_APP): Promise<void> => {
      // Security Check for entire batch
      appointments.forEach(a => validateAuthorization(actingUser, a.clinicId));

      const appts = getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
      const newAppts = appointments.map(a => ({
          ...a,
          // ✅ SECURITY FIX: Sanitize notes in batch blocks
          notes: sanitizeInput(a.notes),
          procedure: sanitizeInput(a.procedure),
          // SECURITY UPGRADE: Use crypto.randomUUID for ID
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString()
      }));
      
      appts.push(...newAppts as Appointment[]);
      setStorage(STORAGE_KEYS.APPOINTMENTS, appts);

      systemLogService.createLog({
        organizationId: appointments[0].clinicId,
        source: source,
        action: AuditAction.AGENDA_BLOCKED,
        entityType: 'Schedule',
        entityId: 'batch_block',
        entityName: 'Bloqueio de Agenda',
        description: `Bloqueou ${newAppts.length} horários em lote`,
        metadata: { count: newAppts.length, date: appointments[0].date },
        userId: actingUser.id,
        userName: actingUser.name
      });

      // ✅ WEBSOCKET EMIT (Send first one to trigger refresh on relevant day)
      // Fix: Provide a dummy patient for batch events (usually blocks) to satisfy strict typing
      const payload: Appointment & { patient: Patient } = {
          ...(newAppts[0] as unknown as Appointment),
          patient: {
              id: 'batch_placeholder',
              organizationId: appointments[0].clinicId,
              name: 'Lote / Bloqueio',
              phone: '',
              status: PatientStatus.Active,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
          }
      };

      socketServer.emit(
        SocketEvent.APPOINTMENT_CREATED,
        payload,
        appointments[0].clinicId,
        getCurrentUserId()
      );
  }
};
