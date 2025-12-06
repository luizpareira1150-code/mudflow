
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User as UserIcon, ShieldCheck, Crown, Stethoscope, Calendar, Briefcase } from 'lucide-react';
import { useToast } from './ToastProvider';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { showToast } = useToast();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // O Contexto já chama o authService internamente
      const success = await login(username, password);
      
      if (!success) {
        setError('Credenciais inválidas.');
        showToast('error', 'Usuário ou senha incorretos.');
      }
      // Se sucesso, o Contexto atualiza o 'user' e o App.tsx redireciona automaticamente
    } catch (err) {
      setError('Erro ao conectar.');
      showToast('error', 'Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async () => {
    if (!username) {
        showToast('warning', 'Digite seu usuário para recuperar a senha.');
        return;
    }
    showToast('info', 'Enviando solicitação...', 1000);
    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        showToast('success', 'Link de recuperação enviado! Verifique seu WhatsApp/Email.');
    } catch (e) {
        showToast('error', 'Erro ao enviar link de recuperação.');
    }
  };

  const fillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-[420px] w-full bg-white rounded-[32px] shadow-xl p-8 md:p-10">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200 transform hover:scale-105 transition-transform duration-300">
            <ShieldCheck className="text-white w-8 h-8" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">MedFlow</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">CRM da Saúde & Automação</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Usuário</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                <UserIcon size={20} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-gray-700 placeholder-gray-400 bg-white"
                placeholder="Seu usuário"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Senha</label>
            <div className="relative group">
               <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                <Lock size={20} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-gray-700 placeholder-gray-400 bg-white"
                placeholder="••••••"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button 
                type="button" 
                onClick={handleRecovery}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Esqueceu a senha?
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl text-center font-medium border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-70 flex items-center justify-center text-base transform active:scale-[0.98]"
          >
            {loading ? (
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Entrando...</span>
                </div>
            ) : 'Entrar no Sistema'}
          </button>
        </form>

        {/* Quick Access Section */}
        <div className="mt-10 pt-8 border-t border-gray-100">
          <p className="text-xs text-center text-gray-400 mb-4 font-medium uppercase tracking-wider">Ambiente de Teste (Acesso Rápido)</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fillCredentials('admin', '123')}
              className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-2xl hover:border-amber-400 hover:bg-amber-50 transition-all group bg-white h-24"
            >
              <Crown size={24} className="text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-amber-700">Dono</span>
              <span className="text-[10px] text-gray-400">admin</span>
            </button>

            <button
              type="button"
              onClick={() => fillCredentials('medicocli', '123')}
              className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-all group bg-white h-24"
            >
              <Briefcase size={24} className="text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-blue-700">Clínica</span>
              <span className="text-[10px] text-gray-400">medicocli</span>
            </button>

            <button
              type="button"
              onClick={() => fillCredentials('secretaria', '123')}
              className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-2xl hover:border-rose-400 hover:bg-rose-50 transition-all group bg-white h-24"
            >
              <Calendar size={24} className="text-rose-500 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-rose-700">Secretária</span>
              <span className="text-[10px] text-gray-400">secretaria</span>
            </button>

            <button
              type="button"
              onClick={() => fillCredentials('medicocon', '123')}
              className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-2xl hover:border-teal-400 hover:bg-teal-50 transition-all group bg-white h-24"
            >
              <Stethoscope size={24} className="text-teal-500 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-teal-700">Consultório</span>
              <span className="text-[10px] text-gray-400">medicocon</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
