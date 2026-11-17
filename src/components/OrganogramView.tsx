import React, { useMemo, useState } from 'react';
import { GitFork, Home, Shield, UserCheck, UserPlus, Users } from 'lucide-react';
import { assignOrganogramPlacement } from '../lib/cellService';
import {
  MAX_FILHINHOS_PER_MENTOR,
  MAX_TRAINERS_PER_CELL,
  ROLE_LABELS,
  type CellMember,
  type CellRole,
  type CellWing,
  type CellWorkspace,
  type RolePermissions,
} from '../types/cell';

interface OrganogramViewProps {
  cell: CellWorkspace;
  permissions: RolePermissions;
  members: CellMember[];
}

export function OrganogramView({
  cell,
  permissions,
  members,
}: OrganogramViewProps) {
  const [wingFilter, setWingFilter] = useState<'Todas' | CellWing>('Todas');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const allMentors = useMemo(() => [...leaders, ...trainers], [leaders, trainers]);

  const getMenteesOf = (mentorId: string) =>
    visibleMembers.filter(
      (m) => m.role === 'filhinho' && m.mentorId === mentorId,
    );

  const getTotalMenteesOf = (mentorId: string) =>
    members.filter((m) => m.role === 'filhinho' && m.mentorId === mentorId);

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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Organograma da Célula
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Distribuição de Líder, até {MAX_TRAINERS_PER_CELL} Líderes em Treinamento, Secretário, Anfitrião, Filhinhos (máx. {MAX_FILHINHOS_PER_MENTOR} por líder), Visitantes e Ala Feminina.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg shrink-0">
          {(['Todas', 'Feminina', 'Masculina'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWingFilter(w)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                wingFilter === w
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {w === 'Todas' ? 'Todas as Alas' : `Ala ${w}`}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
        >
          {errorMsg}
        </div>
      )}

      {/* Nível 1: Líder da Célula + seus até 3 Filhinhos */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Liderança Principal da Célula
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Código da célula: <strong className="font-mono text-slate-900">{cell.accessCode}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-5">
          {leaders.map((leader) => {
            const directMentees = getMenteesOf(leader.id);
            const totalDirectCount = getTotalMenteesOf(leader.id).length;
            return (
              <div
                key={leader.id}
                className="border border-slate-200 rounded-xl p-5 bg-slate-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-teal-700">
                      {ROLE_LABELS.lider} · Ala {leader.wing || 'Masculina'}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                      {leader.fullName}
                    </h3>
                  </div>
                  <div className="text-xs font-mono tabular-nums font-semibold text-slate-700">
                    {totalDirectCount} / {MAX_FILHINHOS_PER_MENTOR} filhinhos
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80">
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Filhinhos sob controle direto
                  </div>
                  {directMentees.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Nenhum filhinho vinculado diretamente na ala selecionada.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {directMentees.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center justify-between gap-2 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">
                              {f.fullName}
                            </span>
                            <span className="text-slate-500 ml-2">
                              Ala {f.wing || 'Masculina'}
                            </span>
                          </div>
                          {permissions.canManageOrganogram && (
                            <button
                              type="button"
                              disabled={busyId === f.id}
                              onClick={() =>
                                handleAssign(f, 'filhinho', f.wing || 'Masculina', '')
                              }
                              className="text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                            >
                              Desvincular
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {permissions.canManageOrganogram &&
                    totalDirectCount < MAX_FILHINHOS_PER_MENTOR && (
                      <div className="mt-3">
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
                                leader.id,
                              );
                            }
                            e.target.value = '';
                          }}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="">
                            + Vincular filhinho ao Líder ({totalDirectCount}/{MAX_FILHINHOS_PER_MENTOR})...
                          </option>
                          {assignablePool
                            .filter((x) => x.mentorId !== leader.id)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.fullName} ({ROLE_LABELS[x.role]} · Ala {x.wing || 'Masculina'})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                </div>
              </div>
            );
          })}

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
                <span className="text-xs text-slate-500 tabular-nums">
                  {secretaries.length}
                </span>
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
                <span className="text-xs text-slate-500 tabular-nums">
                  {hosts.length}
                </span>
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

      {/* Nível 2: Líderes em Treinamento (máx. 3), cada um controlando até 3 Filhinhos */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Líderes em Treinamento ({trainers.length} / {MAX_TRAINERS_PER_CELL}) e seus Filhinhos
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Cada líder em treinamento controla no máximo {MAX_FILHINHOS_PER_MENTOR} filhinhos
          </span>
        </div>

        {trainers.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            Nenhum Líder em Treinamento distribuído ainda.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
            {trainers.map((tr) => {
              const mentees = getMenteesOf(tr.id);
              const totalCount = getTotalMenteesOf(tr.id).length;
              return (
                <div
                  key={tr.id}
                  className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-semibold text-teal-700">
                        Ala {tr.wing || 'Masculina'}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-800">
                        {totalCount} / {MAX_FILHINHOS_PER_MENTOR}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {tr.fullName}
                    </h3>

                    <div className="mt-4 space-y-2">
                      {mentees.length === 0 ? (
                        <p className="text-xs text-slate-500 py-2">
                          Sem filhinhos vinculados na ala atual.
                        </p>
                      ) : (
                        mentees.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">
                                {f.fullName}
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
                        ))
                      )}
                    </div>
                  </div>

                  {permissions.canManageOrganogram &&
                    totalCount < MAX_FILHINHOS_PER_MENTOR && (
                      <div className="mt-4 pt-3 border-t border-slate-100">
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
                            + Distribuir filhinho ({totalCount}/{MAX_FILHINHOS_PER_MENTOR})...
                          </option>
                          {assignablePool
                            .filter((x) => x.mentorId !== tr.id)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.fullName} (Ala {x.wing || 'Masculina'})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
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
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Distribuição de Cargos, Alas e Visitantes
            </h2>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {visitors.length} visitante(s) · {unassignedFilhinhos.length} filhinho(s) sem mentor · {generalMembers.length} membro(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Ala</th>
                <th className="py-3 px-4">Cargo no Organograma</th>
                <th className="py-3 px-4">Mentor (para Filhinho)</th>
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
                        <option value="lider_treinamento">Líder em Treinamento</option>
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
                          <option value="">Sem mentor atribuído</option>
                          {allMentors.map((mentor) => {
                            const cnt = getTotalMenteesOf(mentor.id).length;
                            return (
                              <option key={mentor.id} value={mentor.id}>
                                {mentor.fullName} ({cnt}/{MAX_FILHINHOS_PER_MENTOR})
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <span className="text-slate-600">
                          {members.find((x) => x.id === m.mentorId)?.fullName ||
                            'Sem mentor'}
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
    </div>
  );
}
