import { signInAnonymously } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  FIELD_LIMITS,
  MAX_ALLOWED_EMAILS,
  MAX_FILHINHOS_PER_MENTOR,
  MAX_TRAINERS_PER_CELL,
  type ActivityLevel,
  type BaptismStatus,
  type CellLookup,
  type CellMember,
  type CellRole,
  type CellRosterEntry,
  type CellWing,
  type CellWorkspace,
  type MemberAccessCode,
  type MemberPrivateInfo,
  type MonthlyPlan,
  type NotificationType,
  type PlanStatus,
  type ReportStatus,
  type StudyCategory,
  type StudyMaterial,
} from '../types/cell';
import { addDaysIso, getMonthKey, getTodayIso } from './cellAnalytics';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`.replace(
    /[^a-zA-Z0-9_-]/g,
    '',
  );
}

export function generateAccessCode(cellName: string): string {
  const base = cellName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'C');
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${base}-${digits}`;
}

export function generateMemberCode(
  fullName: string,
  usedCodes?: Set<string>,
): string {
  const firstWord = fullName.trim().split(/\s+/)[0] || 'MBR';
  const prefix = firstWord
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(3, 'M');

  for (let i = 0; i < 20; i += 1) {
    const digits = String(Math.floor(1000 + Math.random() * 9000));
    const candidate = `${prefix}-${digits}`;
    if (!usedCodes || !usedCodes.has(candidate)) {
      usedCodes?.add(candidate);
      return candidate;
    }
  }
  const fallback = `${prefix}-${String(Date.now()).slice(-5)}`;
  usedCodes?.add(fallback);
  return fallback;
}

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function clampStr(val: string | undefined, max: number): string {
  return (val ?? '').trim().slice(0, max);
}

export async function ensureUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
}): Promise<void> {
  if (user.isAnonymous) return;
  const email = (user.email ?? '').trim().toLowerCase();
  if (!email) return;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: clampStr(user.email ?? '', FIELD_LIMITS.email),
        displayName: clampStr(
          user.displayName || email.split('@')[0],
          FIELD_LIMITS.fullName,
        ),
        photoUrl: clampStr(user.photoURL ?? '', 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: clampStr(
          user.displayName || email.split('@')[0],
          FIELD_LIMITS.fullName,
        ),
        photoUrl: clampStr(user.photoURL ?? '', 500),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function syncCellLookup(
  cell: Pick<CellWorkspace, 'id' | 'name' | 'accessCode' | 'ownerUid'>,
  members: CellMember[],
): Promise<void> {
  if (!cell.accessCode) return;
  const roster: CellRosterEntry[] = members.slice(0, 50).map((m) => ({
    id: m.id,
    fullName: m.fullName,
    memberCode: m.memberCode || '',
    role: m.role,
    wing: m.wing || 'Masculina',
    mentorId: m.mentorId || '',
  }));
  const lookupRef = doc(db, 'cellLookup', cell.accessCode);
  try {
    await setDoc(lookupRef, {
      cellId: cell.id,
      cellName: clampStr(cell.name, FIELD_LIMITS.name),
      accessCode: cell.accessCode,
      ownerUid: cell.ownerUid,
      memberRoster: roster,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `cellLookup/${cell.accessCode}`,
    );
  }
}

export async function syncMemberAccessCodeDoc(params: {
  cell: Pick<CellWorkspace, 'id' | 'name' | 'accessCode' | 'ownerUid'>;
  memberId: string;
  memberCode: string;
  fullName: string;
}): Promise<void> {
  const { cell, memberId, memberCode, fullName } = params;
  if (!memberCode || !cell.accessCode) return;
  const ref = doc(db, 'memberAccessCodes', memberCode);
  try {
    await setDoc(ref, {
      memberCode,
      memberId,
      fullName: clampStr(fullName, FIELD_LIMITS.fullName),
      cellId: cell.id,
      cellName: clampStr(cell.name, FIELD_LIMITS.name),
      accessCode: cell.accessCode,
      ownerUid: cell.ownerUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `memberAccessCodes/${memberCode}`,
    );
  }
}

export async function ensureCellAccessCodeBackfill(
  cell: CellWorkspace,
  members: CellMember[],
): Promise<string> {
  let activeCode = cell.accessCode;

  if (!activeCode) {
    activeCode = generateAccessCode(cell.name);
    const batch = writeBatch(db);
    batch.update(doc(db, 'cells', cell.id), {
      accessCode: activeCode,
      updatedAt: serverTimestamp(),
    });

    const colNames = [
      'members',
      'monthlyPlans',
      'meetingReports',
      'studyMaterials',
      'notifications',
    ] as const;
    for (const colName of colNames) {
      const snap = await getDocs(
        query(collection(db, colName), where('cellId', '==', cell.id)),
      );
      for (const d of snap.docs) {
        batch.update(d.ref, {
          accessCode: activeCode,
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  }

  const usedCodes = new Set<string>(
    members.map((m) => m.memberCode).filter((c): c is string => Boolean(c)),
  );
  const missingMemberCode = members.filter((m) => !m.memberCode);
  let updatedMembers = members;

  if (missingMemberCode.length > 0) {
    const batchCodes = writeBatch(db);
    updatedMembers = members.map((m) => {
      if (m.memberCode) return m;
      const newCode = generateMemberCode(m.fullName, usedCodes);
      batchCodes.update(doc(db, 'members', m.id), {
        memberCode: newCode,
        updatedAt: serverTimestamp(),
      });
      batchCodes.set(doc(db, 'memberAccessCodes', newCode), {
        memberCode: newCode,
        memberId: m.id,
        fullName: clampStr(m.fullName, FIELD_LIMITS.fullName),
        cellId: cell.id,
        cellName: clampStr(cell.name, FIELD_LIMITS.name),
        accessCode: activeCode,
        ownerUid: cell.ownerUid,
        updatedAt: serverTimestamp(),
      });
      return { ...m, memberCode: newCode };
    });
    await batchCodes.commit();
  }

  const lookupSnap = await getDoc(doc(db, 'cellLookup', activeCode));
  if (!lookupSnap.exists() || missingMemberCode.length > 0) {
    await syncCellLookup({ ...cell, accessCode: activeCode }, updatedMembers);
  }

  return activeCode;
}

export async function signInMemberByName(
  rawCode: string,
  rawFullName: string = '',
): Promise<{ cellId: string; memberId: string; fullName: string; accessCode: string }> {
  const code = rawCode.trim().toUpperCase();
  const targetName = normalizeName(rawFullName);

  if (code.length < 6) {
    throw new Error('Informe o código gerado na sua ficha de cadastro (ex.: MARI-4821).');
  }

  let cred;
  try {
    cred = await signInAnonymously(auth);
  } catch (err) {
    const errCode = (err as { code?: string })?.code || '';
    if (
      errCode.includes('operation-not-allowed') ||
      errCode.includes('admin-restricted-operation')
    ) {
      throw new Error('ANON_AUTH_DISABLED');
    }
    throw err;
  }

  // 1. Try individual generated member access code first
  const memberCodeSnap = await getDoc(doc(db, 'memberAccessCodes', code));
  if (memberCodeSnap.exists()) {
    const entry = memberCodeSnap.data() as MemberAccessCode;
    if (targetName.length > 0 && normalizeName(entry.fullName) !== targetName) {
      throw new Error(
        'O nome digitado não corresponde a este código de ficha. Verifique com o Líder da Célula.',
      );
    }

    await setDoc(doc(db, 'memberSessions', cred.user.uid), {
      uid: cred.user.uid,
      cellId: entry.cellId,
      accessCode: entry.accessCode,
      memberId: entry.memberId,
      fullName: entry.fullName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      cellId: entry.cellId,
      memberId: entry.memberId,
      fullName: entry.fullName,
      accessCode: entry.accessCode,
    };
  }

  // 2. Fallback to shared cell code + pre-registered full name
  const lookupSnap = await getDoc(doc(db, 'cellLookup', code));
  if (!lookupSnap.exists()) {
    throw new Error(
      'Código não encontrado. Confirme o código gerado na sua ficha com o Líder da Célula.',
    );
  }

  if (targetName.length < 2) {
    throw new Error(
      'Ao entrar com o código geral da célula, informe também o seu nome completo cadastrado.',
    );
  }

  const lookup = lookupSnap.data() as CellLookup;
  const matched = lookup.memberRoster.find(
    (entry) => normalizeName(entry.fullName) === targetName,
  );

  if (!matched) {
    throw new Error(
      'Seu nome ainda não está cadastrado nesta célula. Peça ao Líder para criar sua ficha primeiro.',
    );
  }

  await setDoc(doc(db, 'memberSessions', cred.user.uid), {
    uid: cred.user.uid,
    cellId: lookup.cellId,
    accessCode: lookup.accessCode,
    memberId: matched.id,
    fullName: matched.fullName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    cellId: lookup.cellId,
    memberId: matched.id,
    fullName: matched.fullName,
    accessCode: lookup.accessCode,
  };
}

export async function createCellWorkspace(
  input: {
    name: string;
    description?: string;
    meetingDay: string;
    meetingTime: string;
    location?: string;
    seedExampleData?: boolean;
  },
  user: { uid: string; email: string; displayName: string },
): Promise<string> {
  const cellId = generateId('cell');
  const cellRef = doc(db, 'cells', cellId);
  const ownerEmail = clampStr(user.email, FIELD_LIMITS.email);
  const allowedEmails = [ownerEmail];
  const trainerEmails: string[] = [];
  const secretaryEmails: string[] = [];
  const accessCode = generateAccessCode(input.name);

  try {
    await setDoc(cellRef, {
      name: clampStr(input.name, FIELD_LIMITS.name),
      description: clampStr(input.description, 500),
      meetingDay: clampStr(input.meetingDay, 30),
      meetingTime: clampStr(input.meetingTime, 10),
      location: clampStr(input.location, 200),
      accessCode,
      ownerUid: user.uid,
      ownerEmail,
      allowedEmails,
      trainerEmails,
      secretaryEmails,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const batch1 = writeBatch(db);
    const batch2 = writeBatch(db);

    const leaderId = generateId('mem');
    const leaderRef = doc(db, 'members', leaderId);
    const t1Id = generateId('mem');
    const t2Id = generateId('mem');
    const secId = generateId('mem');
    const hostId = generateId('mem');
    const f1Id = generateId('mem');
    const f2Id = generateId('mem');
    const f3Id = generateId('mem');
    const visId = generateId('mem');

    const usedSeedCodes = new Set<string>();
    const leaderName = clampStr(
      user.displayName || 'Líder da Célula',
      FIELD_LIMITS.fullName,
    );
    const leaderCode = generateMemberCode(leaderName, usedSeedCodes);
    const t1Code = generateMemberCode('Lucas Andrade', usedSeedCodes);
    const t2Code = generateMemberCode('Beatriz Almeida', usedSeedCodes);
    const secCode = generateMemberCode('Camila Ferreira', usedSeedCodes);
    const hostCode = generateMemberCode('Marcos Silva', usedSeedCodes);
    const f1Code = generateMemberCode('Mariana Costa', usedSeedCodes);
    const f2Code = generateMemberCode('Rafael Oliveira', usedSeedCodes);
    const f3Code = generateMemberCode('Juliana Mendes', usedSeedCodes);
    const visCode = generateMemberCode('Larissa Rocha', usedSeedCodes);

    const rosterForLookup: CellRosterEntry[] = [
      {
        id: leaderId,
        fullName: leaderName,
        memberCode: leaderCode,
        role: 'lider',
        wing: 'Masculina',
        mentorId: '',
      },
    ];

    batch1.set(leaderRef, {
      cellId,
      ownerUid: user.uid,
      accessCode,
      memberCode: leaderCode,
      allowedEmails,
      fullName: leaderName,
      role: 'lider',
      wing: 'Masculina',
      mentorId: '',
      menteeIds: input.seedExampleData ? [f1Id] : [],
      activityLevel: 'Muito Ativo',
      isChurchMember: true,
      baptismStatus: 'Batizado',
      birthMonthDay: '',
      memberEmail: ownerEmail,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch1.set(doc(db, 'memberAccessCodes', leaderCode), {
      memberCode: leaderCode,
      memberId: leaderId,
      fullName: leaderName,
      cellId,
      cellName: clampStr(input.name, FIELD_LIMITS.name),
      accessCode,
      ownerUid: user.uid,
      updatedAt: serverTimestamp(),
    });

    batch2.set(doc(db, 'members', leaderId, 'private', 'info'), {
      cellId,
      ownerUid: user.uid,
      email: ownerEmail,
      phone: '(11) 99000-0000',
      address: clampStr(input.location || 'Endereço principal da célula', FIELD_LIMITS.address),
      birthDate: '1992-05-15',
      baptismDate: '2016-08-20',
      notes: 'Líder responsável pela coordenação geral e distribuição do organograma.',
      updatedAt: serverTimestamp(),
    });

    if (input.seedExampleData) {
      const today = getTodayIso();
      const monthKey = getMonthKey(today);

      // Líder em Treinamento 1 (Ala Masculina, controla f2Id)
      batch1.set(doc(db, 'members', t1Id), {
        cellId,
        ownerUid: user.uid,
        accessCode,
        memberCode: t1Code,
        allowedEmails,
        fullName: 'Lucas Andrade',
        role: 'lider_treinamento',
        wing: 'Masculina',
        mentorId: leaderId,
        menteeIds: [f2Id],
        activityLevel: 'Muito Ativo',
        isChurchMember: true,
        baptismStatus: 'Batizado',
        birthMonthDay: today.slice(5, 10),
        memberEmail: '',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'members', t1Id, 'private', 'info'), {
        cellId,
        ownerUid: user.uid,
        email: '',
        phone: '(11) 98412-3310',
        address: 'Rua das Acácias, 142 - Centro',
        birthDate: `1996-${today.slice(5, 10)}`,
        baptismDate: '2020-11-12',
        notes: 'Líder em treinamento da Ala Masculina; acompanha Rafael Oliveira.',
        updatedAt: serverTimestamp(),
      });

      // Líder em Treinamento 2 (Ala Feminina, controla f3Id)
      batch1.set(doc(db, 'members', t2Id), {
        cellId,
        ownerUid: user.uid,
        accessCode,
        memberCode: t2Code,
        allowedEmails,
        fullName: 'Beatriz Almeida',
        role: 'lider_treinamento',
        wing: 'Feminina',
        mentorId: leaderId,
        menteeIds: [f3Id],
        activityLevel: 'Muito Ativo',
        isChurchMember: true,
        baptismStatus: 'Batizado',
        birthMonthDay: '08-14',
        memberEmail: '',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'members', t2Id, 'private', 'info'), {
        cellId,
        ownerUid: user.uid,
        email: '',
        phone: '(11) 98110-4455',
        address: 'Rua das Flores, 210',
        birthDate: '1997-08-14',
        baptismDate: '2019-06-10',
        notes: 'Coordena o discipulado da Ala Feminina.',
        updatedAt: serverTimestamp(),
      });

      // Secretária (Ala Feminina)
      batch1.set(doc(db, 'members', secId), {
        cellId,
        ownerUid: user.uid,
        accessCode,
        memberCode: secCode,
        allowedEmails,
        fullName: 'Camila Ferreira',
        role: 'secretario',
        wing: 'Feminina',
        mentorId: '',
        menteeIds: [],
        activityLevel: 'Ativo',
        isChurchMember: true,
        baptismStatus: 'Batizado',
        birthMonthDay: '03-19',
        memberEmail: '',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'members', secId, 'private', 'info'), {
        cellId,
        ownerUid: user.uid,
        email: '',
        phone: '(11) 97744-9012',
        address: 'Av. Paulista, 1200',
        birthDate: '1998-03-19',
        baptismDate: '2021-04-03',
        notes: 'Secretária da célula; cuida da frequência e relatórios.',
        updatedAt: serverTimestamp(),
      });

      // Anfitrião (Ala Masculina)
      batch1.set(doc(db, 'members', hostId), {
        cellId,
        ownerUid: user.uid,
        accessCode,
        memberCode: hostCode,
        allowedEmails,
        fullName: 'Marcos Silva',
        role: 'anfitriao',
        wing: 'Masculina',
        mentorId: '',
        menteeIds: [],
        activityLevel: 'Muito Ativo',
        isChurchMember: true,
        baptismStatus: 'Batizado',
        birthMonthDay: '11-05',
        memberEmail: '',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'members', hostId, 'private', 'info'), {
        cellId,
        ownerUid: user.uid,
        email: '',
        phone: '(11) 96550-8811',
        address: clampStr(input.location || 'Casa da Família Silva', FIELD_LIMITS.address),
        birthDate: '1988-11-05',
        baptismDate: '2014-09-21',
        notes: 'Anfitrião da casa onde ocorrem as reuniões semanais.',
        updatedAt: serverTimestamp(),
      });

      // Filhinha 1 (Ala Feminina, vinculada ao Líder)
      batch1.set(doc(db, 'members', f1Id), {
        cellId,
        ownerUid: user.uid,
        accessCode,
        memberCode: f1Code,
        allowedEmails,
        fullName: 'Mariana Costa',
        role: 'filhinho',
        wing: 'Feminina',
        mentorId: leaderId,
        menteeIds: [],
        activityLevel: 'Ativo',
        isChurchMember: true,
        baptismStatus: 'Em Preparação',
        birthMonthDay: addDaysIso(today, 5).slice(5, 10),
        memberEmail: '',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'members', f1Id, 'private', 'info'), {
        cellId,
        ownerUid: user.uid,
        email: '',
        phone: '(11) 97221-8890',
        address: 'Av. Brasil, 890 - Ap 42',
        birthDate: `2001-${addDaysIso(today, 5).slice(5, 10)}`,
        baptismDate: '',
        notes: 'Em preparação para o batismo; participa da Ala Feminina.',
        updatedAt: serverTimestamp(),
      });

      // Filhinho 2 (Ala Masculina, vinculado a Lucas Andrade)
      batch1.set(doc(db, 'members', f2Id), {
        cellId,
        ownerUid: user.uid,
        accessCode,
        memberCode: f2Code,
        allowedEmails,
        fullName: 'Rafael Oliveira',
        role: 'filhinho',
        wing: 'Masculina',
        mentorId: t1Id,
        menteeIds: [],
        activityLevel: 'Novo Convertido',
        isChurchMember: false,
        baptismStatus: 'Não Batizado',
        birthMonthDay: '09-22',
        memberEmail: '',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'members', f2Id, 'private', 'info'), {
        cellId,
        ownerUid: user.uid,
        email: '',
        phone: '(11) 96334-1209',
        address: 'Rua Bela Vista, 55',
        birthDate: '1999-09-22',
        baptismDate: '',
        notes: 'Discipulado por Lucas Andrade.',
        updatedAt: serverTimestamp(),
      });

      // Filhinha 3 (Ala Feminina, vinculada a Beatriz Almeida)
      batch1.set(doc(db, 'members', f3Id), {
        cellId,
        ownerUid: user.uid,
        accessCode,
        memberCode: f3Code,
        allowedEmails,
        fullName: 'Juliana Mendes',
        role: 'filhinho',
        wing: 'Feminina',
        mentorId: t2Id,
        menteeIds: [],
        activityLevel: 'Ativo',
        isChurchMember: true,
        baptismStatus: 'Batizado',
        birthMonthDay: '04-12',
        memberEmail: '',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'members', f3Id, 'private', 'info'), {
        cellId,
        ownerUid: user.uid,
        email: '',
        phone: '(11) 98821-7733',
        address: 'Rua Primavera, 310',
        birthDate: '2002-04-12',
        baptismDate: '2023-10-08',
        notes: 'Acompanhada na Ala Feminina por Beatriz Almeida.',
        updatedAt: serverTimestamp(),
      });

      // Visitante (Ala Feminina)
      batch1.set(doc(db, 'members', visId), {
        cellId,
        ownerUid: user.uid,
        accessCode,
        memberCode: visCode,
        allowedEmails,
        fullName: 'Larissa Rocha',
        role: 'visitante',
        wing: 'Feminina',
        mentorId: '',
        menteeIds: [],
        activityLevel: 'Novo Convertido',
        isChurchMember: false,
        baptismStatus: 'Não Batizado',
        birthMonthDay: '',
        memberEmail: '',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch2.set(doc(db, 'members', visId, 'private', 'info'), {
        cellId,
        ownerUid: user.uid,
        email: '',
        phone: '',
        address: '',
        birthDate: '',
        baptismDate: '',
        notes: 'Visitante convidada esta semana.',
        updatedAt: serverTimestamp(),
      });

      const seededAccessEntries: Array<{
        id: string;
        fullName: string;
        memberCode: string;
        role: CellRole;
        wing: CellWing;
        mentorId: string;
      }> = [
        { id: t1Id, fullName: 'Lucas Andrade', memberCode: t1Code, role: 'lider_treinamento', wing: 'Masculina', mentorId: leaderId },
        { id: t2Id, fullName: 'Beatriz Almeida', memberCode: t2Code, role: 'lider_treinamento', wing: 'Feminina', mentorId: leaderId },
        { id: secId, fullName: 'Camila Ferreira', memberCode: secCode, role: 'secretario', wing: 'Feminina', mentorId: '' },
        { id: hostId, fullName: 'Marcos Silva', memberCode: hostCode, role: 'anfitriao', wing: 'Masculina', mentorId: '' },
        { id: f1Id, fullName: 'Mariana Costa', memberCode: f1Code, role: 'filhinho', wing: 'Feminina', mentorId: leaderId },
        { id: f2Id, fullName: 'Rafael Oliveira', memberCode: f2Code, role: 'filhinho', wing: 'Masculina', mentorId: t1Id },
        { id: f3Id, fullName: 'Juliana Mendes', memberCode: f3Code, role: 'filhinho', wing: 'Feminina', mentorId: t2Id },
        { id: visId, fullName: 'Larissa Rocha', memberCode: visCode, role: 'visitante', wing: 'Feminina', mentorId: '' },
      ];

      for (const entry of seededAccessEntries) {
        rosterForLookup.push(entry);
        batch1.set(doc(db, 'memberAccessCodes', entry.memberCode), {
          memberCode: entry.memberCode,
          memberId: entry.id,
          fullName: entry.fullName,
          cellId,
          cellName: clampStr(input.name, FIELD_LIMITS.name),
          accessCode,
          ownerUid: user.uid,
          updatedAt: serverTimestamp(),
        });
      }

      // Past completed meeting + automatic report
      const pastDate = addDaysIso(today, -7);
      const pastMonth = getMonthKey(pastDate);
      const pastPlanId = generateId('plan');
      batch1.set(doc(db, 'monthlyPlans', pastPlanId), {
        cellId,
        ownerUid: user.uid,
        accessCode,
        allowedEmails,
        date: pastDate,
        monthKey: pastMonth,
        time: input.meetingTime,
        lessonTitle: 'Fundamentos da Comunhão Cristã',
        lessonReference: 'Atos 2:42-47',
        responsibleName: user.displayName || 'Líder da Célula',
        preacherName: user.displayName || 'Líder da Célula',
        worshipName: 'Lucas Andrade',
        snackName: 'Marcos Silva',
        icebreakerName: 'Beatriz Almeida',
        prayerName: 'Mariana Costa',
        location: input.location || 'Casa da Família Silva',
        notes: 'Primeira reunião do ciclo mensal.',
        status: 'Realizada',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch1.set(doc(db, 'meetingReports', generateId('rep')), {
        cellId,
        ownerUid: user.uid,
        accessCode,
        allowedEmails,
        planId: pastPlanId,
        date: pastDate,
        monthKey: pastMonth,
        lessonTitle: 'Fundamentos da Comunhão Cristã',
        preacherName: user.displayName || 'Líder da Célula',
        presentMemberIds: [leaderId, t1Id, t2Id, secId, hostId, f1Id, f2Id, f3Id],
        absentMemberIds: [],
        visitorsCount: 1,
        visitorNames: ['Larissa Rocha'],
        decisionsCount: 1,
        summary: 'Reunião edificante com participação das alas masculina e feminina.',
        highlights: 'Larissa visitou pela primeira vez e recebeu acolhimento da Ala Feminina.',
        prayerRequests: 'Orar pela classe de batismo da Mariana.',
        status: 'Finalizado',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Current week upcoming meeting
      const nextDate = addDaysIso(today, 2);
      batch1.set(doc(db, 'monthlyPlans', generateId('plan')), {
        cellId,
        ownerUid: user.uid,
        accessCode,
        allowedEmails,
        date: nextDate,
        monthKey,
        time: input.meetingTime,
        lessonTitle: 'O Poder do Discipulado no Dia a Dia',
        lessonReference: '2 Timóteo 2:1-7',
        responsibleName: 'Lucas Andrade',
        preacherName: user.displayName || 'Líder da Célula',
        worshipName: 'Beatriz Almeida',
        snackName: '',
        icebreakerName: 'Mariana Costa',
        prayerName: 'Rafael Oliveira',
        location: input.location || 'Casa da Família Silva',
        notes: 'Confirmar lanche com o anfitrião.',
        status: 'Planejada',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Study material
      batch1.set(doc(db, 'studyMaterials', generateId('mat')), {
        cellId,
        ownerUid: user.uid,
        accessCode,
        allowedEmails,
        title: 'Guia da Lição: O Poder do Discipulado no Dia a Dia',
        category: 'Lição da Semana',
        summary: 'Esboço completo com perguntas para debate em grupo e versículos-chave de 2 Timóteo 2.',
        contentText:
          'Objetivo do Estudo:\nCompreender que o discipulado acontece no cotidiano, através de relacionamentos intencionais e cuidado mútuo.\n\n1. Acolhimento e Quebra-Gelo (10 min)\n2. Leitura Bíblica (2 Timóteo 2:1-7)\n3. Aplicação Prática (Cuidado 1 para 3).\n4. Oração pelos visitantes e pedidos.',
        resourceUrl: '',
        monthKey,
        authorName: user.displayName || 'Líder da Célula',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch1.set(doc(db, 'cellLookup', accessCode), {
      cellId,
      cellName: clampStr(input.name, FIELD_LIMITS.name),
      accessCode,
      ownerUid: user.uid,
      memberRoster: rosterForLookup,
      updatedAt: serverTimestamp(),
    });

    await batch1.commit();
    await batch2.commit();
    return cellId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `cells/${cellId}`);
  }
}

export async function updateCellSettings(
  cellId: string,
  updates: {
    name: string;
    description?: string;
    meetingDay: string;
    meetingTime: string;
    location?: string;
  },
): Promise<void> {
  try {
    await updateDoc(doc(db, 'cells', cellId), {
      name: clampStr(updates.name, FIELD_LIMITS.name),
      description: clampStr(updates.description, 500),
      meetingDay: clampStr(updates.meetingDay, 30),
      meetingTime: clampStr(updates.meetingTime, 10),
      location: clampStr(updates.location, 200),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `cells/${cellId}`);
  }
}

async function syncCellAccessListsAcrossCollections(
  cell: CellWorkspace,
  nextAllowedEmails: string[],
  nextTrainerEmails: string[],
  nextSecretaryEmails: string[],
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'cells', cell.id), {
    allowedEmails: nextAllowedEmails,
    trainerEmails: nextTrainerEmails,
    secretaryEmails: nextSecretaryEmails,
    updatedAt: serverTimestamp(),
  });

  const colNames = [
    'members',
    'monthlyPlans',
    'meetingReports',
    'studyMaterials',
    'notifications',
  ] as const;

  for (const colName of colNames) {
    const snap = await getDocs(
      query(collection(db, colName), where('cellId', '==', cell.id)),
    );
    for (const d of snap.docs) {
      batch.update(d.ref, {
        allowedEmails: nextAllowedEmails,
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
}

export async function saveMemberWithPrivateInfo(params: {
  cell: CellWorkspace;
  existingMember?: CellMember | null;
  allMembers: CellMember[];
  currentUid: string;
  canManageRoles: boolean;
  data: {
    fullName: string;
    role: CellRole;
    wing: CellWing;
    mentorId: string;
    activityLevel: ActivityLevel;
    isChurchMember: boolean;
    baptismStatus: BaptismStatus;
    memberEmail: string;
    phone: string;
    address: string;
    birthDate: string;
    baptismDate: string;
    notes: string;
  };
}): Promise<{ memberId: string; memberCode: string }> {
  const { cell, existingMember, allMembers, currentUid, canManageRoles, data } =
    params;

  const cleanEmail = clampStr(data.memberEmail, FIELD_LIMITS.email);
  const targetRole: CellRole = canManageRoles
    ? data.role
    : existingMember
      ? existingMember.role
      : data.role === 'filhinho' || data.role === 'visitante' || data.role === 'membro'
        ? data.role
        : 'filhinho';

  if (targetRole === 'lider_treinamento') {
    const currentTrainers = allMembers.filter(
      (m) => m.role === 'lider_treinamento' && m.id !== existingMember?.id,
    );
    if (currentTrainers.length >= MAX_TRAINERS_PER_CELL) {
      throw new Error(
        `Limite atingido: a célula pode ter no máximo ${MAX_TRAINERS_PER_CELL} Líderes em Treinamento.`,
      );
    }
  }

  const mentorId =
    targetRole === 'filhinho' ? clampStr(data.mentorId, FIELD_LIMITS.id) : '';
  if (targetRole === 'filhinho' && mentorId) {
    const mentor = allMembers.find((m) => m.id === mentorId);
    if (!mentor) {
      throw new Error(
        'Selecione um Líder ou Líder em Treinamento válido como mentor.',
      );
    }
    const currentMentees = allMembers.filter(
      (m) =>
        m.role === 'filhinho' &&
        m.mentorId === mentorId &&
        m.id !== existingMember?.id,
    );
    if (currentMentees.length >= MAX_FILHINHOS_PER_MENTOR) {
      throw new Error(
        `Limite atingido: ${mentor.fullName} já controla o máximo de ${MAX_FILHINHOS_PER_MENTOR} filhinhos.`,
      );
    }
  }

  const memberId = existingMember?.id || generateId('mem');
  const usedCodes = new Set<string>(
    allMembers.map((m) => m.memberCode).filter((c): c is string => Boolean(c)),
  );
  const memberCode =
    existingMember?.memberCode ||
    generateMemberCode(data.fullName, usedCodes);

  const birthMonthDay =
    data.birthDate && data.birthDate.length === 10
      ? data.birthDate.slice(5, 10)
      : '';

  let nextAllowed = [...cell.allowedEmails];
  let nextTrainers = [...cell.trainerEmails];
  let nextSecretaries = [...(cell.secretaryEmails || [])];

  if (canManageRoles) {
    const updatedOtherEmails = allMembers
      .filter((m) => m.id !== memberId)
      .map((m) => m.memberEmail?.trim())
      .filter((e): e is string => Boolean(e));

    const emailSet = new Set<string>([
      cell.ownerEmail,
      ...updatedOtherEmails,
      ...(cleanEmail ? [cleanEmail] : []),
    ]);
    nextAllowed = Array.from(emailSet).slice(0, MAX_ALLOWED_EMAILS);

    const trainerSet = new Set<string>();
    const secSet = new Set<string>();
    for (const m of allMembers) {
      if (m.id === memberId) continue;
      if (m.role === 'lider_treinamento' && m.memberEmail?.trim()) {
        trainerSet.add(m.memberEmail.trim());
      }
      if (m.role === 'secretario' && m.memberEmail?.trim()) {
        secSet.add(m.memberEmail.trim());
      }
    }
    if (targetRole === 'lider_treinamento' && cleanEmail) {
      trainerSet.add(cleanEmail);
    }
    if (targetRole === 'secretario' && cleanEmail) {
      secSet.add(cleanEmail);
    }
    nextTrainers = Array.from(trainerSet).slice(0, MAX_TRAINERS_PER_CELL);
    nextSecretaries = Array.from(secSet).slice(0, 5);
  }

  try {
    const batch = writeBatch(db);
    const memberRef = doc(db, 'members', memberId);
    const privRef = doc(db, 'members', memberId, 'private', 'info');

    if (existingMember) {
      const updatePayload: Record<string, unknown> = {
        fullName: clampStr(data.fullName, FIELD_LIMITS.fullName),
        memberCode,
        wing: data.wing,
        mentorId,
        activityLevel: data.activityLevel,
        isChurchMember: data.isChurchMember,
        baptismStatus: data.baptismStatus,
        birthMonthDay,
        updatedAt: serverTimestamp(),
      };
      if (canManageRoles) {
        updatePayload.role = targetRole;
        updatePayload.memberEmail = cleanEmail;
        updatePayload.allowedEmails = nextAllowed;
      }
      batch.update(memberRef, updatePayload);
    } else {
      batch.set(memberRef, {
        cellId: cell.id,
        ownerUid: cell.ownerUid,
        accessCode: cell.accessCode,
        memberCode,
        allowedEmails: nextAllowed,
        fullName: clampStr(data.fullName, FIELD_LIMITS.fullName),
        role: targetRole,
        wing: data.wing,
        mentorId,
        menteeIds: [],
        activityLevel: data.activityLevel,
        isChurchMember: data.isChurchMember,
        baptismStatus: data.baptismStatus,
        birthMonthDay,
        memberEmail: cleanEmail,
        createdBy: currentUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const prevMentorId = existingMember?.mentorId || '';
    if (prevMentorId && prevMentorId !== mentorId) {
      const prevMentor = allMembers.find((m) => m.id === prevMentorId);
      if (prevMentor) {
        batch.update(doc(db, 'members', prevMentor.id), {
          menteeIds: prevMentor.menteeIds
            .filter((id) => id !== memberId)
            .slice(0, MAX_FILHINHOS_PER_MENTOR),
          updatedAt: serverTimestamp(),
        });
      }
    }
    if (mentorId && targetRole === 'filhinho') {
      const nextMentor = allMembers.find((m) => m.id === mentorId);
      if (nextMentor && !nextMentor.menteeIds.includes(memberId)) {
        const nextList = [...nextMentor.menteeIds, memberId];
        if (nextList.length <= MAX_FILHINHOS_PER_MENTOR) {
          batch.update(doc(db, 'members', nextMentor.id), {
            menteeIds: nextList,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    await batch.commit();

    const privSnap = await getDoc(privRef);
    if (privSnap.exists()) {
      const privUpdate: Record<string, unknown> = {
        phone: clampStr(data.phone, FIELD_LIMITS.phone),
        address: clampStr(data.address, FIELD_LIMITS.address),
        birthDate: clampStr(data.birthDate, 10),
        baptismDate:
          data.baptismStatus === 'Batizado'
            ? clampStr(data.baptismDate, 10)
            : '',
        notes: clampStr(data.notes, FIELD_LIMITS.notes),
        updatedAt: serverTimestamp(),
      };
      if (canManageRoles) {
        privUpdate.email = cleanEmail;
      }
      await updateDoc(privRef, privUpdate);
    } else {
      await setDoc(privRef, {
        cellId: cell.id,
        ownerUid: cell.ownerUid,
        email: cleanEmail,
        phone: clampStr(data.phone, FIELD_LIMITS.phone),
        address: clampStr(data.address, FIELD_LIMITS.address),
        birthDate: clampStr(data.birthDate, 10),
        baptismDate:
          data.baptismStatus === 'Batizado'
            ? clampStr(data.baptismDate, 10)
            : '',
        notes: clampStr(data.notes, FIELD_LIMITS.notes),
        updatedAt: serverTimestamp(),
      });
    }

    if (
      canManageRoles &&
      (JSON.stringify(nextAllowed) !== JSON.stringify(cell.allowedEmails) ||
        JSON.stringify(nextTrainers) !== JSON.stringify(cell.trainerEmails) ||
        JSON.stringify(nextSecretaries) !==
          JSON.stringify(cell.secretaryEmails || []))
    ) {
      await syncCellAccessListsAcrossCollections(
        cell,
        nextAllowed,
        nextTrainers,
        nextSecretaries,
      );
    }

    const updatedList: CellMember[] = existingMember
      ? allMembers.map((m) =>
          m.id === memberId
            ? {
                ...m,
                fullName: clampStr(data.fullName, FIELD_LIMITS.fullName),
                memberCode,
                role: targetRole,
                wing: data.wing,
                mentorId,
              }
            : m,
        )
      : [
          ...allMembers,
          {
            id: memberId,
            cellId: cell.id,
            ownerUid: cell.ownerUid,
            allowedEmails: nextAllowed,
            fullName: clampStr(data.fullName, FIELD_LIMITS.fullName),
            memberCode,
            role: targetRole,
            wing: data.wing,
            mentorId,
            menteeIds: [],
            activityLevel: data.activityLevel,
            isChurchMember: data.isChurchMember,
            baptismStatus: data.baptismStatus,
            createdBy: currentUid,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
        ];
    await syncMemberAccessCodeDoc({
      cell,
      memberId,
      memberCode,
      fullName: data.fullName,
    });
    await syncCellLookup(cell, updatedList);

    return { memberId, memberCode };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `members/${memberId}`);
  }
}

export async function assignOrganogramPlacement(params: {
  cell: CellWorkspace;
  member: CellMember;
  allMembers: CellMember[];
  nextRole: CellRole;
  nextWing: CellWing;
  nextMentorId: string;
}): Promise<void> {
  const { cell, member, allMembers, nextRole, nextWing, nextMentorId } = params;

  if (nextRole === 'lider_treinamento' && member.role !== 'lider_treinamento') {
    const trainersCount = allMembers.filter(
      (m) => m.role === 'lider_treinamento',
    ).length;
    if (trainersCount >= MAX_TRAINERS_PER_CELL) {
      throw new Error(
        `A célula já possui o máximo de ${MAX_TRAINERS_PER_CELL} Líderes em Treinamento.`,
      );
    }
  }

  const effectiveMentorId = nextRole === 'filhinho' ? nextMentorId : '';
  if (nextRole === 'filhinho' && effectiveMentorId) {
    const mentor = allMembers.find((m) => m.id === effectiveMentorId);
    if (!mentor || (mentor.role !== 'lider' && mentor.role !== 'lider_treinamento')) {
      throw new Error('O mentor deve ser o Líder da Célula ou um Líder em Treinamento.');
    }
    const currentMentees = allMembers.filter(
      (m) =>
        m.role === 'filhinho' &&
        m.mentorId === effectiveMentorId &&
        m.id !== member.id,
    );
    if (currentMentees.length >= MAX_FILHINHOS_PER_MENTOR) {
      throw new Error(
        `${mentor.fullName} já atingiu o limite máximo de ${MAX_FILHINHOS_PER_MENTOR} filhinhos.`,
      );
    }
  }

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'members', member.id), {
      role: nextRole,
      wing: nextWing,
      mentorId: effectiveMentorId,
      updatedAt: serverTimestamp(),
    });

    if (member.mentorId && member.mentorId !== effectiveMentorId) {
      const oldMentor = allMembers.find((m) => m.id === member.mentorId);
      if (oldMentor) {
        batch.update(doc(db, 'members', oldMentor.id), {
          menteeIds: oldMentor.menteeIds.filter((id) => id !== member.id),
          updatedAt: serverTimestamp(),
        });
      }
    }

    if (effectiveMentorId) {
      const newMentor = allMembers.find((m) => m.id === effectiveMentorId);
      if (newMentor && !newMentor.menteeIds.includes(member.id)) {
        batch.update(doc(db, 'members', newMentor.id), {
          menteeIds: [...newMentor.menteeIds, member.id].slice(
            0,
            MAX_FILHINHOS_PER_MENTOR,
          ),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();

    const updatedMembers = allMembers.map((m) =>
      m.id === member.id
        ? { ...m, role: nextRole, wing: nextWing, mentorId: effectiveMentorId }
        : m,
    );
    await syncCellLookup(cell, updatedMembers);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `members/${member.id}`);
  }
}

export async function fetchMemberPrivateInfo(
  memberId: string,
): Promise<MemberPrivateInfo | null> {
  const path = `members/${memberId}/private/info`;
  try {
    const snap = await getDoc(doc(db, 'members', memberId, 'private', 'info'));
    if (!snap.exists()) return null;
    return snap.data() as MemberPrivateInfo;
  } catch (error) {
    console.warn('Sem permissão para visualizar PII deste membro:', path, error);
    return null;
  }
}

export async function deleteMemberRecord(
  cell: CellWorkspace,
  member: CellMember,
  allMembers: CellMember[],
): Promise<void> {
  const path = `members/${member.id}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'members', member.id, 'private', 'info'));
    batch.delete(doc(db, 'members', member.id));
    if (member.memberCode) {
      batch.delete(doc(db, 'memberAccessCodes', member.memberCode));
    }

    if (member.mentorId) {
      const mentor = allMembers.find((m) => m.id === member.mentorId);
      if (mentor) {
        batch.update(doc(db, 'members', mentor.id), {
          menteeIds: mentor.menteeIds.filter((id) => id !== member.id),
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();

    const remaining = allMembers.filter((m) => m.id !== member.id);
    const nextAllowed = Array.from(
      new Set([
        cell.ownerEmail,
        ...remaining
          .map((m) => m.memberEmail?.trim())
          .filter((e): e is string => Boolean(e)),
      ]),
    ).slice(0, MAX_ALLOWED_EMAILS);
    const nextTrainers = Array.from(
      new Set(
        remaining
          .filter((m) => m.role === 'lider_treinamento' && m.memberEmail?.trim())
          .map((m) => m.memberEmail!.trim()),
      ),
    ).slice(0, MAX_TRAINERS_PER_CELL);
    const nextSecretaries = Array.from(
      new Set(
        remaining
          .filter((m) => m.role === 'secretario' && m.memberEmail?.trim())
          .map((m) => m.memberEmail!.trim()),
      ),
    ).slice(0, 5);

    await syncCellAccessListsAcrossCollections(
      cell,
      nextAllowed,
      nextTrainers,
      nextSecretaries,
    );
    await syncCellLookup(cell, remaining);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveMonthlyPlan(params: {
  cell: CellWorkspace;
  existingPlan?: MonthlyPlan | null;
  currentUid: string;
  data: {
    date: string;
    time: string;
    lessonTitle: string;
    lessonReference: string;
    responsibleName: string;
    preacherName: string;
    worshipName: string;
    snackName: string;
    icebreakerName: string;
    prayerName: string;
    location: string;
    notes: string;
    status: PlanStatus;
  };
}): Promise<string> {
  const { cell, existingPlan, currentUid, data } = params;
  const planId = existingPlan?.id || generateId('plan');
  const monthKey = getMonthKey(data.date);
  try {
    if (existingPlan) {
      await updateDoc(doc(db, 'monthlyPlans', planId), {
        date: clampStr(data.date, 10),
        monthKey,
        time: clampStr(data.time, 10),
        lessonTitle: clampStr(data.lessonTitle, FIELD_LIMITS.lessonTitle),
        lessonReference: clampStr(
          data.lessonReference,
          FIELD_LIMITS.lessonReference,
        ),
        responsibleName: clampStr(data.responsibleName, FIELD_LIMITS.fullName),
        preacherName: clampStr(data.preacherName, FIELD_LIMITS.fullName),
        worshipName: clampStr(data.worshipName, FIELD_LIMITS.fullName),
        snackName: clampStr(data.snackName, FIELD_LIMITS.fullName),
        icebreakerName: clampStr(data.icebreakerName, FIELD_LIMITS.fullName),
        prayerName: clampStr(data.prayerName, FIELD_LIMITS.fullName),
        location: clampStr(data.location, 200),
        notes: clampStr(data.notes, 1000),
        status: data.status,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'monthlyPlans', planId), {
        cellId: cell.id,
        ownerUid: cell.ownerUid,
        accessCode: cell.accessCode,
        allowedEmails: cell.allowedEmails,
        date: clampStr(data.date, 10),
        monthKey,
        time: clampStr(data.time, 10),
        lessonTitle: clampStr(data.lessonTitle, FIELD_LIMITS.lessonTitle),
        lessonReference: clampStr(
          data.lessonReference,
          FIELD_LIMITS.lessonReference,
        ),
        responsibleName: clampStr(data.responsibleName, FIELD_LIMITS.fullName),
        preacherName: clampStr(data.preacherName, FIELD_LIMITS.fullName),
        worshipName: clampStr(data.worshipName, FIELD_LIMITS.fullName),
        snackName: clampStr(data.snackName, FIELD_LIMITS.fullName),
        icebreakerName: clampStr(data.icebreakerName, FIELD_LIMITS.fullName),
        prayerName: clampStr(data.prayerName, FIELD_LIMITS.fullName),
        location: clampStr(data.location, 200),
        notes: clampStr(data.notes, 1000),
        status: data.status,
        createdBy: currentUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return planId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `monthlyPlans/${planId}`);
  }
}

export async function deleteMonthlyPlan(planId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'monthlyPlans', planId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `monthlyPlans/${planId}`);
  }
}

export async function saveMeetingReport(params: {
  cell: CellWorkspace;
  existingReport?: { id: string } | null;
  currentUid: string;
  data: {
    planId?: string;
    date: string;
    lessonTitle: string;
    preacherName: string;
    presentMemberIds: string[];
    absentMemberIds: string[];
    visitorsCount: number;
    visitorNames: string[];
    decisionsCount: number;
    summary: string;
    highlights: string;
    prayerRequests: string;
    status: ReportStatus;
  };
}): Promise<string> {
  const { cell, existingReport, currentUid, data } = params;
  const reportId = existingReport?.id || generateId('rep');
  const monthKey = getMonthKey(data.date);
  try {
    const batch = writeBatch(db);
    const repRef = doc(db, 'meetingReports', reportId);

    if (existingReport) {
      batch.update(repRef, {
        planId: clampStr(data.planId, FIELD_LIMITS.id),
        date: clampStr(data.date, 10),
        monthKey,
        lessonTitle: clampStr(data.lessonTitle, FIELD_LIMITS.lessonTitle),
        preacherName: clampStr(data.preacherName, FIELD_LIMITS.fullName),
        presentMemberIds: data.presentMemberIds.slice(0, 50),
        absentMemberIds: data.absentMemberIds.slice(0, 50),
        visitorsCount: Math.max(0, Math.min(200, Math.floor(data.visitorsCount))),
        visitorNames: data.visitorNames
          .map((n) => clampStr(n, FIELD_LIMITS.fullName))
          .filter(Boolean)
          .slice(0, 30),
        decisionsCount: Math.max(0, Math.min(200, Math.floor(data.decisionsCount))),
        summary: clampStr(data.summary, FIELD_LIMITS.summary),
        highlights: clampStr(data.highlights, FIELD_LIMITS.highlights),
        prayerRequests: clampStr(data.prayerRequests, FIELD_LIMITS.prayerRequests),
        status: data.status,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(repRef, {
        cellId: cell.id,
        ownerUid: cell.ownerUid,
        accessCode: cell.accessCode,
        allowedEmails: cell.allowedEmails,
        planId: clampStr(data.planId, FIELD_LIMITS.id),
        date: clampStr(data.date, 10),
        monthKey,
        lessonTitle: clampStr(data.lessonTitle, FIELD_LIMITS.lessonTitle),
        preacherName: clampStr(data.preacherName, FIELD_LIMITS.fullName),
        presentMemberIds: data.presentMemberIds.slice(0, 50),
        absentMemberIds: data.absentMemberIds.slice(0, 50),
        visitorsCount: Math.max(0, Math.min(200, Math.floor(data.visitorsCount))),
        visitorNames: data.visitorNames
          .map((n) => clampStr(n, FIELD_LIMITS.fullName))
          .filter(Boolean)
          .slice(0, 30),
        decisionsCount: Math.max(0, Math.min(200, Math.floor(data.decisionsCount))),
        summary: clampStr(data.summary, FIELD_LIMITS.summary),
        highlights: clampStr(data.highlights, FIELD_LIMITS.highlights),
        prayerRequests: clampStr(data.prayerRequests, FIELD_LIMITS.prayerRequests),
        status: data.status,
        createdBy: currentUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (data.planId && data.status === 'Finalizado') {
      batch.update(doc(db, 'monthlyPlans', data.planId), {
        status: 'Realizada',
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    return reportId;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `meetingReports/${reportId}`,
    );
  }
}

export async function deleteMeetingReport(reportId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'meetingReports', reportId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `meetingReports/${reportId}`,
    );
  }
}

export async function saveStudyMaterial(params: {
  cell: CellWorkspace;
  existingMaterial?: StudyMaterial | null;
  currentUid: string;
  authorName: string;
  data: {
    title: string;
    category: StudyCategory;
    summary: string;
    contentText: string;
    resourceUrl: string;
    monthKey: string;
  };
}): Promise<string> {
  const { cell, existingMaterial, currentUid, authorName, data } = params;
  const materialId = existingMaterial?.id || generateId('mat');
  try {
    if (existingMaterial) {
      await updateDoc(doc(db, 'studyMaterials', materialId), {
        title: clampStr(data.title, FIELD_LIMITS.lessonTitle),
        category: data.category,
        summary: clampStr(data.summary, FIELD_LIMITS.materialSummary),
        contentText: clampStr(data.contentText, FIELD_LIMITS.materialContent),
        resourceUrl: clampStr(data.resourceUrl, FIELD_LIMITS.resourceUrl),
        monthKey: clampStr(data.monthKey, 7),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'studyMaterials', materialId), {
        cellId: cell.id,
        ownerUid: cell.ownerUid,
        accessCode: cell.accessCode,
        allowedEmails: cell.allowedEmails,
        title: clampStr(data.title, FIELD_LIMITS.lessonTitle),
        category: data.category,
        summary: clampStr(data.summary, FIELD_LIMITS.materialSummary),
        contentText: clampStr(data.contentText, FIELD_LIMITS.materialContent),
        resourceUrl: clampStr(data.resourceUrl, FIELD_LIMITS.resourceUrl),
        monthKey: clampStr(data.monthKey, 7),
        authorName: clampStr(authorName || 'Liderança', FIELD_LIMITS.fullName),
        createdBy: currentUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const notifId = generateId('notif');
      await setDoc(doc(db, 'notifications', notifId), {
        cellId: cell.id,
        ownerUid: cell.ownerUid,
        accessCode: cell.accessCode,
        allowedEmails: cell.allowedEmails,
        type: 'material_novo',
        title: `Novo material: ${clampStr(data.title, 100)}`,
        message: `${clampStr(authorName || 'Liderança', 60)} compartilhou um material na categoria ${data.category}.`,
        dueDate: getTodayIso(),
        readByUids: [currentUid],
        createdBy: currentUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return materialId;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `studyMaterials/${materialId}`,
    );
  }
}

export async function deleteStudyMaterial(materialId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'studyMaterials', materialId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `studyMaterials/${materialId}`,
    );
  }
}

export async function createManualReminder(params: {
  cell: CellWorkspace;
  currentUid: string;
  data: {
    type: NotificationType;
    title: string;
    message: string;
    dueDate: string;
  };
}): Promise<string> {
  const { cell, currentUid, data } = params;
  const notifId = generateId('notif');
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      cellId: cell.id,
      ownerUid: cell.ownerUid,
      accessCode: cell.accessCode,
      allowedEmails: cell.allowedEmails,
      type: data.type,
      title: clampStr(data.title, FIELD_LIMITS.notificationTitle),
      message: clampStr(data.message, FIELD_LIMITS.notificationMessage),
      dueDate: clampStr(data.dueDate, 10),
      readByUids: [],
      createdBy: currentUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return notifId;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `notifications/${notifId}`,
    );
  }
}

export async function markNotificationRead(
  notification: { id: string; readByUids: string[] },
  uid: string,
): Promise<void> {
  if (notification.readByUids.includes(uid)) return;
  try {
    await updateDoc(doc(db, 'notifications', notification.id), {
      readByUids: [...notification.readByUids, uid].slice(0, 50),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `notifications/${notification.id}`,
    );
  }
}

export async function deleteNotificationRecord(
  notificationId: string,
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `notifications/${notificationId}`,
    );
  }
}
