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
  Sparkles,
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
  type PlanEventType,
  type PlanStatus,
  type RolePermissions,
} from '../types/cell';
import { MemberPickerField } from './MemberPickerField';
import { MemberResponsibilitySearch } from './MemberResponsibilitySearch';

interface PlanningWorkspaceProps {
  cell: CellWorkspace;
  currentUid: string;
  currentMemberId?: string;
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
  currentMemberId,
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
  const [selectedDayIso, setSelectedDayIso] = useState<string>(today);
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
  const [formEventType, setFormEventType] =
    useState<PlanEventType>('Reunião de Célula');
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
    setSelectedDayIso(
      nextKey === getMonthKey(today) ? today : `${nextKey}-01`,
    );
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

  const specialActivities = useMemo(
    () =>
      monthPlans.filter(
        (p) =>
          p.eventType === 'Atividade Social' ||
          p.eventType === 'Atividade Espiritual',
      ),
    [monthPlans],
  );

  const openCreateModal = (
    presetDate?: string,
    presetEventType: PlanEventType = 'Reunião de Célula',
  ) => {
    setEditingPlan(null);
    setFormEventType(presetEventType);
    setFormDate(
      presetDate ||
        (selectedMonth === getMonthKey(today) ? today : `${selectedMonth}-01`),
    );
    setFormTime(cell.meetingTime || '19:30');
    setFormLesson('');
    setFormRef('');
    setFormResponsible(memberNames[0] || '');
    setFormPreacher('');
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
    setFormEventType(plan.eventType || 'Reunião de Célula');
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
      setFormError('Informe a lição/atividade e quem será o Dirigente.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await saveMonthlyPlan({
        cell,
        existingPlan: editingPlan,
        existingPlans: plans,
        currentUid,
        data: {
          date: formDate,
          time: formTime,
          eventType: formEventType,
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
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Planificação e Progresso
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Calendário mensal integrado, agenda semanal automática e evolução após cada evento registrado.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Mês anterior"
              className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-semibold text-slate-900 whitespace-nowrap min-w-[140px] text-center">
              {formatMonthLabelPt(selectedMonth)}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Próximo mês"
              className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {permissions.canEditMonthlyPlan && (
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openCreateModal(undefined, 'Atividade Social')}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                Atividade Social / Espiritual
              </button>
              <button
                type="button"
                onClick={() => openCreateModal(undefined, 'Reunião de Célula')}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Agendar Reunião no Mês
              </button>
            </div>
          )}
        </div>
      </div>

      {/* People Search: Details + Monthly Responsibilities */}
      <MemberResponsibilitySearch
        members={members}
        monthPlans={monthPlans}
        selectedMonth={selectedMonth}
        permissions={permissions}
        currentMemberId={currentMemberId}
      />

      {/* 3 Core Tabs */}
      <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-full sm:w-auto">
        <button
          type="button"
          onClick={() => onChangeTab('mes')}
          className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'mes'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="sm:hidden">1. Mês</span>
          <span className="hidden sm:inline">1. Planificação do Mês</span>
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('semana')}
          className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'semana'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="sm:hidden">2. Semana</span>
          <span className="hidden sm:inline">2. Planificação da Semana</span>
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('progresso')}
          className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'progresso'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="sm:hidden">3. Progresso</span>
          <span className="hidden sm:inline">3. Relatórios de Progresso Automático</span>
        </button>
      </div>

      {/* TAB 1: PLANIFICAÇÃO DO MÊS + CALENDÁRIO INTEGRADO */}
      {activeTab === 'mes' && (
        <div className="space-y-6">
          {/* Integrated Monthly Calendar */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                  Calendário Mensal Integrado
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">
                  ({monthPlans.length} evento(s))
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-teal-600 inline-block" />
                  Célula
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" />
                  Social
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                  Espiritual
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                  Realizada
                </span>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEKDAYS_PT.map((wd) => (
                <div
                  key={wd}
                  className="py-2 text-center text-[11px] sm:text-xs font-semibold text-slate-600"
                >
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
              {calendarDays.map((cellDay, idx) => {
                const isToday = cellDay.dateIso === today;
                const isSelectedDay =
                  Boolean(cellDay.dateIso) && cellDay.dateIso === selectedDayIso;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (cellDay.dateIso) setSelectedDayIso(cellDay.dateIso);
                    }}
                    className={`min-h-[54px] sm:min-h-[96px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors ${
                      cellDay.dayNum
                        ? isSelectedDay
                          ? 'bg-teal-50/60 sm:bg-white cursor-pointer sm:cursor-default'
                          : 'bg-white cursor-pointer sm:cursor-default'
                        : 'bg-slate-50/70'
                    }`}
                  >
                    {cellDay.dayNum && (
                      <>
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-xs font-mono tabular-nums ${
                              isToday
                                ? 'font-bold text-teal-700 underline underline-offset-4'
                                : isSelectedDay
                                  ? 'font-bold text-slate-900'
                                  : 'text-slate-600'
                            }`}
                          >
                            {cellDay.dayNum}
                          </span>
                          {permissions.canEditMonthlyPlan && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCreateModal(cellDay.dateIso!);
                              }}
                              title={`Agendar em ${formatDatePt(cellDay.dateIso!)}`}
                              className="hidden sm:inline-flex p-1 text-slate-400 hover:text-teal-700 rounded cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Mobile compact event dots */}
                        {cellDay.dayPlans.length > 0 && (
                          <div className="flex sm:hidden flex-wrap items-center gap-1 mt-1">
                            {cellDay.dayPlans.map((p) => {
                              const dotColor =
                                p.status === 'Realizada'
                                  ? 'bg-emerald-600'
                                  : p.status === 'Cancelada'
                                    ? 'bg-slate-400'
                                    : p.eventType === 'Atividade Social'
                                      ? 'bg-indigo-600'
                                      : p.eventType === 'Atividade Espiritual'
                                        ? 'bg-amber-600'
                                        : 'bg-teal-600';
                              return (
                                <span
                                  key={p.id}
                                  className={`w-2 h-2 rounded-full ${dotColor}`}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* Desktop event chips */}
                        <div className="hidden sm:block space-y-1 mt-1">
                          {cellDay.dayPlans.map((p) => {
                            const isSocial = p.eventType === 'Atividade Social';
                            const isSpiritual =
                              p.eventType === 'Atividade Espiritual';
                            const colorCls =
                              p.status === 'Realizada'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : p.status === 'Cancelada'
                                  ? 'bg-slate-100 text-slate-500 line-through'
                                  : isSocial
                                    ? 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                                    : isSpiritual
                                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                      : 'bg-teal-50 text-teal-900 border border-teal-200';
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() =>
                                  permissions.canEditMonthlyPlan
                                    ? openEditModal(p)
                                    : onChangeTab('semana')
                                }
                                className={`w-full text-left px-1.5 py-1 rounded text-[11px] font-medium truncate cursor-pointer ${colorCls}`}
                              >
                                {p.time} ·{' '}
                                {isSocial
                                  ? `[Social] ${p.lessonTitle}`
                                  : isSpiritual
                                    ? `[Espiritual] ${p.lessonTitle}`
                                    : p.lessonTitle}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile Selected Day Quick Detail Bar */}
            {selectedDayIso && selectedDayIso.startsWith(selectedMonth) && (
              <div className="sm:hidden border-t border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Dia {formatDatePt(selectedDayIso)}
                  </span>
                  {permissions.canEditMonthlyPlan && (
                    <button
                      type="button"
                      onClick={() => openCreateModal(selectedDayIso)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-teal-800 bg-white border border-teal-200 rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agendar neste dia
                    </button>
                  )}
                </div>
                {monthPlans.filter((p) => p.date === selectedDayIso).length ===
                0 ? (
                  <p className="text-xs text-slate-500">
                    Nenhuma programação registrada nesta data.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {monthPlans
                      .filter((p) => p.date === selectedDayIso)
                      .map((p) => (
                        <div
                          key={p.id}
                          className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-mono tabular-nums text-slate-500">
                              {p.time} · {p.eventType || 'Reunião de Célula'} ·{' '}
                              {p.status}
                            </div>
                            <div className="font-semibold text-slate-900 truncate">
                              {p.lessonTitle}
                            </div>
                            <div className="text-slate-600 truncate">
                              Dirigente: {p.responsibleName}
                            </div>
                          </div>
                          {permissions.canEditMonthlyPlan && (
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="min-h-[36px] px-2.5 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 rounded-md cursor-pointer shrink-0"
                            >
                              Editar
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dedicated Isolated-Date Social / Spiritual Activity Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Atividades Sociais e Espirituais do Mês (Datas Isoladas)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Programe um momento social (confraternização, passeio, café) ou espiritual (vigília, jejum, culto especial) com data própria em {formatMonthLabelPt(selectedMonth)}.
                </p>
              </div>
              {permissions.canEditMonthlyPlan && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openCreateModal(undefined, 'Atividade Social')}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    + Atividade Social
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openCreateModal(undefined, 'Atividade Espiritual')
                    }
                    className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    + Atividade Espiritual
                  </button>
                </div>
              )}
            </div>

            {specialActivities.length === 0 ? (
              <p className="text-xs text-slate-500 pt-4">
                Nenhuma atividade social ou espiritual agendada para este mês ainda.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
                {specialActivities.map((act) => (
                  <div
                    key={act.id}
                    className="border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-3 bg-slate-50/40"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`px-2 py-0.5 font-semibold rounded ${
                            act.eventType === 'Atividade Social'
                              ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {act.eventType}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-slate-700">
                          {formatDatePt(act.date)} · {act.time}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {act.lessonTitle}
                      </div>
                      <div className="text-xs text-slate-600">
                        Dirigente: <strong>{act.responsibleName}</strong>
                        {act.location ? ` · Local: ${act.location}` : ''}
                      </div>
                    </div>
                    {permissions.canEditMonthlyPlan && (
                      <button
                        type="button"
                        onClick={() => openEditModal(act)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded cursor-pointer shrink-0"
                        title="Editar atividade"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detailed Monthly Schedule Organized by Week */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Cronograma Mensal Organizado por Semana
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Escala cronológica na ordem: Lição, Dirigente, Louvor, Quebra-gelo e Lanche.
                </p>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {weeksInMonth.length} semanas · {monthPlans.length} programação(ões)
              </span>
            </div>

            {monthPlans.length === 0 ? (
              <div className="p-8 sm:p-10 text-center">
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
                    className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                  >
                    Agendar Primeira Reunião
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile Weekly Cards View */}
                <div className="md:hidden divide-y divide-slate-200">
                  {weeksInMonth.map((week) => {
                    const weekPlans = monthPlans.filter(
                      (p) => p.date >= week.start && p.date <= week.end,
                    );
                    if (weekPlans.length === 0) return null;
                    return (
                      <div key={week.weekNumber}>
                        <div className="bg-slate-100/90 px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 border-b border-slate-200">
                          <span>{week.label}</span>
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            {weekPlans.length} evento(s)
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {weekPlans.map((plan) => (
                            <div key={plan.id} className="p-4 space-y-3 text-xs">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-mono tabular-nums text-slate-500">
                                    {formatDatePt(plan.date)} · {plan.time}
                                  </div>
                                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                                    {plan.lessonTitle}
                                  </div>
                                  {plan.eventType &&
                                    plan.eventType !== 'Reunião de Célula' && (
                                      <span
                                        className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                                          plan.eventType === 'Atividade Social'
                                            ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                                        }`}
                                      >
                                        {plan.eventType}
                                      </span>
                                    )}
                                </div>
                                <span
                                  className={`font-semibold shrink-0 ${
                                    plan.status === 'Realizada'
                                      ? 'text-emerald-700'
                                      : plan.status === 'Cancelada'
                                        ? 'text-slate-400'
                                        : 'text-amber-700'
                                  }`}
                                >
                                  {plan.status}
                                </span>
                              </div>

                              <dl className="grid grid-cols-2 gap-2.5 bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                                <div>
                                  <dt className="text-[11px] text-slate-500">
                                    2. Dirigente
                                  </dt>
                                  <dd className="font-semibold text-slate-900 truncate">
                                    {plan.responsibleName}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-slate-500">
                                    3. Louvor
                                  </dt>
                                  <dd className="font-medium text-slate-800 truncate">
                                    {plan.worshipName || '—'}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-slate-500">
                                    4. Quebra-gelo
                                  </dt>
                                  <dd className="font-medium text-slate-800 truncate">
                                    {plan.icebreakerName || '—'}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-slate-500">
                                    5. Lanche
                                  </dt>
                                  <dd
                                    className={`font-medium truncate ${
                                      plan.snackName
                                        ? 'text-slate-800'
                                        : 'text-amber-700'
                                    }`}
                                  >
                                    {plan.snackName || 'Pendente'}
                                  </dd>
                                </div>
                              </dl>

                              {(permissions.canRecordAttendance ||
                                permissions.canEditMonthlyPlan ||
                                permissions.canDeletePlanOrReport) && (
                                <div className="flex items-center justify-end gap-2">
                                  {permissions.canRecordAttendance &&
                                    plan.status === 'Planejada' && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onStartAttendanceFromPlan(plan)
                                        }
                                        className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg cursor-pointer"
                                      >
                                        Frequência
                                      </button>
                                    )}
                                  {permissions.canEditMonthlyPlan && (
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(plan)}
                                      className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                                    >
                                      Editar
                                    </button>
                                  )}
                                  {permissions.canDeletePlanOrReport && (
                                    <button
                                      type="button"
                                      onClick={() => deleteMonthlyPlan(plan.id)}
                                      title="Excluir reunião"
                                      className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4 whitespace-nowrap">Data / Hora & Tipo</th>
                        <th className="py-3 px-4">1. Lição / Atividade</th>
                        <th className="py-3 px-4 whitespace-nowrap">2. Dirigente</th>
                        <th className="py-3 px-4 whitespace-nowrap">3. Louvor</th>
                        <th className="py-3 px-4 whitespace-nowrap">4. Quebra-gelo</th>
                        <th className="py-3 px-4 whitespace-nowrap">5. Lanche</th>
                        <th className="py-3 px-4 whitespace-nowrap">Status</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {weeksInMonth.map((week) => {
                        const weekPlans = monthPlans.filter(
                          (p) => p.date >= week.start && p.date <= week.end,
                        );
                        if (weekPlans.length === 0) return null;
                        return (
                          <React.Fragment key={week.weekNumber}>
                            <tr className="bg-slate-100/80 border-y border-slate-200">
                              <td
                                colSpan={8}
                                className="py-2 px-4 text-xs font-semibold text-slate-700"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span>{week.label}</span>
                                  <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                                    {weekPlans.length} evento(s)
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {weekPlans.map((plan) => (
                              <tr
                                key={plan.id}
                                className="hover:bg-slate-50/70 transition-colors"
                              >
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <div className="font-mono tabular-nums text-slate-900">
                                    {formatDatePt(plan.date)} · {plan.time}
                                  </div>
                                  {plan.eventType &&
                                    plan.eventType !== 'Reunião de Célula' && (
                                      <span
                                        className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                                          plan.eventType === 'Atividade Social'
                                            ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                                        }`}
                                      >
                                        {plan.eventType}
                                      </span>
                                    )}
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
                                <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                                  {plan.responsibleName}
                                </td>
                                <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                                  {plan.worshipName || '—'}
                                </td>
                                <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                                  {plan.icebreakerName || '—'}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {plan.snackName ? (
                                    <span className="text-slate-700">
                                      {plan.snackName}
                                    </span>
                                  ) : (
                                    <span className="text-amber-700 font-medium">
                                      Pendente
                                    </span>
                                  )}
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
                                          onClick={() =>
                                            onStartAttendanceFromPlan(plan)
                                          }
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
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
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
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                          <span className="font-mono tabular-nums font-semibold text-slate-900">
                            {formatDatePt(plan.date)} · {plan.time}
                          </span>
                          {plan.eventType &&
                            plan.eventType !== 'Reunião de Célula' && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                                    plan.eventType === 'Atividade Social'
                                      ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  {plan.eventType}
                                </span>
                              </>
                            )}
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
                        <div className="text-xs text-slate-500">Dirigente</div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">
                          {plan.responsibleName}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Louvor</div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">
                          {plan.worshipName || 'Pendente'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Quebra-gelo</div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">
                          {plan.icebreakerName || 'Pendente'}
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
                        <div className="text-xs text-slate-500">Ministração</div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">
                          {plan.preacherName || 'Pendente'}
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-2xl p-5 sm:p-8 max-h-[92vh] overflow-y-auto shadow-xl">
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
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipo de Programação *
                  </label>
                  <select
                    value={formEventType}
                    onChange={(e) =>
                      setFormEventType(e.target.value as PlanEventType)
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Reunião de Célula">Reunião de Célula</option>
                    <option value="Atividade Social">Atividade Social (Data Isolada)</option>
                    <option value="Atividade Espiritual">Atividade Espiritual (Data Isolada)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {formEventType === 'Reunião de Célula'
                      ? 'Data da Reunião *'
                      : 'Data Isolada da Atividade *'}
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
                    {formEventType === 'Reunião de Célula'
                      ? '1. Lição / Tema *'
                      : '1. Nome da Atividade / Tema *'}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={formLesson}
                    onChange={(e) => setFormLesson(e.target.value)}
                    placeholder={
                      formEventType === 'Reunião de Célula'
                        ? 'Ex.: O Poder da Oração em Unidade'
                        : formEventType === 'Atividade Social'
                          ? 'Ex.: Confraternização e Jantar da Célula'
                          : 'Ex.: Noite de Oração e Jejum'
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Referência Bíblica (opcional)
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MemberPickerField
                  label="2. Dirigente *"
                  required
                  value={formResponsible}
                  onChange={setFormResponsible}
                  members={members}
                  placeholder="Buscar dirigente registrado..."
                />
                <MemberPickerField
                  label="3. Louvor"
                  value={formWorship}
                  onChange={setFormWorship}
                  members={members}
                  placeholder="Buscar integrante para o louvor..."
                />
                <MemberPickerField
                  label="4. Quebra-Gelo"
                  value={formIcebreaker}
                  onChange={setFormIcebreaker}
                  members={members}
                  placeholder="Buscar integrante para quebra-gelo..."
                />
                <MemberPickerField
                  label="5. Lanche"
                  value={formSnack}
                  onChange={setFormSnack}
                  members={members}
                  placeholder="Buscar responsável pelo lanche..."
                />
                <MemberPickerField
                  label="Ministração da Palavra (opcional)"
                  value={formPreacher}
                  onChange={setFormPreacher}
                  members={members}
                  placeholder="Buscar ministrante registrado..."
                />
                <MemberPickerField
                  label="Oração / Intercessão (opcional)"
                  value={formPrayer}
                  onChange={setFormPrayer}
                  members={members}
                  placeholder="Buscar intercessor registrado..."
                />
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
