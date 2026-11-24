export type DbComplaintCategory = 'quality' | 'safety' | 'conduct' | 'billing' | 'other';
export type ComplaintIssueKey = DbComplaintCategory | 'no_show';
export type ComplaintStatusFilter = 'all' | 'open' | 'resolved';

export const NO_SHOW_STATEMENT_PREFIX = '[No-show / missed appointment]';

export type ComplaintIssueOption = {
  key: ComplaintIssueKey;
  dbCategory: DbComplaintCategory;
  label: string;
  guidance: string;
};

export const COMPLAINT_ISSUE_OPTIONS: readonly ComplaintIssueOption[] = [
  {
    key: 'quality',
    dbCategory: 'quality',
    label: 'Work quality',
    guidance: 'Describe what work was agreed, what was completed, and specific defects observed.',
  },
  {
    key: 'no_show',
    dbCategory: 'conduct',
    label: 'No-show or missed appointment',
    guidance:
      'Include the agreed appointment date/time window, any messages sent, and whether notice was given.',
  },
  {
    key: 'safety',
    dbCategory: 'safety',
    label: 'Safety concern',
    guidance:
      'Describe the safety hazard clearly. For immediate danger or emergencies, contact emergency services first.',
  },
  {
    key: 'conduct',
    dbCategory: 'conduct',
    label: 'Conduct or communication',
    guidance: 'Describe the behaviour or communication issue objectively with dates where relevant.',
  },
  {
    key: 'billing',
    dbCategory: 'billing',
    label: 'Billing or quote dispute',
    guidance: 'Describe the quoted amount, any agreed changes, and the discrepancy you are raising.',
  },
  {
    key: 'other',
    dbCategory: 'other',
    label: 'Other booking dispute',
    guidance: 'Describe what happened and when. Avoid sharing passwords, full bank details or unrelated personal data.',
  },
];

export function resolveComplaintSubmission(
  issueKey: ComplaintIssueKey,
  rawStatement: string
): {dbCategory: DbComplaintCategory; statement: string; error: string | null} {
  const trimmed = rawStatement.trim();
  const option =
    COMPLAINT_ISSUE_OPTIONS.find(item => item.key === issueKey) ?? COMPLAINT_ISSUE_OPTIONS[0];
  if (trimmed.length < 30) {
    return {
      dbCategory: option.dbCategory,
      statement: trimmed,
      error: 'Describe what happened in at least 30 characters.',
    };
  }
  const statement =
    issueKey === 'no_show' && !trimmed.toLowerCase().startsWith(NO_SHOW_STATEMENT_PREFIX.toLowerCase())
      ? `${NO_SHOW_STATEMENT_PREFIX} ${trimmed}`
      : trimmed;
  if (statement.length > 4000) {
    return {
      dbCategory: option.dbCategory,
      statement,
      error: 'Keep your complaint statement within 4000 characters.',
    };
  }
  return {dbCategory: option.dbCategory, statement, error: null};
}

export function formatComplaintCategoryLabel(category: string, statement: string): string {
  if (statement.trim().toLowerCase().startsWith(NO_SHOW_STATEMENT_PREFIX.toLowerCase())) {
    return 'No-show / missed appointment';
  }
  const match = COMPLAINT_ISSUE_OPTIONS.find(item => item.key === category);
  return match ? match.label : category;
}

export function isOpenComplaintStatus(status: string): boolean {
  return status === 'submitted' || status === 'investigating';
}

export function filterComplaintsByStatus<T extends {status: string}>(
  cases: readonly T[],
  filter: ComplaintStatusFilter
): T[] {
  if (filter === 'open') return cases.filter(c => isOpenComplaintStatus(c.status));
  if (filter === 'resolved') return cases.filter(c => !isOpenComplaintStatus(c.status));
  return [...cases];
}

export function validateAdminDecisionNote(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < 30) {
    return 'Provide at least 30 characters of case-specific evidence and reasoning.';
  }
  if (trimmed.length > 4000) {
    return 'Keep decision reasoning within 4000 characters.';
  }
  return null;
}
