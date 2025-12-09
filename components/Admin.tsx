
import React, { useState, useEffect } from 'react';
import { User, UserRole, ClinicSettings, Doctor, Organization, AccountType } from '../types';
import { doctorService, settingsService, authService } from '../services/mockSupabase';
import Automations from './Automations';
import { Users, Webhook, Workflow, Stethoscope, Mail, Phone, KeyRound, Building2, X, RefreshCw, Trash2, AlertTriangle, Lock, ShieldCheck, UserCog } from 'lucide-react';
import { useToast } from './ToastProvider';
import { DoctorAvailabilityConfig } from './DoctorAvailabilityConfig';

// Import New Sub-components
import { AdminTeam } from './admin/AdminTeam';
import { AdminDoctors } from './admin/AdminDoctors';
import { AdminIntegrations } from './admin/AdminIntegrations';
import { AdminProfile } from './admin/AdminProfile';

interface AdminProps {
  user: User;
}

// Helper Wrapper for Locked Content extracted to avoid re-definition on render
interface LockedContentProps {
  children: React.ReactNode;
  isLocked: boolean;
  onUnlockRequest: () => void;
}

const LockedContent: React.FC<LockedContentProps> = ({ children, isLocked, onUnlockRequest }) => {
    // SECURITY: Do not render children (which may contain API keys) if locked.
    if (!isLocked) {
        return <>{children}</>;
    }

    return (
        <div className="relative h-[500px] bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            
            <div className="z-10 bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center max-w-sm mx-4 transform transition-all">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock size={32} className="text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Acesso Protegido</h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                    Esta área contém credenciais de integração sensíveis (API Keys).
                    <br/>
                    <strong>Conteúdo oculto por segurança.</strong>
                </p>
                <button 
                    onClick={onUnlockRequest}
                    className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all flex items-center justify-center gap-2"
                >
                    <ShieldCheck size={18} />
                    Solicitar Acesso
                </button>
            </div>
        </div>
    );
};

const Admin: React.FC<AdminProps> = ({ user: currentUser }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'team' | 'profile' | 'doctors' | 'integrations' | 'automations'>('team');

  // --- GLOBAL DATA ---
  const [users, setUsers] = useState<User[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  
  // Sensitive Data (Deferred Loading)
  const [settings, setSettings] = useState<ClinicSettings>({ clinicId: currentUser.clinicId });

  // --- MODAL STATES ---
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedDoctorForAvailability, setSelectedDoctorForAvailability] = useState<Doctor | null>(null);
  
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; user: User | null; doctor: Doctor | null }>({ isOpen: false, user: null, doctor: null });
  const [resetModal, setResetModal] = useState<{ isOpen: boolean; user: User | null }>({ isOpen: false, user: null });
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // --- FEATURE UNLOCK STATE ---
  const [isFeaturesUnlocked, setIsFeaturesUnlocked] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');

  // Lock logic: Only unlocked for OWNER or if password verified
  const isLocked = !(isFeaturesUnlocked || currentUser.role === UserRole.OWNER);

  const canViewDoctors = currentUser.role === UserRole.DOCTOR_ADMIN && currentOrganization?.accountType === AccountType.CLINICA;

  const loadData = async () => {
    const fetchedUsers = await doctorService.getUsers(
      currentUser.role === UserRole.OWNER ? undefined : currentUser.clinicId
    );

    if (currentUser.role === UserRole.OWNER) {
      const adminsOnly = fetchedUsers.filter(u => 
        u.role === UserRole.DOCTOR_ADMIN && u.id !== currentUser.id
      );
      setUsers(adminsOnly);
      const orgs = await doctorService.getOrganizations();
      setOrganizations(orgs);
    } else {
      setUsers(fetchedUsers);
    }

    if (currentUser.role === UserRole.DOCTOR_ADMIN) {
        const org = await doctorService.getOrganization(currentUser.clinicId);
        setCurrentOrganization(org);
        
        if (org?.accountType === AccountType.CLINICA) {
            const docs = await doctorService.getDoctors(currentUser.clinicId);
            setDoctors(docs);
        }
    }
  };

  const loadSettings = async () => {
    // SECURITY: Only load settings if the view is UNLOCKED
    if (currentUser.role !== UserRole.OWNER && !isFeaturesUnlocked) return;

    if (currentUser.role !== UserRole.OWNER) {
        const data = await settingsService.getClinicSettings(currentUser.clinicId);
        setSettings(data);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Load settings only when tab is active AND unlocked
  useEffect(() => {
    if (activeTab === 'integrations' && !isLocked) {
        loadSettings();
    }
  }, [activeTab, isLocked]);

  // --- GLOBAL HANDLERS ---

  const confirmDelete = async () => {
    setActionLoading(true);
    try {
      if (deleteModal.user) {
          await doctorService.deleteUser(deleteModal.user.id);
          showToast('success', 'Usuário removido.');
      } else if (deleteModal.doctor) {
          await doctorService.deleteDoctor(deleteModal.doctor.id);
          showToast('success', 'Médico removido.');
      }
      await loadData();
      setDeleteModal({ isOpen: false, user: null, doctor: null });
      setSelectedUser(null);
    } catch (error) {
      showToast('error', 'Erro ao excluir.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmReset = async () => {
    if (!resetModal.user || !newPassword) return;
    setActionLoading(true);
    try {
      await doctorService.resetPassword(resetModal.user.id, newPassword);
      setResetModal({ isOpen: false, user: null });
      showToast('success', `Senha de ${resetModal.user.name} alterada!`);
    } catch (error) {
      showToast('error', 'Erro ao resetar senha.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlockFeatures = async (e: React.FormEvent) => {
      e.preventDefault();
      setActionLoading(true);
      try {
          const isValid = await authService.verifyMasterPassword(unlockPassword);
          if (isValid) {
              setIsFeaturesUnlocked(true);
              setIsUnlockModalOpen(false);
              showToast('success', 'Acesso desbloqueado pelo Super-Admin.');
              // Trigger settings load immediately after unlock
              loadSettings();
          } else {
              showToast('error', 'Senha de Dono / Super-Admin incorreta.');
          }
      } catch (error) {
          showToast('error', 'Erro na verificação.');
      } finally {
          setActionLoading(false);
          setUnlockPassword('');
      }
  };

  const getRoleColor = (role: string) => {
      switch(role) {
          case UserRole.OWNER: return 'bg-purple-100 text-purple-700 border-purple-200';
          case UserRole.DOCTOR_ADMIN: return 'bg-blue-100 text-blue-700 border-blue-200';
          case UserRole.SECRETARY: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          default: return 'bg-gray-100 text-gray-700 border-gray-200';
      }
  };
  const getUserOrg = (user: User) => organizations.find(o => o.id === user.clinicId);

  return (
    <div className={`mx-auto pb-10 relative p-8 animate-in fade-in duration-500 ${activeTab === 'automations' ? 'max-w-6xl' : 'max-w-4xl'}`}>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Painel Administrativo</h2>
        <div className="flex items-center gap-2 text-gray-500 mt-1">
            {currentOrganization && (
                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded border border-gray-200 uppercase font-bold tracking-wider">
                    {currentOrganization.accountType}
                </span>
            )}
            <p className="text-sm">{currentUser.role === UserRole.OWNER ? 'Gestão Global do Sistema' : currentOrganization?.name || 'Configurações da Clínica'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit overflow-x-auto">
        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
            ${activeTab === 'team' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Users size={18} />
          {currentUser.role === UserRole.OWNER ? 'Contas Ativas' : 'Minha Equipe'}
        </button>

        {currentUser.role === UserRole.OWNER && (
            <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === 'profile' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
            <UserCog size={18} />
            Minha Conta
            </button>
        )}
        
        {canViewDoctors && (
            <button
            onClick={() => setActiveTab('doctors')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === 'doctors' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
            <Stethoscope size={18} />
            Corpo Clínico
            </button>
        )}

        {currentUser.role !== UserRole.OWNER && (
            <>
                <button
                onClick={() => setActiveTab('integrations')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                    ${activeTab === 'integrations' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                <Webhook size={18} />
                Integrações (API)
                </button>
                <button
                onClick={() => setActiveTab('automations')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                    ${activeTab === 'automations' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                <Workflow size={18} />
                Automação
                </button>
            </>
        )}
      </div>

      {/* --- CONTENT --- */}
      
      {activeTab === 'team' && (
          <AdminTeam 
            currentUser={currentUser} 
            users={users} 
            organizations={organizations}
            onUserCreated={loadData}
            onSelectUser={setSelectedUser}
          />
      )}

      {activeTab === 'profile' && (
          <AdminProfile currentUser={currentUser} />
      )}

      {activeTab === 'doctors' && (
          <AdminDoctors 
            currentUser={currentUser}
            doctors={doctors}
            currentOrganization={currentOrganization}
            onDoctorCreated={loadData}
            onDeleteDoctor={(doc) => setDeleteModal({ isOpen: true, user: null, doctor: doc })}
            onConfigureAvailability={setSelectedDoctorForAvailability}
          />
      )}

      {activeTab === 'integrations' && (
          <LockedContent isLocked={isLocked} onUnlockRequest={() => setIsUnlockModalOpen(true)}>
              <AdminIntegrations 
                currentUser={currentUser}
                settings={settings}
                onSettingsSaved={() => {
                    loadSettings(); // Reload to refresh state
                }}
              />
          </LockedContent>
      )}

      {activeTab === 'automations' && (
        <LockedContent isLocked={isLocked} onUnlockRequest={() => setIsUnlockModalOpen(true)}>
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <Automations />
            </div>
        </LockedContent>
      )}

      {/* --- USER DETAIL POP-UP MODAL (Same as previous) --- */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col">
                <div className={`p-6 border-b border-gray-100 flex justify-between items-start bg-gradient-to-br ${
                    selectedUser.role === UserRole.OWNER ? 'from-purple-50 to-white' : 
                    selectedUser.role === UserRole.DOCTOR_ADMIN ? 'from-blue-50 to-white' : 'from-emerald-50 to-white'
                }`}>
                    <div className="flex gap-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl shadow-inner ${
                            selectedUser.role === UserRole.OWNER ? 'bg-purple-100 text-purple-600' : 
                            selectedUser.role === UserRole.DOCTOR_ADMIN ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                            {selectedUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 mt-1">{selectedUser.name}</h3>
                            <div className="flex gap-2 flex-wrap">
                                <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded border mt-1 inline-block ${getRoleColor(selectedUser.role)}`}>
                                    {selectedUser.role === UserRole.DOCTOR_ADMIN ? 'Cliente (Médico)' : selectedUser.role === UserRole.SECRETARY ? 'Secretária' : 'Admin'}
                                </span>
                                {getUserOrg(selectedUser) && (
                                    <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded border mt-1 inline-block bg-gray-100 text-gray-600 border-gray-200">
                                        {getUserOrg(selectedUser)?.accountType}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setSelectedUser(null)} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-600 shadow-sm border border-gray-100">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                    {getUserOrg(selectedUser) && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 mb-2">
                            <h4 className="text-xs font-bold text-blue-800 uppercase flex items-center gap-2 mb-2">
                                <Building2 size={14} /> Detalhes do Contrato
                            </h4>
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Estabelecimento:</span>
                                    <span className="font-bold text-gray-800">{getUserOrg(selectedUser)?.name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Mensalidade (MRR):</span>
                                    <span className="font-bold text-green-600">R$ {getUserOrg(selectedUser)?.subscriptionValue?.toLocaleString('pt-BR') || '0,00'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Limite de Médicos:</span>
                                    <span className="font-bold text-gray-800">{getUserOrg(selectedUser)?.maxDoctors}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Acesso (Login)</label>
                            <div className="flex items-center gap-2 font-medium text-gray-800">
                                <KeyRound size={16} className="text-gray-400" />
                                {selectedUser.username}
                            </div>
                        </div>
                        
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Contato</label>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <Mail size={16} className="text-gray-400" />
                                    {selectedUser.email}
                                </div>
                                {(selectedUser.phone1 || selectedUser.phone2) && (
                                    <div className="flex items-center gap-2 text-sm text-gray-700">
                                        <Phone size={16} className="text-gray-400" />
                                        <span>{selectedUser.phone1} {selectedUser.phone2 ? `/ ${selectedUser.phone2}` : ''}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3">
                    {selectedUser.id !== currentUser.id ? (
                        <>
                            <button 
                                onClick={() => { setNewPassword(''); setResetModal({ isOpen: true, user: selectedUser }); }}
                                className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-medium shadow-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                <RefreshCw size={18} />
                                Resetar Senha
                            </button>
                            <button 
                                onClick={() => setDeleteModal({ isOpen: true, user: selectedUser, doctor: null })}
                                className="flex-1 py-3 bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 rounded-xl font-medium shadow-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                <Trash2 size={18} />
                                Excluir
                            </button>
                        </>
                    ) : (
                        <div className="w-full text-center text-sm text-gray-500 italic py-2">
                            Você não pode excluir sua própria conta aqui.
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteModal.isOpen && (deleteModal.user || deleteModal.doctor) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Excluir Registro?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Esta ação é permanente. Tem certeza que deseja excluir <strong>{deleteModal.user?.name || deleteModal.doctor?.name}</strong>?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteModal({ isOpen: false, user: null, doctor: null })}
                className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                disabled={actionLoading}
                className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex justify-center"
              >
                {actionLoading ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RESET PASSWORD MODAL --- */}
      {resetModal.isOpen && resetModal.user && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Nova Senha</h3>
              <button onClick={() => setResetModal({ isOpen: false, user: null })} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="mb-6">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-200 bg-gray-50 text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Nova senha..."
                autoFocus
              />
            </div>
            <button 
              onClick={confirmReset}
              disabled={!newPassword || actionLoading}
              className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
            >
              {actionLoading ? 'Salvando...' : 'Salvar Senha'}
            </button>
          </div>
        </div>
      )}

      {/* --- FEATURE UNLOCK MODAL --- */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                        <Lock size={32} className="text-purple-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Autorização Necessária</h3>
                    <p className="text-sm text-gray-500 mt-2">
                        Insira a <strong>Senha do Dono / Super-Admin</strong> para desbloquear os recursos avançados.
                    </p>
                </div>

                <form onSubmit={handleUnlockFeatures} className="space-y-4">
                    <input
                        type="password"
                        value={unlockPassword}
                        onChange={(e) => setUnlockPassword(e.target.value)}
                        className="w-full border border-gray-200 bg-white text-center text-gray-900 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder-gray-400"
                        placeholder="Senha do Dono"
                        autoFocus
                    />
                    
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => { setIsUnlockModalOpen(false); setUnlockPassword(''); }}
                            className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!unlockPassword || actionLoading}
                            className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 shadow-md transition-all flex justify-center items-center gap-2 disabled:opacity-70"
                        >
                            {actionLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- AVAILABILITY CONFIG MODAL --- */}
      {selectedDoctorForAvailability && ( 
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-4xl h-[90vh]">
                <DoctorAvailabilityConfig 
                    doctor={selectedDoctorForAvailability} 
                    onClose={() => setSelectedDoctorForAvailability(null)} 
                /> 
            </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
