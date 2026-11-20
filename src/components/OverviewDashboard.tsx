import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  MessageCircle,
  Plus,
  Trash2,
  UserRoundPen,
  Users,
} from 'lucide-react';
import {
  formatDatePt,
  formatMonthLabelPt,
  getMonthKey,
  getTodayIso,
  type ProgressMetrics,
} from '../lib/cellAnalytics';
import {
  createManualReminder,
  deleteNotificationRecord,
  markNotificationRead,
} from '../lib/cellService';
import {
  MAX_FILHINHOS_PER_MENTOR,
  MAX_TRAINERS_PER_CELL,
  ROLE_LABELS,
  type AutoReminder,
  type CellChallenge,
  type CellMember,
  type CellNotification,
  type CellRole,
  type CellWorkspace,
  type ChallengeResponse,
  type MonthlyPlan,
  type NotificationType,
  type RolePermissions,
} from '../types/cell';
import { ChallengeWallSection } from './ChallengeWallSection';
import { MemberAvatar } from './MemberAvatar';
import type { NavSection } from './Sidebar';

interface OverviewDashboardProps {
  cell: CellWorkspace;
  currentUid: string;
  currentMember: CellMember | null;
  userName: string;
  effectiveRole: CellRole;
  permissions: RolePermissions;
  members: CellMember[];
  plans: MonthlyPlan[];
  notifications: CellNotification[];
  autoAlerts: AutoReminder[];
  progressMetrics: ProgressMetrics;
  challenges: CellChallenge[];
  challengeResponses: ChallengeResponse[];
  onNavigate: (
    section: NavSection,
    extra?: { tab?: 'mes' | 'semana' | 'progresso'; planId?: string },
  ) => void;
}

export function OverviewDashboard({
  cell,
  currentUid,
  currentMember,
  userName,
  effectiveRole,
  permissions,
  members,
  plans,
  notifications,
  autoAlerts,
  progressMetrics,
  challenges,
  challengeResponses,
  onNavigate,
}: OverviewDashboardProps) {
  const today = getTodayIso();
  const currentMonthKey = getMonthKey(today);

  const [showNewReminder, setShowNewReminder] = useState(false);
  const [remTitle, setRemTitle] = useState('');
  const [remMessage, setRemMessage] = useState('');
  const [remDueDate, setRemDueDate] = useState(today);
  const [remType, setRemType] = useState<NotificationType>('lembrete_manual');
  const [savingReminder, setSavingReminder] = useState(false);
  const [dismissedAutoIds, setDismissedAutoIds] = useState<string[]>([]);

  const upcomingPlan = useMemo(
    () =>
      [...plans]
        .filter((p) => p.status === 'Planejada' && p.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0],
    [plans, today],
  );

  const activeAutoAlerts = autoAlerts.filter(
    (a) => !dismissedAutoIds.includes(a.id),
  );
  const unreadNotifs = notifications.filter(
    (n) => !n.readByUids.includes(currentUid),
  );
  const totalPendingAlerts = activeAutoAlerts.length + unreadNotifs.length;

  const leaderMember = useMemo(
    () => members.find((m) => m.role === 'lider') || null,
    [members],
  );
  const trainers = useMemo(
    () =>
      members
        .filter((m) => m.role === 'lider_treinamento')
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [members],
  );
  const filhinhosCount = useMemo(
    () => members.filter((m) => m.role === 'filhinho').length,
    [members],
  );
  const baptizedCount = useMemo(
    () => members.filter((m) => m.baptismStatus === 'Batizado').length,
    [members],
  );

  const memberByName = useMemo(() => {
    const map = new Map<string, CellMember>();
    for (const m of members) {
      map.set(m.fullName.trim().toLowerCase(), m);
    }
    return map;
  }, [members]);

  const activeChallengesCount = useMemo(
    () => challenges.filter((c) => c.status === 'Ativo').length,
    [challenges],
  );
  const activeChallengeCompletedResponses = useMemo(() => {
    const activeIds = new Set(
      challenges.filter((c) => c.status === 'Ativo').map((c) => c.id),
    );
    return challengeResponses.filter((r) => activeIds.has(r.challengeId)).length;
  }, [challenges, challengeResponses]);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim() || !remMessage.trim()) return;
    setSavingReminder(true);
    try {
      await createManualReminder({
        cell,
        currentUid,
        data: {
          type: remType,
          title: remTitle,
          message: remMessage,
          dueDate: remDueDate,
        },
      });
      setRemTitle('');
      setRemMessage('');
      setShowNewReminder(false);
    } finally {
      setSavingReminder(false);
    }
  };

  const renderPersonWithAvatar = (nameValue: string | undefined, fallback: string, isPendingHighlight = false) => {
    const cleanName = (nameValue || '').trim();
    const matched = cleanName ? memberByName.get(cleanName.toLowerCase()) : undefined;
    if (!cleanName) {
      return (
        <span className={isPendingHighlight ? 'text-amber-700' : 'text-slate-500'}>
          {fallback}
        </span>
      );
    }
    return (
      <div className="flex items-center gap-2 min-w-0 mt-0.5">
        <MemberAvatar
          name={cleanName}
          photoDataUrl={matched?.photoDataUrl}
          size="xs"
        />
        <span className="font-semibold text-slate-900 truncate">
          {cleanName}
        </span>
      </div>
    );
  };

  const displayName = currentMember?.fullName || userName;
  const firstName = displayName.split(/\s+/)[0] || displayName;

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Welcome & Cell Identity Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <MemberAvatar
              name={displayName}
              photoDataUrl={currentMember?.photoDataUrl}
              size="lg"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-0.5">
                <span className="font-semibold text-teal-700">{cell.name}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {cell.meetingDay} às {cell.meetingTime}
                </span>
                {cell.location && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate max-w-[220px]">{cell.location}</span>
                  </>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                Olá, {firstName}
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                {ROLE_LABELS[effectiveRole] || 'Membro'}
                {currentMember ? ` · Ala ${currentMember.wing || 'Masculina'}` : ''}
                {' · '}
                <span className="tabular-nums">{members.length} integrante(s)</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
            {permissions.canViewOwnFicha && (
              <button
                type="button"
                onClick={() => onNavigate('ficha')}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <UserRoundPen className="w-4 h-4 shrink-0" />
                Minha Ficha
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4 text-teal-700 shrink-0" />
              Bate-Papo
            </button>
            {permissions.canCreateManualReminders && (
              <button
                type="button"
                onClick={() => setShowNewReminder((v) => !v)}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Novo Lembrete
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('planning', { tab: 'mes' })}
              className="col-span-2 sm:col-span-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Planificação e Progresso
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </section>

      {/* 2x2 Mobile / 4-Column Desktop KPI Strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="text-[11px] sm:text-xs font-medium text-slate-500">
              Frequência Média ({formatMonthLabelPt(currentMonthKey).split(' ')[0]})
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1.5">
              {progressMetrics.avgAttendanceRate}%
            </div>
          </div>
          <div className="mt-2.5">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-700 rounded-full transition-all"
                style={{ width: `${progressMetrics.avgAttendanceRate}%` }}
              />
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 mt-1.5 tabular-nums truncate">
              {progressMetrics.avgPresentCount} pres. · {progressMetrics.totalVisitors} vis.
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="text-[11px] sm:text-xs font-medium text-slate-500">
              Reuniões no Mês
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1.5">
              {progressMetrics.completedCount} / {progressMetrics.plannedCount}
            </div>
          </div>
          <div className="mt-2.5">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${progressMetrics.completionRate}%` }}
              />
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 mt-1.5 tabular-nums truncate">
              {progressMetrics.completionRate}% concluído
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="text-[11px] sm:text-xs font-medium text-slate-500">
              Desafios Ativos
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1.5">
              {activeChallengesCount}
            </div>
          </div>
          <div className="text-[11px] sm:text-xs text-slate-500 mt-2 tabular-nums">
            {activeChallengeCompletedResponses} resposta(s) enviada(s)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="text-[11px] sm:text-xs font-medium text-slate-500">
              Lembretes Pendentes
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold tabular-nums mt-1.5 ${
                totalPendingAlerts > 0 ? 'text-amber-600' : 'text-emerald-700'
              }`}
            >
              {totalPendingAlerts}
            </div>
          </div>
          <div className="text-[11px] sm:text-xs text-slate-500 mt-2">
            {totalPendingAlerts > 0
              ? 'Escalas ou reuniões pendentes'
              : 'Tudo em dia na célula'}
          </div>
        </div>
      </div>

      {showNewReminder && permissions.canCreateManualReminders && (
        <form
          onSubmit={handleCreateReminder}
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Criar Lembrete para a Célula
            </h2>
            <button
              type="button"
              onClick={() => setShowNewReminder(false)}
              className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Fechar
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Título do Lembrete
              </label>
              <input
                type="text"
                required
                maxLength={140}
                value={remTitle}
                onChange={(e) => setRemTitle(e.target.value)}
                placeholder="Ex.: Confirmar lanche e louvor de quinta-feira"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Data Alvo
              </label>
              <input
                type="date"
                required
                value={remDueDate}
                onChange={(e) => setRemDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mensagem
              </label>
              <input
                type="text"
                required
                maxLength={500}
                value={remMessage}
                onChange={(e) => setRemMessage(e.target.value)}
                placeholder="Detalhes do aviso para os membros e líderes em treinamento"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tipo
              </label>
              <select
                value={remType}
                onChange={(e) => setRemType(e.target.value as NotificationType)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                <option value="lembrete_manual">Lembrete Geral</option>
                <option value="reuniao_pendente">Reunião Pendente</option>
                <option value="escala_incompleta">Escala / Organização</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingReminder}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              {savingReminder ? 'Publicando...' : 'Publicar Lembrete'}
            </button>
          </div>
        </form>
      )}

      {/* Mural de Desafios da Célula */}
      <ChallengeWallSection
        cell={cell}
        currentUid={currentUid}
        currentMember={currentMember}
        userName={userName}
        effectiveRole={effectiveRole}
        permissions={permissions}
        members={members}
        challenges={challenges}
        challengeResponses={challengeResponses}
      />

      {/* Main 2-column grid: Notifications + Next Meeting & Hierarchy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Automatic Notifications & Pending Reminders */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Bell className="w-4 h-4 text-teal-700 shrink-0" />
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                Notificações Automáticas e Lembretes
              </h2>
            </div>
            <span className="text-xs text-slate-500 tabular-nums shrink-0">
              {totalPendingAlerts} pendente(s)
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {activeAutoAlerts.length === 0 && notifications.length === 0 && (
              <div className="p-6 sm:p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-900">
                  Nenhuma pendência imediata
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Novos avisos aparecerão automaticamente quando houver reuniões próximas, escalas incompletas ou relatórios pendentes.
                </p>
              </div>
            )}

            {activeAutoAlerts.map((alert) => (
              <div
                key={alert.id}
                className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {alert.severity === 'alta' ? (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-0.5">
                      <span
                        className={
                          alert.severity === 'alta'
                            ? 'font-semibold text-red-700'
                            : 'font-semibold text-amber-700'
                        }
                      >
                        {alert.severity === 'alta'
                          ? 'Atenção'
                          : 'Lembrete Automático'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {formatDatePt(alert.dueDate)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {alert.title}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      {alert.message}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 shrink-0 pl-7 sm:pl-0">
                  {alert.actionView &&
                    (permissions.canRecordAttendance ||
                      (alert.actionView !== 'attendance' &&
                        alert.actionView !== 'members')) && (
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate(alert.actionView!, {
                            planId: alert.relatedPlanId,
                            tab:
                              alert.actionView === 'planning'
                                ? 'semana'
                                : undefined,
                          })
                        }
                        className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 sm:bg-transparent hover:bg-teal-50 rounded-md cursor-pointer whitespace-nowrap"
                      >
                        Ver
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() =>
                      setDismissedAutoIds((prev) => [...prev, alert.id])
                    }
                    title="Ocultar aviso nesta sessão"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {notifications.map((notif) => {
              const isRead = notif.readByUids.includes(currentUid);
              return (
                <div
                  key={notif.id}
                  className={`px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                    isRead ? 'opacity-65' : 'bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
                      <span className="font-medium text-slate-700">
                        {isRead ? 'Lido' : 'Aviso da Célula'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {formatDatePt(notif.dueDate)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {notif.message}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 shrink-0">
                    {!isRead && permissions.canCreateManualReminders && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(notif, currentUid)}
                        className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded-md cursor-pointer whitespace-nowrap"
                      >
                        Marcar lido
                      </button>
                    )}
                    {permissions.canDeletePlanOrReport && (
                      <button
                        type="button"
                        onClick={() => deleteNotificationRecord(notif.id)}
                        title="Excluir lembrete"
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Next meeting + Cell Hierarchy */}
        <div className="lg:col-span-5 space-y-5 sm:space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
                <h2 className="text-base font-semibold text-slate-900">
                  Próxima Reunião Planejada
                </h2>
              </div>
              {upcomingPlan && (
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {formatDatePt(upcomingPlan.date)} · {upcomingPlan.time}
                </span>
              )}
            </div>

            {upcomingPlan ? (
              <div>
                {upcomingPlan.eventType &&
                  upcomingPlan.eventType !== 'Reunião de Célula' && (
                    <div className="text-xs font-semibold text-teal-700 mb-1">
                      {upcomingPlan.eventType} (Data isolada)
                    </div>
                  )}
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {upcomingPlan.lessonTitle}
                </h3>
                {upcomingPlan.lessonReference && (
                  <p className="text-xs text-slate-500 mb-4">
                    Referência: {upcomingPlan.lessonReference}
                  </p>
                )}

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 py-4 border-y border-slate-100 text-xs">
                  <div>
                    <dt className="text-slate-500">Dirigente</dt>
                    <dd>{renderPersonWithAvatar(upcomingPlan.responsibleName, 'A definir')}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Louvor</dt>
                    <dd>{renderPersonWithAvatar(upcomingPlan.worshipName, 'A definir')}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Quebra-gelo</dt>
                    <dd>{renderPersonWithAvatar(upcomingPlan.icebreakerName, 'A definir')}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Lanche</dt>
                    <dd>{renderPersonWithAvatar(upcomingPlan.snackName, 'Pendente definir', true)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Ministração</dt>
                    <dd>{renderPersonWithAvatar(upcomingPlan.preacherName, 'A definir')}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Oração</dt>
                    <dd>{renderPersonWithAvatar(upcomingPlan.prayerName, 'A definir')}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
                  {permissions.canRecordAttendance && (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate('attendance', { planId: upcomingPlan.id })
                      }
                      className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Registrar Frequência e Relatório
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate('planning', { tab: 'mes' })}
                    className="min-h-[42px] px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 sm:bg-transparent hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Abrir Calendário
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4">
                <p className="text-sm text-slate-600 mb-3">
                  Nenhuma reunião futura planejada no calendário mensal.
                </p>
                {permissions.canEditMonthlyPlan && (
                  <button
                    type="button"
                    onClick={() => onNavigate('planning', { tab: 'mes' })}
                    className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                  >
                    Planejar Reuniões do Mês
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Hierarquia da Célula */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-700 shrink-0" />
                <h2 className="text-base font-semibold text-slate-900">
                  Hierarquia da Célula
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('organogram')}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer whitespace-nowrap"
                >
                  Organograma
                </button>
                {permissions.canManageAllMembers && (
                  <button
                    type="button"
                    onClick={() => onNavigate('members')}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                  >
                    Gerir acessos
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {/* 1. Líder da Célula */}
              <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MemberAvatar
                    name={leaderMember?.fullName || 'Líder da Célula'}
                    photoDataUrl={leaderMember?.photoDataUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {leaderMember?.fullName || 'Líder não atribuído'}
                    </div>
                    <div className="text-[11px] text-teal-700 font-medium">
                      Líder da Célula
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                  {trainers.length}/{MAX_TRAINERS_PER_CELL} líderes
                </span>
              </div>

              {/* 2. Líderes em Treinamento logo após o Líder */}
              {trainers.length === 0 ? (
                <p className="text-xs text-slate-500 py-1">
                  Nenhum Líder em Treinamento selecionado no organograma.
                </p>
              ) : (
                <div className="space-y-2">
                  {trainers.map((t) => {
                    const count = members.filter(
                      (m) => m.role === 'filhinho' && m.mentorId === t.id,
                    ).length;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 py-1.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <MemberAvatar
                            name={t.fullName}
                            photoDataUrl={t.photoDataUrl}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {t.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Líder em Treinamento · Ala {t.wing || 'Masculina'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-slate-600 shrink-0">
                          {count}/{MAX_FILHINHOS_PER_MENTOR} filhinhos
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Total de Filhinhos</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {filhinhosCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Total de Batizados</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {baptizedCount} de {members.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
