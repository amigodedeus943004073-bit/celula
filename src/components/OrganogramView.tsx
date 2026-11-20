import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  GitFork,
  Home,
  Plus,
  Search,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { assignOrganogramPlacement } from '../lib/cellService';
import {
  MAX_FILHINHOS_PER_MENTOR,
  MAX_TRAINERS_PER_CELL,
  ROLE_HIERARCHY_ORDER,
  ROLE_LABELS,
  type CellMember,
  type CellRole,
  type CellWing,
  type CellWorkspace,
  type RolePermissions,
} from '../types/cell';
import { MemberAvatar } from './MemberAvatar';

interface OrganogramViewProps {
  cell: CellWorkspace;
  currentUid: string;
  permissions: RolePermissions;
  members: CellMember[];
}

type PickerTarget = {
  role: CellRole;
  mentorId?: string;
  mentorName?: string;
  title: string;
};

const QUICK_ASSIGNABLE_ROLES: Array<{ role: CellRole; label: string }> = [
  { role: 'lider_treinamento', label: 'Líder em Treinamento' },
  { role: 'filhinho', label: 'Filhinho(a)' },
  { role: 'secretario', label: 'Secretário(a)' },
  { role: 'anfitriao', label: 'Anfitrião(ã)' },
];

export function OrganogramView({
  cell,
  permissions,
  members,
}: OrganogramViewProps) {
  const [wingFilter, setWingFilter] = useState<'Todas' | CellWing>('Todas');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Instant registered-member selection modal ("Preencher")
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerMentorId, setPickerMentorId] = useState('');
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const sortedAllMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (ROLE_HIERARCHY_ORDER[a.role] !== ROLE_HIERARCHY_ORDER[b.role]) {
          return ROLE_HIERARCHY_ORDER[a.role] - ROLE_HIERARCHY_ORDER[b.role];
        }
        return a.fullName.localeCompare(b.fullName);
      }),
    [members],
  );

  const visibleMembers = useMemo(() => {
    if (wingFilter === 'Todas') return sortedAllMembers;
    return sortedAllMembers.filter(
      (m) => (m.wing || 'Masculina') === wingFilter,
    );
  }, [sortedAllMembers, wingFilter]);

  const leaders = useMemo(
    () => sortedAllMembers.filter((m) => m.role === 'lider'),
    [sortedAllMembers],
  );
  const trainers = useMemo(
    () => sortedAllMembers.filter((m) => m.role === 'lider_treinamento'),
    [sortedAllMembers],
  );
  const secretaries = useMemo(
    () => visibleMembers.filter((m) => m.role === 'secretario'),
    [visibleMembers],
  );
  const hosts = useMemo(
    () => visibleMembers.filter((m) => m.role === 'anfitriao'),
    [visibleMembers],
  );
  const visitors = useMemo(
    () => visibleMembers.filter((m) => m.role === 'visitante'),
    [visibleMembers],
  );
  const unassignedFilhinhos = useMemo(
    () =>
      visibleMembers.filter(
        (m) =>
          m.role === 'filhinho' &&
          (!m.mentorId || !members.some((x) => x.id === m.mentorId)),
      ),
    [visibleMembers, members],
  );
  const generalMembers = useMemo(
    () => visibleMembers.filter((m) => m.role === 'membro'),
    [visibleMembers],
  );

  const legacyLeaderFilhinhos = useMemo(() => {
    const leaderIds = new Set(leaders.map((l) => l.id));
    return sortedAllMembers.filter(
      (m) => m.role === 'filhinho' && m.mentorId && leaderIds.has(m.mentorId),
    );
  }, [sortedAllMembers, leaders]);

  const getMenteesOf = (mentorId: string) =>
    visibleMembers.filter(
      (m) => m.role === 'filhinho' && m.mentorId === mentorId,
    );

  const getTotalMenteesOf = (mentorId: string) =>
    sortedAllMembers.filter(
      (m) => m.role === 'filhinho' && m.mentorId === mentorId,
    );

  const totalAssignedUnderTrainers = useMemo(
    () =>
      trainers.reduce(
        (acc, tr) => acc + getTotalMenteesOf(tr.id).length,
        0,
      ),
    [trainers, sortedAllMembers],
  );

  const femaleWingMembers = useMemo(
    () =>
      sortedAllMembers.filter((m) => (m.wing || 'Masculina') === 'Feminina'),
    [sortedAllMembers],
  );

  const openMemberSelector = (target: PickerTarget) => {
    setPickerTarget(target);
    setPickerSearch('');
    setPickerError(null);
    if (target.mentorId) {
      setPickerMentorId(target.mentorId);
    } else if (target.role === 'filhinho') {
      const available = trainers.find(
        (tr) => getTotalMenteesOf(tr.id).length < MAX_FILHINHOS_PER_MENTOR,
      );
      setPickerMentorId(available?.id || trainers[0]?.id || '');
    } else {
      setPickerMentorId('');
    }
  };

  // All registered members (excluding main cell leader), ready for immediate 1-tap selection
  const selectableRegisteredMembers = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return sortedAllMembers.filter((m) => {
      if (m.role === 'lider') return false;
      if (!q) return true;
      return (
        m.fullName.toLowerCase().includes(q) ||
        ROLE_LABELS[m.role].toLowerCase().includes(q) ||
        (m.wing || 'Masculina').toLowerCase().includes(q)
      );
    });
  }, [sortedAllMembers, pickerSearch]);

  const handleSelectMemberForTarget = async (member: CellMember) => {
    if (!pickerTarget) return;
    setAssigningId(member.id);
    setPickerError(null);
    setErrorMsg(null);
    setSuccessBanner(null);
    try {
      const effectiveMentorId =
        pickerTarget.role === 'filhinho'
          ? pickerTarget.mentorId || pickerMentorId
          : '';
      await assignOrganogramPlacement({
        cell,
        member,
        allMembers: members,
        nextRole: pickerTarget.role,
        nextWing: member.wing || 'Masculina',
        nextMentorId: effectiveMentorId,
      });
      const roleTitle = ROLE_LABELS[pickerTarget.role];
      const mentorObj = effectiveMentorId
        ? members.find((x) => x.id === effectiveMentorId)
        : null;
      setSuccessBanner(
        mentorObj
          ? `${member.fullName} selecionado(a) como ${roleTitle} na equipe de ${mentorObj.fullName}.`
          : `${member.fullName} selecionado(a) como ${roleTitle}.`,
      );
      setPickerTarget(null);
    } catch (err) {
      setPickerError(
        err instanceof Error
          ? err.message
          : 'Não foi possível selecionar este irmão para a vaga.',
      );
    } finally {
      setAssigningId(null);
    }
  };

  const handleAssign = async (
    member: CellMember,
    nextRole: CellRole,
    nextWing: CellWing,
    nextMentorId: string,
  ) => {
    setBusyId(member.id);
    setErrorMsg(null);
    try {
      await assignOrganogramPlacement({
        cell,
        member,
        allMembers: members,
        nextRole,
        nextWing,
        nextMentorId,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível atualizar distribuição no organograma.',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Organograma da Célula
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Hierarquia: Líder da Célula → {MAX_TRAINERS_PER_CELL} Líderes em Treinamento → até {MAX_FILHINHOS_PER_MENTOR} Filhinhos cada. Clique em <strong>Preencher</strong> em qualquer vaga para selecionar os irmãos já registrados.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
          <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg shrink-0">
            {(['Todas', 'Feminina', 'Masculina'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWingFilter(w)}
                className={`min-h-[38px] px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap text-center ${
                  wingFilter === w
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {w === 'Todas' ? 'Todas Alas' : `Ala ${w}`}
              </button>
            ))}
          </div>

          {permissions.canManageOrganogram && (
            <button
              type="button"
              onClick={() =>
                openMemberSelector({
                  role:
                    trainers.length < MAX_TRAINERS_PER_CELL
                      ? 'lider_treinamento'
                      : 'filhinho',
                  title: 'Preencher Organograma · Selecionar Irmão',
                })
              }
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              Preencher Vagas
            </button>
          )}
        </div>
      </div>

      {successBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-900">
          <span className="inline-flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            {successBanner}
          </span>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            aria-label="Fechar aviso"
            className="p-1 text-emerald-700 hover:text-emerald-950 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
        >
          {errorMsg}
        </div>
      )}

      {/* Nível 1: Líder da Célula + Equipe de Apoio (Secretário e Anfitrião) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Nível 1 · Líder da Célula e Equipe de Apoio
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Código da célula:{' '}
            <strong className="font-mono text-slate-900">
              {cell.accessCode}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-5">
          {leaders.map((leader) => (
            <div
              key={leader.id}
              className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <MemberAvatar
                      name={leader.fullName}
                      photoDataUrl={leader.photoDataUrl}
                      wing={leader.wing}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-teal-700">
                        {ROLE_LABELS.lider} · Ala {leader.wing || 'Masculina'}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-0.5 truncate">
                        {leader.fullName}
                      </h3>
                    </div>
                  </div>
                  <div className="text-xs font-mono tabular-nums font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-md shrink-0">
                    {trainers.length}/{MAX_TRAINERS_PER_CELL} treinando
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                    <div className="text-slate-500">Líderes em Treinamento</div>
                    <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                      {trainers.length} / {MAX_TRAINERS_PER_CELL}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                    <div className="text-slate-500">Filhinhos nos 3 grupos</div>
                    <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                      {totalAssignedUnderTrainers} /{' '}
                      {MAX_TRAINERS_PER_CELL * MAX_FILHINHOS_PER_MENTOR}
                    </div>
                  </div>
                </div>

                {legacyLeaderFilhinhos.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                    <p className="text-xs font-medium text-amber-900">
                      Reatribua estes filhinhos para um dos{' '}
                      {MAX_TRAINERS_PER_CELL} Líderes em Treinamento:
                    </p>
                    <ul className="space-y-1.5">
                      {legacyLeaderFilhinhos.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center justify-between gap-2 text-xs bg-white border border-amber-200 rounded px-2.5 py-1.5"
                        >
                          <span className="font-semibold text-slate-900">
                            {f.fullName}
                          </span>
                          {permissions.canManageOrganogram && (
                            <button
                              type="button"
                              disabled={busyId === f.id}
                              onClick={() =>
                                handleAssign(
                                  f,
                                  'filhinho',
                                  f.wing || 'Masculina',
                                  '',
                                )
                              }
                              className="text-xs text-amber-800 hover:text-red-700 font-medium cursor-pointer"
                            >
                              Desvincular
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {permissions.canManageOrganogram &&
                trainers.length < MAX_TRAINERS_PER_CELL && (
                  <div className="mt-4 pt-3 border-t border-slate-200/80">
                    <button
                      type="button"
                      onClick={() =>
                        openMemberSelector({
                          role: 'lider_treinamento',
                          title: 'Selecionar Líder em Treinamento',
                        })
                      }
                      className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Preencher Líder em Treinamento ({trainers.length}/
                      {MAX_TRAINERS_PER_CELL})
                    </button>
                  </div>
                )}
            </div>
          ))}

          {/* Secretário(a) & Anfitrião(ã) */}
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-teal-700" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Secretário(a) da Célula
                  </h3>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-slate-500 tabular-nums">
                    {secretaries.length}
                  </span>
                  {permissions.canManageOrganogram && (
                    <button
                      type="button"
                      onClick={() =>
                        openMemberSelector({
                          role: 'secretario',
                          title: 'Selecionar Secretário(a) da Célula',
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Preencher
                    </button>
                  )}
                </div>
              </div>
              {secretaries.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhum secretário(a) atribuído ainda. Clique em Preencher para selecionar um irmão registrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {secretaries.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-slate-100 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MemberAvatar
                          name={s.fullName}
                          photoDataUrl={s.photoDataUrl}
                          wing={s.wing}
                          size="xs"
                        />
                        <span className="font-semibold text-slate-900 truncate">
                          {s.fullName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500">
                          Ala {s.wing || 'Masculina'}
                        </span>
                        {permissions.canManageOrganogram && (
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() =>
                              handleAssign(
                                s,
                                'membro',
                                s.wing || 'Masculina',
                                '',
                              )
                            }
                            className="text-[11px] text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-teal-700" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Anfitrião(ã)
                  </h3>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-slate-500 tabular-nums">
                    {hosts.length}
                  </span>
                  {permissions.canManageOrganogram && (
                    <button
                      type="button"
                      onClick={() =>
                        openMemberSelector({
                          role: 'anfitriao',
                          title: 'Selecionar Anfitrião(ã) da Célula',
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Preencher
                    </button>
                  )}
                </div>
              </div>
              {hosts.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhum anfitrião(ã) atribuído ainda. Clique em Preencher para selecionar um irmão registrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {hosts.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-slate-100 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MemberAvatar
                          name={h.fullName}
                          photoDataUrl={h.photoDataUrl}
                          wing={h.wing}
                          size="xs"
                        />
                        <span className="font-semibold text-slate-900 truncate">
                          {h.fullName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500">
                          Ala {h.wing || 'Masculina'}
                        </span>
                        {permissions.canManageOrganogram && (
                          <button
                            type="button"
                            disabled={busyId === h.id}
                            onClick={() =>
                              handleAssign(
                                h,
                                'membro',
                                h.wing || 'Masculina',
                                '',
                              )
                            }
                            className="text-[11px] text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nível 2 e 3: Grade fixa de 3 Líderes em Treinamento -> 3 Filhinhos cada */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Nível 2 e 3 · {MAX_TRAINERS_PER_CELL} Líderes em Treinamento e seus{' '}
              {MAX_FILHINHOS_PER_MENTOR} Filhinhos
            </h2>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {trainers.length}/{MAX_TRAINERS_PER_CELL} líderes em treinamento · Máx.{' '}
            {MAX_FILHINHOS_PER_MENTOR} filhinhos cada
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
          {Array.from({ length: MAX_TRAINERS_PER_CELL }, (_, slotIdx) => {
            const tr = trainers[slotIdx] || null;
            if (!tr) {
              return (
                <div
                  key={`empty-trainer-${slotIdx}`}
                  className="border border-dashed border-slate-300 rounded-xl p-5 flex flex-col items-center justify-center text-center min-h-[260px] bg-slate-50/50"
                >
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Vaga {slotIdx + 1} de {MAX_TRAINERS_PER_CELL}
                  </div>
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    Líder em Treinamento disponível
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
                    Responsável por acompanhar até {MAX_FILHINHOS_PER_MENTOR}{' '}
                    filhinhos nesta frente.
                  </p>
                  {permissions.canManageOrganogram && (
                    <button
                      type="button"
                      onClick={() =>
                        openMemberSelector({
                          role: 'lider_treinamento',
                          title: `Preencher Vaga ${slotIdx + 1} · Líder em Treinamento`,
                        })
                      }
                      className="mt-4 min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Preencher Líder em Treinamento
                    </button>
                  )}
                </div>
              );
            }

            const mentees = getMenteesOf(tr.id);
            const totalMentees = getTotalMenteesOf(tr.id);
            const totalCount = totalMentees.length;
            const hiddenOtherWingCount = Math.max(0, totalCount - mentees.length);

            return (
              <div
                key={tr.id}
                className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-white"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-teal-700">
                      Vaga {slotIdx + 1} · Ala {tr.wing || 'Masculina'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums font-semibold text-slate-800">
                        {totalCount}/{MAX_FILHINHOS_PER_MENTOR}
                      </span>
                      {permissions.canManageOrganogram && (
                        <button
                          type="button"
                          disabled={busyId === tr.id}
                          onClick={() =>
                            handleAssign(
                              tr,
                              'membro',
                              tr.wing || 'Masculina',
                              '',
                            )
                          }
                          title="Remover da vaga de Líder em Treinamento"
                          className="text-[11px] text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <MemberAvatar
                      name={tr.fullName}
                      photoDataUrl={tr.photoDataUrl}
                      wing={tr.wing}
                      size="md"
                    />
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {tr.fullName}
                    </h3>
                  </div>

                  <div className="mt-4 space-y-2">
                    {Array.from(
                      { length: MAX_FILHINHOS_PER_MENTOR },
                      (_, fIdx) => {
                        const f = mentees[fIdx] || null;
                        if (!f) {
                          return permissions.canManageOrganogram ? (
                            <button
                              key={`slot-${tr.id}-${fIdx}`}
                              type="button"
                              onClick={() =>
                                openMemberSelector({
                                  role: 'filhinho',
                                  mentorId: tr.id,
                                  mentorName: tr.fullName,
                                  title: `Selecionar Filhinho para ${tr.fullName}`,
                                })
                              }
                              className="w-full flex items-center justify-between text-xs border border-dashed border-teal-300 bg-teal-50/40 hover:bg-teal-50 rounded-lg px-3 py-2 text-teal-800 font-medium cursor-pointer transition-colors"
                            >
                              <span>
                                Filhinho {fIdx + 1}/{MAX_FILHINHOS_PER_MENTOR} · Selecionar irmão
                              </span>
                              <Plus className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                            </button>
                          ) : (
                            <div
                              key={`slot-${tr.id}-${fIdx}`}
                              className="flex items-center justify-between text-xs border border-dashed border-slate-200 rounded-lg px-3 py-2 text-slate-400"
                            >
                              <span>
                                Filhinho {fIdx + 1}/{MAX_FILHINHOS_PER_MENTOR} · Vaga livre
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={f.id}
                            className="flex items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <MemberAvatar
                                name={f.fullName}
                                photoDataUrl={f.photoDataUrl}
                                wing={f.wing}
                                size="xs"
                              />
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 truncate">
                                  {fIdx + 1}. {f.fullName}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Ala {f.wing || 'Masculina'} · {f.activityLevel}
                                </div>
                              </div>
                            </div>
                            {permissions.canManageOrganogram && (
                              <button
                                type="button"
                                disabled={busyId === f.id}
                                onClick={() =>
                                  handleAssign(
                                    f,
                                    'filhinho',
                                    f.wing || 'Masculina',
                                    '',
                                  )
                                }
                                className="text-[11px] text-slate-500 hover:text-red-600 cursor-pointer shrink-0"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                        );
                      },
                    )}
                    {hiddenOtherWingCount > 0 && (
                      <p className="text-[11px] text-slate-500 pt-1">
                        +{hiddenOtherWingCount} filhinho(s) de outra ala
                        vinculado(s) a este líder.
                      </p>
                    )}
                  </div>
                </div>

                {permissions.canManageOrganogram &&
                  totalCount < MAX_FILHINHOS_PER_MENTOR && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() =>
                          openMemberSelector({
                            role: 'filhinho',
                            mentorId: tr.id,
                            mentorName: tr.fullName,
                            title: `Preencher Filhinho de ${tr.fullName}`,
                          })
                        }
                        className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Preencher Filhinho ({totalCount}/{MAX_FILHINHOS_PER_MENTOR})
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ala Feminina em Destaque */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Ala Feminina da Célula
            </h2>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600">
            {femaleWingMembers.length} integrante(s)
          </span>
        </div>

        {femaleWingMembers.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            Nenhuma integrante vinculada à Ala Feminina ainda.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
            {femaleWingMembers.map((fm) => {
              const mentor = fm.mentorId
                ? members.find((x) => x.id === fm.mentorId)
                : null;
              return (
                <div
                  key={fm.id}
                  className="border border-slate-200 rounded-lg p-3.5 text-xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MemberAvatar
                      name={fm.fullName}
                      photoDataUrl={fm.photoDataUrl}
                      wing={fm.wing}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {fm.fullName}
                      </div>
                      <div className="text-slate-500 mt-0.5 truncate">
                        {ROLE_LABELS[fm.role]}
                        {mentor ? ` · Mentor: ${mentor.fullName}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-teal-700 shrink-0">
                    {fm.baptismStatus}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visitantes, Membros Gerais & Distribuição Rápida */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-teal-700 shrink-0" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Distribuição de Cargos, Alas e Visitantes
            </h2>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {visitors.length} visitante(s) · {unassignedFilhinhos.length}{' '}
            filhinho(s) sem mentor · {generalMembers.length} membro(s)
          </span>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {visibleMembers.map((m) => (
            <div key={m.id} className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MemberAvatar
                    name={m.fullName}
                    photoDataUrl={m.photoDataUrl}
                    wing={m.wing}
                    size="sm"
                  />
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {m.fullName}
                  </span>
                </div>
                <span className="text-slate-500 shrink-0">
                  {ROLE_LABELS[m.role]}
                </span>
              </div>

              {permissions.canManageOrganogram ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    disabled={busyId === m.id}
                    value={m.wing || 'Masculina'}
                    onChange={(e) =>
                      handleAssign(
                        m,
                        m.role,
                        e.target.value as CellWing,
                        m.mentorId || '',
                      )
                    }
                    className="w-full min-h-[40px] px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                  >
                    <option value="Masculina">Ala Masculina</option>
                    <option value="Feminina">Ala Feminina</option>
                  </select>

                  {m.role !== 'lider' && (
                    <select
                      disabled={busyId === m.id}
                      value={m.role}
                      onChange={(e) =>
                        handleAssign(
                          m,
                          e.target.value as CellRole,
                          m.wing || 'Masculina',
                          m.mentorId || '',
                        )
                      }
                      className="w-full min-h-[40px] px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                    >
                      <option
                        value="lider_treinamento"
                        disabled={
                          trainers.length >= MAX_TRAINERS_PER_CELL &&
                          m.role !== 'lider_treinamento'
                        }
                      >
                        Líder em Treinamento ({trainers.length}/
                        {MAX_TRAINERS_PER_CELL})
                      </option>
                      <option value="secretario">Secretário(a)</option>
                      <option value="anfitriao">Anfitrião(ã)</option>
                      <option value="filhinho">Filhinho(a)</option>
                      <option value="visitante">Visitante</option>
                      <option value="membro">Membro</option>
                    </select>
                  )}

                  {m.role === 'filhinho' && (
                    <select
                      disabled={busyId === m.id}
                      value={m.mentorId || ''}
                      onChange={(e) =>
                        handleAssign(
                          m,
                          'filhinho',
                          m.wing || 'Masculina',
                          e.target.value,
                        )
                      }
                      className="w-full min-h-[40px] px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                    >
                      <option value="">
                        Sem líder em treinamento atribuído
                      </option>
                      {trainers.map((mentor) => {
                        const cnt = getTotalMenteesOf(mentor.id).length;
                        const isFull =
                          cnt >= MAX_FILHINHOS_PER_MENTOR &&
                          m.mentorId !== mentor.id;
                        return (
                          <option
                            key={mentor.id}
                            value={mentor.id}
                            disabled={isFull}
                          >
                            {mentor.fullName} ({cnt}/{MAX_FILHINHOS_PER_MENTOR})
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              ) : (
                <div className="text-slate-600">
                  Ala {m.wing || 'Masculina'}
                  {m.role === 'filhinho' &&
                    ` · Líder: ${
                      members.find((x) => x.id === m.mentorId)?.fullName ||
                      'Sem líder atribuído'
                    }`}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Ala</th>
                <th className="py-3 px-4">Cargo no Organograma</th>
                <th className="py-3 px-4">
                  Líder em Treinamento (para Filhinho)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleMembers.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <MemberAvatar
                        name={m.fullName}
                        photoDataUrl={m.photoDataUrl}
                        wing={m.wing}
                        size="sm"
                      />
                      <span>{m.fullName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {permissions.canManageOrganogram ? (
                      <select
                        disabled={busyId === m.id}
                        value={m.wing || 'Masculina'}
                        onChange={(e) =>
                          handleAssign(
                            m,
                            m.role,
                            e.target.value as CellWing,
                            m.mentorId || '',
                          )
                        }
                        className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-xs"
                      >
                        <option value="Masculina">Ala Masculina</option>
                        <option value="Feminina">Ala Feminina</option>
                      </select>
                    ) : (
                      <span className="text-slate-700">
                        Ala {m.wing || 'Masculina'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {permissions.canManageOrganogram && m.role !== 'lider' ? (
                      <select
                        disabled={busyId === m.id}
                        value={m.role}
                        onChange={(e) =>
                          handleAssign(
                            m,
                            e.target.value as CellRole,
                            m.wing || 'Masculina',
                            m.mentorId || '',
                          )
                        }
                        className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-xs"
                      >
                        <option
                          value="lider_treinamento"
                          disabled={
                            trainers.length >= MAX_TRAINERS_PER_CELL &&
                            m.role !== 'lider_treinamento'
                          }
                        >
                          Líder em Treinamento ({trainers.length}/
                          {MAX_TRAINERS_PER_CELL})
                        </option>
                        <option value="secretario">Secretário(a)</option>
                        <option value="anfitriao">Anfitrião(ã)</option>
                        <option value="filhinho">Filhinho(a)</option>
                        <option value="visitante">Visitante</option>
                        <option value="membro">Membro</option>
                      </select>
                    ) : (
                      <span className="font-medium text-slate-800">
                        {ROLE_LABELS[m.role]}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {m.role === 'filhinho' ? (
                      permissions.canManageOrganogram ? (
                        <select
                          disabled={busyId === m.id}
                          value={m.mentorId || ''}
                          onChange={(e) =>
                            handleAssign(
                              m,
                              'filhinho',
                              m.wing || 'Masculina',
                              e.target.value,
                            )
                          }
                          className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-xs"
                        >
                          <option value="">
                            Sem líder em treinamento atribuído
                          </option>
                          {trainers.map((mentor) => {
                            const cnt = getTotalMenteesOf(mentor.id).length;
                            const isFull =
                              cnt >= MAX_FILHINHOS_PER_MENTOR &&
                              m.mentorId !== mentor.id;
                            return (
                              <option
                                key={mentor.id}
                                value={mentor.id}
                                disabled={isFull}
                              >
                                {mentor.fullName} ({cnt}/
                                {MAX_FILHINHOS_PER_MENTOR})
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <span className="text-slate-600">
                          {members.find((x) => x.id === m.mentorId)?.fullName ||
                            'Sem líder atribuído'}
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Selecionar Irmão / Membro já Registrado (SEM campos para preencher) */}
      {pickerTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setPickerTarget(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {pickerTarget.title}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toque em qualquer irmão já registrado na célula para selecionar imediatamente para{' '}
                  <strong>{ROLE_LABELS[pickerTarget.role]}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerTarget(null)}
                aria-label="Fechar lista"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role switch pills when filling generally */}
            {!pickerTarget.mentorId && (
              <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-1.5">
                {QUICK_ASSIGNABLE_ROLES.map((item) => {
                  const active = pickerTarget.role === item.role;
                  return (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => {
                        setPickerError(null);
                        setPickerTarget((prev) =>
                          prev
                            ? {
                                ...prev,
                                role: item.role,
                                title: `Selecionar Irmão para ${item.label}`,
                              }
                            : prev,
                        );
                        if (item.role === 'filhinho' && !pickerMentorId) {
                          const avail = trainers.find(
                            (tr) =>
                              getTotalMenteesOf(tr.id).length <
                              MAX_FILHINHOS_PER_MENTOR,
                          );
                          setPickerMentorId(avail?.id || trainers[0]?.id || '');
                        }
                      }}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* If picking a filhinho without pre-chosen mentor, let user pick which trainer */}
            {pickerTarget.role === 'filhinho' && !pickerTarget.mentorId && (
              <div className="px-5 py-2.5 border-b border-slate-200 bg-teal-50/40">
                <label className="block text-[11px] font-semibold text-teal-900 mb-1">
                  Líder em Treinamento responsável por este filhinho:
                </label>
                <select
                  value={pickerMentorId}
                  onChange={(e) => setPickerMentorId(e.target.value)}
                  className="w-full min-h-[38px] px-2.5 py-1.5 text-xs bg-white border border-teal-200 rounded-lg"
                >
                  <option value="">Sem líder atribuído</option>
                  {trainers.map((tr) => {
                    const cnt = getTotalMenteesOf(tr.id).length;
                    return (
                      <option
                        key={tr.id}
                        value={tr.id}
                        disabled={cnt >= MAX_FILHINHOS_PER_MENTOR}
                      >
                        {tr.fullName} ({cnt}/{MAX_FILHINHOS_PER_MENTOR})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Quick filter (optional, full list is already shown below) */}
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Filtrar nome na lista (opcional)..."
                  className="w-full pl-9 pr-3 py-2 min-h-[40px] text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
              {pickerError && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {pickerError}
                </div>
              )}
            </div>

            {/* Full list of all registered members immediately visible */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {selectableRegisteredMembers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {members.length <= 1
                    ? 'Nenhum outro membro registrado na célula ainda. Cadastre as fichas na aba Membros & Acessos para selecioná-los aqui.'
                    : `Nenhum irmão encontrado para "${pickerSearch}".`}
                </div>
              ) : (
                selectableRegisteredMembers.map((m) => {
                  const targetMentor =
                    pickerTarget.role === 'filhinho'
                      ? pickerTarget.mentorId || pickerMentorId
                      : '';
                  const alreadyInSlot =
                    pickerTarget.role === 'filhinho'
                      ? m.role === 'filhinho' && m.mentorId === targetMentor
                      : m.role === pickerTarget.role;
                  const currentMentor = m.mentorId
                    ? members.find((x) => x.id === m.mentorId)
                    : null;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={assigningId !== null || alreadyInSlot}
                      onClick={() => handleSelectMemberForTarget(m)}
                      className={`w-full px-5 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                        alreadyInSlot
                          ? 'bg-teal-50/70 cursor-default'
                          : 'hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <MemberAvatar
                          name={m.fullName}
                          photoDataUrl={m.photoDataUrl}
                          wing={m.wing}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {m.fullName}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {ROLE_LABELS[m.role]} · Ala {m.wing || 'Masculina'}
                            {currentMentor
                              ? ` · Mentor: ${currentMentor.fullName}`
                              : ''}
                          </div>
                        </div>
                      </div>

                      {alreadyInSlot ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 shrink-0">
                          <Check className="w-4 h-4" />
                          Já na vaga
                        </span>
                      ) : assigningId === m.id ? (
                        <span className="text-xs font-semibold text-teal-700 shrink-0">
                          Selecionando...
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg shrink-0">
                          Selecionar
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-5 py-3 pb-safe bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between gap-2">
              <span>
                Mostrando {selectableRegisteredMembers.length} irmão(s) registrado(s)
              </span>
              <span>Cadastros novos em Membros & Acessos</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
