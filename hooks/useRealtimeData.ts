
import React, { useEffect, useState, useCallback } from 'react';
import { socketServer, SocketEvent } from '../lib/socketServer';
import { dataService } from '../services/mockSupabase';

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
  
  // Função de carregamento
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);
      const result = await fetchFunction();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro desconhecido'));
      console.error('Erro ao carregar dados:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, dependencies); // dependencies controlled by parent
  
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
        // console.log('🔄 [Realtime] Recarregando por evento:', event);
        // Silent reload on event updates to avoid flickering spinners if desired, 
        // or regular load. For now, using regular load logic inside but we can optimize.
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
    () => dataService.getAppointments(clinicId, date, doctorId),
    [
      SocketEvent.APPOINTMENT_CREATED,
      SocketEvent.APPOINTMENT_UPDATED,
      SocketEvent.APPOINTMENT_DELETED,
      SocketEvent.APPOINTMENT_STATUS_CHANGED,
      SocketEvent.AGENDA_CONFIG_UPDATED // Config changes might affect slot rendering if using this for slots
    ],
    [clinicId, date, doctorId]
  );
}

/**
 * Hook específico para lista de pacientes
 */
export function useRealtimePatients(organizationId: string) {
  return useRealtimeData(
    () => dataService.getAllPatients(organizationId),
    [SocketEvent.PATIENT_CREATED, SocketEvent.PATIENT_UPDATED],
    [organizationId]
  );
}

/**
 * Hook específico para médicos
 */
export function useRealtimeDoctors(organizationId: string) {
  return useRealtimeData(
    () => dataService.getDoctors(organizationId),
    [SocketEvent.DOCTOR_CREATED, SocketEvent.DOCTOR_DELETED],
    [organizationId]
  );
}

/**
 * Hook para usuários (Team)
 */
export function useRealtimeUsers(clinicId?: string) {
  return useRealtimeData(
    () => dataService.getUsers(clinicId),
    [SocketEvent.USER_CREATED, SocketEvent.USER_DELETED],
    [clinicId]
  );
}
