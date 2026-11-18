import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  GitFork,
  Home,
  Plus,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  assignOrganogramPlacement,
  saveMemberWithPrivateInfo,
} from '../lib/cellService';
import {
  MAX_FILHINHOS_PER_MENTOR,
  MAX_TRAINERS_PER_CELL,
  ROLE_LABELS,
  type ActivityLevel,
  type BaptismStatus,
  type CellMember,
  type CellRole,
  type CellWing,
  type CellWorkspace,
  type RolePermissions,
} from '../types/cell';

interface OrganogramViewProps {
  cell: CellWorkspace;
  currentUid: string;
  permissions: RolePermissions;
  members: CellMember[];
}

export function OrganogramView({
  cell,
  currentUid,
  permissions,
  members,
}: OrganogramViewProps) {
  const [wingFilter, setWingFilter] = useState<'Todas' | CellWing>('Todas');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add person modal from Organogram
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<CellRole>('filhinho');
  const [newWing, setNewWing] = useState<CellWing>('Masculina');
  const [newMentorId, setNewMentorId] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newBirthDate, setNewBirthDate] = useState('');
  const [newBaptismStatus, setNewBaptismStatus] =
    useState<BaptismStatus>('Não Batizado');
  const [newActivityLevel, setNewActivityLevel] =
    useState<ActivityLevel>('Ativo');
  const [newIsChurchMember, setNewIsChurchMember] = useState(true);
  const [newNotes, setNewNotes] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [createdBanner, setCreatedBanner] = useState<{
    fullName: string;
    memberCode: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const visibleMembers = useMemo(() => {
    if (wingFilter === 'Todas') return members;
    return members.filter((m) => (m.wing || 'Masculina') === wingFilter);
  }, [members, wingFilter]);

  const leaders = useMemo(
    () => members.filter((m) => m.role === 'lider'),
    [members],
  );
  const trainers = useMemo(
    () => members.filter((m) => m.role === 'lider_treinamento'),
    [members],
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
    return members.filter(
      (m) => m.role === 'filhinho' && m.mentorId && leaderIds.has(m.mentorId),
    );
  }, [members, leaders]);

  const getMenteesOf = (mentorId: string) =>
    visibleMembers.filter(
      (m) => m.role === 'filhinho' && m.mentorId === mentorId,
    );

  const getTotalMenteesOf = (mentorId: string) =>
    members.filter((m) => m.role === 'filhinho' && m.mentorId === mentorId);

  const totalAssignedUnderTrainers = useMemo(
    () =>
      trainers.reduce(
        (acc, tr) => acc + getTotalMenteesOf(tr.id).length,
        0,
      ),
    [trainers, members],
  );

  const openAddPersonModal = (preset?: {
    role?: CellRole;
    mentorId?: string;
    wing?: CellWing;
  }) => {
    setNewName('');
    setNewRole(preset?.role || 'filhinho');
    setNewWing(
      preset?.wing || (wingFilter === 'Todas' ? 'Masculina' : wingFilter),
    );
    setNewMentorId(preset?.mentorId || '');
    setNewPhone('');
    setNewBirthDate('');
    setNewBaptismStatus('Não Batizado');
    setNewActivityLevel('Ativo');
    setNewIsChurchMember(preset?.role !== 'visitante');
    setNewNotes('');
    setAddError(null);
    setAddOpen(true);
  };

  const handleSaveNewPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim().length < 2) {
      setAddError('Informe o nome completo da pessoa.');
      return;
    }
    setSavingNew(true);
    setAddError(null);
    try {
      const res = await saveMemberWithPrivateInfo({
        cell,
        existingMember: null,
        allMembers: members,
        currentUid,
        canManageRoles: permissions.canManageOrganogram,
        data: {
          fullName: newName.trim(),
          role: newRole,
          wing: newWing,
          mentorId: newRole === 'filhinho' ? newMentorId : '',
          activityLevel: newActivityLevel,
          isChurchMember: newIsChurchMember,
          baptismStatus: newBaptismStatus,
          memberEmail: '',
          phone: newPhone.trim(),
          address: '',
          birthDate: newBirthDate,
          baptismDate: '',
          notes: newNotes.trim(),
        },
      });
      setCreatedBanner({
        fullName: newName.trim(),
        memberCode: res.memberCode,
      });
      setCopiedCode(false);
      setAddOpen(false);
    } catch (err) {
      setAddError(
        err instanceof Error
          ? err.message
          : 'Não foi possível adicionar a pessoa no organograma.',
      );
    } finally {
      setSavingNew(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Clipboard may be unavailable in restricted contexts
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

  const femaleWingMembers = useMemo(
    () => members.filter((m) => (m.wing || 'Masculina') === 'Feminina'),
    [members],
  );

  const assignablePool = useMemo(
    () =>
      members.filter(
        (m) =>
          m.role === 'filhinho' ||
          m.role === 'visitante' ||
          m.role === 'membro',
      ),
    [members],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Organograma da Célula
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Hierarquia organizada: Líder da Célula → {MAX_TRAINERS_PER_CELL} Líderes em Treinamento → até {MAX_FILHINHOS_PER_MENTOR} Filhinhos por líder em treinamento, além de Secretário, Anfitrião, Visitantes e Ala Feminina.
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
              onClick={() => openAddPersonModal()}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              Adicionar Pessoa
            </button>
          )}
        </div>
      </div>

      {createdBanner && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-teal-900">
            <strong>{createdBanner.fullName}</strong> adicionado(a) ao organograma! Código de acesso individual gerado:{' '}
            <span className="font-mono font-bold text-teal-950 bg-white border border-teal-300 px-2 py-0.5 rounded ml-1">
              {createdBanner.memberCode}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopyCode(createdBanner.memberCode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-white border border-teal-300 hover:bg-teal-100 rounded-lg cursor-pointer"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Código
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setCreatedBanner(null)}
              aria-label="Fechar aviso"
              className="p-1.5 text-teal-700 hover:text-teal-950 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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

      {/* Nível 1: Líder da Célula (supervisiona até 3 Líderes em Treinamento) + Equipe de Apoio */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Nível 1 · Liderança Principal e Equipe de Apoio
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Código da célula: <strong className="font-mono text-slate-900">{cell.accessCode}</strong>
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
                  <div>
                    <div className="text-xs font-medium text-teal-700">
                      {ROLE_LABELS.lider} · Ala {leader.wing || 'Masculina'}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                      {leader.fullName}
                    </h3>
                  </div>
                  <div className="text-xs font-mono tabular-nums font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-md">
                    {trainers.length} / {MAX_TRAINERS_PER_CELL} líderes em treinamento
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
                      {totalAssignedUnderTrainers} / {MAX_TRAINERS_PER_CELL * MAX_FILHINHOS_PER_MENTOR}
                    </div>
                  </div>
                </div>

                {legacyLeaderFilhinhos.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                    <p className="text-xs font-medium text-amber-900">
                      Reatribua estes filhinhos para um dos {MAX_TRAINERS_PER_CELL} Líderes em Treinamento:
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
                                handleAssign(f, 'filhinho', f.wing || 'Masculina', '')
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
                        openAddPersonModal({ role: 'lider_treinamento' })
                      }
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Preencher Vaga de Líder em Treinamento ({trainers.length}/{MAX_TRAINERS_PER_CELL})
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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 tabular-nums">
                    {secretaries.length}
                  </span>
                  {permissions.canManageOrganogram && (
                    <button
                      type="button"
                      onClick={() => openAddPersonModal({ role: 'secretario' })}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
                    >
                      + Adicionar
                    </button>
                  )}
                </div>
              </div>
              {secretaries.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhum secretário(a) atribuído ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {secretaries.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-b-0"
                    >
                      <span className="font-semibold text-slate-900">
                        {s.fullName}
                      </span>
                      <span className="text-slate-500">
                        Ala {s.wing || 'Masculina'} · {s.activityLevel}
                      </span>
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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 tabular-nums">
                    {hosts.length}
                  </span>
                  {permissions.canManageOrganogram && (
                    <button
                      type="button"
                      onClick={() => openAddPersonModal({ role: 'anfitriao' })}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
                    >
                      + Adicionar
                    </button>
                  )}
                </div>
              </div>
              {hosts.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhum anfitrião(ã) atribuído ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {hosts.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-b-0"
                    >
                      <span className="font-semibold text-slate-900">
                        {h.fullName}
                      </span>
                      <span className="text-slate-500">
                        Ala {h.wing || 'Masculina'} · {h.activityLevel}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nível 2 e 3: Grade fixa de 3 Líderes em Treinamento -> 3 Filhinhos cada */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Nível 2 e 3 · {MAX_TRAINERS_PER_CELL} Líderes em Treinamento e seus {MAX_FILHINHOS_PER_MENTOR} Filhinhos
            </h2>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {trainers.length}/{MAX_TRAINERS_PER_CELL} líderes em treinamento · Máx. {MAX_FILHINHOS_PER_MENTOR} filhinhos cada
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
                    Responsável por acompanhar até {MAX_FILHINHOS_PER_MENTOR} filhinhos nesta frente.
                  </p>
                  {permissions.canManageOrganogram && (
                    <button
                      type="button"
                      onClick={() =>
                        openAddPersonModal({ role: 'lider_treinamento' })
                      }
                      className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar Líder em Treinamento
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
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold text-teal-700">
                      Vaga {slotIdx + 1} · Ala {tr.wing || 'Masculina'}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-800">
                      {totalCount} / {MAX_FILHINHOS_PER_MENTOR} filhinhos
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {tr.fullName}
                  </h3>

                  <div className="mt-4 space-y-2">
                    {Array.from(
                      { length: MAX_FILHINHOS_PER_MENTOR },
                      (_, fIdx) => {
                        const f = mentees[fIdx] || null;
                        if (!f) {
                          return (
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
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">
                                {fIdx + 1}. {f.fullName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Ala {f.wing || 'Masculina'} · {f.activityLevel}
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
                        +{hiddenOtherWingCount} filhinho(s) de outra ala vinculado(s) a este líder.
                      </p>
                    )}
                  </div>
                </div>

                {permissions.canManageOrganogram &&
                  totalCount < MAX_FILHINHOS_PER_MENTOR && (
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <select
                        defaultValue=""
                        disabled={busyId !== null}
                        onChange={(e) => {
                          const target = members.find(
                            (x) => x.id === e.target.value,
                          );
                          if (target) {
                            handleAssign(
                              target,
                              'filhinho',
                              target.wing || 'Masculina',
                              tr.id,
                            );
                          }
                          e.target.value = '';
                        }}
                        className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">
                          + Vincular filhinho existente ({totalCount}/{MAX_FILHINHOS_PER_MENTOR})...
                        </option>
                        {assignablePool
                          .filter((x) => x.mentorId !== tr.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.fullName} (Ala {x.wing || 'Masculina'})
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          openAddPersonModal({
                            role: 'filhinho',
                            mentorId: tr.id,
                            wing: tr.wing || 'Masculina',
                          })
                        }
                        className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Novo Filhinho
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ala Feminina em Destaque */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
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
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {fm.fullName}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      {ROLE_LABELS[fm.role]}
                      {mentor ? ` · Mentora: ${mentor.fullName}` : ''}
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
            {visitors.length} visitante(s) · {unassignedFilhinhos.length} filhinho(s) sem mentor · {generalMembers.length} membro(s)
          </span>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {visibleMembers.map((m) => (
            <div key={m.id} className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">
                  {m.fullName}
                </span>
                <span className="text-slate-500">
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
                        Líder em Treinamento ({trainers.length}/{MAX_TRAINERS_PER_CELL})
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
                      <option value="">Sem líder em treinamento atribuído</option>
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
                <th className="py-3 px-4">Líder em Treinamento (para Filhinho)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleMembers.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {m.fullName}
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
                          Líder em Treinamento ({trainers.length}/{MAX_TRAINERS_PER_CELL})
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
                          <option value="">Sem líder em treinamento atribuído</option>
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

      {/* Modal: Adicionar Pessoa Direto no Organograma */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-xl p-5 sm:p-8 max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Adicionar Pessoa no Organograma
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Cadastre líderes em treinamento, filhinhos (máx. {MAX_FILHINHOS_PER_MENTOR} por mentor), secretário(a), anfitrião(ã) ou visitantes diretamente na hierarquia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {addError}
              </div>
            )}

            <form onSubmit={handleSaveNewPerson} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={120}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex.: Pedro Henrique"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cargo no Organograma *
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as CellRole;
                      setNewRole(nextRole);
                      if (nextRole !== 'filhinho') setNewMentorId('');
                      if (nextRole === 'visitante') setNewIsChurchMember(false);
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option
                      value="lider_treinamento"
                      disabled={trainers.length >= MAX_TRAINERS_PER_CELL}
                    >
                      Líder em Treinamento ({trainers.length}/{MAX_TRAINERS_PER_CELL})
                    </option>
                    <option value="filhinho">Filhinho(a)</option>
                    <option value="secretario">Secretário(a)</option>
                    <option value="anfitriao">Anfitrião(ã)</option>
                    <option value="visitante">Visitante</option>
                    <option value="membro">Membro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ala da Célula *
                  </label>
                  <select
                    value={newWing}
                    onChange={(e) => setNewWing(e.target.value as CellWing)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Masculina">Ala Masculina</option>
                    <option value="Feminina">Ala Feminina</option>
                  </select>
                </div>
              </div>

              {newRole === 'filhinho' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Líder em Treinamento Responsável (máx. {MAX_FILHINHOS_PER_MENTOR} filhinhos por líder)
                  </label>
                  <select
                    value={newMentorId}
                    onChange={(e) => setNewMentorId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Sem líder em treinamento atribuído ainda</option>
                    {trainers.map((mentor) => {
                      const cnt = getTotalMenteesOf(mentor.id).length;
                      return (
                        <option
                          key={mentor.id}
                          value={mentor.id}
                          disabled={cnt >= MAX_FILHINHOS_PER_MENTOR}
                        >
                          {mentor.fullName} ({cnt}/{MAX_FILHINHOS_PER_MENTOR} filhinhos)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    maxLength={40}
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="(11) 99999-0000"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data de Nascimento
                  </label>
                  <input
                    type="date"
                    value={newBirthDate}
                    onChange={(e) => setNewBirthDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Batismo
                  </label>
                  <select
                    value={newBaptismStatus}
                    onChange={(e) =>
                      setNewBaptismStatus(e.target.value as BaptismStatus)
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Batizado">Batizado</option>
                    <option value="Em Preparação">Em Preparação</option>
                    <option value="Não Batizado">Não Batizado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nível de Atividade
                  </label>
                  <select
                    value={newActivityLevel}
                    onChange={(e) =>
                      setNewActivityLevel(e.target.value as ActivityLevel)
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Muito Ativo">Muito Ativo</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Novo Convertido">Novo Convertido</option>
                    <option value="Irregular">Irregular</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer pt-4">
                  <input
                    type="checkbox"
                    checked={newIsChurchMember}
                    onChange={(e) => setNewIsChurchMember(e.target.checked)}
                    className="w-4 h-4 accent-teal-700"
                  />
                  Já é membro oficial da igreja
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Notas breves sobre discipulado ou acompanhamento..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingNew}
                  className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  {savingNew ? 'Salvando...' : 'Adicionar e Gerar Código'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
