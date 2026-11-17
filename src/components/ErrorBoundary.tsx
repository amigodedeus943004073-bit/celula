import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  isQuotaError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
    isQuotaError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    const raw = error.message || 'Erro inesperado na aplicação.';
    let friendly = raw;
    let isQuotaError = false;

    if (raw.includes('Quota exceeded')) {
      isQuotaError = true;
      friendly =
        'O limite diário gratuito de operações do banco de dados foi atingido. A cota é redefinida no dia seguinte.';
    } else {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.error === 'string') {
          friendly = `Operação bloqueada (${parsed.operationType} em ${parsed.path || 'coleção'}): ${parsed.error}`;
        }
      } catch {
        // Not JSON
      }
    }

    return { hasError: true, errorMessage: friendly, isQuotaError };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou erro:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '', isQuotaError: false });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-xl font-semibold text-slate-900">
                Não foi possível concluir a ação
              </h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              {this.state.errorMessage}
            </p>
            {this.state.isQuotaError && (
              <p className="text-xs text-slate-500 mb-6">
                Consulte os limites do plano Spark (Enterprise Edition) na documentação oficial do Firebase Firestore.
              </p>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
