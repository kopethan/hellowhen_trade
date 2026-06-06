export type WizardStepStatus = 'upcoming' | 'current' | 'complete' | 'blocked';

export type WizardStepDefinition<TStepId extends string = string> = {
  id: TStepId;
  title: string;
  description?: string;
  optional?: boolean;
  disabled?: boolean;
  completed?: boolean;
};

export type WizardStepState<TStepId extends string = string> = WizardStepDefinition<TStepId> & {
  index: number;
  number: number;
  status: WizardStepStatus;
};

export type WizardValidationIssue<TField extends string = string, TStepId extends string = string> = {
  field?: TField;
  stepId?: TStepId;
  message: string;
};

export type WizardFieldValidator<TDraft, TField extends string = string, TStepId extends string = string> = {
  field?: TField;
  stepId?: TStepId;
  validate: (draft: TDraft) => string | null | undefined;
};

export type WizardDraftEnvelope<TDraft> = {
  version: number;
  updatedAt: string;
  data: TDraft;
};

export const WIZARD_DRAFT_VERSION = 1;
export const WIZARD_DRAFT_MAX_AGE_DAYS = 14;

export function getWizardStepIndex<TStepId extends string>(steps: readonly WizardStepDefinition<TStepId>[], activeStepId: TStepId | null | undefined) {
  const index = steps.findIndex((step) => step.id === activeStepId);
  return index >= 0 ? index : 0;
}

export function getWizardActiveStep<TStepId extends string>(steps: readonly WizardStepDefinition<TStepId>[], activeStepId: TStepId | null | undefined) {
  return steps[getWizardStepIndex(steps, activeStepId)] ?? null;
}

export function getWizardStepStates<TStepId extends string>(steps: readonly WizardStepDefinition<TStepId>[], activeStepId: TStepId | null | undefined): WizardStepState<TStepId>[] {
  const activeIndex = getWizardStepIndex(steps, activeStepId);

  return steps.map((step, index) => {
    let status: WizardStepStatus = 'upcoming';
    if (step.disabled) status = 'blocked';
    else if (index === activeIndex) status = 'current';
    else if (step.completed || index < activeIndex) status = 'complete';

    return {
      ...step,
      index,
      number: index + 1,
      status,
    };
  });
}

export function getWizardProgressPercent<TStepId extends string>(steps: readonly WizardStepDefinition<TStepId>[], activeStepId: TStepId | null | undefined) {
  if (steps.length <= 1) return 100;
  const activeIndex = getWizardStepIndex(steps, activeStepId);
  return Math.round((activeIndex / (steps.length - 1)) * 100);
}

export function getWizardProgressLabel<TStepId extends string>(steps: readonly WizardStepDefinition<TStepId>[], activeStepId: TStepId | null | undefined, labels?: { step?: string; of?: string }) {
  const activeIndex = getWizardStepIndex(steps, activeStepId);
  const stepLabel = labels?.step ?? 'Step';
  const ofLabel = labels?.of ?? 'of';
  return `${stepLabel} ${activeIndex + 1} ${ofLabel} ${Math.max(steps.length, 1)}`;
}

export function getNextWizardStepId<TStepId extends string>(steps: readonly WizardStepDefinition<TStepId>[], activeStepId: TStepId | null | undefined) {
  const activeIndex = getWizardStepIndex(steps, activeStepId);
  return steps[Math.min(activeIndex + 1, steps.length - 1)]?.id ?? null;
}

export function getPreviousWizardStepId<TStepId extends string>(steps: readonly WizardStepDefinition<TStepId>[], activeStepId: TStepId | null | undefined) {
  const activeIndex = getWizardStepIndex(steps, activeStepId);
  return steps[Math.max(activeIndex - 1, 0)]?.id ?? null;
}

export function canOpenWizardStep<TStepId extends string>(steps: readonly WizardStepDefinition<TStepId>[], targetStepId: TStepId) {
  const targetIndex = steps.findIndex((step) => step.id === targetStepId);
  if (targetIndex < 0) return false;
  if (steps[targetIndex]?.disabled) return false;
  return steps.slice(0, targetIndex).every((step) => !step.disabled);
}

export function validateWizardDraft<TDraft, TField extends string = string, TStepId extends string = string>(
  draft: TDraft,
  validators: readonly WizardFieldValidator<TDraft, TField, TStepId>[],
): WizardValidationIssue<TField, TStepId>[] {
  const issues: WizardValidationIssue<TField, TStepId>[] = [];

  for (const validator of validators) {
    const message = validator.validate(draft);
    if (!message) continue;
    issues.push({
      message,
      ...(validator.field ? { field: validator.field } : {}),
      ...(validator.stepId ? { stepId: validator.stepId } : {}),
    });
  }

  return issues;
}

export function firstWizardIssueMessage(issues: readonly WizardValidationIssue[]) {
  return issues[0]?.message ?? null;
}

export function createRequiredTextValidator<TDraft, TField extends string, TStepId extends string = string>(options: {
  field: TField;
  stepId?: TStepId;
  getValue: (draft: TDraft) => string | null | undefined;
  message: string;
}): WizardFieldValidator<TDraft, TField, TStepId> {
  return {
    field: options.field,
    ...(options.stepId ? { stepId: options.stepId } : {}),
    validate: (draft) => options.getValue(draft)?.trim() ? null : options.message,
  };
}

export function createTextLengthValidator<TDraft, TField extends string, TStepId extends string = string>(options: {
  field: TField;
  stepId?: TStepId;
  getValue: (draft: TDraft) => string | null | undefined;
  min?: number;
  max?: number;
  tooShortMessage?: string;
  tooLongMessage?: string;
}): WizardFieldValidator<TDraft, TField, TStepId> {
  return {
    field: options.field,
    ...(options.stepId ? { stepId: options.stepId } : {}),
    validate: (draft) => {
      const value = options.getValue(draft)?.trim() ?? '';
      if (options.min !== undefined && value.length < options.min) return options.tooShortMessage ?? `Minimum ${options.min} characters required.`;
      if (options.max !== undefined && value.length > options.max) return options.tooLongMessage ?? `Maximum ${options.max} characters allowed.`;
      return null;
    },
  };
}

export function hasWizardIssues(issues: readonly WizardValidationIssue[]) {
  return issues.length > 0;
}

export function createWizardDraftEnvelope<TDraft>(data: TDraft, options?: { version?: number; updatedAt?: Date | string }): WizardDraftEnvelope<TDraft> {
  const updatedAt = options?.updatedAt instanceof Date ? options.updatedAt.toISOString() : options?.updatedAt ?? new Date().toISOString();
  return {
    version: options?.version ?? WIZARD_DRAFT_VERSION,
    updatedAt,
    data,
  };
}

export function serializeWizardDraft<TDraft>(data: TDraft, options?: { version?: number; updatedAt?: Date | string }) {
  return JSON.stringify(createWizardDraftEnvelope(data, options));
}

export function parseWizardDraft<TDraft>(raw: string | null | undefined, options?: {
  version?: number;
  maxAgeDays?: number;
  validate?: (data: unknown) => data is TDraft;
}): WizardDraftEnvelope<TDraft> | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<WizardDraftEnvelope<unknown>>;
    const expectedVersion = options?.version ?? WIZARD_DRAFT_VERSION;
    if (parsed.version !== expectedVersion) return null;
    if (typeof parsed.updatedAt !== 'string') return null;
    if (isWizardDraftExpired(parsed.updatedAt, options?.maxAgeDays ?? WIZARD_DRAFT_MAX_AGE_DAYS)) return null;
    if (options?.validate && !options.validate(parsed.data)) return null;
    return parsed as WizardDraftEnvelope<TDraft>;
  } catch {
    return null;
  }
}

export function isWizardDraftExpired(updatedAt: string | Date, maxAgeDays = WIZARD_DRAFT_MAX_AGE_DAYS) {
  const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return true;
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return Date.now() - date.getTime() > maxAgeMs;
}

export function trimWizardTextFields<TDraft extends Record<string, unknown>>(draft: TDraft, fields: readonly (keyof TDraft)[]): TDraft {
  const next = { ...draft };
  for (const field of fields) {
    const value = next[field];
    if (typeof value === 'string') next[field] = value.trim() as TDraft[keyof TDraft];
  }
  return next;
}

export function hasWizardDraftContent<TDraft extends Record<string, unknown>>(draft: TDraft, fields?: readonly (keyof TDraft)[]) {
  const entries = fields ? fields.map((field) => draft[field]) : Object.values(draft);

  return entries.some((value) => {
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
    if (typeof value === 'boolean') return value;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return false;
  });
}
