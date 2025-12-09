
import React, { useState } from 'react';
import { User } from '../../types';
import { doctorService, authService } from '../../services/mockSupabase';
import { UserCog, Lock, Save, ShieldCheck } from 'lucide-react';
import { useToast } from '../ToastProvider';

interface AdminProfileProps {
  currentUser: User;
}

export const AdminProfile: React.FC<AdminProfileProps> = ({ currentUser }) => {
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    username: currentUser.username,
    newPassword: '',
    confirmNewPassword: '',
    currentPassword: '' // Required to confirm changes
  });
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic Validation
    if (!formData.currentPassword) {
      showToast('warning', 'Digite sua senha atual para confirmar as alterações.');
      return;
    }

    if (formData.newPassword && formData.newPassword !== formData.confirmNewPassword) {
      showToast('error', 'A nova senha e a confirmação não coincidem.');
      return;
    }

    setLoading(true);

    try {
      // 1. Verify Current Password
      const isValid = await authService.verifyPassword(formData.currentPassword);
      if (!isValid) {
        showToast('error', 'Senha atual incorreta.');
        setLoading(false);
        return;
      }

      // 2. Prepare Updates
      const updates: any = {};
      if (formData.username !== currentUser.username) {
        updates.username = formData.username;
      }
      if (formData.newPassword) {
        updates.password = formData.newPassword;
      }

      if (Object.keys(updates).length === 0) {
        showToast('info', 'Nenhuma alteração detectada.');
        setLoading(false);
        return;
      }

      // 3. Update User via Service
      await doctorService.updateUser(currentUser.id, updates);
      
      showToast('success', 'Perfil atualizado com sucesso!');
      setFormData(prev => ({ ...prev, newPassword: '', confirmNewPassword: '', currentPassword: '' }));
      
    } catch (error: any) {
      showToast('error', error.message || 'Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <UserCog size={24} className="text-blue-600" />
            Configurações da Conta
          </h3>
          <p className="text-gray-500 text-sm mt-1">
            Gerencie suas credenciais de acesso ao sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Identity Section */}
          <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100">
            <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wide mb-4">Credenciais de Login</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Usuário / Login</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Seu nome de usuário"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Este é o nome usado para entrar no sistema.</p>
              </div>
            </div>
          </div>

          {/* Password Reset Section */}
          <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Lock size={16} /> Alterar Senha
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nova Senha</label>
                <input
                  type="password"
                  value={formData.newPassword}
                  onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                  className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Deixe em branco para manter"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={formData.confirmNewPassword}
                  onChange={e => setFormData({ ...formData, confirmNewPassword: e.target.value })}
                  className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Repita a nova senha"
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Security Confirmation */}
          <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
             <div className="flex items-start gap-3">
                <ShieldCheck className="text-yellow-600 shrink-0 mt-1" size={20} />
                <div className="flex-1">
                    <label className="block text-sm font-bold text-yellow-800 mb-2">Confirmação de Segurança</label>
                    <p className="text-xs text-yellow-700 mb-3">Para salvar as alterações, digite sua senha <strong>ATUAL</strong>.</p>
                    <input
                      type="password"
                      value={formData.currentPassword}
                      onChange={e => setFormData({ ...formData, currentPassword: e.target.value })}
                      className="w-full border border-yellow-200 bg-white text-gray-900 rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 outline-none transition-all placeholder-gray-400"
                      placeholder="Sua senha atual"
                      required
                    />
                </div>
             </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || !formData.currentPassword}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
