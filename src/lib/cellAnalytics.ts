import type {
  AutoReminder,
  CellMember,
  MeetingReport,
  MonthlyPlan,
} from '../types/cell';

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMonthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function formatDatePt(dateIso: string): string {
  if (!dateIso || dateIso.length < 10) return dateIso;
  const [y, m, d] = dateIso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatMonthLabelPt(monthKey: string): string {
  if (!monthKey || monthKey.length < 7) return monthKey;
  const [y, m] = monthKey.split('-');
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const idx = Math.max(0, Math.min(11, Number(m) - 1));
  return `${months[idx]} de ${y}`;
}

export function getWeekRangeForDate(dateIso: string): {
  start: string;
  end: string;
  label: string;
} {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dayOfWeek = dt.getDay(); // 0 = Sunday
  const startDt = new Date(dt);
  startDt.setDate(dt.getDate() - dayOfWeek);
  const endDt = new Date(startDt);
  endDt.setDate(startDt.getDate() + 6);

  const toIso = (val: Date) =>
    `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;

  const start = toIso(startDt);
  const end = toIso(endDt);
  return {
    start,
    end,
    label: `${formatDatePt(start).slice(0, 5)} a ${formatDatePt(end).slice(0, 5)}`,
  };
}

export function getWeeksInMonth(monthKey: string): Array<{
  weekNumber: number;
  start: string;
  end: string;
  label: string;
}> {
  const [y, m] = monthKey.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0);
  const totalDays = lastDay.getDate();

  const weeks: Array<{
    weekNumber: number;
    start: string;
    end: string;
    label: string;
  }> = [];

  let cursor = new Date(firstDay);
  let weekNumber = 1;
  while (cursor <= lastDay) {
    const startDay = cursor.getDate();
    const daysUntilSaturday = 6 - cursor.getDay();
    const endDay = Math.min(totalDays, startDay + daysUntilSaturday);
    const start = `${y}-${String(m).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const end = `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    weeks.push({
      weekNumber,
      start,
      end,
      label: `Semana ${weekNumber} (${String(startDay).padStart(2, '0')}/${String(m).padStart(2, '0')} - ${String(endDay).padStart(2, '0')}/${String(m).padStart(2, '0')})`,
    });
    cursor = new Date(y, m - 1, endDay + 1);
    weekNumber += 1;
  }

  return weeks;
}

export function addDaysIso(dateIso: string, deltaDays: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function computeMissingRoles(plan: MonthlyPlan): string[] {
  const isSpecialActivity =
    plan.eventType === 'Atividade Social' ||
    plan.eventType === 'Atividade Espiritual';
  const missing: string[] = [];
  if (!plan.responsibleName?.trim()) missing.push('Dirigente');
  if (!plan.worshipName?.trim() && !isSpecialActivity) missing.push('Louvor');
  if (!plan.icebreakerName?.trim() && !isSpecialActivity) {
    missing.push('Quebra-gelo');
  }
  if (!plan.snackName?.trim()) missing.push('Lanche');
  return missing;
}

export interface MemberMonthlyAssignment {
  plan: MonthlyPlan;
  roles: string[];
}

function samePersonName(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  const na = norm(a);
  const nb = norm(b);
  return Boolean(na && nb && (na === nb || na.includes(nb) || nb.includes(na)));
}

export function getMemberMonthlyResponsibilities(
  memberName: string,
  monthPlans: MonthlyPlan[],
): MemberMonthlyAssignment[] {
  const results: MemberMonthlyAssignment[] = [];
  for (const plan of monthPlans) {
    if (plan.status === 'Cancelada') continue;
    const roles: string[] = [];
    if (samePersonName(plan.responsibleName, memberName)) roles.push('Dirigente');
    if (samePersonName(plan.worshipName, memberName)) roles.push('Louvor');
    if (samePersonName(plan.icebreakerName, memberName)) {
      roles.push('Quebra-gelo');
    }
    if (samePersonName(plan.snackName, memberName)) roles.push('Lanche');
    if (samePersonName(plan.preacherName, memberName)) {
      roles.push('Ministração');
    }
    if (samePersonName(plan.prayerName, memberName)) roles.push('Oração');
    if (roles.length > 0) {
      results.push({ plan, roles });
    }
  }
  return results.sort((a, b) => a.plan.date.localeCompare(b.plan.date));
}

export function computeAutomaticAlerts(
  plans: MonthlyPlan[],
  reports: MeetingReport[],
  members: CellMember[],
  todayIso: string = getTodayIso(),
): AutoReminder[] {
  const alerts: AutoReminder[] = [];
  const nextWeekIso = addDaysIso(todayIso, 7);
  const reportByPlanId = new Set(
    reports.filter((r) => Boolean(r.planId)).map((r) => r.planId as string),
  );
  const reportDates = new Set(reports.map((r) => r.date));

  for (const plan of plans) {
    if (plan.status === 'Cancelada') continue;
    const hasReport =
      plan.status === 'Realizada' ||
      reportByPlanId.has(plan.id) ||
      reportDates.has(plan.date);

    // 1. Overdue planned meeting without report
    if (plan.date < todayIso && !hasReport) {
      alerts.push({
        id: `auto-overdue-${plan.id}`,
        type: 'relatorio_pendente',
        severity: 'alta',
        title: `Relatório pendente: ${plan.lessonTitle}`,
        message: `A reunião de ${formatDatePt(plan.date)} ainda não teve frequência e relatório registrados.`,
        dueDate: plan.date,
        actionView: 'attendance',
        relatedPlanId: plan.id,
      });
    }

    // 2. Upcoming planned meeting (today through next 7 days)
    if (plan.date >= todayIso && plan.date <= nextWeekIso && !hasReport) {
      const isToday = plan.date === todayIso;
      alerts.push({
        id: `auto-upcoming-${plan.id}`,
        type: 'reuniao_pendente',
        severity: isToday ? 'alta' : 'media',
        title: isToday
          ? `${plan.eventType && plan.eventType !== 'Reunião de Célula' ? plan.eventType : 'Reunião'} hoje às ${plan.time}: ${plan.lessonTitle}`
          : `Próxima programação em ${formatDatePt(plan.date)}: ${plan.lessonTitle}`,
        message: `Dirigente: ${plan.responsibleName}${plan.location ? ` · Local: ${plan.location}` : ''}.`,
        dueDate: plan.date,
        actionView: 'planning',
        relatedPlanId: plan.id,
      });

      // 3. Incomplete scale check on upcoming meeting
      const missingRoles = computeMissingRoles(plan);
      if (missingRoles.length > 0) {
        alerts.push({
          id: `auto-scale-${plan.id}`,
          type: 'escala_incompleta',
          severity: 'media',
          title: `Escala incompleta (${formatDatePt(plan.date)})`,
          message: `Falta definir: ${missingRoles.join(', ')}.`,
          dueDate: plan.date,
          actionView: 'planning',
          relatedPlanId: plan.id,
        });
      }
    }
  }

  // 4. Upcoming birthdays in the next 14 days
  const currentYear = Number(todayIso.slice(0, 4));
  const twoWeeksIso = addDaysIso(todayIso, 14);
  for (const member of members) {
    if (!member.birthMonthDay) continue;
    const candidateThisYear = `${currentYear}-${member.birthMonthDay}`;
    if (candidateThisYear >= todayIso && candidateThisYear <= twoWeeksIso) {
      alerts.push({
        id: `auto-bday-${member.id}`,
        type: 'aniversario',
        severity: candidateThisYear === todayIso ? 'alta' : 'normal',
        title:
          candidateThisYear === todayIso
            ? `Aniversário hoje: ${member.fullName}`
            : `Aniversariante próximo: ${member.fullName}`,
        message: `Data: ${member.birthMonthDay.split('-').reverse().join('/')} · Envie uma mensagem ou organize a celebração na célula.`,
        dueDate: candidateThisYear,
        actionView: 'members',
      });
    }
  }

  const severityOrder = { alta: 0, media: 1, normal: 2 };
  return alerts.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export interface ProgressMetrics {
  plannedCount: number;
  completedCount: number;
  completionRate: number;
  reportsCount: number;
  avgAttendanceRate: number;
  avgPresentCount: number;
  totalVisitors: number;
  totalDecisions: number;
  meetingTrend: Array<{
    reportId: string;
    date: string;
    lessonTitle: string;
    presentCount: number;
    visitorsCount: number;
    attendanceRate: number;
  }>;
  memberEngagement: Array<{
    memberId: string;
    fullName: string;
    role: string;
    attendedCount: number;
    totalMeetings: number;
    rate: number;
    activityLevel: string;
  }>;
  roleCoverageRate: number;
}

export function computeProgressMetrics(
  monthKey: string,
  plans: MonthlyPlan[],
  reports: MeetingReport[],
  members: CellMember[],
): ProgressMetrics {
  const monthPlans = plans.filter(
    (p) => p.monthKey === monthKey && p.status !== 'Cancelada',
  );
  const monthReports = reports
    .filter((r) => r.monthKey === monthKey)
    .sort((a, b) => a.date.localeCompare(b.date));

  const plannedCount = monthPlans.length;
  const completedCount = monthPlans.filter(
    (p) => p.status === 'Realizada',
  ).length;
  const completionRate =
    plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;

  let sumRates = 0;
  let sumPresent = 0;
  let totalVisitors = 0;
  let totalDecisions = 0;

  const meetingTrend = monthReports.map((rep) => {
    const present = rep.presentMemberIds.length;
    const totalEligible = Math.max(
      present + rep.absentMemberIds.length,
      members.length,
      1,
    );
    const rate = Math.min(100, Math.round((present / totalEligible) * 100));
    sumRates += rate;
    sumPresent += present;
    totalVisitors += rep.visitorsCount || 0;
    totalDecisions += rep.decisionsCount || 0;
    return {
      reportId: rep.id,
      date: rep.date,
      lessonTitle: rep.lessonTitle,
      presentCount: present,
      visitorsCount: rep.visitorsCount || 0,
      attendanceRate: rate,
    };
  });

  const reportsCount = monthReports.length;
  const avgAttendanceRate =
    reportsCount > 0 ? Math.round(sumRates / reportsCount) : 0;
  const avgPresentCount =
    reportsCount > 0 ? Math.round((sumPresent / reportsCount) * 10) / 10 : 0;

  const memberEngagement = members
    .map((m) => {
      const attendedCount = monthReports.filter((r) =>
        r.presentMemberIds.includes(m.id),
      ).length;
      const rate =
        reportsCount > 0
          ? Math.round((attendedCount / reportsCount) * 100)
          : 0;
      return {
        memberId: m.id,
        fullName: m.fullName,
        role: m.role,
        attendedCount,
        totalMeetings: reportsCount,
        rate,
        activityLevel: m.activityLevel,
      };
    })
    .sort((a, b) => b.rate - a.rate || a.fullName.localeCompare(b.fullName));

  // Role coverage across monthly plans
  let totalSlots = 0;
  let filledSlots = 0;
  for (const p of monthPlans) {
    const slots = [
      p.responsibleName,
      p.preacherName,
      p.worshipName,
      p.snackName,
      p.icebreakerName,
      p.prayerName,
    ];
    totalSlots += slots.length;
    filledSlots += slots.filter((s) => Boolean(s && s.trim())).length;
  }
  const roleCoverageRate =
    totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  return {
    plannedCount,
    completedCount,
    completionRate,
    reportsCount,
    avgAttendanceRate,
    avgPresentCount,
    totalVisitors,
    totalDecisions,
    meetingTrend,
    memberEngagement,
    roleCoverageRate,
  };
}
