import React from 'react';
import {
  Bell,
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  GitFork,
  LogOut,
  MessageCircle,
  Settings,
  UserCheck,
  UserRoundPen,
  Users,
  X,
} from 'lucide-react';
import { ROLE_LABELS, type CellRole, type CellWorkspace } from '../types/cell';

export type NavSection =
  | 'overview'
  | 'planning'
  | 'attendance'
  | 'organogram'
  | 'members'
  | 'ficha'
  | 'materials'
  | 'chat';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  cells: CellWorkspace[];
  activeCell: CellWorkspace | null;
  onSelectCell: (cellId: string) => void;
  effectiveRole: CellRole;
  actualRole: CellRole;
  unreadAlertsCount: number;
  unreadChatCount?: number;
  userEmail: string;
  userName: string;
  memberCode?: string;
  isNameSession: boolean;
  isReadOnlyMember: boolean;
  canManageCellSettings: boolean;
  onOpenCellSettings: () => void;
  onOpenNewCell: () => void;
  onOpenNameSwitch: () => void;
  onSignOut: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Visão Geral & Lembretes', icon: Bell },
  { id: 'chat', label: 'Bate-Papo da Célula', icon: MessageCircle },
  { id: 'ficha', label: 'Minha Ficha', icon: UserRoundPen },
  { id: 'organogram', label: 'Organograma da Célula', icon: GitFork },
  { id: 'planning', label: 'Planificação & Progresso', icon: CalendarRange },
  { id: 'attendance', label: 'Frequência & Reuniões', icon: ClipboardCheck },
  { id: 'members', label: 'Membros & Acessos', icon: Users },
  { id: 'materials', label: 'Materiais de Estudo', icon: BookOpen },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  cells,
  activeCell,
  onSelectCell,
  effectiveRole,
  actualRole,
  unreadAlertsCount,
  unreadChatCount = 0,
  userEmail,
  userName,
  memberCode,
  isNameSession,
  isReadOnlyMember,
  canManageCellSettings,
  onOpenCellSettings,
  onOpenNewCell,
  onOpenNameSwitch,
  onSignOut,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const visibleNavItems = isReadOnlyMember
    ? NAV_ITEMS.filter(
        (item) => item.id !== 'attendance' && item.id !== 'members',
      )
    : NAV_ITEMS;
  const sidebarBody = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-[276px] max-w-[85vw]">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Célula Viva
          </div>
          <div className="text-xs text-slate-500 truncate mt-0.5">
            {activeCell ? activeCell.name : 'Sem célula selecionada'}
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Fechar menu"
          className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {activeCell && (
        <div className="px-4 py-3 border-b border-slate-200">
          {cells.length > 0 && !isNameSession ? (
            <>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Célula Ativa
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={activeCell.id}
                  onChange={(e) => onSelectCell(e.target.value)}
                  className="flex-1 min-w-0 min-h-[40px] px-2.5 py-2 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                >
                  {cells.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {canManageCellSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenCellSettings();
                      onCloseMobile();
                    }}
                    title="Configurações da Célula"
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer shrink-0"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
              </div>
              {actualRole === 'lider' && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenNewCell();
                    onCloseMobile();
                  }}
                  className="mt-2 py-1 text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
                >
                  + Criar nova célula
                </button>
              )}
            </>
          ) : (
            <div className="text-xs font-semibold text-slate-800">
              {activeCell.name}
            </div>
          )}

          {memberCode ? (
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Seu código:</span>
              <span className="font-mono font-semibold text-slate-900">
                {memberCode}
              </span>
            </div>
          ) : (
            activeCell.accessCode && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Código célula:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {activeCell.accessCode}
                </span>
              </div>
            )
          )}
        </div>
      )}

      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              className={`w-full min-h-[44px] flex items-center justify-between gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer text-left ${
                isActive
                  ? 'bg-teal-50 text-teal-800 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-teal-700' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'overview' && unreadAlertsCount > 0 && (
                <span className="text-xs font-mono tabular-nums font-semibold text-amber-700 shrink-0">
                  {unreadAlertsCount}
                </span>
              )}
              {item.id === 'chat' && unreadChatCount > 0 && (
                <span className="text-xs font-mono tabular-nums font-semibold text-teal-700 shrink-0">
                  {unreadChatCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 pb-safe border-t border-slate-200 bg-slate-50/70 space-y-2.5">
        <div>
          <div className="text-xs font-semibold text-slate-900 truncate">
            {userName}
          </div>
          {userEmail && (
            <div className="text-xs text-slate-500 truncate">{userEmail}</div>
          )}
          <div className="text-xs text-teal-700 font-medium mt-1">
            {ROLE_LABELS[effectiveRole]}
            {isReadOnlyMember ? ' · Somente Leitura' : ''}
          </div>
        </div>

        {!isNameSession && actualRole === 'lider' && (
          <button
            type="button"
            onClick={() => {
              onOpenNameSwitch();
              onCloseMobile();
            }}
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Entrar com Código (Membro)
          </button>
        )}

        <button
          type="button"
          onClick={onSignOut}
          className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair da conta
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen print:hidden">
        {sidebarBody}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex print:hidden">
          <div
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{sidebarBody}</div>
        </div>
      )}
    </>
  );
}
