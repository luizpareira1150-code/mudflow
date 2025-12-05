
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Doctor, Organization, UserRole } from '../types';
import { dataService } from '../services/mockSupabase';
import { useAuth } from './AuthContext';

interface ClinicContextType {
  organization: Organization | null;
  doctors: Doctor[];
  selectedDoctorId: string;
  setSelectedDoctorId: (id: string) => void;
  refreshContext: () => Promise<void>;
  loading: boolean;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export const ClinicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadContext = async () => {
    if (!user || user.role === UserRole.OWNER) return;

    setLoading(true);
    try {
      const [org, docs] = await Promise.all([
        dataService.getOrganization(user.clinicId),
        dataService.getDoctors(user.clinicId)
      ]);

      setOrganization(org);
      setDoctors(docs);

      // Smart selection of doctor ID
      if (docs.length > 0) {
        // If current selection is invalid (doctor deleted), select first one
        if (!selectedDoctorId || !docs.find(d => d.id === selectedDoctorId)) {
          setSelectedDoctorId(docs[0].id);
        }
      } else {
        setSelectedDoctorId('');
      }
    } catch (error) {
      console.error("Failed to load clinic context", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadContext();
    } else {
      // Reset state on logout
      setOrganization(null);
      setDoctors([]);
      setSelectedDoctorId('');
    }
  }, [user]);

  // Listen for external updates (e.g. from Admin panel creating a doctor)
  useEffect(() => {
    const handleUpdate = () => loadContext();
    window.addEventListener('medflow:doctors-updated', handleUpdate);
    return () => window.removeEventListener('medflow:doctors-updated', handleUpdate);
  }, [user]);

  return (
    <ClinicContext.Provider value={{ 
      organization, 
      doctors, 
      selectedDoctorId, 
      setSelectedDoctorId, 
      refreshContext: loadContext,
      loading 
    }}>
      {children}
    </ClinicContext.Provider>
  );
};

export const useClinic = () => {
  const context = useContext(ClinicContext);
  if (context === undefined) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
};
