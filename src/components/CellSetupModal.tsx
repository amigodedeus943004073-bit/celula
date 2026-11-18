import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { CellWorkspace } from '../types/cell';

interface CellSetupModalProps {
  mode: 'create' | 'edit';
  existingCell?: CellWorkspace | null;
  onClose?: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    meetingDay: string;
    meetingTime: string;
    location: string;
    seedExampleData: boolean;
  }) => Promise<void>;
}

const DAYS = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
];

export function CellSetupModal({
  mode,
  existingCell,
  onClose,
  onSubmit,
}: CellSetupModalProps) {
  const [name, setName] = useState(existingCell?.name || 'Célula Vida Nova');
  const [meetingDay, setMeetingDay] = useState(
    existingCell?.meetingDay || 'Quinta-feira',
  );
  const [meetingTime, setMeetingTime] = useState(
    existingCell?.meetingTime || '19:30',
  );
  const [location, setLocation] = useState(
    existingCell?.location || 'Casa da Família Silva',
  );
  const [description, setDescription] = useState(
    existingCell?.description ||
      'Célula de comunhão, estudo bíblico e discipulado semanal.',
  );
  const [seedExampleData, setSeedExampleData] = useState(mode === 'create');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        meetingDay,
        meetingTime,
        location: location.trim(),
        seedExampleData,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao salvar configuração.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-lg p-5 sm:p-8 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {mode === 'create'
                ? 'Configurar Sua Célula'
                : 'Configurações da Célula'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {mode === 'create'
                ? 'Defina os dados principais da célula para iniciar o planejamento e o cadastro de membros.'
                : 'Atualize o dia, horário e local padrão das reuniões.'}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nome da Célula
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              placeholder="Ex.: Célula Esperança"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Dia da Reunião
              </label>
              <select
                value={meetingDay}
                onChange={(e) => setMeetingDay(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Horário Padrão
              </label>
              <input
                type="time"
                required
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Local Padrão
            </label>
            <input
              type="text"
              maxLength={200}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              placeholder="Endereço ou casa anfitriã"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Descrição / Propósito
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
            />
          </div>

          {mode === 'create' && (
            <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={seedExampleData}
                onChange={(e) => setSeedExampleData(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-teal-700"
              />
              <span className="text-xs text-slate-700 leading-relaxed">
                <strong className="font-semibold text-slate-900">
                  Incluir modelo inicial completo
                </strong>{' '}
                (1 líder em treinamento, 2 filhinhos, reuniões do mês, 1 relatório com frequência e 1 guia de estudo para começar imediatamente).
              </span>
            </label>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 pb-safe">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 min-h-[42px] text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 min-h-[42px] text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {saving
                ? 'Salvando...'
                : mode === 'create'
                  ? 'Criar Célula'
                  : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
