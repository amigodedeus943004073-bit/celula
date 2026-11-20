import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  Flame,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { addDaysIso, formatDatePt, getTodayIso } from '../lib/cellAnalytics';
import {
  deleteCellChallenge,
  deleteChallengeResponse,
  saveCellChallenge,
  saveChallengeResponse,
  toggleCellChallengeStatus,
} from '../lib/cellService';
import {
  FIELD_LIMITS,
  ROLE_HIERARCHY_ORDER,
  ROLE_LABELS,
  type CellChallenge,
  type CellMember,
  type CellRole,
  type CellWorkspace,
  type ChallengeCategory,
  type ChallengeResponse,
  type ChallengeResponseStatus,
  type RolePermissions,
} from '../types/cell';
import { MemberAvatar } from './MemberAvatar';

interface ChallengeWallSectionProps {
  cell: CellWorkspace;
  currentUid: string;
  currentMember: CellMember | null;
  userName: string;
  effectiveRole: CellRole;
  permissions: RolePermissions;
  members: CellMember[];
  challenges: CellChallenge[];
  challengeResponses: ChallengeResponse[];
}

const CATEGORIES: ChallengeCategory[] = [
  'Leitura Bíblica',
  'Oração & Jejum',
  'Visita & Cuidado',
  'Evangelismo',
  'Serviço',
];

const PRESET_TEMPLATES: Array<{
  label: string;
  title: string;
  category: ChallengeCategory;
  days: number;
  description: string;
}> = [
  {
    label: 'Ler a Bíblia na semana',
    title: 'Ler 1 capítulo dos Evangelhos por dia',
    category: 'Leitura Bíblica',
    days: 7,
    description:
      'Separe 15 minutos diários para ler um capítulo bíblico e compartilhe aqui o versículo que mais falou com você.',
  },
  {
    label: 'Visitar um irmão ou visitante',
    title: 'Visitar ou ligar para um membro da célula',
    category: 'Visita & Cuidado',
    days: 7,
    description:
      'Escolha um irmão ou visitante recente para encorajar, orar junto e fortalecer a comunhão nesta semana.',
  },
  {
    label: 'Semana de Oração & Jejum',
    title: 'Propósito de oração diária pela célula',
    category: 'Oração & Jejum',
    days: 5,
    description:
      'Ore diariamente pelos pedidos da célula, pelas famílias e pelas próximas reuniões do mês.',
  },
  {
    label: 'Convidar alguém para a célula',
    title: 'Convidar um amigo ou familiar para a reunião',
    category: 'Evangelismo',
    days: 7,
    description:
      'Ore por uma pessoa próxima e faça o convite pessoal para participar da nossa próxima célula.',
  },
];

function computeDaysDiff(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const a = new Date(y1, m1 - 1, d1).getTime();
  const b = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((b - a) / 86400000);
}

export function ChallengeWallSection({
  cell,
  currentUid,
  currentMember,
  userName,
  effectiveRole,
  permissions,
  members,
  challenges,
  challengeResponses,
}: ChallengeWallSectionProps) {
  const today = getTodayIso();
  const canManageChallenges = permissions.canPublishMaterials;

  const [filterStatus, setFilterStatus] = useState<'Ativo' | 'Encerrado'>('Ativo');
  const [formOpen, setFormOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] =
    useState<CellChallenge | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] =
    useState<ChallengeCategory>('Leitura Bíblica');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysIso(today, 7));
  const [description, setDescription] = useState('');
  const [savingChallenge, setSavingChallenge] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  // Per-challenge response composer state
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] =
    useState<ChallengeResponseStatus>('Concluído');
  const [responseNote, setResponseNote] = useState('');
  const [savingResponse, setSavingResponse] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [expandedResponsesIds, setExpandedResponsesIds] = useState<string[]>([]);

  const sortedChallenges = useMemo(() => {
    return [...challenges].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'Ativo' ? -1 : 1;
      return b.startDate.localeCompare(a.startDate);
    });
  }, [challenges]);

  const activeCount = useMemo(
    () => challenges.filter((c) => c.status === 'Ativo').length,
    [challenges],
  );
  const closedCount = useMemo(
    () => challenges.filter((c) => c.status === 'Encerrado').length,
    [challenges],
  );

  const visibleChallenges = useMemo(
    () => sortedChallenges.filter((c) => c.status === filterStatus),
    [sortedChallenges, filterStatus],
  );

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  const openCreateForm = () => {
    setEditingChallenge(null);
    setTitle('');
    setCategory('Leitura Bíblica');
    setStartDate(today);
    setEndDate(addDaysIso(today, 7));
    setDescription('');
    setChallengeError(null);
    setFormOpen(true);
  };

  const openEditForm = (challenge: CellChallenge) => {
    setEditingChallenge(challenge);
    setTitle(challenge.title);
    setCategory(challenge.category);
    setStartDate(challenge.startDate);
    setEndDate(challenge.endDate);
    setDescription(challenge.description);
    setChallengeError(null);
    setFormOpen(true);
  };

  const applyTemplate = (tpl: (typeof PRESET_TEMPLATES)[number]) => {
    setTitle(tpl.title);
    setCategory(tpl.category);
    setStartDate(today);
    setEndDate(addDaysIso(today, tpl.days));
    setDescription(tpl.description);
  };

  const handleSaveChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingChallenge(true);
    setChallengeError(null);
    try {
      await saveCellChallenge({
        cell,
        existingChallenge: editingChallenge,
        currentUid,
        authorName: currentMember?.fullName || userName,
        data: {
          title,
          description,
          category,
          startDate,
          endDate,
          status: editingChallenge?.status || 'Ativo',
        },
      });
      setFormOpen(false);
      setFilterStatus('Ativo');
    } catch (err) {
      setChallengeError(
        err instanceof Error ? err.message : 'Erro ao salvar desafio.',
      );
    } finally {
      setSavingChallenge(false);
    }
  };

  const openResponseEditor = (
    challengeId: string,
    myResp?: ChallengeResponse,
  ) => {
    setRespondingId(challengeId);
    setResponseStatus(myResp?.status || 'Concluído');
    setResponseNote(myResp?.note || '');
    setResponseError(null);
  };

  const handleSaveResponse = async (
    e: React.FormEvent,
    challengeId: string,
  ) => {
    e.preventDefault();
    setSavingResponse(true);
    setResponseError(null);
    try {
      await saveChallengeResponse({
        cell,
        challengeId,
        memberUid: currentUid,
        memberId: currentMember?.id || '',
        memberName: currentMember?.fullName || userName,
        memberRole: currentMember?.role || effectiveRole,
        status: responseStatus,
        note: responseNote,
      });
      setRespondingId(null);
    } catch (err) {
      setResponseError(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar sua resposta.',
      );
    } finally {
      setSavingResponse(false);
    }
  };

  const toggleExpandResponses = (challengeId: string) => {
    setExpandedResponsesIds((prev) =>
      prev.includes(challengeId)
        ? prev.filter((id) => id !== challengeId)
        : [...prev, challengeId],
    );
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-teal-700 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Mural de Desafios da Célula
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Metas práticas e espirituais com prazo definido para toda a célula responder.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setFilterStatus('Ativo')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                filterStatus === 'Ativo'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ativos ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('Encerrado')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                filterStatus === 'Encerrado'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Encerrados ({closedCount})
            </button>
          </div>

          {canManageChallenges && (
            <button
              type="button"
              onClick={openCreateForm}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              Novo Desafio
            </button>
          )}
        </div>
      </div>

      {/* Create / Edit Form */}
      {formOpen && canManageChallenges && (
        <form
          onSubmit={handleSaveChallenge}
          className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/70 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {editingChallenge ? 'Editar Desafio' : 'Lançar Novo Desafio'}
            </h3>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
              aria-label="Fechar formulário de desafio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!editingChallenge && (
            <div>
              <div className="text-[11px] font-medium text-slate-600 mb-1.5">
                Sugestões rápidas:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-teal-800 bg-white border border-teal-200 hover:bg-teal-50 rounded-md cursor-pointer whitespace-nowrap"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {challengeError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {challengeError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Título do Desafio *
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.challengeTitle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Ler 1 capítulo da Bíblia por dia"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoria *
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ChallengeCategory)
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Início *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prazo Final *
              </label>
              <input
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Orientação para os Membros *
            </label>
            <textarea
              required
              rows={2}
              maxLength={FIELD_LIMITS.challengeDescription}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explique o que os irmãos devem fazer dentro desse período e o que compartilhar na resposta..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200/70 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingChallenge}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              {savingChallenge
                ? 'Publicando...'
                : editingChallenge
                  ? 'Atualizar Desafio'
                  : 'Publicar no Mural'}
            </button>
          </div>
        </form>
      )}

      {/* Challenges Grid / List */}
      <div className="p-4 sm:p-6">
        {visibleChallenges.length === 0 ? (
          <div className="py-8 text-center">
            <Flame className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-900">
              {filterStatus === 'Ativo'
                ? 'Nenhum desafio ativo no momento'
                : 'Nenhum desafio encerrado ainda'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {canManageChallenges && filterStatus === 'Ativo'
                ? 'Lance um desafio semanal (leitura bíblica, visitas ou oração) para engajar os membros com prazo definido.'
                : 'Quando a liderança publicar novos desafios para a célula, eles aparecerão aqui.'}
            </p>
            {canManageChallenges && filterStatus === 'Ativo' && (
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-4 min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Lançar Primeiro Desafio
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleChallenges.map((c) => {
              const responses = challengeResponses
                .filter((r) => r.challengeId === c.id)
                .sort((a, b) => {
                  if (a.status !== b.status) {
                    return a.status === 'Concluído' ? -1 : 1;
                  }
                  const oA = ROLE_HIERARCHY_ORDER[a.memberRole] ?? 99;
                  const oB = ROLE_HIERARCHY_ORDER[b.memberRole] ?? 99;
                  if (oA !== oB) return oA - oB;
                  return a.memberName.localeCompare(b.memberName);
                });

              const completedCount = responses.filter(
                (r) => r.status === 'Concluído',
              ).length;
              const inProgressCount = responses.filter(
                (r) => r.status === 'Em Andamento',
              ).length;
              const totalMembers = Math.max(members.length, 1);
              const completionPct = Math.min(
                100,
                Math.round((completedCount / totalMembers) * 100),
              );

              const myResponse = responses.find((r) =>
                currentMember
                  ? r.memberId === currentMember.id ||
                    (r.memberUid === currentUid && !r.memberId)
                  : r.memberUid === currentUid,
              );

              const canRespond = c.status === 'Ativo' && today <= c.endDate;
              const isFuture = today < c.startDate;
              const daysLeft = computeDaysDiff(today, c.endDate);
              const deadlineLabel =
                c.status === 'Encerrado'
                  ? 'Encerrado'
                  : isFuture
                    ? `Inicia em ${formatDatePt(c.startDate).slice(0, 5)}`
                    : daysLeft < 0
                      ? 'Prazo encerrado'
                      : daysLeft === 0
                        ? 'Último dia hoje'
                        : daysLeft === 1
                          ? 'Resta 1 dia'
                          : `Restam ${daysLeft} dias`;

              const deadlineTone =
                c.status === 'Encerrado' || daysLeft < 0
                  ? 'text-slate-500'
                  : daysLeft === 0
                    ? 'text-amber-700 font-semibold'
                    : 'text-teal-700 font-semibold';

              const isExpanded = expandedResponsesIds.includes(c.id);
              const isEditingMyResp = respondingId === c.id;
              const canDeleteThisChallenge =
                permissions.canDeletePlanOrReport ||
                (canManageChallenges && c.createdBy === currentUid);

              return (
                <article
                  key={c.id}
                  className="border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4 bg-white"
                >
                  <div className="space-y-3">
                    {/* Unboxed Metadata + Leadership actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 min-w-0">
                        <span className="font-semibold text-slate-800">
                          {c.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatDatePt(c.startDate).slice(0, 5)} a{' '}
                          {formatDatePt(c.endDate).slice(0, 5)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={`tabular-nums ${deadlineTone}`}>
                          {deadlineLabel}
                        </span>
                      </div>

                      {canManageChallenges && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditForm(c)}
                            title="Editar desafio"
                            className="p-1.5 text-slate-400 hover:text-slate-900 rounded cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              toggleCellChallengeStatus(
                                c.id,
                                c.status === 'Ativo' ? 'Encerrado' : 'Ativo',
                              )
                            }
                            className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer whitespace-nowrap"
                          >
                            {c.status === 'Ativo' ? 'Encerrar' : 'Reabrir'}
                          </button>
                          {canDeleteThisChallenge && (
                            <button
                              type="button"
                              onClick={() =>
                                deleteCellChallenge(
                                  c.id,
                                  responses.map((r) => r.id),
                                )
                              }
                              title="Excluir desafio"
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {c.title}
                      </h3>
                      <p className="text-xs sm:text-[13px] text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap">
                        {c.description}
                      </p>
                    </div>

                    {/* Progress bar */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1.5 tabular-nums">
                        <span>
                          <strong className="text-slate-900">
                            {completedCount}
                          </strong>{' '}
                          concluíram
                          {inProgressCount > 0
                            ? ` · ${inProgressCount} em andamento`
                            : ''}{' '}
                          de {members.length} membro(s)
                        </span>
                        <span className="font-mono font-semibold text-teal-700">
                          {completionPct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-700 rounded-full transition-all"
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                    </div>

                    {/* My response summary or inline editor */}
                    {isEditingMyResp ? (
                      <form
                        onSubmit={(e) => handleSaveResponse(e, c.id)}
                        className="border border-teal-200 bg-teal-50/40 rounded-lg p-3 space-y-2.5"
                      >
                        {responseError && (
                          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
                            {responseError}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-800">
                            Seu progresso como {currentMember?.fullName || userName}
                          </span>
                          <div className="inline-flex items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-md">
                            <button
                              type="button"
                              onClick={() => setResponseStatus('Em Andamento')}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer whitespace-nowrap ${
                                responseStatus === 'Em Andamento'
                                  ? 'bg-amber-600 text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Em Andamento
                            </button>
                            <button
                              type="button"
                              onClick={() => setResponseStatus('Concluído')}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer whitespace-nowrap ${
                                responseStatus === 'Concluído'
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Concluído
                            </button>
                          </div>
                        </div>

                        <textarea
                          rows={2}
                          maxLength={FIELD_LIMITS.challengeNote}
                          value={responseNote}
                          onChange={(e) => setResponseNote(e.target.value)}
                          placeholder="Compartilhe brevemente como foi (ex.: versículo lido, irmão visitado, pedido de oração)..."
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                        />

                        <div className="flex items-center justify-end gap-2">
                          {myResponse && (
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteChallengeResponse(myResponse.id);
                                setRespondingId(null);
                              }}
                              className="mr-auto text-[11px] font-medium text-red-600 hover:underline cursor-pointer"
                            >
                              Remover resposta
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setRespondingId(null)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={savingResponse}
                            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            {savingResponse ? 'Salvando...' : 'Salvar Resposta'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        {myResponse ? (
                          <div className="flex items-center gap-1.5 text-xs min-w-0">
                            {myResponse.status === 'Concluído' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            )}
                            <span
                              className={`font-semibold ${
                                myResponse.status === 'Concluído'
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              Você: {myResponse.status}
                            </span>
                            {myResponse.note && (
                              <span className="text-slate-500 truncate max-w-[200px]">
                                — {myResponse.note}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Por {c.authorName}
                          </span>
                        )}

                        {canRespond && (
                          <button
                            type="button"
                            onClick={() => openResponseEditor(c.id, myResponse)}
                            className={`min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                              myResponse
                                ? 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                                : 'text-white bg-teal-700 hover:bg-teal-800'
                            }`}
                          >
                            {myResponse
                              ? 'Atualizar Resposta'
                              : 'Responder Desafio'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Member Responses Accordion */}
                  <div className="pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => toggleExpandResponses(c.id)}
                      className="w-full flex items-center justify-between text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        Respostas dos membros ({responses.length})
                      </span>
                      <span className="text-teal-700 font-semibold">
                        {isExpanded ? 'Ocultar' : 'Ver respostas'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                        {responses.length === 0 ? (
                          <p className="text-xs text-slate-500 py-1">
                            Nenhum membro respondeu a este desafio ainda.
                          </p>
                        ) : (
                          responses.map((resp) => {
                            const matchedMember = resp.memberId
                              ? memberById.get(resp.memberId)
                              : members.find(
                                  (m) =>
                                    m.fullName.toLowerCase() ===
                                    resp.memberName.toLowerCase(),
                                );
                            return (
                              <div
                                key={resp.id}
                                className="flex items-start gap-2.5 py-2 border-b border-slate-100 last:border-b-0 text-xs"
                              >
                                <MemberAvatar
                                  name={resp.memberName}
                                  photoDataUrl={matchedMember?.photoDataUrl}
                                  size="xs"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="font-semibold text-slate-900 truncate">
                                      {resp.memberName}
                                      <span className="font-normal text-slate-500">
                                        {' · '}
                                        {ROLE_LABELS[resp.memberRole] || 'Membro'}
                                      </span>
                                    </span>
                                    <span
                                      className={`font-semibold shrink-0 ${
                                        resp.status === 'Concluído'
                                          ? 'text-emerald-700'
                                          : 'text-amber-700'
                                      }`}
                                    >
                                      {resp.status}
                                    </span>
                                  </div>
                                  {resp.note && (
                                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                                      {resp.note}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
