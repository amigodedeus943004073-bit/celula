import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Bell,
  CalendarRange,
  ClipboardCheck,
  Menu,
  MessageCircle,
  UserCheck,
  UserRoundPen,
  X,
} from 'lucide-react';
import { AttendanceReportsView } from './components/AttendanceReportsView';
import { AuthGate } from './components/AuthGate';
import { CellChatView } from './components/CellChatView';
import { CellSetupModal } from './components/CellSetupModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MembersAccessView } from './components/MembersAccessView';
import { MyFichaView } from './components/MyFichaView';
import { OrganogramView } from './components/OrganogramView';
import { OverviewDashboard } from './components/OverviewDashboard';
import { PlanningWorkspace } from './components/PlanningWorkspace';
import { Sidebar, type NavSection } from './components/Sidebar';
import { StudyMaterialsView } from './components/StudyMaterialsView';
import {
  computeAutomaticAlerts,
  computeProgressMetrics,
  getMonthKey,
  getTodayIso,
} from './lib/cellAnalytics';
import {
  createCellWorkspace,
  ensureCellAccessCodeBackfill,
  ensureUserProfile,
  updateCellSettings,
} from './lib/cellService';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import {
  getRolePermissions,
  ROLE_LABELS,
  type CellChallenge,
  type CellMember,
  type CellMessage,
  type CellNotification,
  type CellRole,
  type CellWorkspace,
  type ChallengeResponse,
  type MeetingReport,
  type MemberSession,
  type MonthlyPlan,
  type StudyMaterial,
} from './types/cell';

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Visão Geral & Lembretes',
  chat: 'Bate-Papo da Célula',
  ficha: 'Minha Ficha',
  organogram: 'Organograma da Célula',
  planning: 'Planificação & Progresso',
  attendance: 'Frequência & Reuniões',
  members: 'Membros & Acessos',
  materials: 'Materiais de Estudo',
};

function CellManagementWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [cells, setCells] = useState<CellWorkspace[]>([]);
  const [cellsLoaded, setCellsLoaded] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [activeCellId, setActiveCellId] = useState<string>('');

  const [memberSession, setMemberSession] = useState<MemberSession | null>(null);

  const [allMembers, setAllMembers] = useState<CellMember[]>([]);
  const [allPlans, setAllPlans] = useState<MonthlyPlan[]>([]);
  const [allReports, setAllReports] = useState<MeetingReport[]>([]);
  const [allMaterials, setAllMaterials] = useState<StudyMaterial[]>([]);
  const [allNotifications, setAllNotifications] = useState<CellNotification[]>([]);
  const [allMessages, setAllMessages] = useState<CellMessage[]>([]);
  const [allChallenges, setAllChallenges] = useState<CellChallenge[]>([]);
  const [allChallengeResponses, setAllChallengeResponses] = useState<ChallengeResponse[]>([]);
  const [lastSeenChatMs, setLastSeenChatMs] = useState<number>(() => Date.now());

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [planningTab, setPlanningTab] = useState<'mes' | 'semana' | 'progresso'>('mes');
  const [preselectedPlanForAttendance, setPreselectedPlanForAttendance] =
    useState<MonthlyPlan | null>(null);

  const [previewRole, setPreviewRole] = useState<CellRole | null>(null);
  const [nameSwitchMemberId, setNameSwitchMemberId] = useState<string | null>(null);
  const [nameSwitchOpen, setNameSwitchOpen] = useState(false);
  const [nameSwitchInput, setNameSwitchInput] = useState('');
  const [nameSwitchError, setNameSwitchError] = useState<string | null>(null);

  const [cellModalMode, setCellModalMode] = useState<'create' | 'edit' | null>(
    null,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const backfilledCellIdsRef = useRef<Set<string>>(new Set());

  // 1. Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser?.isAnonymous) {
        try {
          const snap = await getDoc(doc(db, 'memberSessions', nextUser.uid));
          setMemberSession(snap.exists() ? (snap.data() as MemberSession) : null);
        } catch {
          setMemberSession(null);
        }
      } else {
        setMemberSession(null);
      }

      setUser(nextUser);
      setAuthReady(true);
      setNameSwitchMemberId(null);
      setPreviewRole(null);

      if (nextUser) {
        if (!nextUser.isAnonymous) {
          await ensureUserProfile(nextUser);
        }
      } else {
        setCells([]);
        setCellsLoaded(false);
        setMembersLoaded(false);
        setActiveCellId('');
        setAllMembers([]);
        setAllPlans([]);
        setAllReports([]);
        setAllMaterials([]);
        setAllNotifications([]);
        setAllMessages([]);
        setAllChallenges([]);
        setAllChallengeResponses([]);
      }
    });
    return () => unsub();
  }, []);

  // 2A. Anonymous Name-session listener (memberSessions/{uid})
  useEffect(() => {
    if (!authReady || !user || !user.isAnonymous) return;

    const unsubSession = onSnapshot(
      doc(db, 'memberSessions', user.uid),
      (snap) => {
        if (snap.exists()) {
          setMemberSession(snap.data() as MemberSession);
        } else {
          setMemberSession(null);
        }
      },
      (error) =>
        handleFirestoreError(
          error,
          OperationType.GET,
          `memberSessions/${user.uid}`,
        ),
    );

    return () => unsubSession();
  }, [authReady, user]);

  // 2B. Anonymous session data listeners (by accessCode + getDoc on active cell)
  useEffect(() => {
    if (!authReady || !user || !user.isAnonymous || !memberSession) return;

    let cancelled = false;
    async function loadSessionCell(session: MemberSession) {
      try {
        const cellSnap = await getDoc(doc(db, 'cells', session.cellId));
        if (!cancelled) {
          if (cellSnap.exists()) {
            const loadedCell = {
              id: cellSnap.id,
              ...(cellSnap.data() as Omit<CellWorkspace, 'id'>),
            };
            setCells([loadedCell]);
            setActiveCellId(loadedCell.id);
          } else {
            setCells([]);
          }
          setCellsLoaded(true);
        }
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.GET,
          `cells/${session.cellId}`,
        );
      }
    }

    loadSessionCell(memberSession);

    const code = memberSession.accessCode;

    const unsubMembers = onSnapshot(
      query(collection(db, 'members'), where('accessCode', '==', code)),
      (snap) => {
        setAllMembers(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CellMember, 'id'>),
          })),
        );
        setMembersLoaded(true);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'members'),
    );

    const unsubPlans = onSnapshot(
      query(collection(db, 'monthlyPlans'), where('accessCode', '==', code)),
      (snap) => {
        setAllPlans(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<MonthlyPlan, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'monthlyPlans'),
    );

    const unsubReports = onSnapshot(
      query(collection(db, 'meetingReports'), where('accessCode', '==', code)),
      (snap) => {
        setAllReports(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<MeetingReport, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'meetingReports'),
    );

    const unsubMaterials = onSnapshot(
      query(collection(db, 'studyMaterials'), where('accessCode', '==', code)),
      (snap) => {
        setAllMaterials(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<StudyMaterial, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'studyMaterials'),
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('accessCode', '==', code)),
      (snap) => {
        setAllNotifications(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CellNotification, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'notifications'),
    );

    const unsubMessages = onSnapshot(
      query(collection(db, 'cellMessages'), where('accessCode', '==', code)),
      (snap) => {
        setAllMessages(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CellMessage, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'cellMessages'),
    );

    const unsubChallenges = onSnapshot(
      query(collection(db, 'cellChallenges'), where('accessCode', '==', code)),
      (snap) => {
        setAllChallenges(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CellChallenge, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'cellChallenges'),
    );

    const unsubChallengeResponses = onSnapshot(
      query(collection(db, 'challengeResponses'), where('accessCode', '==', code)),
      (snap) => {
        setAllChallengeResponses(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ChallengeResponse, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'challengeResponses'),
    );

    return () => {
      cancelled = true;
      unsubMembers();
      unsubPlans();
      unsubReports();
      unsubMaterials();
      unsubNotifs();
      unsubMessages();
      unsubChallenges();
      unsubChallengeResponses();
    };
  }, [authReady, user, memberSession]);

  // 2C. Google-authenticated user real-time listeners (single-field array-contains query)
  useEffect(() => {
    if (!authReady || !user || user.isAnonymous || !user.email) return;
    const userEmail = user.email.trim().toLowerCase();

    const unsubCells = onSnapshot(
      query(
        collection(db, 'cells'),
        where('allowedEmails', 'array-contains', userEmail),
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CellWorkspace, 'id'>),
        }));
        setCells(list);
        setCellsLoaded(true);
        setActiveCellId((prev) =>
          prev && list.some((c) => c.id === prev) ? prev : list[0]?.id || '',
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'cells'),
    );

    const unsubMembers = onSnapshot(
      query(
        collection(db, 'members'),
        where('allowedEmails', 'array-contains', userEmail),
      ),
      (snap) => {
        setAllMembers(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CellMember, 'id'>),
          })),
        );
        setMembersLoaded(true);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'members'),
    );

    const unsubPlans = onSnapshot(
      query(
        collection(db, 'monthlyPlans'),
        where('allowedEmails', 'array-contains', userEmail),
      ),
      (snap) => {
        setAllPlans(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<MonthlyPlan, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'monthlyPlans'),
    );

    const unsubReports = onSnapshot(
      query(
        collection(db, 'meetingReports'),
        where('allowedEmails', 'array-contains', userEmail),
      ),
      (snap) => {
        setAllReports(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<MeetingReport, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'meetingReports'),
    );

    const unsubMaterials = onSnapshot(
      query(
        collection(db, 'studyMaterials'),
        where('allowedEmails', 'array-contains', userEmail),
      ),
      (snap) => {
        setAllMaterials(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<StudyMaterial, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'studyMaterials'),
    );

    const unsubNotifs = onSnapshot(
      query(
        collection(db, 'notifications'),
        where('allowedEmails', 'array-contains', userEmail),
      ),
      (snap) => {
        setAllNotifications(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CellNotification, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'notifications'),
    );

    const unsubMessages = onSnapshot(
      query(
        collection(db, 'cellMessages'),
        where('allowedEmails', 'array-contains', userEmail),
      ),
      (snap) => {
        setAllMessages(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CellMessage, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'cellMessages'),
    );

    const unsubChallenges = onSnapshot(
      query(
        collection(db, 'cellChallenges'),
        where('allowedEmails', 'array-contains', userEmail),
      ),
      (snap) => {
        setAllChallenges(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CellChallenge, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'cellChallenges'),
    );

    const unsubChallengeResponses = onSnapshot(
      query(
        collection(db, 'challengeResponses'),
        where('allowedEmails', 'array-contains', userEmail),
      ),
      (snap) => {
        setAllChallengeResponses(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ChallengeResponse, 'id'>),
          })),
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, 'challengeResponses'),
    );

    return () => {
      unsubCells();
      unsubMembers();
      unsubPlans();
      unsubReports();
      unsubMaterials();
      unsubNotifs();
      unsubMessages();
      unsubChallenges();
      unsubChallengeResponses();
    };
  }, [authReady, user]);

  const activeCell = useMemo(
    () => cells.find((c) => c.id === activeCellId) || cells[0] || null,
    [cells, activeCellId],
  );

  const members = useMemo(
    () => allMembers.filter((m) => m.cellId === activeCell?.id),
    [allMembers, activeCell?.id],
  );
  const plans = useMemo(
    () => allPlans.filter((p) => p.cellId === activeCell?.id),
    [allPlans, activeCell?.id],
  );
  const reports = useMemo(
    () => allReports.filter((r) => r.cellId === activeCell?.id),
    [allReports, activeCell?.id],
  );
  const materials = useMemo(
    () => allMaterials.filter((m) => m.cellId === activeCell?.id),
    [allMaterials, activeCell?.id],
  );
  const notifications = useMemo(
    () => allNotifications.filter((n) => n.cellId === activeCell?.id),
    [allNotifications, activeCell?.id],
  );
  const messages = useMemo(
    () => allMessages.filter((m) => m.cellId === activeCell?.id),
    [allMessages, activeCell?.id],
  );
  const challenges = useMemo(
    () => allChallenges.filter((c) => c.cellId === activeCell?.id),
    [allChallenges, activeCell?.id],
  );
  const challengeResponses = useMemo(
    () => allChallengeResponses.filter((r) => r.cellId === activeCell?.id),
    [allChallengeResponses, activeCell?.id],
  );

  const isRemoteNameSession = Boolean(user?.isAnonymous);
  const isLocalNameSwitch = Boolean(!isRemoteNameSession && nameSwitchMemberId);
  const isNameSession = isRemoteNameSession || isLocalNameSwitch;

  const actualRole: CellRole = useMemo(() => {
    if (!user || !activeCell) return 'lider';
    if (user.isAnonymous) {
      const m = memberSession
        ? members.find((item) => item.id === memberSession.memberId)
        : null;
      return m?.role || 'membro';
    }
    const email = user.email || '';
    if (
      activeCell.ownerUid === user.uid ||
      email.toLowerCase() === 'amigodedeus943004073@gmail.com'
    ) {
      return 'lider';
    }
    if (activeCell.trainerEmails.includes(email)) {
      return 'lider_treinamento';
    }
    if (activeCell.secretaryEmails?.includes(email)) {
      return 'secretario';
    }
    const matched = members.find(
      (m) => m.memberEmail?.toLowerCase() === email.toLowerCase(),
    );
    return matched?.role || 'membro';
  }, [user, activeCell, members, memberSession]);

  // Backfill accessCode, cellLookup, and individual memberCodes across all collections
  useEffect(() => {
    if (
      !user ||
      user.isAnonymous ||
      !activeCell ||
      !membersLoaded ||
      actualRole !== 'lider'
    ) {
      return;
    }
    const cellAllowed = activeCell.allowedEmails.map((e) =>
      e.trim().toLowerCase(),
    );
    const hasSyncGap = (docs: Array<{ allowedEmails?: string[] }>) =>
      docs.some((d) => {
        const list = (d.allowedEmails || []).map((e) => e.trim().toLowerCase());
        return cellAllowed.some((e) => !list.includes(e));
      });
    const needsBackfill =
      !activeCell.accessCode ||
      members.some((m) => !m.memberCode || !m.accessCode || !m.wing) ||
      plans.some((p) => !p.accessCode) ||
      reports.some((r) => !r.accessCode) ||
      materials.some((m) => !m.accessCode) ||
      notifications.some((n) => !n.accessCode) ||
      challenges.some((c) => !c.accessCode) ||
      challengeResponses.some((r) => !r.accessCode) ||
      hasSyncGap(members) ||
      hasSyncGap(plans) ||
      hasSyncGap(reports) ||
      hasSyncGap(materials) ||
      hasSyncGap(notifications) ||
      hasSyncGap(challenges) ||
      hasSyncGap(challengeResponses) ||
      !backfilledCellIdsRef.current.has(activeCell.id);
    if (!needsBackfill) return;
    backfilledCellIdsRef.current.add(activeCell.id);
    ensureCellAccessCodeBackfill(activeCell, members).catch((err) => {
      console.warn('Backfill de código de acesso pendente:', err);
    });
  }, [
    user,
    activeCell,
    members,
    plans,
    reports,
    materials,
    notifications,
    challenges,
    challengeResponses,
    membersLoaded,
    actualRole,
  ]);

  const currentMember: CellMember | null = useMemo(() => {
    if (isRemoteNameSession && memberSession) {
      return members.find((m) => m.id === memberSession.memberId) || null;
    }
    if (nameSwitchMemberId) {
      return members.find((m) => m.id === nameSwitchMemberId) || null;
    }
    if (!user?.email) return null;
    const email = user.email.toLowerCase();
    return (
      members.find((m) => m.memberEmail?.toLowerCase() === email) ||
      (actualRole === 'lider'
        ? members.find((m) => m.role === 'lider') || null
        : null)
    );
  }, [
    isRemoteNameSession,
    memberSession,
    nameSwitchMemberId,
    user?.email,
    members,
    actualRole,
  ]);

  const effectiveRole: CellRole = useMemo(() => {
    if (isLocalNameSwitch && currentMember) {
      return currentMember.role;
    }
    if (actualRole === 'lider' && previewRole) {
      return previewRole;
    }
    return actualRole;
  }, [isLocalNameSwitch, currentMember, actualRole, previewRole]);

  const permissions = useMemo(
    () => getRolePermissions(effectiveRole, isNameSession),
    [effectiveRole, isNameSession],
  );

  const isReadOnlyMember =
    isNameSession ||
    (!permissions.canManageAllMembers && !permissions.canRecordAttendance);

  useEffect(() => {
    if (
      isReadOnlyMember &&
      (activeSection === 'attendance' || activeSection === 'members')
    ) {
      setActiveSection('overview');
    }
  }, [isReadOnlyMember, activeSection]);

  const today = getTodayIso();
  const currentMonthKey = getMonthKey(today);

  const autoAlerts = useMemo(
    () => computeAutomaticAlerts(plans, reports, members, today),
    [plans, reports, members, today],
  );

  const progressMetrics = useMemo(
    () => computeProgressMetrics(currentMonthKey, plans, reports, members),
    [currentMonthKey, plans, reports, members],
  );

  const unreadAlertsCount = useMemo(() => {
    if (!user) return autoAlerts.length;
    const unreadNotifs = notifications.filter(
      (n) => !n.readByUids.includes(user.uid),
    ).length;
    return autoAlerts.length + unreadNotifs;
  }, [autoAlerts.length, notifications, user]);

  useEffect(() => {
    if (activeSection === 'chat') {
      setLastSeenChatMs(Date.now());
    }
  }, [activeSection, messages.length]);

  const unreadChatCount = useMemo(() => {
    if (activeSection === 'chat' || !user) return 0;
    return messages.filter((m) => {
      if (m.senderUid === user.uid) return false;
      const ms = m.createdAt?.toMillis ? m.createdAt.toMillis() : 0;
      return ms > lastSeenChatMs;
    }).length;
  }, [activeSection, messages, user, lastSeenChatMs]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">
          Carregando Célula Viva...
        </div>
      </div>
    );
  }

  if (!user || (user.isAnonymous && !memberSession)) {
    return <AuthGate />;
  }

  // First-time Google leader with no cell yet
  if (
    !user.isAnonymous &&
    cellsLoaded &&
    !activeCell &&
    cellModalMode !== 'edit'
  ) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <CellSetupModal
          mode="create"
          onSubmit={async (data) => {
            const newId = await createCellWorkspace(data, {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Líder da Célula',
            });
            setActiveCellId(newId);
          }}
        />
      </div>
    );
  }

  const handleNavigate = (
    section: NavSection,
    extra?: { tab?: 'mes' | 'semana' | 'progresso'; planId?: string },
  ) => {
    setActiveSection(section);
    if (section === 'planning' && extra?.tab) {
      setPlanningTab(extra.tab);
    }
    if (section === 'attendance' && extra?.planId) {
      const targetPlan = plans.find((p) => p.id === extra.planId) || null;
      setPreselectedPlanForAttendance(targetPlan);
    }
  };

  const handleConfirmNameSwitch = (e: React.FormEvent) => {
    e.preventDefault();
    const targetCode = nameSwitchInput.trim().toUpperCase();
    if (targetCode.length < 6) {
      setNameSwitchError(
        'Informe o código individual gerado na ficha (ex.: MARI-4821).',
      );
      return;
    }
    const matched = members.find(
      (m) => m.memberCode && m.memberCode.toUpperCase() === targetCode,
    );
    if (!matched) {
      setNameSwitchError(
        'Código de ficha não encontrado nesta célula. Crie a ficha primeiro para gerar o código.',
      );
      return;
    }
    setNameSwitchMemberId(matched.id);
    setPreviewRole(null);
    setNameSwitchInput('');
    setNameSwitchError(null);
    setNameSwitchOpen(false);
    setActiveSection('overview');
  };

  const displayUserName =
    isNameSession && currentMember
      ? currentMember.fullName
      : memberSession?.fullName || user.displayName || 'Usuário';

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        cells={cells}
        activeCell={activeCell}
        onSelectCell={(id) => {
          setActiveCellId(id);
          setPreviewRole(null);
          setNameSwitchMemberId(null);
        }}
        effectiveRole={effectiveRole}
        actualRole={actualRole}
        unreadAlertsCount={unreadAlertsCount}
        unreadChatCount={unreadChatCount}
        userEmail={isNameSession ? '' : user.email || ''}
        userName={displayUserName}
        memberCode={isNameSession ? currentMember?.memberCode : undefined}
        isNameSession={isNameSession}
        isReadOnlyMember={isReadOnlyMember}
        canManageCellSettings={permissions.canManageCellSettings}
        onOpenCellSettings={() => setCellModalMode('edit')}
        onOpenNewCell={() => setCellModalMode('create')}
        onOpenNameSwitch={() => {
          setNameSwitchInput('');
          setNameSwitchError(null);
          setNameSwitchOpen(true);
        }}
        onSignOut={() => signOut(auth)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Workspace Header */}
        <header className="print:hidden bg-white/95 backdrop-blur-sm border-b border-slate-200 px-3.5 sm:px-8 h-13 sm:h-14 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
              className="lg:hidden min-h-[40px] min-w-[40px] -ml-1.5 flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs sm:text-sm text-slate-500 truncate">
              <span className="hidden sm:inline">
                {activeCell?.name || 'Célula Viva'}
              </span>
              <span className="hidden sm:inline mx-2" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900">
                {SECTION_TITLES[activeSection]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isLocalNameSwitch && currentMember && (
              <button
                type="button"
                onClick={() => setNameSwitchMemberId(null)}
                className="px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg cursor-pointer whitespace-nowrap max-w-[160px] sm:max-w-none truncate"
              >
                {currentMember.fullName.split(' ')[0]} · Sair modo
              </button>
            )}
            {!isLocalNameSwitch && effectiveRole !== actualRole && (
              <button
                type="button"
                onClick={() => setPreviewRole(null)}
                className="px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer whitespace-nowrap"
              >
                {ROLE_LABELS[effectiveRole]} (Sair)
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveSection('overview')}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5 text-teal-700" />
              <span className="tabular-nums font-semibold">
                {unreadAlertsCount}
              </span>
              <span className="hidden sm:inline">lembretes</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-[1320px] w-full mx-auto print:p-0 print:max-w-none print:pb-0">
          {!activeCell ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Sincronizando dados da célula...
            </div>
          ) : (
            <>
              {isReadOnlyMember && currentMember && activeSection === 'overview' && (
                <div className="print:hidden mb-6 bg-teal-50 border border-teal-200 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-teal-900">
                    <span className="font-semibold">
                      Olá, {currentMember.fullName}!
                    </span>{' '}
                    Acesso <strong>de membro</strong> ({ROLE_LABELS[currentMember.role]} · Ala{' '}
                    {currentMember.wing || 'Masculina'}). Edite sua ficha, responda aos desafios, participe do bate-papo e acompanhe a planificação.
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigate('planning', { tab: 'mes' })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <CalendarRange className="w-3.5 h-3.5" />
                    Ver Planificação e Progresso
                  </button>
                </div>
              )}

              {activeSection === 'overview' && (
                <OverviewDashboard
                  cell={activeCell}
                  currentUid={user.uid}
                  currentMember={currentMember}
                  userName={displayUserName}
                  effectiveRole={effectiveRole}
                  permissions={permissions}
                  members={members}
                  plans={plans}
                  notifications={notifications}
                  autoAlerts={autoAlerts}
                  progressMetrics={progressMetrics}
                  challenges={challenges}
                  challengeResponses={challengeResponses}
                  onNavigate={handleNavigate}
                />
              )}

              {activeSection === 'ficha' && (
                <MyFichaView
                  cell={activeCell}
                  member={currentMember}
                  allMembers={members}
                />
              )}

              {activeSection === 'organogram' && (
                <OrganogramView
                  cell={activeCell}
                  currentUid={user.uid}
                  permissions={permissions}
                  members={members}
                />
              )}

              {activeSection === 'planning' && (
                <PlanningWorkspace
                  cell={activeCell}
                  currentUid={user.uid}
                  currentMemberId={currentMember?.id}
                  permissions={permissions}
                  members={members}
                  plans={plans}
                  reports={reports}
                  activeTab={planningTab}
                  onChangeTab={setPlanningTab}
                  onStartAttendanceFromPlan={(plan) => {
                    setPreselectedPlanForAttendance(plan);
                    setActiveSection('attendance');
                  }}
                />
              )}

              {activeSection === 'attendance' && !isReadOnlyMember && (
                <AttendanceReportsView
                  cell={activeCell}
                  currentUid={user.uid}
                  permissions={permissions}
                  members={members}
                  plans={plans}
                  reports={reports}
                  preselectedPlan={preselectedPlanForAttendance}
                  onClearPreselectedPlan={() =>
                    setPreselectedPlanForAttendance(null)
                  }
                />
              )}

              {activeSection === 'members' && !isReadOnlyMember && (
                <MembersAccessView
                  cell={activeCell}
                  currentUid={user.uid}
                  currentEmail={isNameSession ? '' : user.email || ''}
                  currentMemberId={currentMember?.id}
                  actualRole={actualRole}
                  effectiveRole={effectiveRole}
                  onChangePreviewRole={(nextRole) =>
                    setPreviewRole(nextRole === actualRole ? null : nextRole)
                  }
                  permissions={permissions}
                  members={members}
                />
              )}

              {activeSection === 'materials' && (
                <StudyMaterialsView
                  cell={activeCell}
                  currentUid={user.uid}
                  userName={displayUserName}
                  permissions={permissions}
                  materials={materials}
                />
              )}

              {activeSection === 'chat' && (
                <CellChatView
                  cell={activeCell}
                  currentUid={user.uid}
                  currentMember={currentMember}
                  userName={displayUserName}
                  effectiveRole={effectiveRole}
                  actualRole={actualRole}
                  members={members}
                  messages={messages}
                  permissions={permissions}
                />
              )}
            </>
          )}
        </main>

        {/* Mobile Bottom Thumb-Zone Navigation Bar */}
        <nav
          aria-label="Navegação rápida móvel"
          className="print:hidden lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
        >
          <div className="grid grid-cols-5 h-14">
            <button
              type="button"
              onClick={() => setActiveSection('overview')}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] cursor-pointer ${
                activeSection === 'overview'
                  ? 'text-teal-700 font-semibold'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Início</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('planning')}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] cursor-pointer ${
                activeSection === 'planning'
                  ? 'text-teal-700 font-semibold'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <CalendarRange className="w-4 h-4" />
              <span>Agenda</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('chat')}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] cursor-pointer ${
                activeSection === 'chat'
                  ? 'text-teal-700 font-semibold'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>Chat</span>
              {unreadChatCount > 0 && (
                <span className="absolute top-1.5 right-3 min-w-[16px] h-4 px-1 rounded-full bg-teal-700 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </button>
            {isReadOnlyMember ? (
              <button
                type="button"
                onClick={() => setActiveSection('ficha')}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] cursor-pointer ${
                  activeSection === 'ficha'
                    ? 'text-teal-700 font-semibold'
                    : 'text-slate-500 font-medium'
                }`}
              >
                <UserRoundPen className="w-4 h-4" />
                <span>Ficha</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveSection('attendance')}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] cursor-pointer ${
                  activeSection === 'attendance'
                    ? 'text-teal-700 font-semibold'
                    : 'text-slate-500 font-medium'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Chamada</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] cursor-pointer ${
                activeSection === 'organogram' ||
                activeSection === 'members' ||
                activeSection === 'materials' ||
                (!isReadOnlyMember && activeSection === 'ficha')
                  ? 'text-teal-700 font-semibold'
                  : 'text-slate-500 font-medium'
              }`}
            >
              <Menu className="w-4 h-4" />
              <span>Menu</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Modal de troca rápida por Código da Ficha ou Nome no mesmo dispositivo */}
      {nameSwitchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl w-full max-w-md shadow-xl p-5 sm:p-6 pb-safe space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-teal-700 shrink-0" />
                <h2 className="text-base font-bold text-slate-900">
                  Entrar como Membro (Somente Leitura)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setNameSwitchOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-md cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Permite entrar no painel usando exclusivamente o código individual gerado na ficha para visualizar Visão Geral, Planificação e Progresso em modo somente leitura.
            </p>
            {nameSwitchError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {nameSwitchError}
              </div>
            )}
            <form onSubmit={handleConfirmNameSwitch} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Código Gerado na Ficha *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={nameSwitchInput}
                  onChange={(e) => setNameSwitchInput(e.target.value.toUpperCase())}
                  placeholder="Ex.: MARI-4821"
                  className="w-full px-3 py-2.5 min-h-[44px] text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNameSwitchOpen(false)}
                  className="px-4 py-2.5 min-h-[42px] text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 min-h-[42px] text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                >
                  Acessar como Membro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cellModalMode && (
        <CellSetupModal
          mode={cellModalMode}
          existingCell={cellModalMode === 'edit' ? activeCell : null}
          onClose={() => setCellModalMode(null)}
          onSubmit={async (data) => {
            if (cellModalMode === 'create') {
              const newId = await createCellWorkspace(data, {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'Líder da Célula',
              });
              setActiveCellId(newId);
            } else if (activeCell) {
              await updateCellSettings(activeCell.id, data);
            }
            setCellModalMode(null);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CellManagementWorkspace />
    </ErrorBoundary>
  );
}
