import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  HeartHandshake,
  Lock,
  Save,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { formatDatePt } from '../lib/cellAnalytics';
import {
  fetchMemberPrivateInfo,
  saveOwnMemberFicha,
  saveOwnMemberPhoto,
} from '../lib/cellService';
import { compressProfilePhoto } from '../lib/imageUtils';
import {
  FIELD_LIMITS,
  ROLE_LABELS,
  type BaptismStatus,
  type CellMember,
  type CellWorkspace,
  type MemberPrivateInfo,
} from '../types/cell';
import { MemberAvatar } from './MemberAvatar';

interface MyFichaViewProps {
  cell: CellWorkspace;
  member: CellMember | null;
  allMembers: CellMember[];
}

const BAPTISM_STATUSES: BaptismStatus[] = [
  'Batizado',
  'Não Batizado',
  'Em Preparação',
];

const MARITAL_STATUS_OPTIONS = [
  '',
  'Solteiro(a)',
  'Casado(a)',
  'Noivo(a)',
  'Divorciado(a)',
  'Viúvo(a)',
];

export function MyFichaView({ cell, member, allMembers }: MyFichaViewProps) {
  const [priv, setPriv] = useState<MemberPrivateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Editable self-ficha fields
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [baptismStatus, setBaptismStatus] =
    useState<BaptismStatus>('Não Batizado');
  const [baptismDate, setBaptismDate] = useState('');
  const [profession, setProfession] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [skillsOrInterests, setSkillsOrInterests] = useState('');
  const [prayerRequest, setPrayerRequest] = useState('');
  const [usefulInfo, setUsefulInfo] = useState('');
  const [notes, setNotes] = useState('');

  const syncFormFromData = (
    m: CellMember,
    info: MemberPrivateInfo | null,
  ) => {
    setPhone(info?.phone || '');
    setAddress(info?.address || '');
    setBirthDate(info?.birthDate || '');
    setBaptismStatus(m.baptismStatus);
    setBaptismDate(info?.baptismDate || '');
    setProfession(info?.profession || '');
    setMaritalStatus(info?.maritalStatus || '');
    setEmergencyContact(info?.emergencyContact || '');
    setSkillsOrInterests(info?.skillsOrInterests || '');
    setPrayerRequest(info?.prayerRequest || '');
    setUsefulInfo(info?.usefulInfo || '');
    setNotes(info?.notes || '');
  };

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
        syncFormFromData(member, data);
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

  const handleStartEdit = () => {
    syncFormFromData(member, priv);
    setSaveError(null);
    setSaveSuccess(null);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    syncFormFromData(member, priv);
    setSaveError(null);
    setEditing(false);
  };

  const handleSelectPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSavingPhoto(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const compressed = await compressProfilePhoto(file);
      await saveOwnMemberPhoto(member.id, compressed);
      setSaveSuccess('Foto da sua ficha atualizada com sucesso.');
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar a foto da ficha.',
      );
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setSavingPhoto(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      await saveOwnMemberPhoto(member.id, '');
      setSaveSuccess('Foto removida da sua ficha.');
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Não foi possível remover a foto.',
      );
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      await saveOwnMemberFicha({
        cell,
        member,
        data: {
          phone,
          address,
          birthDate,
          baptismStatus,
          baptismDate,
          profession,
          maritalStatus,
          emergencyContact,
          skillsOrInterests,
          prayerRequest,
          usefulInfo,
          notes,
        },
      });
      const refreshed = await fetchMemberPrivateInfo(member.id);
      setPriv(refreshed);
      setEditing(false);
      setSaveSuccess('Sua ficha foi atualizada com sucesso.');
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar as alterações da sua ficha.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Minha Ficha na Célula
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Consulte e atualize apenas a sua própria ficha cadastral na {cell.name}.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          {member.memberCode && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[42px] text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <span>Código:</span>
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

          {!editing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Editar Minha Ficha
            </button>
          )}
        </div>
      </div>

      {/* Personal Edit Scope Notice */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 sm:px-5 py-3.5 flex items-start gap-3 text-xs text-teal-900">
        <Lock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Edição individual habilitada:</strong> você pode atualizar e adicionar informações úteis{' '}
          <strong>apenas na sua própria ficha</strong> (contato, endereço, profissão, dons/áreas de serviço e pedido de oração). Cargo no organograma, ala e dados de outros membros continuam protegidos pela liderança.
        </p>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-2 text-xs text-emerald-900">
          <span className="inline-flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            {saveSuccess}
          </span>
          <button
            type="button"
            onClick={() => setSaveSuccess(null)}
            className="p-1 text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {saveError && !editing && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
          {saveError}
        </div>
      )}

      {/* Photo & Organogram summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-4 min-w-0">
            <MemberAvatar
              name={member.fullName}
              photoDataUrl={member.photoDataUrl}
              wing={member.wing}
              size="xl"
            />
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                {member.fullName}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Sua foto aparece na ficha, no organograma e no bate-papo da célula.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handleSelectPhoto}
              className="hidden"
            />
            <button
              type="button"
              disabled={savingPhoto}
              onClick={() => photoInputRef.current?.click()}
              className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
              {savingPhoto
                ? 'Enviando...'
                : member.photoDataUrl
                  ? 'Alterar Foto'
                  : 'Colocar Foto'}
            </button>
            {member.photoDataUrl && (
              <button
                type="button"
                disabled={savingPhoto}
                onClick={handleRemovePhoto}
                title="Remover foto da ficha"
                className="min-h-[40px] inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 hover:text-red-600 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
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
      </div>

      {/* Main Ficha Details or Edit Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8">
        {loading ? (
          <p className="text-xs text-slate-500">Carregando sua ficha...</p>
        ) : editing ? (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="pb-4 border-b border-slate-100 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs text-slate-500">Editando Ficha de</div>
                <div className="text-lg font-bold text-slate-900">
                  {member.fullName}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                aria-label="Cancelar edição"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.phone}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Endereço Atualizado
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.address}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro..."
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Profissão / Área de Atuação
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.profession}
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="Ex.: Professor(a), Designer, Estudante..."
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estado Civil
                </label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                >
                  {MARITAL_STATUS_OPTIONS.map((opt) => (
                    <option key={opt || 'empty'} value={opt}>
                      {opt || 'Não informado'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contato de Emergência / Familiar
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.emergencyContact}
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Nome e telefone de um familiar ou responsável"
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
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
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
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
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dons, Habilidades ou Áreas para Servir na Célula
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.skillsOrInterests}
                  value={skillsOrInterests}
                  onChange={(e) => setSkillsOrInterests(e.target.value)}
                  placeholder="Ex.: Louvor/Música, Recepção, Quebra-gelo, Mídia, Lanche, Intercessão..."
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pedido de Oração Pessoal
                </label>
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.prayerRequest}
                  value={prayerRequest}
                  onChange={(e) => setPrayerRequest(e.target.value)}
                  placeholder="Compartilhe motivos de oração com a liderança da célula..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Outras Informações Úteis / Disponibilidade
                </label>
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.usefulInfo}
                  value={usefulInfo}
                  onChange={(e) => setUsefulInfo(e.target.value)}
                  placeholder="Ex.: Melhores horários, alergias alimentares para o lanche, transporte, necessidades..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações Gerais
                </label>
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.notes}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar Minha Ficha'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
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
                <dt className="text-slate-500">Telefone / WhatsApp</dt>
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
                <dt className="text-slate-500">Profissão / Área de Atuação</dt>
                <dd className="font-medium text-slate-900 mt-1">
                  {priv?.profession || 'Não informado'}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Estado Civil</dt>
                <dd className="font-medium text-slate-900 mt-1">
                  {priv?.maritalStatus || 'Não informado'}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-slate-500">Contato de Emergência</dt>
                <dd className="font-medium text-slate-900 mt-1">
                  {priv?.emergencyContact || 'Não informado'}
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

            <div className="pt-4 border-t border-slate-100 space-y-4 text-xs">
              <div>
                <div className="font-semibold text-slate-700 mb-1">
                  Dons, Habilidades e Áreas para Servir
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {priv?.skillsOrInterests || 'Nenhuma habilidade informada ainda.'}
                </p>
              </div>

              <div>
                <div className="font-semibold text-slate-700 mb-1 inline-flex items-center gap-1.5">
                  <HeartHandshake className="w-3.5 h-3.5 text-teal-700" />
                  Pedido de Oração Pessoal
                </div>
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                  {priv?.prayerRequest || 'Nenhum pedido de oração registrado.'}
                </p>
              </div>

              <div>
                <div className="font-semibold text-slate-700 mb-1">
                  Outras Informações Úteis
                </div>
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                  {priv?.usefulInfo || 'Nenhuma informação adicional informada.'}
                </p>
              </div>

              <div>
                <div className="font-semibold text-slate-700 mb-1">
                  Observações Registradas
                </div>
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                  {priv?.notes || 'Nenhuma observação registrada.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
