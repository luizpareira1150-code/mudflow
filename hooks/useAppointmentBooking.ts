import { useState, useEffect, useCallback } from 'react';
import { Doctor, AvailableSlot, Patient, RecommendedSlot, User } from '../types';
import { doctorService } from '../services/doctorService';
import { appointmentService } from '../services/appointmentService';
import { settingsService } from '../services/settingsService';
import { recommendationService } from '../services/recommendationService';
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
        const docs = await doctorService.getDoctors(clinicId);
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
          appointmentService.getAvailableSlots(clinicId, selectedDoctorId, selectedDate),
          settingsService.getProcedureOptions(clinicId, selectedDoctorId)
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

  // 4. Action: Commit Booking (Atomic Transaction)
  const bookAppointment = useCallback(async (params: {
    patient: Patient | null;
    time: string;
    procedure: string;
    notes: string;
    currentUser: User; // Updated type from any to User
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

    try {
      // Execute Atomic Transaction
      await appointmentService.processBookingTransaction({
          clinicId,
          doctorId: selectedDoctorId,
          date: selectedDate,
          time,
          procedure,
          notes,
          patientId: patient.id, // Existing patient ID
          currentUser: currentUser // Pass full user object
      });
      
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