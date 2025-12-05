

import { useState, useEffect, useCallback } from 'react';
import { Doctor, AvailableSlot, AppointmentStatus, Patient, RecommendedSlot } from '../types';
import { dataService } from '../services/mockSupabase';
import { slotReservationService } from '../services/slotReservationService';
import { recommendationService } from '../services/recommendationService';
import { validateSafe } from '../utils/validator';
import { AppointmentSchema } from '../utils/validationSchemas';
import { useToast } from '../components/ToastProvider';

interface UseBookingProps {
  clinicId: string;
  selectedDoctorId?: string;
  selectedDate?: string;
}

export const useAppointmentBooking = ({ clinicId, selectedDoctorId, selectedDate }: UseBookingProps) => {
  const { showToast } = useToast();
  
  // Data States
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [procedures, setProcedures] = useState<string[]>([]);
  
  // AI Suggestions State
  const [suggestions, setSuggestions] = useState<RecommendedSlot[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Operation States
  const [loadingData, setLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 1. Initial Load: Doctors
  useEffect(() => {
    let mounted = true;
    const loadDoctors = async () => {
      try {
        const docs = await dataService.getDoctors(clinicId);
        if (mounted) setDoctors(docs);
      } catch (err) {
        console.error("Failed to load doctors", err);
      }
    };
    loadDoctors();
    return () => { mounted = false; };
  }, [clinicId]);

  // 2. Reactive Load: Slots & Procedures (When doctor/date changes)
  useEffect(() => {
    if (!selectedDoctorId || !selectedDate) {
        setSlots([]);
        setProcedures([]);
        return;
    }

    let mounted = true;
    setLoadingData(true);

    const loadContext = async () => {
      try {
        const [fetchedSlots, fetchedProcs] = await Promise.all([
          dataService.getAvailableSlots(clinicId, selectedDoctorId, selectedDate),
          dataService.getProcedureOptions(clinicId, selectedDoctorId)
        ]);
        
        if (mounted) {
          setSlots(fetchedSlots);
          setProcedures(fetchedProcs);
        }
      } catch (err) {
        console.error("Failed to load slots/procedures", err);
      } finally {
        if (mounted) setLoadingData(false);
      }
    };

    loadContext();
    return () => { mounted = false; };
  }, [clinicId, selectedDoctorId, selectedDate]);

  // 3. Action: Get AI Suggestions
  const fetchSuggestions = useCallback(async (patientId: string, doctorId: string) => {
    setLoadingSuggestions(true);
    try {
      const results = await recommendationService.suggestOptimalSlots(clinicId, doctorId, patientId);
      setSuggestions(results);
      if (results.length === 0) {
        showToast('info', 'Sem padrões claros no histórico para sugerir.');
      }
    } catch (e) {
      console.error(e);
      showToast('error', 'Falha ao gerar sugestões.');
    } finally {
      setLoadingSuggestions(false);
    }
  }, [clinicId, showToast]);

  const clearSuggestions = useCallback(() => setSuggestions([]), []);

  // 4. Action: Commit Booking (The heavy lifting)
  const bookAppointment = useCallback(async (params: {
    patient: Patient | null;
    time: string;
    procedure: string;
    notes: string;
    currentUser: any; // User type
  }) => {
    const { patient, time, procedure, notes, currentUser } = params;
    setError('');

    // Pre-flight Validation
    if (!selectedDoctorId || !selectedDate || !time) {
      setError("Preencha Médico, Data e Horário.");
      return false;
    }
    if (!patient) {
      setError("Selecione um paciente.");
      return false;
    }

    setIsSubmitting(true);
    let reservationId: string | undefined;

    try {
      // Step A: Reserve Slot (Concurrency Check)
      const reservationResult = await slotReservationService.reserveSlot({
        doctorId: selectedDoctorId,
        date: selectedDate,
        time: time,
        clinicId,
        reservedBy: 'WEB_APP',
        userId: currentUser.id
      });

      if (!reservationResult.success) {
        const conflictOwner = reservationResult.conflict?.reservedBy === 'N8N_WEBHOOK' 
          ? 'automação do WhatsApp' 
          : 'outra secretária';
        throw new Error(`Este horário acabou de ser reservado por ${conflictOwner}. Escolha outro.`);
      }
      reservationId = reservationResult.reservation!.id;

      // Step B: Prepare Payload
      const appointmentPayload = {
        clinicId,
        doctorId: selectedDoctorId,
        patientId: patient.id,
        date: selectedDate,
        time,
        status: AppointmentStatus.AGENDADO,
        procedure: procedure || 'Consulta',
        notes,
        createdAt: new Date().toISOString()
      };

      // Step C: Schema Validation
      const validation = validateSafe(AppointmentSchema, appointmentPayload);
      if (!validation.success) {
        throw new Error(validation.errors?.join(', ') || 'Erro nos dados do agendamento.');
      }

      // Step D: Persist to DB
      await dataService.createAppointment(appointmentPayload, undefined, reservationId);
      
      showToast('success', 'Agendamento realizado com sucesso!');
      return true;

    } catch (err: any) {
      let msg = err.message || "Erro desconhecido.";
      
      // Clean up conflict message prefix if present
      if (msg.startsWith('CONFLICT_DETECTED:')) {
        msg = msg.replace('CONFLICT_DETECTED:', '');
        showToast('warning', msg);
      } else {
        showToast('error', msg);
      }
      
      setError(msg);

      // Rollback Reservation if exists
      if (reservationId) {
        await slotReservationService.cancelReservation(reservationId);
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [clinicId, selectedDoctorId, selectedDate, showToast]);

  return {
    // Data
    doctors,
    slots,
    procedures,
    suggestions,
    
    // Status
    loadingData,
    loadingSuggestions,
    isSubmitting,
    error,
    
    // Actions
    fetchSuggestions,
    clearSuggestions,
    bookAppointment
  };
};