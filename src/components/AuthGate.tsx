import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { signInMemberByName } from '../lib/cellService';
import { auth, googleProvider } from '../lib/firebase';

export function AuthGate() {
  const [loginMode, setLoginMode] = useState<'name' | 'google'>('name');
  const [accessCode, setAccessCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [anonDisabledHelp, setAnonDisabledHelp] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    setAnonDisabledHelp(false);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Falha ao autenticar com o Google.';
      setErrorMsg(
        msg.includes('popup-closed-by-user')
          ? 'A janela de login foi fechada antes da conclusão.'
          : 'Não foi possível entrar com sua conta Google. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNameSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setAnonDisabledHelp(false);
    try {
      await signInMemberByName(accessCode, fullName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao entrar.';
      if (msg === 'ANON_AUTH_DISABLED') {
        setAnonDisabledHelp(true);
        setErrorMsg(
          'O login sem e-mail (provedor Anônimo) ainda precisa ser ativado pelo Líder no Console do Firebase.',
        );
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row items-stretch">
      <div className="flex-1 flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-white border-b lg:border-b-0 lg:border-r border-slate-200">
        <div>
          <div className="text-xl font-bold tracking-tight text-slate-900">
            Célula Viva
          </div>
        </div>

        <div className="max-w-xl my-10">
          <p className="text-xs font-medium text-teal-700 mb-3">
            Gestão de Célula · Organograma e Produtividade
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight mb-4">
            Acesso para toda a célula, com organograma e planificação.
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
            Membros pré-cadastrados entram apenas com o <strong>Código da Ficha</strong> gerado pelo Líder (sem e-mail) para visualizar a <strong>Visão Geral</strong>, <strong>Planificação</strong> e <strong>Progresso</strong> em modo somente leitura.
          </p>

          {/* Login Mode Tabs */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setLoginMode('name');
                setErrorMsg(null);
                setAnonDisabledHelp(false);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                loginMode === 'name'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Entrar com Nome (Membros)
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('google');
                setErrorMsg(null);
                setAnonDisabledHelp(false);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                loginMode === 'google'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Acesso Liderança (Google)
            </button>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mb-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 space-y-2"
            >
              <p className="font-medium">{errorMsg}</p>
              {anonDisabledHelp && (
                <div className="pt-2 border-t border-red-200 text-slate-700 space-y-1">
                  <p className="font-semibold">
                    Como ativar o acesso por Nome (1 minuto):
                  </p>
                  <ol className="list-decimal pl-4 space-y-0.5">
                    <li>
                      Abra o painel{' '}
                      <a
                        href="https://console.firebase.google.com/project/generated-proton-0lkcn/authentication/providers"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-teal-700 font-semibold underline"
                      >
                        Authentication → Sign-in method
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>Clique em <strong>Adicionar novo provedor</strong> → <strong>Anônimo (Anonymous)</strong>.</li>
                    <li>Ative a chave e clique em <strong>Salvar</strong>.</li>
                  </ol>
                  <p className="text-[11px] text-slate-500 pt-1">
                    Alternativa imediata: o Líder pode entrar com Google e usar o botão &ldquo;Acesso por Nome&rdquo; dentro do painel para o membro preencher sua ficha no mesmo dispositivo.
                  </p>
                </div>
              )}
            </div>
          )}

          {loginMode === 'name' ? (
            <form onSubmit={handleNameSignIn} className="space-y-3 max-w-md mb-8">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Código de Acesso Gerado na Ficha *
                </label>
                <input
                  type="text"
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="Ex.: MARI-4821"
                  className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Seu Nome Completo (opcional ao usar o código da ficha)
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex.: Mariana Costa"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <UserCheck className="w-4 h-4" />
                {loading ? 'Verificando código...' : 'Entrar para Visualizar'}
              </button>
            </form>
          ) : (
            <div className="mb-8">
              <p className="text-xs text-slate-500 mb-3">
                Para o Líder da Célula e equipe autorizada com conta Google gerenciarem o organograma, fichas de cadastro e planificação.
              </p>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="inline-flex items-center justify-center gap-3 px-6 py-3.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-4 h-4" />
                {loading ? 'Conectando...' : 'Entrar com conta Google'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-200">
            <div className="flex items-start gap-3">
              <CalendarDays className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Mês para Semana
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Escalas completas e lembretes integrados para todos.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Organograma e Alas
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Líder, Líderes em Treinamento, Secretário, Anfitrião, Filhinhos, Visitantes e Ala Feminina.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Acesso Seguro por Código
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Ao criar a ficha, um código é gerado para o membro apenas visualizar.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Estudos e Progresso
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Materiais compartilhados e relatórios automáticos após cada reunião.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          O acesso de membros é somente leitura; alterações cadastrais são feitas pelo Líder.
        </div>
      </div>

      <div className="lg:w-[44%] relative bg-slate-900 min-h-[280px] lg:min-h-screen overflow-hidden">
        {!imgFailed ? (
          <img
            src="/src/assets/images/cell_fellowship_study_1794944490517.jpg"
            alt="Mesa preparada para reunião de célula com caderno de estudos"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 via-teal-950 to-slate-900 flex items-center justify-center p-12">
            <BookOpen className="w-16 h-16 text-teal-400 opacity-70" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent flex flex-col justify-end p-8 sm:p-12">
          <p className="text-xs font-medium text-teal-300 mb-2">
            Comunhão · Organograma · Discipulado
          </p>
          <p className="text-lg sm:text-xl font-medium text-white max-w-md leading-snug">
            Cada integrante conectado ao painel da célula, com funções claras e acompanhamento próximo.
          </p>
        </div>
      </div>
    </div>
  );
}
