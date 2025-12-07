
import React, { useState, useEffect } from 'react';
import { ViewState, UserRole, AccountType } from '../types';
import Sidebar from './Sidebar';
import Patients from './Patients';
import { Agenda } from './Agenda';
import Admin from './Admin';
import { CRM } from './CRM';
import { OwnerDashboard } from './OwnerDashboard';
import { MetricsDashboard } from './MetricsDashboard';
import { ActivityLogs } from './ActivityLogs';
import { useAuth } from '../contexts/AuthContext';
import { useClinic } from '../contexts/ClinicContext';
import { HumanHandoverAlert } from './HumanHandoverAlert';

export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { doctors, selectedDoctorId, setSelectedDoctorId, organization } = useClinic();
  const [currentView, setView] = useState<ViewState>(ViewState.Dashboard);

  // Documentation Log for N8N (Developer Experience)
  useEffect(() => {
    if (user && user.role === UserRole.DOCTOR_ADMIN) {
      console.groupCollapsed('📚 [MedFlow] Guia de Integração N8N');
      console.log('1. Use o Webhook URL nas Configurações');
      console.log('2. Exemplo de Payload para CREATE_APPOINTMENT:', {
        action: 'CREATE_APPOINTMENT',
        clinicId: user.clinicId,
        authToken: 'YOUR_API_TOKEN',
        data: { doctorId: 'doc_1', date: '2024-01-01', time: '10:00' }
      });
      console.groupEnd();
    }
  }, [user]);

  if (!user) return null;

  const renderContent = () => {
    switch (currentView) {
      case ViewState.Dashboard:
        if (user.role === UserRole.OWNER) {
            return <OwnerDashboard currentUser={user} />;
        }
        // For Doctors and Secretaries, "Dashboard" in navigation maps to CRM (Operational View)
        // Doctors have a separate "Metrics" view for analytics
        return (
            <CRM 
                user={user}
                doctors={doctors}
                selectedDoctorId={selectedDoctorId}
                onDoctorChange={setSelectedDoctorId}
                isConsultorio={organization?.accountType === AccountType.CONSULTORIO}
            />
        );
      case ViewState.Metrics:
        // Only allow DOCTOR_ADMIN to access Analytics
        if (user.role === UserRole.DOCTOR_ADMIN) {
            return <MetricsDashboard user={user} organization={organization} />;
        }
        // Fallback for unauthorized access to metrics -> CRM
        return (
            <CRM 
                user={user}
                doctors={doctors}
                selectedDoctorId={selectedDoctorId}
                onDoctorChange={setSelectedDoctorId}
                isConsultorio={organization?.accountType === AccountType.CONSULTORIO}
            />
        );
      case ViewState.Agenda:
        return (
            <Agenda 
                user={user}
                doctors={doctors}
                selectedDoctorId={selectedDoctorId}
                onDoctorChange={setSelectedDoctorId}
                isConsultorio={organization?.accountType === AccountType.CONSULTORIO}
            />
        );
      case ViewState.Patients:
        return <Patients />;
      case ViewState.Settings:
        return <Admin user={user} />;
      case ViewState.Logs:
        return <ActivityLogs user={user} />;
      default:
        // Safe Fallback: Always render CRM if state is unknown
        return (
            <CRM 
                user={user}
                doctors={doctors}
                selectedDoctorId={selectedDoctorId}
                onDoctorChange={setSelectedDoctorId}
                isConsultorio={organization?.accountType === AccountType.CONSULTORIO}
            />
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      {/* Global Alert System */}
      <HumanHandoverAlert user={user} />

      <Sidebar 
        user={user} 
        activePage={currentView} 
        onNavigate={(page) => setView(page as ViewState)} 
        onLogout={logout} 
      />
      
      <main className="flex-1 ml-64 overflow-y-auto h-full">
        {renderContent()}
      </main>
    </div>
  );
};
