import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  UserRoundPen,
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
  type AutoReminder,
  type CellMember,
  type CellNotification,
  type CellWorkspace,
  type MonthlyPlan,
  type NotificationType,
  type RolePermissions,
} from '../types/cell';
import type { NavSection } from './Sidebar';

interface OverviewDashboardProps {
  cell: CellWorkspace;
  currentUid: string;
  permissions: RolePermissions;
  members: CellMember[];
  plans: MonthlyPlan[];
  notifications: CellNotification[];
  autoAlerts: AutoReminder[];
  progressMetrics: ProgressMetrics;
  onNavigate: (section: NavSection, extra?: { tab?: 'mes' | 'semana' | 'progresso'; planId?: string }) => void;
}

export function OverviewDashboard({
  cell,
  currentUid,
  permissions,
  members,
  plans,
  notifications,
  autoAlerts,
  progressMetrics,
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

  const upcomingPlan = [...plans]
    .filter((p) => p.status === 'Planejada' && p.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const activeAutoAlerts = autoAlerts.filter(
    (a) => !dismissedAutoIds.includes(a.id),
  );
  const unreadNotifs = notifications.filter(
    (n) => !n.readByUids.includes(currentUid),
  );
  const totalPendingAlerts = activeAutoAlerts.length + unreadNotifs.length;

  const trainersCount = members.filter(
    (m) => m.role === 'lider_treinamento',
  ).length;
  const filhinhosCount = members.filter((m) => m.role === 'filhinho').length;

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

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header summary */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-teal-700 mb-1 truncate">
            {cell.meetingDay} · {cell.meetingTime}
            {cell.location ? ` · ${cell.location}` : ''}
          </p>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Painel de Produtividade e Lembretes
          </h1>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
          {permissions.canViewOwnFicha && (
            <button
              type="button"
              onClick={() => onNavigate('ficha')}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <UserRoundPen className="w-4 h-4 shrink-0" />
              Minha Ficha
            </button>
          )}
          {permissions.canCreateManualReminders && (
            <button
              type="button"
              onClick={() => setShowNewReminder((v) => !v)}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              Novo Lembrete
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('planning', { tab: 'semana' })}
            className="col-span-2 sm:col-span-1 min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            Ver Planificação e Progresso
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>

      {/* 2x2 mobile / 4-column desktop KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="text-[11px] sm:text-xs font-medium text-slate-500">
              Frequência Média ({formatMonthLabelPt(currentMonthKey).split(' ')[0]})
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1.5 sm:mt-2">
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
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1.5 sm:mt-2">
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
              Membros e Liderança
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-1.5 sm:mt-2">
              {members.length}
            </div>
          </div>
          <div className="text-[11px] sm:text-xs text-slate-500 mt-2 tabular-nums">
            {trainersCount}/{MAX_TRAINERS_PER_CELL} treinando · {filhinhosCount} filhinhos
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="text-[11px] sm:text-xs font-medium text-slate-500">
              Lembretes Pendentes
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold tabular-nums mt-1.5 sm:mt-2 ${
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
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
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

      {/* Main 2-column grid */}
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
                        {alert.severity === 'alta' ? 'Atenção' : 'Lembrete Automático'}
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

        {/* Right column: Next meeting + Leadership hierarchy */}
        <div className="lg:col-span-5 space-y-5 sm:space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-700" />
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
                    <dd className="font-semibold text-slate-900 mt-0.5">
                      {upcomingPlan.responsibleName || 'A definir'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Louvor</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">
                      {upcomingPlan.worshipName || 'A definir'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Quebra-gelo</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">
                      {upcomingPlan.icebreakerName || 'A definir'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Lanche</dt>
                    <dd
                      className={`font-semibold mt-0.5 ${
                        upcomingPlan.snackName
                          ? 'text-slate-900'
                          : 'text-amber-700'
                      }`}
                    >
                      {upcomingPlan.snackName || 'Pendente definir'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Ministração</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">
                      {upcomingPlan.preacherName || 'A definir'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Oração</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">
                      {upcomingPlan.prayerName || 'A definir'}
                    </dd>
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

          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Estrutura de Discipulado
              </h2>
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
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Líderes em Treinamento</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {trainersCount} / {MAX_TRAINERS_PER_CELL} vagas
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Limite de Filhinhos por Mentor</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  máx. {MAX_FILHINHOS_PER_MENTOR} por líder
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600">Total de Batizados</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {members.filter((m) => m.baptismStatus === 'Batizado').length} de{' '}
                  {members.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
