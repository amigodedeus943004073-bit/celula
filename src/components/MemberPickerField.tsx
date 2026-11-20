import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import {
  ROLE_HIERARCHY_ORDER,
  ROLE_LABELS,
  type CellMember,
} from '../types/cell';
import { MemberAvatar } from './MemberAvatar';

interface MemberPickerFieldProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (nextName: string) => void;
  members: CellMember[];
  placeholder?: string;
}

export function MemberPickerField({
  label,
  required = false,
  value,
  onChange,
  members,
  placeholder = 'Buscar integrante registrado...',
}: MemberPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (ROLE_HIERARCHY_ORDER[a.role] !== ROLE_HIERARCHY_ORDER[b.role]) {
          return ROLE_HIERARCHY_ORDER[a.role] - ROLE_HIERARCHY_ORDER[b.role];
        }
        return a.fullName.localeCompare(b.fullName);
      }),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedMembers;
    return sortedMembers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        ROLE_LABELS[m.role].toLowerCase().includes(q) ||
        (m.wing || 'Masculina').toLowerCase().includes(q),
    );
  }, [sortedMembers, search]);

  const matchedMember = useMemo(
    () =>
      value
        ? members.find(
            (m) => m.fullName.toLowerCase() === value.trim().toLowerCase(),
          ) || null
        : null,
    [members, value],
  );

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        {label}
      </label>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen((prev) => !prev);
            setSearch('');
          }}
          className={`w-full min-h-[42px] px-3 py-2 text-left text-sm bg-white border rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-colors ${
            open
              ? 'border-teal-700 ring-2 ring-teal-700/20'
              : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          {value ? (
            <span className="flex items-center gap-2 min-w-0">
              <MemberAvatar
                name={value}
                photoDataUrl={matchedMember?.photoDataUrl}
                wing={matchedMember?.wing}
                size="xs"
              />
              <span className="font-medium text-slate-900 truncate">
                {value}
              </span>
              {matchedMember && (
                <span className="hidden sm:inline text-[11px] text-slate-500 shrink-0">
                  ({ROLE_LABELS[matchedMember.role]})
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {!required && value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            title="Limpar seleção"
            aria-label={`Limpar ${label}`}
            className="min-h-[42px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-red-600 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, cargo ou ala..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
            {sortedMembers.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 text-center">
                Nenhum integrante registrado ainda. Cadastre membros em Membros & Acessos.
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 text-center">
                Nenhuma pessoa registrada encontrada para &ldquo;{search}&rdquo;.
              </div>
            ) : (
              filteredMembers.map((m) => {
                const isSelected =
                  value.trim().toLowerCase() === m.fullName.trim().toLowerCase();
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onChange(m.fullName);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full min-h-[42px] px-3 py-2 text-left flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-teal-50 text-teal-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MemberAvatar
                        name={m.fullName}
                        photoDataUrl={m.photoDataUrl}
                        wing={m.wing}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{m.fullName}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {ROLE_LABELS[m.role]} · Ala {m.wing || 'Masculina'}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-teal-700 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
