
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { socketServer, SocketEvent } from '../lib/socketServer';
import { appointmentService } from '../services/appointmentService';
import { patientService } from '../services/patientService';
import { doctorService } from '../services/doctorService';

/**
 * Hook genérico para dados em tempo real
 */
export function useRealtimeData<T>(
  fetchFunction: () => Promise<T>,
  reloadOnEvents: SocketEvent | SocketEvent[],
  dependencies: any[] = []
): {
  data: T | null; // Allow initial null
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Track mounted state to prevent setting state on unmounted component
  const isMounted = useRef(true);

  // Use ref to hold the latest fetch function, preventing re-execution of loadData
  // if the parent passes a new inline function on every render.
  const fetchRef = useRef(fetchFunction);

  useEffect(() => {
    fetchRef.current = fetchFunction;
  }, [fetchFunction]);

  // Handle unmount cleanup
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Função de carregamento
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent && isMounted.current) setLoading(true);
      if (isMounted.current) setError(null);
      
      // Always call the latest version of the function
      const result = await fetchRef.current();
      
      if (isMounted.current) {
        setData(result);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error('Erro desconhecido'));
      }
    } finally {
      if (!isSilent && isMounted.current) {
        setLoading(false);
      }
    }
  }, dependencies); // Only re-create if explicit dependencies change
  
  // Carregar dados inicial
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Escutar eventos WebSocket
  useEffect(() => {
    const events = Array.isArray(reloadOnEvents) ? reloadOnEvents : [reloadOnEvents];
    
    // Registrar listeners
    const unsubscribers = events.map(event => 
      socketServer.on(event, () => {
        loadData(true); // Silent refresh
      })
    );
    
    // Cleanup: remover listeners
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [reloadOnEvents, loadData]);
  
  return {
    data,
    loading,
    error,
    refresh: () => loadData(false),
    setData
  };
}

/**
 * Hook específico para appointments
 */
export function useRealtimeAppointments(
  clinicId: string,
  date: string,
  doctorId?: string
) {
  return useRealtimeData(
    () => appointmentService.getAppointments(clinicId, date, doctorId),
    [
      SocketEvent.APPOINTMENT_CREATED,
      SocketEvent.APPOINTMENT_UPDATED,
      SocketEvent.APPOINTMENT_DELETED,
      SocketEvent.APPOINTMENT_STATUS_CHANGED,
      SocketEvent.AGENDA_CONFIG_UPDATED
    ],
    [clinicId, date, doctorId]
  );
}

/**
 * Hook específico para lista de pacientes
 */
export function useRealtimePatients(organizationId: string) {
  return useRealtimeData(
    () => patientService.getAllPatients(organizationId),
    [SocketEvent.PATIENT_CREATED, SocketEvent.PATIENT_UPDATED],
    [organizationId]
  );
}

/**
 * Hook específico para médicos
 */
export function useRealtimeDoctors(organizationId: string) {
  return useRealtimeData(
    () => doctorService.getDoctors(organizationId),
    [SocketEvent.DOCTOR_CREATED, SocketEvent.DOCTOR_DELETED],
    [organizationId]
  );
}

/**
 * Hook para usuários (Team)
 */
export function useRealtimeUsers(clinicId?: string) {
  return useRealtimeData(
    () => doctorService.getUsers(clinicId),
    [SocketEvent.USER_CREATED, SocketEvent.USER_DELETED],
    [clinicId]
  );
}
