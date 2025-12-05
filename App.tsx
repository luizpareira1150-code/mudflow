
import React from 'react';
import { Loader2 } from 'lucide-react';
import { ToastProvider, useToast } from './components/ToastProvider';
import { Login } from './components/Login';
import { MainLayout } from './components/MainLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClinicProvider } from './contexts/ClinicContext';

// Componente intermediário para decidir entre Login ou Layout
// Necessário para usar o hook useAuth que está dentro do AuthProvider
const AppContent: React.FC = () => {
  const { user, loading, login } = useAuth();
  const { showToast } = useToast();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <Login onLogin={async (u) => {
         // O Login component atual passa o objeto usuário direto, 
         // mas aqui vamos apenas forçar o refresh do contexto se necessário,
         // ou confiar que o contexto já atualizou.
         // A prop onLogin do componente Login original espera (user: User) => void.
         // Vamos manter a compatibilidade ou o Login deve usar o hook useAuth também?
         // Para este refactor sem quebrar o componente Login, aceitamos o objeto mas usamos o contexto.
      }} />
    );
  }

  return (
    <ClinicProvider>
      <MainLayout />
    </ClinicProvider>
  );
};

// Wrapper para o Login Component usar o Contexto
// Como o componente Login.tsx original usa props e estado local,
// vamos criar um wrapper aqui ou refatorar o Login.tsx. 
// Para ser menos intrusivo, vamos adaptar o render acima.
// Mas espere, o Login.tsx original chama authService.login diretamente.
// O ideal é que o Login chame o login do contexto.

// Vamos fazer uma pequena adaptação no AppContent para ser compatível com o Login atual
// O Login.tsx espera `onLogin`. 
const AppContentCompatible: React.FC = () => {
  const { user, loading, updateUser } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={(u) => updateUser(u)} />;
  }

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
        <AppContentCompatible />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
