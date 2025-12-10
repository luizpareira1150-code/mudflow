
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { socketServer, SocketEvent } from '../lib/socketServer';
import { appointmentService } from '../services/appointmentService';
import { patientService } from '../services/patientService';
import { doctorService } from '../services/doctorService';

/**
 * Hook genérico para dados em tempo real
 * 
 * @param fetchFunction - Função de busca de dados. 
 * ⚠️ IMPORTANTE: Esta função DEVE ser memoizada com `useCallback` no componente pai se depender de props/state, 
 * caso contrário, causará loops infinitos de re-renderização.
 * 
 * Exemplo correto:
 * const fetcher = useCallback(() => service.get(id), [id]);
 * useRealtimeData(fetcher, ...);
 * 
 * @param reloadOnEvents - Evento(s) do Socket que disparam atualização.
 * @param dependencies - Array de dependências adicionais que forçam recarregamento.
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

  // Use ref to hold the latest fetch function.
  // This allows us to call the freshest logic without forcing useEffects to re-run constantly.
  const fetchRef = useRef(fetchFunction);

  useEffect(() => {
    fetchRef.current = fetchFunction;
  }); // Run on every render to ensure ref is always fresh

  // Handle unmount cleanup
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Função de carregamento memoizada pelas dependências de DADOS (não pela função em si)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent && isMounted.current) setLoading(true);
      if (isMounted.current) setError(null);
      
      // Always call the latest version of the function via Ref
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
  }, [...dependencies]); // Spread dependencies to ensure value equality checks
  
  // Carregar dados inicial
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Estabilizar a lista de eventos para evitar recriação de listeners se passado array inline
  const eventsList = Array.isArray(reloadOnEvents) ? reloadOnEvents : [reloadOnEvents];
  const eventsKey = eventsList.join(','); // Stable primitive key for dependency array

  // Escutar eventos WebSocket
  useEffect(() => {
    // Registrar listeners
    const unsubscribers = eventsList.map(event => 
      socketServer.on(event, () => {
        loadData(true); // Silent refresh
      })
    );
    
    // Cleanup: remover listeners
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey, loadData]); // Depend on stable key instead of array reference
  
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
