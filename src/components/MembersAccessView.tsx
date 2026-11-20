import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Edit3,
  Eye,
  Lock,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { formatDatePt } from '../lib/cellAnalytics';
import {
  deleteMemberRecord,
  fetchMemberPrivateInfo,
  saveMemberWithPrivateInfo,
} from '../lib/cellService';
import { compressProfilePhoto } from '../lib/imageUtils';
import {
  MAX_FILHINHOS_PER_MENTOR,
  MAX_TRAINERS_PER_CELL,
  ROLE_HIERARCHY_ORDER,
  ROLE_LABELS,
  type ActivityLevel,
  type BaptismStatus,
  type CellMember,
  type CellRole,
  type CellWing,
  type CellWorkspace,
  type MemberPrivateInfo,
  type RolePermissions,
} from '../types/cell';
import { MemberAvatar } from './MemberAvatar';

interface MembersAccessViewProps {
  cell: CellWorkspace;
  currentUid: string;
  currentEmail: string;
  currentMemberId?: string;
  actualRole: CellRole;
  effectiveRole: CellRole;
  onChangePreviewRole: (role: CellRole) => void;
  permissions: RolePermissions;
  members: CellMember[];
}

const ACTIVITY_LEVELS: ActivityLevel[] = [
  'Muito Ativo',
  'Ativo',
  'Regular',
  'Inativo',
  'Novo Convertido',
];

const BAPTISM_STATUSES: BaptismStatus[] = [
  'Batizado',
  'Não Batizado',
  'Em Preparação',
];

export function MembersAccessView({
  cell,
  currentUid,
  currentEmail,
  currentMemberId,
  actualRole,
  effectiveRole,
  onChangePreviewRole,
  permissions,
  members,
}: MembersAccessViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'todos' | CellRole>('todos');
  const [wingFilter, setWingFilter] = useState<'Todas' | CellWing>('Todas');
  const [selectedMember, setSelectedMember] = useState<CellMember | null>(null);
  const [selectedPrivate, setSelectedPrivate] =
    useState<MemberPrivateInfo | null>(null);
  const [loadingPrivate, setLoadingPrivate] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedMemberCode, setCopiedMemberCode] = useState<string | null>(null);
  const [createdBanner, setCreatedBanner] = useState<{
    fullName: string;
    memberCode: string;
  } | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CellMember | null>(null);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<CellRole>('filhinho');
  const [wing, setWing] = useState<CellWing>('Feminina');
  const [mentorId, setMentorId] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('Ativo');
  const [isChurchMember, setIsChurchMember] = useState(true);
  const [baptismStatus, setBaptismStatus] =
    useState<BaptismStatus>('Não Batizado');
  const [baptismDate, setBaptismDate] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const modalPhotoInputRef = useRef<HTMLInputElement>(null);

  const trainersCount = useMemo(
    () => members.filter((m) => m.role === 'lider_treinamento').length,
    [members],
  );

  const potentialMentors = useMemo(
    () => members.filter((m) => m.role === 'lider_treinamento'),
    [members],
  );

  const filhinhoCountByMentor = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members) {
      if (m.role === 'filhinho' && m.mentorId) {
        map.set(m.mentorId, (map.get(m.mentorId) || 0) + 1);
      }
    }
    return map;
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members
      .filter((m) => {
        if (roleFilter !== 'todos' && m.role !== roleFilter) return false;
        if (wingFilter !== 'Todas' && (m.wing || 'Masculina') !== wingFilter) {
          return false;
        }
        if (
          searchTerm.trim() &&
          !m.fullName.toLowerCase().includes(searchTerm.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (ROLE_HIERARCHY_ORDER[a.role] !== ROLE_HIERARCHY_ORDER[b.role]) {
          return ROLE_HIERARCHY_ORDER[a.role] - ROLE_HIERARCHY_ORDER[b.role];
        }
        return a.fullName.localeCompare(b.fullName);
      });
  }, [members, roleFilter, wingFilter, searchTerm]);

  useEffect(() => {
    let active = true;
    async function loadPII() {
      if (!selectedMember) {
        setSelectedPrivate(null);
        return;
      }
      const isSelf =
        selectedMember.id === currentMemberId ||
        (Boolean(selectedMember.memberEmail) &&
          selectedMember.memberEmail?.toLowerCase() ===
            currentEmail.toLowerCase());
      if (!permissions.canViewMemberPII && !isSelf) {
        setSelectedPrivate(null);
        return;
      }
      setLoadingPrivate(true);
      const priv = await fetchMemberPrivateInfo(selectedMember.id);
      if (active) {
        setSelectedPrivate(priv);
        setLoadingPrivate(false);
      }
    }
    loadPII();
    return () => {
      active = false;
    };
  }, [selectedMember, permissions.canViewMemberPII, currentEmail, currentMemberId]);

  const openCreateModal = () => {
    setEditingMember(null);
    setFullName('');
    setRole('filhinho');
    setWing('Feminina');
    const availableMentor = potentialMentors.find(
      (pm) =>
        (filhinhoCountByMentor.get(pm.id) || 0) < MAX_FILHINHOS_PER_MENTOR,
    );
    setMentorId(availableMentor?.id || potentialMentors[0]?.id || '');
    setActivityLevel('Ativo');
    setIsChurchMember(true);
    setBaptismStatus('Não Batizado');
    setBaptismDate('');
    setBirthDate('');
    setPhone('');
    setAddress('');
    setMemberEmail('');
    setNotes('');
    setPhotoDataUrl('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = async (m: CellMember) => {
    setEditingMember(m);
    setFullName(m.fullName);
    setRole(m.role);
    setWing(m.wing || 'Masculina');
    setMentorId(m.mentorId || '');
    setActivityLevel(m.activityLevel);
    setIsChurchMember(m.isChurchMember);
    setBaptismStatus(m.baptismStatus);
    setMemberEmail(m.memberEmail || '');
    setPhotoDataUrl(m.photoDataUrl || '');
    setFormError(null);
    setModalOpen(true);

    const priv = await fetchMemberPrivateInfo(m.id);
    setBirthDate(priv?.birthDate || '');
    setBaptismDate(priv?.baptismDate || '');
    setPhone(priv?.phone || '');
    setAddress(priv?.address || '');
    setNotes(priv?.notes || '');
  };

  const handleModalPhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSavingPhoto(true);
    setFormError(null);
    try {
      const compressed = await compressProfilePhoto(file);
      setPhotoDataUrl(compressed);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Erro ao processar foto.',
      );
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setFormError('Informe o nome completo para pré-cadastrar o membro.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const result = await saveMemberWithPrivateInfo({
        cell,
        existingMember: editingMember,
        allMembers: members,
        currentUid,
        canManageRoles: permissions.canManageRolesAndTrainers,
        data: {
          fullName,
          role,
          wing,
          mentorId,
          activityLevel,
          isChurchMember,
          baptismStatus,
          memberEmail,
          phone,
          address,
          birthDate,
          baptismDate,
          notes,
          photoDataUrl,
        },
      });
      if (!editingMember) {
        setCreatedBanner({
          fullName: fullName.trim(),
          memberCode: result.memberCode,
        });
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Erro ao salvar membro.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (!cell.accessCode) return;
    try {
      await navigator.clipboard.writeText(cell.accessCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleCopyMemberCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedMemberCode(code);
      setTimeout(() => setCopiedMemberCode(null), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Membros e Controle de Acessos
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Ao criar a ficha de cadastro, um código individual é gerado para o membro entrar e apenas visualizar Visão Geral, Planificação e Progresso.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {cell.accessCode && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[40px] text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <span>Código:</span>
              <strong className="font-mono text-slate-900">
                {cell.accessCode}
              </strong>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          )}

          {actualRole === 'lider' && (
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 min-h-[40px]">
              <Eye className="w-4 h-4 text-slate-500 shrink-0" />
              <label className="text-xs text-slate-600 whitespace-nowrap">
                Simular:
              </label>
              <select
                value={effectiveRole}
                onChange={(e) => onChangePreviewRole(e.target.value as CellRole)}
                className="text-xs font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="lider">Líder da Célula</option>
                <option value="lider_treinamento">Líder em Treinamento</option>
                <option value="secretario">Secretário(a)</option>
                <option value="anfitriao">Anfitrião(ã)</option>
                <option value="filhinho">Filhinho(a)</option>
                <option value="visitante">Visitante</option>
              </select>
            </div>
          )}

          {permissions.canManageAllMembers && (
            <button
              type="button"
              onClick={openCreateModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Criar Ficha de Cadastro
            </button>
          )}
        </div>
      </div>

      {createdBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-emerald-950">
            <span className="font-semibold">
              Ficha criada para {createdBanner.fullName}!
            </span>{' '}
            Compartilhe o código{' '}
            <strong className="font-mono text-sm px-1.5 py-0.5 bg-white border border-emerald-200 rounded">
              {createdBanner.memberCode}
            </strong>{' '}
            para acesso somente leitura à Visão Geral, Planificação e Progresso.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopyMemberCode(createdBanner.memberCode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-lg cursor-pointer whitespace-nowrap"
            >
              {copiedMemberCode === createdBanner.memberCode ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Código Copiado
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
              className="p-1.5 text-emerald-700 hover:text-emerald-950 rounded-md cursor-pointer"
              aria-label="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hierarchy Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500">
            Líderes em Treinamento
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-1.5">
            {trainersCount} / {MAX_TRAINERS_PER_CELL}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Até {MAX_FILHINHOS_PER_MENTOR} filhinhos cada.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500">
            Alas (Fem · Masc)
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-1.5">
            {members.filter((m) => (m.wing || 'Masculina') === 'Feminina').length} ·{' '}
            {members.filter((m) => (m.wing || 'Masculina') === 'Masculina').length}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Feminina e Masculina.
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="text-[11px] sm:text-xs font-medium text-slate-500">
            Seu Nível Atual
          </div>
          <div className="text-base sm:text-lg font-bold text-teal-800 mt-1">
            {ROLE_LABELS[effectiveRole]}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {permissions.canManageRolesAndTrainers
              ? 'Controle completo sobre organograma e todas as fichas.'
              : permissions.canRecordAttendance
                ? 'Auxilia nas reuniões, frequência e acompanhamento.'
                : 'Acesso ao painel de produtividade, lembretes e própria ficha.'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar membro pelo nome..."
            className="w-full pl-9 pr-3 py-2.5 min-h-[42px] text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
          />
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <select
            value={wingFilter}
            onChange={(e) => setWingFilter(e.target.value as 'Todas' | CellWing)}
            className="px-3 py-2 min-h-[40px] text-xs font-medium bg-white border border-slate-200 rounded-lg"
          >
            <option value="Todas">Todas as Alas</option>
            <option value="Feminina">Ala Feminina</option>
            <option value="Masculina">Ala Masculina</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'todos' | CellRole)}
            className="px-3 py-2 min-h-[40px] text-xs font-medium bg-white border border-slate-200 rounded-lg"
          >
            <option value="todos">Todos os Cargos</option>
            <option value="lider">Líder da Célula</option>
            <option value="lider_treinamento">Líder em Treinamento</option>
            <option value="secretario">Secretário(a)</option>
            <option value="anfitriao">Anfitrião(ã)</option>
            <option value="filhinho">Filhinho(a)</option>
            <option value="visitante">Visitante</option>
            <option value="membro">Membro</option>
          </select>
        </div>
      </div>

      {/* Directory Table + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Mobile Member Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredMembers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Nenhum integrante encontrado com os filtros atuais.
              </div>
            ) : (
              filteredMembers.map((m) => {
                const mentor = m.mentorId
                  ? members.find((x) => x.id === m.mentorId)
                  : null;
                const canEditThis =
                  permissions.canManageRolesAndTrainers ||
                  (permissions.canManageAllMembers &&
                    (m.role === 'filhinho' ||
                      m.role === 'visitante' ||
                      m.role === 'membro'));

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMember(m)}
                    className={`p-4 space-y-2.5 cursor-pointer transition-colors ${
                      selectedMember?.id === m.id
                        ? 'bg-teal-50/50'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MemberAvatar
                          name={m.fullName}
                          photoDataUrl={m.photoDataUrl}
                          wing={m.wing}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {m.fullName}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {ROLE_LABELS[m.role]} · Ala {m.wing || 'Masculina'}
                          </div>
                        </div>
                      </div>
                      {m.memberCode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyMemberCode(m.memberCode!);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded shrink-0 cursor-pointer"
                        >
                          {m.memberCode}
                          {copiedMemberCode === m.memberCode ? (
                            <Check className="w-3 h-3 text-emerald-700" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{m.activityLevel}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            m.baptismStatus === 'Batizado'
                              ? 'text-emerald-700 font-medium'
                              : m.baptismStatus === 'Em Preparação'
                                ? 'text-amber-700 font-medium'
                                : 'text-slate-500'
                          }
                        >
                          {m.baptismStatus}
                        </span>
                        {mentor && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Mentor: {mentor.fullName.split(' ')[0]}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {canEditThis && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(m);
                            }}
                            title="Editar cadastro"
                            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-600 hover:text-slate-900 bg-slate-50 rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {permissions.canManageRolesAndTrainers &&
                          m.role !== 'lider' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMemberRecord(cell, m, members);
                                if (selectedMember?.id === m.id) {
                                  setSelectedMember(null);
                                }
                              }}
                              title="Remover membro"
                              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Nome & Ala</th>
                  <th className="py-3 px-4">Cargo</th>
                  <th className="py-3 px-4">Atividade</th>
                  <th className="py-3 px-4">Batismo</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredMembers.map((m) => {
                  const mentor = m.mentorId
                    ? members.find((x) => x.id === m.mentorId)
                    : null;
                  const canEditThis =
                    permissions.canManageRolesAndTrainers ||
                    (permissions.canManageAllMembers &&
                      (m.role === 'filhinho' ||
                        m.role === 'visitante' ||
                        m.role === 'membro'));

                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedMember(m)}
                      className={`cursor-pointer transition-colors ${
                        selectedMember?.id === m.id
                          ? 'bg-teal-50/50'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <MemberAvatar
                            name={m.fullName}
                            photoDataUrl={m.photoDataUrl}
                            wing={m.wing}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">
                              {m.fullName}
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              Ala {m.wing || 'Masculina'}
                              {m.memberCode ? ` · Cód.: ${m.memberCode}` : ''}
                              {mentor ? ` · Mentor: ${mentor.fullName}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                        {ROLE_LABELS[m.role]}
                        {(m.role === 'lider' || m.role === 'lider_treinamento') && (
                          <span className="block text-[11px] font-mono tabular-nums text-slate-500">
                            {filhinhoCountByMentor.get(m.id) || 0}/
                            {MAX_FILHINHOS_PER_MENTOR} filhinhos
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {m.activityLevel}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={
                            m.baptismStatus === 'Batizado'
                              ? 'text-emerald-700 font-medium'
                              : m.baptismStatus === 'Em Preparação'
                                ? 'text-amber-700 font-medium'
                                : 'text-slate-500'
                          }
                        >
                          {m.baptismStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canEditThis && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(m);
                              }}
                              title="Editar cadastro"
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {permissions.canManageRolesAndTrainers &&
                            m.role !== 'lider' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteMemberRecord(cell, m, members);
                                  if (selectedMember?.id === m.id) {
                                    setSelectedMember(null);
                                  }
                                }}
                                title="Remover membro"
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Desktop Member Detail Card */}
        <div className="hidden lg:block lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          {selectedMember ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <MemberAvatar
                    name={selectedMember.fullName}
                    photoDataUrl={selectedMember.photoDataUrl}
                    wing={selectedMember.wing}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-teal-700">
                      {ROLE_LABELS[selectedMember.role]} · Ala{' '}
                      {selectedMember.wing || 'Masculina'}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mt-0.5 truncate">
                      {selectedMember.fullName}
                    </h2>
                    <div className="text-xs text-slate-500 mt-1">
                      {selectedMember.activityLevel} ·{' '}
                      {selectedMember.isChurchMember
                        ? 'Membro da Igreja'
                        : 'Não membro da igreja'}
                    </div>
                  </div>
                </div>
                {selectedMember.memberCode && (
                  <button
                    type="button"
                    onClick={() => handleCopyMemberCode(selectedMember.memberCode!)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer shrink-0"
                    title="Copiar código individual da ficha"
                  >
                    {selectedMember.memberCode}
                    {copiedMemberCode === selectedMember.memberCode ? (
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>
                )}
              </div>

              {permissions.canViewMemberPII ||
              selectedMember.id === currentMemberId ||
              (selectedMember.memberEmail &&
                selectedMember.memberEmail.toLowerCase() ===
                  currentEmail.toLowerCase()) ? (
                loadingPrivate ? (
                  <p className="text-xs text-slate-500 py-4">
                    Carregando ficha detalhada...
                  </p>
                ) : (
                  <div className="space-y-4 text-xs">
                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-slate-500">Data de Nascimento</dt>
                        <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                          {selectedPrivate?.birthDate
                            ? formatDatePt(selectedPrivate.birthDate)
                            : 'A preencher pelo membro'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Telefone</dt>
                        <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                          {selectedPrivate?.phone || 'A preencher'}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-slate-500">Endereço Atualizado</dt>
                        <dd className="font-medium text-slate-900 mt-0.5">
                          {selectedPrivate?.address || 'A preencher'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Status de Batismo</dt>
                        <dd className="font-semibold text-slate-900 mt-0.5">
                          {selectedMember.baptismStatus}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Data de Batismo</dt>
                        <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                          {selectedPrivate?.baptismDate
                            ? formatDatePt(selectedPrivate.baptismDate)
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Profissão / Atuação</dt>
                        <dd className="font-medium text-slate-900 mt-0.5">
                          {selectedPrivate?.profession || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Estado Civil</dt>
                        <dd className="font-medium text-slate-900 mt-0.5">
                          {selectedPrivate?.maritalStatus || '—'}
                        </dd>
                      </div>
                      {selectedPrivate?.emergencyContact && (
                        <div className="col-span-2">
                          <dt className="text-slate-500">Contato de Emergência</dt>
                          <dd className="font-medium text-slate-900 mt-0.5">
                            {selectedPrivate.emergencyContact}
                          </dd>
                        </div>
                      )}
                      {selectedPrivate?.skillsOrInterests && (
                        <div className="col-span-2">
                          <dt className="text-slate-500">Dons e Áreas para Servir</dt>
                          <dd className="font-medium text-slate-900 mt-0.5">
                            {selectedPrivate.skillsOrInterests}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {selectedPrivate?.prayerRequest && (
                      <div className="pt-3 border-t border-slate-100">
                        <h3 className="font-semibold text-slate-700 mb-1">
                          Pedido de Oração
                        </h3>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                          {selectedPrivate.prayerRequest}
                        </p>
                      </div>
                    )}

                    {selectedPrivate?.usefulInfo && (
                      <div className="pt-3 border-t border-slate-100">
                        <h3 className="font-semibold text-slate-700 mb-1">
                          Outras Informações Úteis
                        </h3>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                          {selectedPrivate.usefulInfo}
                        </p>
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-100">
                      <h3 className="font-semibold text-slate-700 mb-1.5">
                        Observações Detalhadas
                      </h3>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                        {selectedPrivate?.notes ||
                          'Nenhuma observação registrada.'}
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Dados pessoais de outros membros são restritos à liderança. Você pode preencher e editar sua própria ficha na aba <strong>Minha Ficha</strong>.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              Clique em um integrante da lista para consultar ficha, ala, cargo e observações.
            </div>
          )}
        </div>
      </div>

      {/* Mobile Member Detail Bottom Sheet */}
      {selectedMember && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/50 flex items-end p-0"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="bg-white border-t border-slate-200 rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-5 pb-safe space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <MemberAvatar
                  name={selectedMember.fullName}
                  photoDataUrl={selectedMember.photoDataUrl}
                  wing={selectedMember.wing}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-teal-700">
                    {ROLE_LABELS[selectedMember.role]} · Ala{' '}
                    {selectedMember.wing || 'Masculina'}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5 truncate">
                    {selectedMember.fullName}
                  </h2>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {selectedMember.activityLevel} ·{' '}
                    {selectedMember.isChurchMember
                      ? 'Membro da Igreja'
                      : 'Não membro da igreja'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                aria-label="Fechar ficha"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedMember.memberCode && (
              <button
                type="button"
                onClick={() => handleCopyMemberCode(selectedMember.memberCode!)}
                className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer"
              >
                <span>Código da ficha: {selectedMember.memberCode}</span>
                {copiedMemberCode === selectedMember.memberCode ? (
                  <Check className="w-4 h-4 text-emerald-700" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-500" />
                )}
              </button>
            )}

            {permissions.canViewMemberPII ||
            selectedMember.id === currentMemberId ||
            (selectedMember.memberEmail &&
              selectedMember.memberEmail.toLowerCase() ===
                currentEmail.toLowerCase()) ? (
              loadingPrivate ? (
                <p className="text-xs text-slate-500 py-4">
                  Carregando ficha detalhada...
                </p>
              ) : (
                <div className="space-y-4 text-xs">
                  <dl className="grid grid-cols-2 gap-3.5">
                    <div>
                      <dt className="text-slate-500">Data de Nascimento</dt>
                      <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                        {selectedPrivate?.birthDate
                          ? formatDatePt(selectedPrivate.birthDate)
                          : 'A preencher'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Telefone</dt>
                      <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                        {selectedPrivate?.phone || 'A preencher'}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-slate-500">Endereço Atualizado</dt>
                      <dd className="font-medium text-slate-900 mt-0.5">
                        {selectedPrivate?.address || 'A preencher'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Status de Batismo</dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">
                        {selectedMember.baptismStatus}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Data de Batismo</dt>
                      <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                        {selectedPrivate?.baptismDate
                          ? formatDatePt(selectedPrivate.baptismDate)
                          : '—'}
                      </dd>
                    </div>
                      <div>
                        <dt className="text-slate-500">Profissão / Atuação</dt>
                        <dd className="font-medium text-slate-900 mt-0.5">
                          {selectedPrivate?.profession || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Estado Civil</dt>
                        <dd className="font-medium text-slate-900 mt-0.5">
                          {selectedPrivate?.maritalStatus || '—'}
                        </dd>
                      </div>
                      {selectedPrivate?.emergencyContact && (
                        <div className="col-span-2">
                          <dt className="text-slate-500">Contato de Emergência</dt>
                          <dd className="font-medium text-slate-900 mt-0.5">
                            {selectedPrivate.emergencyContact}
                          </dd>
                        </div>
                      )}
                      {selectedPrivate?.skillsOrInterests && (
                        <div className="col-span-2">
                          <dt className="text-slate-500">Dons e Áreas para Servir</dt>
                          <dd className="font-medium text-slate-900 mt-0.5">
                            {selectedPrivate.skillsOrInterests}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {selectedPrivate?.prayerRequest && (
                      <div className="pt-3 border-t border-slate-100">
                        <h3 className="font-semibold text-slate-700 mb-1">
                          Pedido de Oração
                        </h3>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                          {selectedPrivate.prayerRequest}
                        </p>
                      </div>
                    )}

                    {selectedPrivate?.usefulInfo && (
                      <div className="pt-3 border-t border-slate-100">
                        <h3 className="font-semibold text-slate-700 mb-1">
                          Outras Informações Úteis
                        </h3>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                          {selectedPrivate.usefulInfo}
                        </p>
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100">
                      <h3 className="font-semibold text-slate-700 mb-1">
                        Observações Detalhadas
                      </h3>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                        {selectedPrivate?.notes ||
                          'Nenhuma observação registrada.'}
                      </p>
                    </div>
                  </div>
              )
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3">
                <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  Dados pessoais de outros membros são restritos à liderança. Você pode consultar sua própria ficha na aba <strong>Minha Ficha</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RBAC Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-teal-700 shrink-0" />
          <h2 className="text-base font-semibold text-slate-900">
            Permissões por Categoria no Organograma
          </h2>
        </div>
        {/* Mobile RBAC summary cards */}
        <div className="md:hidden divide-y divide-slate-100 text-xs">
          <div className="p-4 space-y-1">
            <div className="font-semibold text-slate-900">Líder da Célula</div>
            <p className="text-slate-600">
              Controle completo: distribui organograma e alas, cria fichas com código e gerencia toda a planificação e relatórios.
            </p>
          </div>
          <div className="p-4 space-y-1">
            <div className="font-semibold text-slate-900">
              Líder em Treinamento (máx. 3)
            </div>
            <p className="text-slate-600">
              Controla seus 3 filhinhos, gera códigos, auxilia na planificação, materiais e presença.
            </p>
          </div>
          <div className="p-4 space-y-1">
            <div className="font-semibold text-slate-900">Secretário(a)</div>
            <p className="text-slate-600">
              Acesso total a lembretes/estudos e registro de atas e frequência das reuniões.
            </p>
          </div>
          <div className="p-4 space-y-1">
            <div className="font-semibold text-slate-900">
              Anfitrião / Filhinho / Visitante
            </div>
            <p className="text-slate-600">
              Acesso somente visualização pelo código da ficha para Visão Geral, Planificação, Progresso e Estudos.
            </p>
          </div>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="py-3 px-4">Ferramenta</th>
                <th className="py-3 px-4">Líder</th>
                <th className="py-3 px-4">Líder Trein. (máx. 3)</th>
                <th className="py-3 px-4">Secretário(a)</th>
                <th className="py-3 px-4">Anfitrião / Filhinho / Visitante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-2.5 px-4 font-medium">Painel de Produtividade, Lembretes e Estudos</td>
                <td className="py-2.5 px-4 text-emerald-700 font-semibold">Completo</td>
                <td className="py-2.5 px-4 text-emerald-700 font-semibold">Completo</td>
                <td className="py-2.5 px-4 text-emerald-700 font-semibold">Acesso total</td>
                <td className="py-2.5 px-4 text-slate-700 font-semibold">Somente visualização</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium">Ficha cadastral e código de acesso</td>
                <td className="py-2.5 px-4 text-emerald-700 font-semibold">Cria, gera código e edita todas</td>
                <td className="py-2.5 px-4 text-emerald-700 font-semibold">Cadastra filhinhos e gera código</td>
                <td className="py-2.5 px-4">Visualização + edita sua própria</td>
                <td className="py-2.5 px-4">Edita apenas a própria ficha</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium">Organograma, distribuição de alas e filhinhos (máx. 3)</td>
                <td className="py-2.5 px-4 text-emerald-700 font-semibold">Distribui todos</td>
                <td className="py-2.5 px-4">Controla seus 3</td>
                <td className="py-2.5 px-4">Visualização</td>
                <td className="py-2.5 px-4">Visualização</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium">Planificação e relatórios de progresso</td>
                <td className="py-2.5 px-4 text-emerald-700 font-semibold">Completo</td>
                <td className="py-2.5 px-4 text-emerald-700 font-semibold">Auxilia e registra</td>
                <td className="py-2.5 px-4 text-emerald-700 font-semibold">Registra atas/presença</td>
                <td className="py-2.5 px-4">Somente visualização</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Member Form Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-2xl p-5 sm:p-8 sm:my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {editingMember
                    ? 'Editar Ficha do Membro'
                    : 'Criar Ficha de Cadastro do Membro'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Ao salvar a ficha, um código exclusivo será gerado automaticamente para o membro entrar apenas para visualizar Visão Geral, Planificação e Progresso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveMember} className="space-y-4">
              <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3 min-w-0">
                  <MemberAvatar
                    name={fullName || 'Novo Membro'}
                    photoDataUrl={photoDataUrl}
                    wing={wing}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">
                      Foto da Ficha (opcional)
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      O próprio membro também pode adicionar ou alterar na aba Minha Ficha.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={modalPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleModalPhotoChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={savingPhoto}
                    onClick={() => modalPhotoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-white border border-teal-200 hover:bg-teal-50 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {savingPhoto
                      ? 'Processando...'
                      : photoDataUrl
                        ? 'Alterar'
                        : 'Colocar Foto'}
                  </button>
                  {photoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoDataUrl('')}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                      title="Remover foto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nome que o membro usará para entrar"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ala *
                  </label>
                  <select
                    value={wing}
                    onChange={(e) => setWing(e.target.value as CellWing)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Feminina">Ala Feminina</option>
                    <option value="Masculina">Ala Masculina</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cargo no Organograma
                  </label>
                  <select
                    disabled={!permissions.canManageRolesAndTrainers}
                    value={role}
                    onChange={(e) => setRole(e.target.value as CellRole)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                  >
                    {editingMember?.role === 'lider' && (
                      <option value="lider">Líder da Célula</option>
                    )}
                    <option value="lider_treinamento">
                      Líder em Treinamento ({trainersCount}/{MAX_TRAINERS_PER_CELL})
                    </option>
                    <option value="secretario">Secretário(a)</option>
                    <option value="anfitriao">Anfitrião(ã)</option>
                    <option value="filhinho">Filhinho(a) (máx. 3 por líder)</option>
                    <option value="visitante">Visitante</option>
                    <option value="membro">Membro Geral</option>
                  </select>
                </div>

                {role === 'filhinho' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Líder em Treinamento Mentor (máx. {MAX_FILHINHOS_PER_MENTOR} filhinhos por líder)
                    </label>
                    <select
                      value={mentorId}
                      onChange={(e) => setMentorId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">Sem mentor definido</option>
                      {potentialMentors.map((pm) => {
                        const count = filhinhoCountByMentor.get(pm.id) || 0;
                        return (
                          <option
                            key={pm.id}
                            value={pm.id}
                            disabled={
                              count >= MAX_FILHINHOS_PER_MENTOR &&
                              editingMember?.mentorId !== pm.id
                            }
                          >
                            {pm.fullName} · Ala {pm.wing || 'Masculina'} ({count}/{MAX_FILHINHOS_PER_MENTOR})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data de Nascimento (opcional)
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone para Contato (opcional)
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Endereço Atualizado (opcional)
                  </label>
                  <input
                    type="text"
                    maxLength={250}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nível de Atividade
                  </label>
                  <select
                    value={activityLevel}
                    onChange={(e) =>
                      setActivityLevel(e.target.value as ActivityLevel)
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {ACTIVITY_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    É Membro da Igreja?
                  </label>
                  <select
                    value={isChurchMember ? 'sim' : 'nao'}
                    onChange={(e) => setIsChurchMember(e.target.value === 'sim')}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="sim">Sim, é membro da igreja</option>
                    <option value="nao">Não é membro da igreja</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status de Batismo
                  </label>
                  <select
                    value={baptismStatus}
                    onChange={(e) =>
                      setBaptismStatus(e.target.value as BaptismStatus)
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {BAPTISM_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data de Batismo
                  </label>
                  <input
                    type="date"
                    disabled={baptismStatus !== 'Batizado'}
                    value={baptismStatus === 'Batizado' ? baptismDate : ''}
                    onChange={(e) => setBaptismDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums disabled:bg-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail Google (opcional — só necessário para liderança com Google)
                  </label>
                  <input
                    type="email"
                    disabled={!permissions.canManageRolesAndTrainers}
                    maxLength={200}
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="Opcional: membros sem e-mail entram apenas com o código da ficha"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Observações Detalhadas sobre o Membro
                  </label>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 pb-safe">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 min-h-[42px] text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 min-h-[42px] text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  {saving ? 'Salvando...' : 'Salvar Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
