import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Phone, Search, User, X } from 'lucide-react';
import {
  formatDatePt,
  formatMonthLabelPt,
  getMemberMonthlyResponsibilities,
} from '../lib/cellAnalytics';
import { fetchMemberPrivateInfo } from '../lib/cellService';
import {
  ROLE_LABELS,
  type CellMember,
  type MemberPrivateInfo,
  type MonthlyPlan,
  type RolePermissions,
} from '../types/cell';

interface MemberResponsibilitySearchProps {
  members: CellMember[];
  monthPlans: MonthlyPlan[];
  selectedMonth: string;
  permissions: RolePermissions;
  currentMemberId?: string;
}

export function MemberResponsibilitySearch({
  members,
  monthPlans,
  selectedMonth,
  permissions,
  currentMemberId,
}: MemberResponsibilitySearchProps) {
  const [queryText, setQueryText] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [priv, setPriv] = useState<MemberPrivateInfo | null>(null);
  const [loadingPriv, setLoadingPriv] = useState(false);

  const matchingMembers = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    const list = q
      ? members.filter(
          (m) =>
            m.fullName.toLowerCase().includes(q) ||
            ROLE_LABELS[m.role].toLowerCase().includes(q) ||
            (m.wing || 'Masculina').toLowerCase().includes(q) ||
            (m.memberCode && m.memberCode.toLowerCase().includes(q)),
        )
      : members;
    return [...list].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [members, queryText]);

  const activeMember = useMemo(() => {
    if (selectedId) {
      return members.find((m) => m.id === selectedId) || null;
    }
    if (queryText.trim() && matchingMembers.length > 0) {
      return matchingMembers[0];
    }
    return null;
  }, [selectedId, members, queryText, matchingMembers]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!activeMember) {
        setPriv(null);
        return;
      }
      const canSeePii =
        permissions.canViewMemberPII || activeMember.id === currentMemberId;
      if (!canSeePii) {
        setPriv(null);
        return;
      }
      setLoadingPriv(true);
      const data = await fetchMemberPrivateInfo(activeMember.id);
      if (active) {
        setPriv(data);
        setLoadingPriv(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [activeMember, permissions.canViewMemberPII, currentMemberId]);

  const assignments = useMemo(() => {
    if (!activeMember) return [];
    return getMemberMonthlyResponsibilities(activeMember.fullName, monthPlans);
  }, [activeMember, monthPlans]);

  const mentor = activeMember?.mentorId
    ? members.find((m) => m.id === activeMember.mentorId)
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Buscar Pessoa: Dados e Responsabilidades no Mês
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pesquise qualquer integrante pelo nome, cargo, ala ou código para consultar dados e escalas de {formatMonthLabelPt(selectedMonth)}.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={queryText}
            onChange={(e) => {
              setQueryText(e.target.value);
              setSelectedId('');
            }}
            placeholder="Digite nome ou cargo..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
          />
          {(queryText || selectedId) && (
            <button
              type="button"
              onClick={() => {
                setQueryText('');
                setSelectedId('');
              }}
              aria-label="Limpar busca"
              className="p-1 text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick selection chips for filtered or top members */}
      <div className="flex sm:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
        {matchingMembers.slice(0, 10).map((m) => {
          const isChosen = activeMember?.id === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className={`px-3 py-2 min-h-[36px] text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isChosen
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {m.fullName}
            </button>
          );
        })}
        {matchingMembers.length === 0 && (
          <span className="text-xs text-slate-500">
            Nenhuma pessoa encontrada com &ldquo;{queryText}&rdquo;.
          </span>
        )}
      </div>

      {activeMember && (
        <div className="pt-4 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Member Profile Summary */}
          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {activeMember.fullName}
                  </div>
                  <div className="text-teal-700 font-semibold">
                    {ROLE_LABELS[activeMember.role]} · Ala{' '}
                    {activeMember.wing || 'Masculina'}
                  </div>
                </div>
              </div>
              {permissions.canManageAllMembers && activeMember.memberCode && (
                <span className="font-mono font-semibold text-slate-800 bg-white border border-slate-200 px-2 py-1 rounded">
                  {activeMember.memberCode}
                </span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2 border-t border-slate-200/80">
              <div>
                <dt className="text-slate-500">Atividade</dt>
                <dd className="font-semibold text-slate-900">
                  {activeMember.activityLevel}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Batismo</dt>
                <dd className="font-semibold text-slate-900">
                  {activeMember.baptismStatus}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Membro da Igreja</dt>
                <dd className="font-semibold text-slate-900">
                  {activeMember.isChurchMember ? 'Sim' : 'Não'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Mentor</dt>
                <dd className="font-semibold text-slate-900">
                  {mentor ? mentor.fullName : '—'}
                </dd>
              </div>
            </dl>

            {(permissions.canViewMemberPII ||
              activeMember.id === currentMemberId) && (
              <div className="pt-2 border-t border-slate-200/80 space-y-1">
                {loadingPriv ? (
                  <span className="text-slate-500">Carregando contato...</span>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono tabular-nums">
                        {priv?.phone || 'Telefone não informado'}
                      </span>
                    </div>
                    {priv?.address && (
                      <div className="text-slate-600">
                        Endereço: {priv.address}
                      </div>
                    )}
                    {priv?.birthDate && (
                      <div className="text-slate-600 tabular-nums">
                        Nascimento: {formatDatePt(priv.birthDate)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Monthly Responsibilities */}
          <div className="lg:col-span-7 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-teal-700" />
                <h3 className="text-xs font-bold text-slate-900">
                  Responsabilidades em {formatMonthLabelPt(selectedMonth)}
                </h3>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {assignments.length} escala(s)
              </span>
            </div>

            {assignments.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Nenhuma responsabilidade atribuída para {activeMember.fullName} neste mês.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {assignments.map(({ plan, roles }) => (
                  <div
                    key={plan.id}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-mono tabular-nums text-slate-500">
                        {formatDatePt(plan.date)} · {plan.time}
                        {plan.eventType && plan.eventType !== 'Reunião de Célula'
                          ? ` · ${plan.eventType}`
                          : ''}
                      </div>
                      <div className="font-semibold text-slate-900 truncate">
                        {plan.lessonTitle}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {roles.map((r) => (
                        <span
                          key={r}
                          className="px-2 py-0.5 font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
