import React, { useState } from 'react';
import { ClinicSettings, User } from '../../types';
import { dataService, authService } from '../../services/mockSupabase';
import { Webhook, Shield, CheckCircle, Copy, RefreshCw, MessageSquare, Eye, EyeOff, Link2, Zap, AlertTriangle, Lock, ShieldCheck } from 'lucide-react';
import { useToast } from '../ToastProvider';
import { generateApiToken } from '../../services/n8nIntegration';

interface AdminIntegrationsProps {
  currentUser: User;
  settings: ClinicSettings;
  onSettingsSaved: () => void;
}

export const AdminIntegrations: React.FC<AdminIntegrationsProps> = ({ currentUser, settings: initialSettings, onSettingsSaved }) => {
  const { showToast } = useToast();
  
  const [settings, setSettings] = useState<ClinicSettings>(initialSettings);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  
  // Security Modal
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityPassword, setSecurityPassword] = useState('');

  const initiateSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityPassword('');
    setIsSecurityModalOpen(true);
  };

  const confirmSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const isValid = await authService.verifyPassword(securityPassword);
        if (!isValid) {
            showToast('error', "Senha incorreta. Acesso negado.");
            return;
        }

        setIsSecurityModalOpen(false);
        setSettingsLoading(true);
        await dataService.updateClinicSettings(settings);
        showToast('success', 'Configurações de integração salvas!');
        onSettingsSaved();
    } catch (error) {
        showToast('error', 'Erro ao salvar configurações.');
    } finally {
        setSettingsLoading(false);
    }
  };

  const handleCopyApiToken = () => {
    if (settings.apiToken) {
        navigator.clipboard.writeText(settings.apiToken);
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
        showToast('success', 'Token de API copiado!');
    }
  };
  
  const handleGenerateToken = () => {
    const newToken = generateApiToken(currentUser.clinicId);
    setSettings({...settings, apiToken: newToken});
    showToast('info', 'Novo token gerado. Clique em Salvar para persistir.');
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
         <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <div className="mb-8">
               <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                   <Webhook size={24} className="text-purple-600" />
                   Configuração de Automação (N8N)
               </h3>
               <p className="text-gray-500 text-sm mt-1">
                   Integração de WhatsApp (Evolution API) e Webhooks.
               </p>
            </div>

            <form onSubmit={initiateSaveSettings} className="space-y-6">
                {/* API Token Section */}
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <h4 className="font-bold text-orange-800 flex items-center gap-2 mb-4 text-sm uppercase tracking-wide">
                        <Shield size={16} /> Token de API (Autenticação)
                    </h4>
                    
                    <p className="text-xs text-orange-700 mb-3">
                        Este token permite que o N8N envie dados DE VOLTA para o sistema (criar agendamentos via WhatsApp, por exemplo).
                    </p>
                    
                    <div className="flex gap-2 mb-3">
                        <input 
                        type="text"
                        value={settings.apiToken || 'Clique em "Gerar Token" para criar'}
                        disabled
                        className="flex-1 border border-orange-200 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm font-mono"
                        />
                        <button
                        type="button"
                        onClick={handleCopyApiToken}
                        disabled={!settings.apiToken}
                        className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Copiar Token"
                        >
                        {tokenCopied ? <CheckCircle size={18} /> : <Copy size={18} />}
                        </button>
                        <button
                        type="button"
                        onClick={handleGenerateToken}
                        className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                        title="Gerar Novo Token"
                        >
                        <RefreshCw size={18} />
                        </button>
                    </div>
                    
                    <div className="bg-white/50 p-3 rounded text-xs text-orange-600 border border-orange-100/50">
                        <strong>⚠️ Segurança:</strong> Não compartilhe este token publicamente. Ele permite que o N8N faça alterações no seu sistema.
                    </div>
                </div>

                {/* Evolution API Section */}
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                    <h4 className="font-bold text-green-800 flex items-center gap-2 mb-4 text-sm uppercase tracking-wide">
                        <MessageSquare size={16} /> Evolution API
                    </h4>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Instance Name</label>
                            <input 
                                type="text"
                                value={settings.evolutionInstanceName || ''}
                                onChange={e => setSettings({...settings, evolutionInstanceName: e.target.value})}
                                placeholder="Ex: clinica_dr_house"
                                className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">API Key (Token)</label>
                            <div className="relative">
                                <input 
                                    type={showApiKey ? "text" : "password"}
                                    value={settings.evolutionApiKey || ''}
                                    onChange={e => setSettings({...settings, evolutionApiKey: e.target.value})}
                                    className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-3 top-2.5 text-gray-400 hover:text-green-600 transition-colors"
                                >
                                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* N8N Section */}
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <h4 className="font-bold text-purple-800 flex items-center gap-2 mb-4 text-sm uppercase tracking-wide">
                        <Link2 size={16} /> Webhook N8N (Saída)
                    </h4>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Webhook URL</label>
                        <input 
                            type="url"
                            value={settings.n8nWebhookUrl || ''}
                            onChange={e => setSettings({...settings, n8nWebhookUrl: e.target.value})}
                            className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                     {/* Toggle Modo de Produção */}
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mt-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                        <h4 className="font-bold text-blue-800 text-sm uppercase tracking-wide flex items-center gap-2">
                            <Zap size={16} /> Modo de Operação
                        </h4>
                        <p className="text-xs text-blue-600 mt-1">
                            {settings.n8nProductionMode 
                            ? 'Webhooks estão sendo enviados REALMENTE para o N8N' 
                            : 'Webhooks estão sendo simulados (apenas logs no console)'}
                        </p>
                        </div>
                        
                        <button
                        type="button"
                        onClick={() => setSettings({...settings, n8nProductionMode: !settings.n8nProductionMode})}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                            settings.n8nProductionMode ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                        >
                        <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                            settings.n8nProductionMode ? 'translate-x-7' : 'translate-x-1'
                            }`}
                        />
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className={`p-2 rounded ${!settings.n8nProductionMode ? 'bg-white border-2 border-blue-400' : 'bg-white/50'}`}>
                        <p className="font-bold text-blue-800">🧪 Desenvolvimento</p>
                        <p className="text-blue-600 text-[10px] mt-1">Logs no console, sem envio real</p>
                        </div>
                        <div className={`p-2 rounded ${settings.n8nProductionMode ? 'bg-white border-2 border-green-400' : 'bg-white/50'}`}>
                        <p className="font-bold text-green-800">🚀 Produção</p>
                        <p className="text-green-600 text-[10px] mt-1">Envia webhooks reais ao N8N</p>
                        </div>
                    </div>
                    
                    {settings.n8nProductionMode && (
                        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 flex items-start gap-2">
                        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                        <span>
                            <strong>Atenção:</strong> Certifique-se de que a URL do webhook está correta e o N8N está configurado antes de ativar o modo produção.
                        </span>
                        </div>
                    )}
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                    <button
                        type="submit"
                        disabled={settingsLoading}
                        className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-black transition-all shadow-lg flex justify-center items-center gap-2"
                    >
                        <Lock size={18} />
                        {settingsLoading ? 'Salvando...' : 'Salvar Configurações'}
                    </button>
                </div>
            </form>
         </div>

         {/* Security Modal */}
         {isSecurityModalOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xs">
                <div className="mb-4 text-center">
                    <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-2">
                        <ShieldCheck size={24} className="text-purple-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Segurança</h3>
                    <p className="text-xs text-gray-500">Digite sua senha para confirmar.</p>
                </div>
                <form onSubmit={confirmSaveSettings} className="space-y-4">
                    <input
                      type="password"
                      value={securityPassword}
                      onChange={(e) => setSecurityPassword(e.target.value)}
                      className="w-full border border-gray-200 bg-white text-center text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="Sua senha"
                      autoFocus
                    />
                    <button 
                        type="submit" 
                        disabled={!securityPassword}
                        className="w-full py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                        Confirmar
                    </button>
                </form>
              </div>
            </div>
          )}
    </div>
  );
};