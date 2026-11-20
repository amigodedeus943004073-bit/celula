import type { Timestamp } from 'firebase/firestore';

export type CellRole =
  | 'lider'
  | 'lider_treinamento'
  | 'secretario'
  | 'anfitriao'
  | 'filhinho'
  | 'visitante'
  | 'membro';

export type CellWing = 'Masculina' | 'Feminina';

export type ActivityLevel =
  | 'Muito Ativo'
  | 'Ativo'
  | 'Regular'
  | 'Inativo'
  | 'Novo Convertido';

export type BaptismStatus = 'Batizado' | 'Não Batizado' | 'Em Preparação';

export type PlanStatus = 'Planejada' | 'Realizada' | 'Cancelada';

export type PlanEventType =
  | 'Reunião de Célula'
  | 'Atividade Social'
  | 'Atividade Espiritual';

export type ReportStatus = 'Rascunho' | 'Finalizado';

export type StudyCategory =
  | 'Lição da Semana'
  | 'Estudo Bíblico'
  | 'Devocional'
  | 'Treinamento de Líderes'
  | 'Discipulado';

export type NotificationType =
  | 'reuniao_pendente'
  | 'relatorio_pendente'
  | 'escala_incompleta'
  | 'aniversario'
  | 'material_novo'
  | 'lembrete_manual';

export const MAX_TRAINERS_PER_CELL = 3;
export const MAX_FILHINHOS_PER_MENTOR = 3;
export const MAX_ALLOWED_EMAILS = 50;

export const FIELD_LIMITS = {
  id: 128,
  name: 100,
  fullName: 120,
  email: 200,
  phone: 40,
  address: 250,
  notes: 2000,
  lessonTitle: 160,
  lessonReference: 160,
  summary: 2500,
  highlights: 1500,
  prayerRequests: 1500,
  materialContent: 5000,
  materialSummary: 500,
  resourceUrl: 500,
  attachmentName: 160,
  attachmentMime: 120,
  attachmentDataUrl: 750000,
  notificationTitle: 140,
  notificationMessage: 500,
  chatMessage: 1000,
  chatMediaDataUrl: 750000,
  profession: 120,
  maritalStatus: 40,
  emergencyContact: 140,
  skillsOrInterests: 300,
  prayerRequest: 600,
  usefulInfo: 1000,
  photoDataUrl: 150000,
  challengeTitle: 140,
  challengeDescription: 800,
  challengeNote: 500,
} as const;

export const ROLE_LABELS: Record<CellRole, string> = {
  lider: 'Líder da Célula',
  lider_treinamento: 'Líder em Treinamento',
  secretario: 'Secretário(a)',
  anfitriao: 'Anfitrião(ã)',
  filhinho: 'Filhinho(a)',
  visitante: 'Visitante',
  membro: 'Membro',
};

export const ROLE_HIERARCHY_ORDER: Record<CellRole, number> = {
  lider: 0,
  lider_treinamento: 1,
  secretario: 2,
  anfitriao: 3,
  filhinho: 4,
  visitante: 5,
  membro: 6,
};

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  activeCellId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CellWorkspace {
  id: string;
  name: string;
  description?: string;
  meetingDay: string;
  meetingTime: string;
  location?: string;
  accessCode: string;
  ownerUid: string;
  ownerEmail: string;
  allowedEmails: string[];
  trainerEmails: string[];
  secretaryEmails?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CellRosterEntry {
  id: string;
  fullName: string;
  memberCode?: string;
  role: CellRole;
  wing: CellWing;
  mentorId?: string;
}

export interface MemberAccessCode {
  memberCode: string;
  memberId: string;
  fullName: string;
  cellId: string;
  cellName: string;
  accessCode: string;
  ownerUid: string;
  updatedAt: Timestamp;
}

export interface CellLookup {
  cellId: string;
  cellName: string;
  accessCode: string;
  ownerUid: string;
  memberRoster: CellRosterEntry[];
  updatedAt: Timestamp;
}

export interface MemberSession {
  uid: string;
  cellId: string;
  accessCode: string;
  memberCode?: string;
  memberId: string;
  fullName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CellMember {
  id: string;
  cellId: string;
  ownerUid: string;
  accessCode?: string;
  memberCode?: string;
  allowedEmails: string[];
  fullName: string;
  role: CellRole;
  wing: CellWing;
  mentorId?: string;
  menteeIds: string[];
  activityLevel: ActivityLevel;
  isChurchMember: boolean;
  baptismStatus: BaptismStatus;
  birthMonthDay?: string;
  photoDataUrl?: string;
  memberEmail?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MemberPrivateInfo {
  cellId: string;
  ownerUid: string;
  email?: string;
  phone: string;
  address: string;
  birthDate: string;
  baptismDate?: string;
  notes: string;
  profession?: string;
  maritalStatus?: string;
  emergencyContact?: string;
  skillsOrInterests?: string;
  prayerRequest?: string;
  usefulInfo?: string;
  updatedAt: Timestamp;
}

export interface MonthlyPlan {
  id: string;
  cellId: string;
  ownerUid: string;
  accessCode?: string;
  allowedEmails: string[];
  date: string;
  monthKey: string;
  time: string;
  eventType?: PlanEventType;
  lessonTitle: string;
  lessonReference?: string;
  responsibleName: string;
  preacherName?: string;
  worshipName?: string;
  snackName?: string;
  icebreakerName?: string;
  prayerName?: string;
  location?: string;
  notes?: string;
  status: PlanStatus;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MeetingReport {
  id: string;
  cellId: string;
  ownerUid: string;
  accessCode?: string;
  allowedEmails: string[];
  planId?: string;
  date: string;
  monthKey: string;
  lessonTitle: string;
  preacherName?: string;
  presentMemberIds: string[];
  absentMemberIds: string[];
  visitorsCount: number;
  visitorNames?: string[];
  decisionsCount: number;
  summary: string;
  highlights?: string;
  prayerRequests?: string;
  status: ReportStatus;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudyMaterial {
  id: string;
  cellId: string;
  ownerUid: string;
  accessCode?: string;
  allowedEmails: string[];
  title: string;
  category: StudyCategory;
  summary?: string;
  contentText: string;
  resourceUrl?: string;
  attachmentName?: string;
  attachmentMime?: string;
  attachmentDataUrl?: string;
  monthKey?: string;
  authorName: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CellNotification {
  id: string;
  cellId: string;
  ownerUid: string;
  accessCode?: string;
  allowedEmails: string[];
  type: NotificationType;
  title: string;
  message: string;
  dueDate: string;
  readByUids: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ChatMediaType = '' | 'image' | 'audio' | 'video';

export interface CellMessage {
  id: string;
  cellId: string;
  ownerUid: string;
  accessCode: string;
  allowedEmails: string[];
  senderUid: string;
  senderMemberId: string;
  senderName: string;
  senderRole: CellRole;
  senderWing: CellWing;
  text: string;
  mediaType?: ChatMediaType;
  mediaName?: string;
  mediaMime?: string;
  mediaDataUrl?: string;
  mediaUrl?: string;
  mediaDurationSec?: number;
  mentionedMemberIds?: string[];
  mentionedNames?: string[];
  replyToId?: string;
  replyToName?: string;
  replyToPreview?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ChallengeCategory =
  | 'Leitura Bíblica'
  | 'Oração & Jejum'
  | 'Visita & Cuidado'
  | 'Evangelismo'
  | 'Serviço';

export type ChallengeStatus = 'Ativo' | 'Encerrado';

export type ChallengeResponseStatus = 'Em Andamento' | 'Concluído';

export interface CellChallenge {
  id: string;
  cellId: string;
  ownerUid: string;
  accessCode?: string;
  allowedEmails: string[];
  title: string;
  description: string;
  category: ChallengeCategory;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  authorName: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ChallengeResponse {
  id: string;
  cellId: string;
  ownerUid: string;
  accessCode: string;
  allowedEmails: string[];
  challengeId: string;
  memberUid: string;
  memberId: string;
  memberName: string;
  memberRole: CellRole;
  status: ChallengeResponseStatus;
  note: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AutoReminder {
  id: string;
  type: NotificationType;
  severity: 'alta' | 'media' | 'normal';
  title: string;
  message: string;
  dueDate: string;
  actionView?:
    | 'overview'
    | 'planning'
    | 'attendance'
    | 'members'
    | 'organogram'
    | 'materials'
    | 'ficha';
  relatedPlanId?: string;
}

export interface RolePermissions {
  canManageCellSettings: boolean;
  canManageRolesAndTrainers: boolean;
  canManageOrganogram: boolean;
  canEditMonthlyPlan: boolean;
  canDeletePlanOrReport: boolean;
  canRecordAttendance: boolean;
  canEditFinalizedReports: boolean;
  canManageAllMembers: boolean;
  canViewMemberPII: boolean;
  canPublishMaterials: boolean;
  canCreateManualReminders: boolean;
  canViewOwnFicha: boolean;
  canEditOwnFicha: boolean;
}

export function getRolePermissions(
  role: CellRole,
  isNameSession: boolean = false,
): RolePermissions {
  // Members authenticated by individual fiche code can view cell panels AND edit only their own ficha.
  if (isNameSession) {
    return {
      canManageCellSettings: false,
      canManageRolesAndTrainers: false,
      canManageOrganogram: false,
      canEditMonthlyPlan: false,
      canDeletePlanOrReport: false,
      canRecordAttendance: false,
      canEditFinalizedReports: false,
      canManageAllMembers: false,
      canViewMemberPII: false,
      canPublishMaterials: false,
      canCreateManualReminders: false,
      canViewOwnFicha: true,
      canEditOwnFicha: true,
    };
  }

  switch (role) {
    case 'lider':
      return {
        canManageCellSettings: true,
        canManageRolesAndTrainers: true,
        canManageOrganogram: true,
        canEditMonthlyPlan: true,
        canDeletePlanOrReport: true,
        canRecordAttendance: true,
        canEditFinalizedReports: true,
        canManageAllMembers: true,
        canViewMemberPII: true,
        canPublishMaterials: true,
        canCreateManualReminders: true,
        canViewOwnFicha: true,
        canEditOwnFicha: true,
      };
    case 'lider_treinamento':
      return {
        canManageCellSettings: false,
        canManageRolesAndTrainers: false,
        canManageOrganogram: false,
        canEditMonthlyPlan: true,
        canDeletePlanOrReport: false,
        canRecordAttendance: true,
        canEditFinalizedReports: false,
        canManageAllMembers: true,
        canViewMemberPII: true,
        canPublishMaterials: true,
        canCreateManualReminders: true,
        canViewOwnFicha: true,
        canEditOwnFicha: true,
      };
    case 'secretario':
      return {
        canManageCellSettings: false,
        canManageRolesAndTrainers: false,
        canManageOrganogram: false,
        canEditMonthlyPlan: true,
        canDeletePlanOrReport: false,
        canRecordAttendance: true,
        canEditFinalizedReports: false,
        canManageAllMembers: false,
        canViewMemberPII: true,
        canPublishMaterials: false,
        canCreateManualReminders: true,
        canViewOwnFicha: true,
        canEditOwnFicha: true,
      };
    case 'anfitriao':
    case 'filhinho':
    case 'visitante':
    case 'membro':
    default:
      return {
        canManageCellSettings: false,
        canManageRolesAndTrainers: false,
        canManageOrganogram: false,
        canEditMonthlyPlan: false,
        canDeletePlanOrReport: false,
        canRecordAttendance: false,
        canEditFinalizedReports: false,
        canManageAllMembers: false,
        canViewMemberPII: false,
        canPublishMaterials: false,
        canCreateManualReminders: false,
        canViewOwnFicha: true,
        canEditOwnFicha: true,
      };
  }
}
