import React, { useEffect, useState } from 'react';
import { Check, Copy, Lock, UserCheck } from 'lucide-react';
import { formatDatePt } from '../lib/cellAnalytics';
import { fetchMemberPrivateInfo } from '../lib/cellService';
import {
  ROLE_LABELS,
  type CellMember,
  type CellWorkspace,
  type MemberPrivateInfo,
} from '../types/cell';

interface MyFichaViewProps {
  cell: CellWorkspace;
  member: CellMember | null;
  allMembers: CellMember[];
}

export function MyFichaView({ cell, member, allMembers }: MyFichaViewProps) {
  const [priv, setPriv] = useState<MemberPrivateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!member) {
        setPriv(null);
        return;
      }
      setLoading(true);
      const data = await fetchMemberPrivateInfo(member.id);
      if (active) {
        setPriv(data);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [member]);

  if (!member) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <UserCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-slate-900">
          Ficha ainda não vinculada
        </h2>
        <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
          Peça ao Líder da Célula para cadastrar sua ficha e gerar seu código individual de acesso.
        </p>
      </div>
    );
  }

  const mentor = member.mentorId
    ? allMembers.find((m) => m.id === member.mentorId)
    : null;

  const handleCopyCode = async () => {
    if (!member.memberCode) return;
    try {
      await navigator.clipboard.writeText(member.memberCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Minha Ficha na Célula
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Visualização da sua ficha cadastral na {cell.name}.
          </p>
        </div>

        {member.memberCode && (
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Código da Ficha:</span>
            <strong className="font-mono text-slate-900">
              {member.memberCode}
            </strong>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
        )}
      </div>

      {/* Somente Leitura Notice */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl px-5 py-3.5 flex items-start gap-3 text-xs text-slate-700">
        <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Modo somente leitura:</strong> membros não podem editar ou alterar dados cadastrais. Caso precise atualizar telefone, endereço ou batismo, solicite diretamente ao Líder da Célula.
        </p>
      </div>

      {/* Organogram summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <div className="text-slate-500">Cargo no Organograma</div>
          <div className="text-sm font-bold text-teal-800 mt-1">
            {ROLE_LABELS[member.role]}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Ala</div>
          <div className="text-sm font-semibold text-slate-900 mt-1">
            Ala {member.wing || 'Masculina'}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Mentor / Responsável</div>
          <div className="text-sm font-semibold text-slate-900 mt-1">
            {mentor ? mentor.fullName : 'Liderança da Célula'}
          </div>
        </div>
      </div>

      {/* Read-only Ficha Details */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        {loading ? (
          <p className="text-xs text-slate-500">Carregando ficha...</p>
        ) : (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 text-xs">
              <div className="sm:col-span-2 pb-4 border-b border-slate-100">
                <dt className="text-slate-500">Nome Completo</dt>
                <dd className="text-lg font-bold text-slate-900 mt-0.5">
                  {member.fullName}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Data de Nascimento</dt>
                <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-1">
                  {priv?.birthDate ? formatDatePt(priv.birthDate) : 'Não informado'}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Telefone para Contato</dt>
                <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-1">
                  {priv?.phone || 'Não informado'}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-slate-500">Endereço Atualizado</dt>
                <dd className="font-medium text-slate-900 mt-1">
                  {priv?.address || 'Não informado'}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Nível de Atividade</dt>
                <dd className="font-semibold text-slate-900 mt-1">
                  {member.activityLevel}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Membro da Igreja</dt>
                <dd className="font-semibold text-slate-900 mt-1">
                  {member.isChurchMember ? 'Sim' : 'Não'}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Status de Batismo</dt>
                <dd className="font-semibold text-slate-900 mt-1">
                  {member.baptismStatus}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Data de Batismo</dt>
                <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-1">
                  {priv?.baptismDate ? formatDatePt(priv.baptismDate) : '—'}
                </dd>
              </div>
            </dl>

            <div className="pt-4 border-t border-slate-100 text-xs">
              <div className="font-semibold text-slate-700 mb-1.5">
                Observações Registradas
              </div>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                {priv?.notes || 'Nenhuma observação registrada.'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
