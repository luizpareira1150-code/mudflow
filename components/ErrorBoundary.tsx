import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Copy, CheckCircle } from 'lucide-react';
import { monitoringService } from '../services/monitoring';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isDetailsOpen: boolean;
  copied: boolean;
  errorId: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    isDetailsOpen: false,
    copied: false,
    // GOVERNANCE: Use crypto.randomUUID() for error tracking ID
    // Fallback for environments where crypto.randomUUID is not available (though it should be in modern browsers)
    errorId: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') 
      ? crypto.randomUUID().slice(0, 8).toUpperCase() 
      : Math.random().toString(36).substring(2, 10).toUpperCase()
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { 
      hasError: true, 
      error, 
      errorInfo: null,
      isDetailsOpen: false,
      copied: false,
      errorId: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID().slice(0, 8).toUpperCase() 
        : Math.random().toString(36).substring(2, 10).toUpperCase()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Integrate with Monitoring Service
    monitoringService.trackError(error, { 
        componentStack: errorInfo.componentStack,
        source: 'ErrorBoundary',
        errorId: this.state.errorId
    });
    
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, isDetailsOpen: false, errorId: '' });
  };

  handleReload = () => {
    window.location.reload();
  };

  copyErrorToClipboard = () => {
    const text = `Error ID: ${this.state.errorId}\nMessage: ${this.state.error?.message}\n\nStack: ${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Header Visual */}
            <div className="bg-red-50 p-8 flex flex-col items-center justify-center border-b border-red-100">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <AlertTriangle size={40} className="text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 text-center">Ops! Algo deu errado.</h1>
              <p className="text-slate-500 text-center mt-2 max-w-xs">
                Não se preocupe, o erro foi reportado automaticamente. Foi apenas uma falha momentânea.
              </p>
            </div>

            {/* Actions */}
            <div className="p-8 space-y-4">
              <button 
                onClick={this.handleReset}
                className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
              >
                <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                Tentar Novamente
              </button>
              
              <button 
                onClick={this.handleReload}
                className="w-full bg-white border border-slate-200 text-slate-600 py-3.5 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                Recarregar Página
              </button>

              {/* Technical Details (Accordion) */}
              <div className="pt-4 border-t border-slate-100 mt-4">
                <button 
                  onClick={() => this.setState((prev) => ({ isDetailsOpen: !prev.isDetailsOpen }))}
                  className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide hover:text-slate-600 transition-colors w-full"
                >
                  {this.state.isDetailsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Detalhes Técnicos (Para Suporte)
                </button>

                {this.state.isDetailsOpen && (
                  <div className="mt-3 bg-slate-50 rounded-lg border border-slate-200 p-4 text-left relative group">
                    <button 
                      onClick={this.copyErrorToClipboard}
                      className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all"
                      title="Copiar erro"
                    >
                      {this.state.copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                    
                    <p className="text-red-600 font-mono text-xs font-bold mb-2 break-words pr-8">
                      {this.state.error?.toString()}
                    </p>
                    <div className="h-32 overflow-y-auto custom-scrollbar">
                      <pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap break-all">
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 text-center border-t border-slate-200">
                <p className="text-xs text-slate-400">
                    ID do Erro: {this.state.errorId}
                </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}