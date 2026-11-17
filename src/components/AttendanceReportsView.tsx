import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  Lock,
  Plus,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { formatDatePt, getTodayIso } from '../lib/cellAnalytics';
import { deleteMeetingReport, saveMeetingReport } from '../lib/cellService';
import type {
  CellMember,
  CellWorkspace,
  MeetingReport,
  MonthlyPlan,
  ReportStatus,
  RolePermissions,
} from '../types/cell';

interface AttendanceReportsViewProps {
  cell: CellWorkspace;
  currentUid: string;
  permissions: RolePermissions;
  members: CellMember[];
  plans: MonthlyPlan[];
  reports: MeetingReport[];
  preselectedPlan?: MonthlyPlan | null;
  onClearPreselectedPlan: () => void;
}

export function AttendanceReportsView({
  cell,
  currentUid,
  permissions,
  members,
  plans,
  reports,
  preselectedPlan,
  onClearPreselectedPlan,
}: AttendanceReportsViewProps) {
  const today = getTodayIso();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<MeetingReport | null>(null);
  const [selectedReportDetail, setSelectedReportDetail] =
    useState<MeetingReport | null>(null);

  const [planId, setPlanId] = useState('');
  const [date, setDate] = useState(today);
  const [lessonTitle, setLessonTitle] = useState('');
  const [preacherName, setPreacherName] = useState('');
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const [visitorsCount, setVisitorsCount] = useState(0);
  const [visitorNamesText, setVisitorNamesText] = useState('');
  const [decisionsCount, setDecisionsCount] = useState(0);
  const [summary, setSummary] = useState('');
  const [highlights, setHighlights] = useState('');
  const [prayerRequests, setPrayerRequests] = useState('');
  const [status, setStatus] = useState<ReportStatus>('Finalizado');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => b.date.localeCompare(a.date)),
    [reports],
  );

  const plannedOptions = useMemo(
    () =>
      [...plans]
        .filter((p) => p.status !== 'Cancelada')
        .sort((a, b) => b.date.localeCompare(a.date)),
    [plans],
  );

  const memberById = useMemo(() => {
    const map = new Map<string, CellMember>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  useEffect(() => {
    if (preselectedPlan) {
      const existing = reports.find(
        (r) =>
          r.planId === preselectedPlan.id || r.date === preselectedPlan.date,
      );
      if (existing) {
        openEditModal(existing);
      } else {
        openCreateFromPlan(preselectedPlan);
      }
      onClearPreselectedPlan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedPlan]);

  const openCreateModal = () => {
    setEditingReport(null);
    setPlanId('');
    setDate(today);
    setLessonTitle('');
    setPreacherName('');
    setPresentIds(members.map((m) => m.id));
    setVisitorsCount(0);
    setVisitorNamesText('');
    setDecisionsCount(0);
    setSummary('');
    setHighlights('');
    setPrayerRequests('');
    setStatus('Finalizado');
    setFormError(null);
    setModalOpen(true);
  };

  const openCreateFromPlan = (plan: MonthlyPlan) => {
    setEditingReport(null);
    setPlanId(plan.id);
    setDate(plan.date);
    setLessonTitle(plan.lessonTitle);
    setPreacherName(plan.preacherName || plan.responsibleName);
    setPresentIds(members.map((m) => m.id));
    setVisitorsCount(0);
    setVisitorNamesText('');
    setDecisionsCount(0);
    setSummary('');
    setHighlights('');
    setPrayerRequests('');
    setStatus('Finalizado');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (rep: MeetingReport) => {
    setEditingReport(rep);
    setPlanId(rep.planId || '');
    setDate(rep.date);
    setLessonTitle(rep.lessonTitle);
    setPreacherName(rep.preacherName || '');
    setPresentIds(rep.presentMemberIds);
    setVisitorsCount(rep.visitorsCount);
    setVisitorNamesText((rep.visitorNames || []).join(', '));
    setDecisionsCount(rep.decisionsCount);
    setSummary(rep.summary);
    setHighlights(rep.highlights || '');
    setPrayerRequests(rep.prayerRequests || '');
    setStatus(rep.status);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSelectPlanDropdown = (nextPlanId: string) => {
    setPlanId(nextPlanId);
    const chosen = plans.find((p) => p.id === nextPlanId);
    if (chosen) {
      setDate(chosen.date);
      setLessonTitle(chosen.lessonTitle);
      setPreacherName(chosen.preacherName || chosen.responsibleName);
    }
  };

  const toggleMemberPresence = (memberId: string) => {
    setPresentIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lessonTitle.trim().length < 2 || summary.trim().length < 3) {
      setFormError('Informe a lição e um resumo da reunião.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const absentMemberIds = members
        .map((m) => m.id)
        .filter((id) => !presentIds.includes(id));

      const visitorNames = visitorNamesText
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      await saveMeetingReport({
        cell,
        existingReport: editingReport,
        currentUid,
        data: {
          planId: planId || undefined,
          date,
          lessonTitle,
          preacherName,
          presentMemberIds: presentIds,
          absentMemberIds,
          visitorsCount: Math.max(visitorsCount, visitorNames.length),
          visitorNames,
          decisionsCount,
          summary,
          highlights,
          prayerRequests,
          status,
        },
      });
      setModalOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Erro ao salvar relatório.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Frequência e Relatórios Semanais
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Cada relatório finalizado atualiza automaticamente o status do calendário e os gráficos de progresso.
          </p>
        </div>

        {permissions.canRecordAttendance && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Registrar Reunião
          </button>
        )}
      </div>

      {sortedReports.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-slate-900">
            Nenhum relatório de reunião registrado ainda
          </p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Registre a presença dos membros, visitantes e resumo da palavra após cada encontro semanal.
          </p>
          {permissions.canRecordAttendance && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              Registrar Primeiro Relatório
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Reports list */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Histórico de Encontros
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">
                {sortedReports.length} registro(s)
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {sortedReports.map((rep) => {
                const canEditThis =
                  permissions.canRecordAttendance &&
                  (rep.status !== 'Finalizado' ||
                    permissions.canEditFinalizedReports);
                const isSelected = selectedReportDetail?.id === rep.id;

                return (
                  <div
                    key={rep.id}
                    onClick={() => setSelectedReportDetail(rep)}
                    className={`p-5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                          <span className="font-mono tabular-nums font-semibold text-slate-900">
                            {formatDatePt(rep.date)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-semibold ${
                              rep.status === 'Finalizado'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {rep.status}
                          </span>
                          {rep.preacherName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Ministração: {rep.preacherName}</span>
                            </>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 truncate">
                          {rep.lessonTitle}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                          {rep.summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {canEditThis ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(rep);
                            }}
                            title="Editar relatório"
                            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        ) : (
                          rep.status === 'Finalizado' &&
                          permissions.canRecordAttendance && (
                            <span
                              title="Relatório finalizado (somente o Líder pode alterar)"
                              className="p-2 text-slate-400"
                            >
                              <Lock className="w-4 h-4" />
                            </span>
                          )
                        )}
                        {permissions.canDeletePlanOrReport && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMeetingReport(rep.id);
                              if (isSelected) setSelectedReportDetail(null);
                            }}
                            title="Excluir relatório"
                            className="p-2 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs tabular-nums text-slate-600">
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                        <UserCheck className="w-3.5 h-3.5" />
                        {rep.presentMemberIds.length} presentes
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-500">
                        <UserX className="w-3.5 h-3.5" />
                        {rep.absentMemberIds.length} ausentes
                      </span>
                      <span>{rep.visitorsCount} visitante(s)</span>
                      <span>{rep.decisionsCount} decisão(ões)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected report detail */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
            {selectedReportDetail ? (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-mono tabular-nums text-slate-500">
                    {formatDatePt(selectedReportDetail.date)} ·{' '}
                    {selectedReportDetail.status}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">
                    {selectedReportDetail.lessonTitle}
                  </h2>
                  {selectedReportDetail.preacherName && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      Ministração: {selectedReportDetail.preacherName}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-1.5">
                    Resumo da Reunião
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {selectedReportDetail.summary}
                  </p>
                </div>

                {selectedReportDetail.highlights && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-700 mb-1">
                      Destaques e Testemunhos
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {selectedReportDetail.highlights}
                    </p>
                  </div>
                )}

                {selectedReportDetail.prayerRequests && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-700 mb-1">
                      Pedidos de Oração
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {selectedReportDetail.prayerRequests}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200">
                  <h3 className="text-xs font-semibold text-slate-700 mb-2">
                    Lista de Presença ({selectedReportDetail.presentMemberIds.length})
                  </h3>
                  <div className="text-xs text-slate-700 leading-relaxed">
                    {selectedReportDetail.presentMemberIds.length > 0
                      ? selectedReportDetail.presentMemberIds
                          .map((id) => memberById.get(id)?.fullName || 'Membro')
                          .join(' · ')
                      : 'Nenhum membro marcado como presente.'}
                  </div>
                  {selectedReportDetail.visitorNames &&
                    selectedReportDetail.visitorNames.length > 0 && (
                      <div className="mt-3 text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">
                          Visitantes:{' '}
                        </span>
                        {selectedReportDetail.visitorNames.join(' · ')}
                      </div>
                    )}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-500">
                Selecione um relatório ao lado para visualizar a lista completa de presença, visitantes e pedidos de oração.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal for Create / Edit Meeting Report */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 sm:p-8 my-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingReport
                    ? 'Editar Frequência e Relatório'
                    : 'Registrar Frequência e Relatório'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Ao finalizar, a reunião planejada correspondente será marcada como Realizada e o relatório de progresso atualizado.
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

            <form onSubmit={handleSave} className="space-y-4">
              {plannedOptions.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vincular à Planificação do Mês (opcional)
                  </label>
                  <select
                    value={planId}
                    onChange={(e) => handleSelectPlanDropdown(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Registro avulso (sem vínculo)</option>
                    {plannedOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatDatePt(p.date)} — {p.lessonTitle} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data do Encontro
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lição Ministrada *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quem Ministrou
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={preacherName}
                    onChange={(e) => setPreacherName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nº de Visitantes
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={visitorsCount}
                    onChange={(e) =>
                      setVisitorsCount(Math.max(0, Number(e.target.value)))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Decisões / Reconciliações
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={decisionsCount}
                    onChange={(e) =>
                      setDecisionsCount(Math.max(0, Number(e.target.value)))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              {/* Attendance Checklist */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-800">
                    Frequência dos Membros ({presentIds.length} / {members.length} presentes)
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setPresentIds(members.map((m) => m.id))}
                      className="text-teal-700 font-medium hover:underline cursor-pointer"
                    >
                      Marcar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresentIds([])}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {members.map((m) => {
                    const checked = presentIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMemberPresence(m.id)}
                        className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg border text-left cursor-pointer transition-colors ${
                          checked
                            ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{m.fullName}</span>
                        {checked && <Check className="w-3.5 h-3.5 text-teal-700 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomes dos Visitantes (separados por vírgula)
                </label>
                <input
                  type="text"
                  value={visitorNamesText}
                  onChange={(e) => setVisitorNamesText(e.target.value)}
                  placeholder="Ex.: Maria Clara, João Pedro"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resumo da Reunião *
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={2500}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Descreva como foi a ministração, participação do grupo e ambiente da reunião."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Destaques / Testemunhos
                  </label>
                  <textarea
                    rows={2}
                    maxLength={1500}
                    value={highlights}
                    onChange={(e) => setHighlights(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pedidos de Oração
                  </label>
                  <textarea
                    rows={2}
                    maxLength={1500}
                    value={prayerRequests}
                    onChange={(e) => setPrayerRequests(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-700">
                    Status:
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ReportStatus)}
                    className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Rascunho">Rascunho</option>
                    <option value="Finalizado">Finalizado (atualiza progresso)</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
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
                    {saving ? 'Salvando...' : 'Salvar Relatório'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
