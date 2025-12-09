
import { useEffect, useState, useCallback } from 'react';
import { Doctor, User } from '../types';
import { doctorService } from '../services/doctorService';

/**
 * Hook that returns only the doctors that the current user has access to.
 * - Admin/Owner: All doctors
 * - Secretary: Filtered by DoctorAccessControl
 */
export function useDoctorsByAccess(
  user: User | null,
  organizationId: string
): {
  doctors: Doctor[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
} {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDoctors = useCallback(async () => {
    if (!user || !organizationId) return;

    try {
      setLoading(true);
      const accessibleDoctors = await doctorService.getDoctorsForUser(user);
      setDoctors(accessibleDoctors);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar médicos'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, organizationId]);

  useEffect(() => {
    loadDoctors();

    // Listen for updates (e.g. from Admin panel)
    const handleUpdate = () => loadDoctors();
    window.addEventListener('medflow:doctors-updated', handleUpdate);
    return () => window.removeEventListener('medflow:doctors-updated', handleUpdate);
  }, [loadDoctors]);

  return { doctors, loading, error, refresh: loadDoctors };
}