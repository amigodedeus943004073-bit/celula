import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Plus,
  Search,
  Trash2,
  Upload,
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
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentMime, setAttachmentMime] = useState('');
  const [attachmentDataUrl, setAttachmentDataUrl] = useState('');
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
    setAttachmentName('');
    setAttachmentMime('');
    setAttachmentDataUrl('');
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
    setAttachmentName(m.attachmentName || '');
    setAttachmentMime(m.attachmentMime || '');
    setAttachmentDataUrl(m.attachmentDataUrl || '');
    setMonthKey(m.monthKey || getMonthKey(getTodayIso()));
    setFormError(null);
    setModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);

    const maxBytes = 550 * 1024;
    if (file.size > maxBytes) {
      setFormError(
        `O arquivo "${file.name}" tem ${(file.size / 1024).toFixed(0)} KB. Envie arquivos de até 550 KB (ou use o campo Link Externo para vídeos/PDFs maiores).`,
      );
      e.target.value = '';
      return;
    }

    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      setTitle(cleanName.slice(0, 160));
    }

    const isPlainText =
      file.type.startsWith('text/') ||
      /\.(txt|md|csv)$/i.test(file.name);

    if (isPlainText) {
      try {
        const text = await file.text();
        if (text.trim() && !contentText.trim()) {
          setContentText(text.trim().slice(0, 5000));
        }
      } catch {
        // Ignore text decode errors
      }
    } else if (!contentText.trim()) {
      setContentText(`Arquivo de estudo anexado: ${file.name}`);
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result.length > 740000) {
        setFormError(
          'O arquivo codificado ultrapassou o limite permitido. Escolha um arquivo menor ou use um link externo.',
        );
        return;
      }
      setAttachmentName(file.name.slice(0, 160));
      setAttachmentMime((file.type || 'application/octet-stream').slice(0, 120));
      setAttachmentDataUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      setFormError('Informe o título do material.');
      return;
    }
    if (!attachmentDataUrl && contentText.trim().length < 5) {
      setFormError('Escreva o conteúdo do estudo ou anexe um arquivo do computador/telefone.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await saveStudyMaterial({
        cell,
        existingMaterial: editingMaterial,
        existingMaterials: materials,
        currentUid,
        authorName: userName,
        data: {
          title,
          category,
          summary,
          contentText,
          resourceUrl,
          attachmentName,
          attachmentMime,
          attachmentDataUrl,
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
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
            className="w-full pl-9 pr-3 py-2.5 min-h-[42px] text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-lg overflow-x-auto no-scrollbar max-w-full">
          {(['Todos', ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
                  {mat.attachmentName && mat.attachmentDataUrl && (
                    <a
                      href={mat.attachmentDataUrl}
                      download={mat.attachmentName}
                      className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-md max-w-full"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{mat.attachmentName}</span>
                    </a>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReadingItem(mat)}
                      className="px-3 py-2 min-h-[36px] text-xs font-semibold text-teal-700 bg-teal-50/70 hover:bg-teal-100 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      Ler Estudo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyShare(mat)}
                      title="Copiar texto para compartilhar com a célula"
                      className="inline-flex items-center gap-1 px-2.5 py-2 min-h-[36px] text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap"
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
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStudyMaterial(mat.id)}
                        title="Excluir material"
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-2xl p-5 sm:p-8 sm:my-8 max-h-[92vh] overflow-y-auto pb-safe">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="text-xs font-medium text-teal-700">
                  {readingItem.category} · Por {readingItem.authorName}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                  {readingItem.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setReadingItem(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {readingItem.summary && (
              <p className="text-sm text-slate-600 mt-4 italic">
                {readingItem.summary}
              </p>
            )}

            <div className="mt-5 text-sm text-slate-800 leading-relaxed whitespace-pre-line max-h-[45vh] overflow-y-auto pr-2">
              {readingItem.contentText}
            </div>

            {readingItem.attachmentDataUrl &&
              readingItem.attachmentMime?.startsWith('image/') && (
                <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                  <img
                    src={readingItem.attachmentDataUrl}
                    alt={readingItem.attachmentName || readingItem.title}
                    className="max-h-72 w-full object-contain"
                  />
                </div>
              )}

            <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {readingItem.attachmentDataUrl && readingItem.attachmentName && (
                  <a
                    href={readingItem.attachmentDataUrl}
                    download={readingItem.attachmentName}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar {readingItem.attachmentName}
                  </a>
                )}
                {readingItem.resourceUrl && (
                  <a
                    href={readingItem.resourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir link complementar
                  </a>
                )}
              </div>

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
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-2xl p-5 sm:p-8 sm:my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
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

              {/* File Upload from Computer or Phone */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/70">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-teal-700" />
                      Enviar Estudo do Computador ou Telefone
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Suporta PDF, Word (.doc/.docx), texto (.txt/.md), slides ou imagem (até 550 KB). Arquivos de texto preenchem o esboço automaticamente.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-teal-800 bg-white border border-teal-300 hover:bg-teal-50 rounded-lg cursor-pointer whitespace-nowrap shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    Selecionar Arquivo
                    <input
                      type="file"
                      accept=".txt,.md,.csv,.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {attachmentName && (
                  <div className="mt-3 flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs">
                    <span className="inline-flex items-center gap-2 font-medium text-slate-800 truncate">
                      <FileText className="w-4 h-4 text-teal-700 shrink-0" />
                      {attachmentName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentName('');
                        setAttachmentMime('');
                        setAttachmentDataUrl('');
                      }}
                      className="text-xs text-red-600 hover:underline cursor-pointer shrink-0"
                    >
                      Remover anexo
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Conteúdo / Esboço Completo {!attachmentDataUrl && '*'}
                </label>
                <textarea
                  rows={6}
                  required={!attachmentDataUrl}
                  maxLength={5000}
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  placeholder="Escreva o texto base, perguntas para debate ou envie um arquivo do seu aparelho acima..."
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
