import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { getMonthKey, getTodayIso } from '../lib/cellAnalytics';
import { deleteStudyMaterial, saveStudyMaterial } from '../lib/cellService';
import type {
  CellWorkspace,
  RolePermissions,
  StudyCategory,
  StudyMaterial,
} from '../types/cell';

interface StudyMaterialsViewProps {
  cell: CellWorkspace;
  currentUid: string;
  userName: string;
  permissions: RolePermissions;
  materials: StudyMaterial[];
}

const CATEGORIES: StudyCategory[] = [
  'Lição da Semana',
  'Estudo Bíblico',
  'Devocional',
  'Treinamento de Líderes',
  'Discipulado',
];

export function StudyMaterialsView({
  cell,
  currentUid,
  userName,
  permissions,
  materials,
}: StudyMaterialsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Todos' | StudyCategory>(
    'Todos',
  );
  const [readingItem, setReadingItem] = useState<StudyMaterial | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] =
    useState<StudyMaterial | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<StudyCategory>('Lição da Semana');
  const [summary, setSummary] = useState('');
  const [contentText, setContentText] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [monthKey, setMonthKey] = useState(getMonthKey(getTodayIso()));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return materials.filter((m) => {
      if (categoryFilter !== 'Todos' && m.category !== categoryFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        return (
          m.title.toLowerCase().includes(q) ||
          (m.summary || '').toLowerCase().includes(q) ||
          m.contentText.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [materials, categoryFilter, searchTerm]);

  const openCreateModal = () => {
    setEditingMaterial(null);
    setTitle('');
    setCategory('Lição da Semana');
    setSummary('');
    setContentText('');
    setResourceUrl('');
    setMonthKey(getMonthKey(getTodayIso()));
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (m: StudyMaterial) => {
    setEditingMaterial(m);
    setTitle(m.title);
    setCategory(m.category);
    setSummary(m.summary || '');
    setContentText(m.contentText);
    setResourceUrl(m.resourceUrl || '');
    setMonthKey(m.monthKey || getMonthKey(getTodayIso()));
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2 || contentText.trim().length < 5) {
      setFormError('Informe título e conteúdo do material.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await saveStudyMaterial({
        cell,
        existingMaterial: editingMaterial,
        currentUid,
        authorName: userName,
        data: {
          title,
          category,
          summary,
          contentText,
          resourceUrl,
          monthKey,
        },
      });
      setModalOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Erro ao salvar material.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopyShare = async (m: StudyMaterial) => {
    const shareText = `${m.title}\nCategoria: ${m.category}\n\n${m.contentText}${
      m.resourceUrl ? `\n\nLink complementar: ${m.resourceUrl}` : ''
    }`;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Materiais de Estudo Compartilhados
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Esboços de lições, devocionais e guias de discipulado disponíveis para toda a célula.
          </p>
        </div>

        {permissions.canPublishMaterials && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Compartilhar Material
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar estudos por título ou tema..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
          />
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/60 rounded-lg">
          {(['Todos', ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-900">
            Nenhum material encontrado
          </p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Publique estudos bíblicos, esboços de lições semanais e guias de discipulado para os membros lerem ou copiarem.
          </p>
          {permissions.canPublishMaterials && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              Publicar Primeiro Material
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((mat) => {
            const canEditThis =
              permissions.canManageRolesAndTrainers ||
              (permissions.canPublishMaterials && mat.createdBy === currentUid);

            return (
              <div
                key={mat.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-teal-700">
                      {mat.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Por {mat.authorName}</span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 mb-2">
                    {mat.title}
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {mat.summary || mat.contentText}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReadingItem(mat)}
                      className="px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      Ler Estudo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyShare(mat)}
                      title="Copiar texto para compartilhar com a célula"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      {copiedId === mat.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>

                  {canEditThis && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(mat)}
                        title="Editar material"
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStudyMaterial(mat.id)}
                        title="Excluir material"
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Study Reader Modal */}
      {readingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 sm:p-8 my-8">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="text-xs font-medium text-teal-700">
                  {readingItem.category} · Por {readingItem.authorName}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  {readingItem.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setReadingItem(null)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {readingItem.summary && (
              <p className="text-sm text-slate-600 mt-4 italic">
                {readingItem.summary}
              </p>
            )}

            <div className="mt-5 text-sm text-slate-800 leading-relaxed whitespace-pre-line max-h-[55vh] overflow-y-auto pr-2">
              {readingItem.contentText}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              {readingItem.resourceUrl ? (
                <a
                  href={readingItem.resourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir anexo / link complementar
                </a>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyShare(readingItem)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedId === readingItem.id ? 'Copiado!' : 'Copiar Texto'}
                </button>
                <button
                  type="button"
                  onClick={() => setReadingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Study Material Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 sm:p-8 my-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingMaterial
                    ? 'Editar Material de Estudo'
                    : 'Compartilhar Novo Material'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Ao publicar, um aviso automático notifica os membros da célula.
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Título do Material *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as StudyCategory)
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resumo Breve
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Objetivo ou resumo rápido do estudo"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Conteúdo / Esboço Completo *
                </label>
                <textarea
                  rows={6}
                  required
                  maxLength={5000}
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  placeholder="Escreva o texto base, perguntas para debate e aplicação prática..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Link Externo (PDF, Drive ou Vídeo)
                  </label>
                  <input
                    type="url"
                    maxLength={500}
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mês de Referência
                  </label>
                  <input
                    type="month"
                    value={monthKey}
                    onChange={(e) => setMonthKey(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
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
                  {saving ? 'Publicando...' : 'Publicar Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
