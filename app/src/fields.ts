import type { Category, Fields, InviteEvent } from './types';

/** Empty event with the occasion's event keys. */
export function emptyEvent(cat: Category): InviteEvent {
  return Object.fromEntries(cat.events.fields.map((f) => [f.key, '']));
}

export function capsKeys(cat: Category): Set<string> {
  return new Set(cat.sections.flatMap((s) => s.fields.filter((f) => f.caps).map((f) => f.key)));
}

/** The details the form starts with: the occasion's fixed wording, everything else empty. */
export function startFields(cat: Category): Fields {
  return { ...(cat.defaults ?? {}) };
}

/** First field that names who the invitation is for (groom, birthday name, baby, mother-to-be). */
export function mainNameKey(cat: Category): string | undefined {
  return cat.title_fields?.[0];
}

/** A short title for the "Your videos" list. */
export function inviteTitle(cat: Category | undefined, fields: Fields, events: InviteEvent[]): string {
  const who = (cat?.title_fields ?? []).map((k) => fields[k]).find((v) => v?.trim()) ?? '';
  const what = events[events.length - 1]?.title || fields.occasion || fields.couple_title || cat?.title || 'Invitation';
  return who ? `${who}'s ${what}` : what;
}
