import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Patients from './components/Patients';
import Automations from './components/Automations';
import { Agenda } from './components/Agenda';
import Admin from './components/Admin';
import { CRM } from './components/CRM';
import { Login } from './components/Login';
import { ViewState, User, UserRole, Doctor, Organization, AccountType } from './types';
import { authService, dataService } from './services/mockSupabase';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setView] = useState<ViewState>(ViewState.Dashboard);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Application Data State
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [organization, setOrganization] = useState<Organization | null>(null);

  useEffect(() => {
    // Check for existing session
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setLoading(false);
  }, []);

  // Fetch doctors and organization when user logs in
  useEffect(() => {
    if (user && user.role !== UserRole.OWNER) {
        const loadContext = async () => {
            try {
                const org = await dataService.getOrganization(user.clinicId);
                setOrganization(org);
                const docs = await dataService.getDoctors(user.clinicId);
                setDoctors(docs);
                if (docs.length > 0 && !selectedDoctorId) {
                    setSelectedDoctorId(docs[0].id);
                }
            } catch (error) {
                console.error("Failed to load application context", error);
            }
        };
        loadContext();
    }
  }, [user]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setView(ViewState.Dashboard);
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setDoctors([]);
    setSelectedDoctorId('');
  };

  const renderContent = () => {
    if (!user) return null;

    switch (currentView) {
      case ViewState.Dashboard:
        // Owner sees the Stats Dashboard, others see the CRM Kanban
        if (user.role === UserRole.OWNER) {
            return <Dashboard />;
        }
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
      case ViewState.Automations:
        return <Automations />;
      case ViewState.Settings:
        return <Admin user={user} />;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      <Sidebar 
        user={user} 
        activePage={currentView} 
        onNavigate={(page) => setView(page as ViewState)} 
        onLogout={handleLogout} 
      />
      
      <main className="flex-1 ml-64 overflow-y-auto h-full">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;