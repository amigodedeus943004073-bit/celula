import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Edit3,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  computeMissingRoles,
  computeProgressMetrics,
  formatDatePt,
  formatMonthLabelPt,
  getMonthKey,
  getTodayIso,
  getWeeksInMonth,
} from '../lib/cellAnalytics';
import { deleteMonthlyPlan, saveMonthlyPlan } from '../lib/cellService';
import {
  ROLE_LABELS,
  type CellMember,
  type CellRole,
  type CellWorkspace,
  type MeetingReport,
  type MonthlyPlan,
  type PlanStatus,
  type RolePermissions,
} from '../types/cell';

interface PlanningWorkspaceProps {
  cell: CellWorkspace;
  currentUid: string;
  permissions: RolePermissions;
  members: CellMember[];
  plans: MonthlyPlan[];
  reports: MeetingReport[];
  activeTab: 'mes' | 'semana' | 'progresso';
  onChangeTab: (tab: 'mes' | 'semana' | 'progresso') => void;
  onStartAttendanceFromPlan: (plan: MonthlyPlan) => void;
}

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function PlanningWorkspace({
  cell,
  currentUid,
  permissions,
  members,
  plans,
  reports,
  activeTab,
  onChangeTab,
  onStartAttendanceFromPlan,
}: PlanningWorkspaceProps) {
  const today = getTodayIso();
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonthKey(today));
  const weeksInMonth = useMemo(
    () => getWeeksInMonth(selectedMonth),
    [selectedMonth],
  );

  const defaultWeekIndex = useMemo(() => {
    const found = weeksInMonth.findIndex(
      (w) => today >= w.start && today <= w.end,
    );
    return found >= 0 ? found : 0;
  }, [weeksInMonth, today]);

  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(
    defaultWeekIndex + 1,
  );

  // Modal state for Monthly Plan Create/Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MonthlyPlan | null>(null);
  const [formDate, setFormDate] = useState(today);
  const [formTime, setFormTime] = useState(cell.meetingTime || '19:30');
  const [formLesson, setFormLesson] = useState('');
  const [formRef, setFormRef] = useState('');
  const [formResponsible, setFormResponsible] = useState('');
  const [formPreacher, setFormPreacher] = useState('');
  const [formWorship, setFormWorship] = useState('');
  const [formSnack, setFormSnack] = useState('');
  const [formIcebreaker, setFormIcebreaker] = useState('');
  const [formPrayer, setFormPrayer] = useState('');
  const [formLocation, setFormLocation] = useState(cell.location || '');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<PlanStatus>('Planejada');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const memberNames = useMemo(
    () => members.map((m) => m.fullName).sort((a, b) => a.localeCompare(b)),
    [members],
  );

  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const dt = new Date(y, m - 1 + delta, 1);
    const nextKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextKey);
    setSelectedWeekNumber(1);
  };

  const monthPlans = useMemo(
    () =>
      plans
        .filter((p) => p.monthKey === selectedMonth)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [plans, selectedMonth],
  );

  const selectedWeekObj =
    weeksInMonth.find((w) => w.weekNumber === selectedWeekNumber) ||
    weeksInMonth[0];

  const weeklyDerivedPlans = useMemo(() => {
    if (!selectedWeekObj) return [];
    return monthPlans.filter(
      (p) => p.date >= selectedWeekObj.start && p.date <= selectedWeekObj.end,
    );
  }, [monthPlans, selectedWeekObj]);

  const progressMetrics = useMemo(
    () => computeProgressMetrics(selectedMonth, plans, reports, members),
    [selectedMonth, plans, reports, members],
  );

  // Calendar matrix for selectedMonth
  const calendarDays = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const cells: Array<{
      dateIso: string | null;
      dayNum: number | null;
      dayPlans: MonthlyPlan[];
    }> = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push({ dateIso: null, dayNum: null, dayPlans: [] });
    }
    for (let d = 1; d <= totalDays; d += 1) {
      const dateIso = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      cells.push({
        dateIso,
        dayNum: d,
        dayPlans: monthPlans.filter((p) => p.date === dateIso),
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ dateIso: null, dayNum: null, dayPlans: [] });
    }
    return cells;
  }, [selectedMonth, monthPlans]);

  const openCreateModal = (presetDate?: string) => {
    setEditingPlan(null);
    setFormDate(
      presetDate ||
        (selectedMonth === getMonthKey(today) ? today : `${selectedMonth}-01`),
    );
    setFormTime(cell.meetingTime || '19:30');
    setFormLesson('');
    setFormRef('');
    setFormResponsible(memberNames[0] || '');
    setFormPreacher(memberNames[0] || '');
    setFormWorship('');
    setFormSnack('');
    setFormIcebreaker('');
    setFormPrayer('');
    setFormLocation(cell.location || '');
    setFormNotes('');
    setFormStatus('Planejada');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (plan: MonthlyPlan) => {
    setEditingPlan(plan);
    setFormDate(plan.date);
    setFormTime(plan.time);
    setFormLesson(plan.lessonTitle);
    setFormRef(plan.lessonReference || '');
    setFormResponsible(plan.responsibleName);
    setFormPreacher(plan.preacherName || '');
    setFormWorship(plan.worshipName || '');
    setFormSnack(plan.snackName || '');
    setFormIcebreaker(plan.icebreakerName || '');
    setFormPrayer(plan.prayerName || '');
    setFormLocation(plan.location || '');
    setFormNotes(plan.notes || '');
    setFormStatus(plan.status);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formLesson.trim().length < 2 || !formResponsible.trim()) {
      setFormError('Informe a lição e o responsável pela reunião.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await saveMonthlyPlan({
        cell,
        existingPlan: editingPlan,
        currentUid,
        data: {
          date: formDate,
          time: formTime,
          lessonTitle: formLesson,
          lessonReference: formRef,
          responsibleName: formResponsible,
          preacherName: formPreacher,
          worshipName: formWorship,
          snackName: formSnack,
          icebreakerName: formIcebreaker,
          prayerName: formPrayer,
          location: formLocation,
          notes: formNotes,
          status: formStatus,
        },
      });
      setSelectedMonth(getMonthKey(formDate));
      setModalOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Erro ao salvar planificação.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Month Navigator */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Planificação e Progresso
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Calendário mensal integrado, agenda semanal automática e evolução após cada evento registrado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Mês anterior"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-semibold text-slate-900 whitespace-nowrap min-w-[160px] text-center">
              {formatMonthLabelPt(selectedMonth)}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Próximo mês"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {permissions.canEditMonthlyPlan && (
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Agendar Reunião no Mês
            </button>
          )}
        </div>
      </div>

      {/* 3 Core Tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
        <button
          type="button"
          onClick={() => onChangeTab('mes')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'mes'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          1. Planificação do Mês
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('semana')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'semana'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          2. Planificação da Semana
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('progresso')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'progresso'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          3. Relatórios de Progresso Automático
        </button>
      </div>

      {/* TAB 1: PLANIFICAÇÃO DO MÊS + CALENDÁRIO INTEGRADO */}
      {activeTab === 'mes' && (
        <div className="space-y-6">
          {/* Integrated Monthly Calendar */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Calendário Mensal Integrado
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">
                {monthPlans.length} evento(s) planejado(s)
              </span>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEKDAYS_PT.map((wd) => (
                <div
                  key={wd}
                  className="py-2.5 text-center text-xs font-semibold text-slate-600"
                >
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
              {calendarDays.map((cellDay, idx) => {
                const isToday = cellDay.dateIso === today;
                return (
                  <div
                    key={idx}
                    className={`min-h-[96px] p-2 flex flex-col justify-between ${
                      cellDay.dayNum ? 'bg-white' : 'bg-slate-50/70'
                    }`}
                  >
                    {cellDay.dayNum && (
                      <>
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-xs font-mono tabular-nums ${
                              isToday
                                ? 'font-bold text-teal-700 underline underline-offset-4'
                                : 'text-slate-600'
                            }`}
                          >
                            {cellDay.dayNum}
                          </span>
                          {permissions.canEditMonthlyPlan && (
                            <button
                              type="button"
                              onClick={() => openCreateModal(cellDay.dateIso!)}
                              title={`Agendar em ${formatDatePt(cellDay.dateIso!)}`}
                              className="p-1 text-slate-400 hover:text-teal-700 rounded cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="space-y-1 mt-1">
                          {cellDay.dayPlans.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() =>
                                permissions.canEditMonthlyPlan
                                  ? openEditModal(p)
                                  : onChangeTab('semana')
                              }
                              className={`w-full text-left px-1.5 py-1 rounded text-[11px] font-medium truncate cursor-pointer ${
                                p.status === 'Realizada'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : p.status === 'Cancelada'
                                    ? 'bg-slate-100 text-slate-500 line-through'
                                    : 'bg-teal-50 text-teal-900 border border-teal-200'
                              }`}
                            >
                              {p.time} · {p.lessonTitle}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Monthly Scale Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Escala Completa do Mês
              </h2>
              <span className="text-xs text-slate-500">
                Lição, responsável, ministração, louvor, lanche, quebra-gelo e oração
              </span>
            </div>

            {monthPlans.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-900">
                  Nenhuma reunião planejada para {formatMonthLabelPt(selectedMonth)}
                </p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Adicione as datas do mês no calendário para gerar automaticamente a planificação semanal.
                </p>
                {permissions.canEditMonthlyPlan && (
                  <button
                    type="button"
                    onClick={() => openCreateModal()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                  >
                    Agendar Primeira Reunião
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4 whitespace-nowrap">Data / Hora</th>
                      <th className="py-3 px-4">Lição</th>
                      <th className="py-3 px-4 whitespace-nowrap">Responsável</th>
                      <th className="py-3 px-4 whitespace-nowrap">Ministração</th>
                      <th className="py-3 px-4 whitespace-nowrap">Louvor</th>
                      <th className="py-3 px-4 whitespace-nowrap">Lanche</th>
                      <th className="py-3 px-4 whitespace-nowrap">Quebra-gelo</th>
                      <th className="py-3 px-4 whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {monthPlans.map((plan) => (
                      <tr
                        key={plan.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-900 whitespace-nowrap">
                          {formatDatePt(plan.date)} · {plan.time}
                        </td>
                        <td className="py-3 px-4 min-w-[200px]">
                          <div className="font-semibold text-slate-900">
                            {plan.lessonTitle}
                          </div>
                          {plan.lessonReference && (
                            <div className="text-slate-500">
                              {plan.lessonReference}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-800 whitespace-nowrap">
                          {plan.responsibleName}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {plan.preacherName || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {plan.worshipName || '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {plan.snackName ? (
                            <span className="text-slate-700">{plan.snackName}</span>
                          ) : (
                            <span className="text-amber-700 font-medium">Pendente</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {plan.icebreakerName || '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              plan.status === 'Realizada'
                                ? 'text-emerald-700'
                                : plan.status === 'Cancelada'
                                  ? 'text-slate-400'
                                  : 'text-amber-700'
                            }`}
                          >
                            {plan.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {permissions.canRecordAttendance &&
                              plan.status === 'Planejada' && (
                                <button
                                  type="button"
                                  onClick={() => onStartAttendanceFromPlan(plan)}
                                  className="px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded cursor-pointer"
                                >
                                  Frequência
                                </button>
                              )}
                            {permissions.canEditMonthlyPlan && (
                              <button
                                type="button"
                                onClick={() => openEditModal(plan)}
                                title="Editar escala"
                                className="p-1.5 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {permissions.canDeletePlanOrReport && (
                              <button
                                type="button"
                                onClick={() => deleteMonthlyPlan(plan.id)}
                                title="Excluir reunião"
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PLANIFICAÇÃO DA SEMANA (DERIVADA DIRETAMENTE DO MÊS) */}
      {activeTab === 'semana' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Planificação da Semana (Extraída da Planificação do Mês)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Selecione uma semana de {formatMonthLabelPt(selectedMonth)} para acompanhar escalas e iniciar o registro de frequência.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {weeksInMonth.map((w) => (
                <button
                  key={w.weekNumber}
                  type="button"
                  onClick={() => setSelectedWeekNumber(w.weekNumber)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedWeekObj?.weekNumber === w.weekNumber
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Semana {w.weekNumber}
                </button>
              ))}
            </div>
          </div>

          {selectedWeekObj && (
            <div className="text-xs font-medium text-slate-500">
              Período selecionado: <span className="text-slate-900 font-semibold">{selectedWeekObj.label}</span>
            </div>
          )}

          {weeklyDerivedPlans.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-sm font-medium text-slate-900">
                Nenhum evento planejado para esta semana
              </p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                A planificação semanal é alimentada automaticamente pelos eventos cadastrados na aba Planificação do Mês.
              </p>
              {permissions.canEditMonthlyPlan && (
                <button
                  type="button"
                  onClick={() => openCreateModal(selectedWeekObj?.start)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  Agendar Reunião nesta Semana
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {weeklyDerivedPlans.map((plan) => {
                const missing = computeMissingRoles(plan);
                const linkedReport = reports.find(
                  (r) => r.planId === plan.id || r.date === plan.date,
                );
                return (
                  <div
                    key={plan.id}
                    className="bg-white border border-slate-200 rounded-xl p-6"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                          <span className="font-mono tabular-nums font-semibold text-slate-900">
                            {formatDatePt(plan.date)} · {plan.time}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-semibold ${
                              plan.status === 'Realizada'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {plan.status}
                          </span>
                          {plan.location && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{plan.location}</span>
                            </>
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">
                          {plan.lessonTitle}
                        </h3>
                        {plan.lessonReference && (
                          <p className="text-xs text-slate-600 mt-0.5">
                            Texto base: {plan.lessonReference}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {permissions.canEditMonthlyPlan && (
                          <button
                            type="button"
                            onClick={() => openEditModal(plan)}
                            className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            Ajustar Escala
                          </button>
                        )}
                        {permissions.canRecordAttendance && (
                          <button
                            type="button"
                            onClick={() => onStartAttendanceFromPlan(plan)}
                            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            {linkedReport
                              ? 'Atualizar Frequência / Relatório'
                              : 'Registrar Frequência e Relatório'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 py-5">
                      <div>
                        <div className="text-xs text-slate-500">Responsável</div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">
                          {plan.responsibleName}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Ministração</div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">
                          {plan.preacherName || 'Pendente'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Louvor</div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">
                          {plan.worshipName || 'Pendente'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Lanche</div>
                        <div
                          className={`text-sm font-semibold mt-1 ${
                            plan.snackName ? 'text-slate-900' : 'text-amber-700'
                          }`}
                        >
                          {plan.snackName || 'Pendente'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Quebra-gelo</div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">
                          {plan.icebreakerName || 'Pendente'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Oração</div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">
                          {plan.prayerName || 'Pendente'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      {missing.length === 0 ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" />
                          Todas as funções da semana estão preenchidas.
                        </span>
                      ) : (
                        <span className="font-medium text-amber-700">
                          Funções pendentes na escala: {missing.join(', ')}
                        </span>
                      )}
                      {plan.notes && (
                        <span className="text-slate-500">Obs.: {plan.notes}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RELATÓRIOS DE PROGRESSO AUTOMÁTICO */}
      {activeTab === 'progresso' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">
                Cumprimento do Plano Mensal
              </div>
              <div className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
                {progressMetrics.completionRate}%
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-teal-700 rounded-full transition-all"
                  style={{ width: `${progressMetrics.completionRate}%` }}
                />
              </div>
              <div className="text-xs text-slate-500 mt-2 tabular-nums">
                {progressMetrics.completedCount} realizada(s) de {progressMetrics.plannedCount} planejada(s)
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">
                Taxa Média de Frequência
              </div>
              <div className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
                {progressMetrics.avgAttendanceRate}%
              </div>
              <div className="text-xs text-slate-500 mt-2 tabular-nums">
                Baseado em {progressMetrics.reportsCount} relatório(s) no mês
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">
                Visitantes e Decisões
              </div>
              <div className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
                {progressMetrics.totalVisitors} · {progressMetrics.totalDecisions}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Visitantes recebidos · Decisões registradas
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">
                Cobertura das Escalas
              </div>
              <div className="text-3xl font-bold text-slate-900 tabular-nums mt-2">
                {progressMetrics.roleCoverageRate}%
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Funções preenchidas no planejamento mensal
              </div>
            </div>
          </div>

          {/* Meeting-by-meeting automatic chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Evolução por Reunião Registrada
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atualizado automaticamente após cada registro de frequência e relatório semanal.
                </p>
              </div>
            </div>

            {progressMetrics.meetingTrend.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                Nenhum relatório registrado em {formatMonthLabelPt(selectedMonth)} ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {progressMetrics.meetingTrend.map((item) => (
                  <div
                    key={item.reportId}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center py-2 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="md:col-span-4">
                      <div className="text-xs font-mono tabular-nums text-slate-500">
                        {formatDatePt(item.date)}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {item.lessonTitle}
                      </div>
                    </div>
                    <div className="md:col-span-5">
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-700 rounded-full"
                          style={{ width: `${item.attendanceRate}%` }}
                        />
                      </div>
                    </div>
                    <div className="md:col-span-3 flex items-center justify-between md:justify-end gap-4 text-xs tabular-nums">
                      <span className="text-slate-700 font-medium">
                        {item.presentCount} presentes
                        {item.visitorsCount > 0 ? ` + ${item.visitorsCount} vis.` : ''}
                      </span>
                      <span className="font-bold text-slate-900">
                        {item.attendanceRate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Individual Member Engagement Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Frequência Individual no Mês
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Membro</th>
                    <th className="py-3 px-4">Cargo</th>
                    <th className="py-3 px-4">Nível de Atividade</th>
                    <th className="py-3 px-4 text-right">Presenças</th>
                    <th className="py-3 px-4 text-right">Taxa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {progressMetrics.memberEngagement.map((row) => (
                    <tr key={row.memberId} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {row.fullName}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {ROLE_LABELS[row.role as CellRole] || row.role}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {row.activityLevel}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                        {row.attendedCount} / {row.totalMeetings}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                          row.totalMeetings > 0 && row.rate < 50
                            ? 'text-red-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {row.rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Monthly Plan Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 sm:p-8 my-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingPlan
                    ? 'Editar Reunião Planejada'
                    : 'Agendar Reunião no Mês'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Os dados preenchidos alimentam automaticamente o calendário mensal e a aba Planificação da Semana.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data da Reunião
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Horário
                  </label>
                  <input
                    type="time"
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as PlanStatus)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Planejada">Planejada</option>
                    <option value="Realizada">Realizada</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lição / Tema
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={formLesson}
                    onChange={(e) => setFormLesson(e.target.value)}
                    placeholder="Ex.: O Poder da Oração em Unidade"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Referência Bíblica
                  </label>
                  <input
                    type="text"
                    maxLength={160}
                    value={formRef}
                    onChange={(e) => setFormRef(e.target.value)}
                    placeholder="Ex.: Mateus 18:19-20"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <datalist id="cell-member-names">
                {memberNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Responsável Geral *
                  </label>
                  <input
                    type="text"
                    required
                    list="cell-member-names"
                    maxLength={120}
                    value={formResponsible}
                    onChange={(e) => setFormResponsible(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ministração da Reunião
                  </label>
                  <input
                    type="text"
                    list="cell-member-names"
                    maxLength={120}
                    value={formPreacher}
                    onChange={(e) => setFormPreacher(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Louvor
                  </label>
                  <input
                    type="text"
                    list="cell-member-names"
                    maxLength={120}
                    value={formWorship}
                    onChange={(e) => setFormWorship(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lanche
                  </label>
                  <input
                    type="text"
                    list="cell-member-names"
                    maxLength={120}
                    value={formSnack}
                    onChange={(e) => setFormSnack(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quebra-Gelo
                  </label>
                  <input
                    type="text"
                    list="cell-member-names"
                    maxLength={120}
                    value={formIcebreaker}
                    onChange={(e) => setFormIcebreaker(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Oração / Intercessão
                  </label>
                  <input
                    type="text"
                    list="cell-member-names"
                    maxLength={120}
                    value={formPrayer}
                    onChange={(e) => setFormPrayer(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Local
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Observações
                  </label>
                  <input
                    type="text"
                    maxLength={1000}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  {saving ? 'Salvando...' : 'Salvar Planificação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
