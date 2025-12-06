
import React from 'react';
import { Loader2 } from 'lucide-react';
import { ToastProvider } from './components/ToastProvider';
import { Login } from './components/Login';
import { MainLayout } from './components/MainLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClinicProvider } from './contexts/ClinicContext';

// Componente principal de roteamento de estado
const AppRouter: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  // Se não estiver logado, mostra Login
  if (!user) {
    return <Login />;
  }

  // Se logado, carrega o Layout Principal com contexto da clínica
  return (
    <ClinicProvider>
      <MainLayout />
    </ClinicProvider>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
