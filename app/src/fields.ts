import type { Fields, InviteEvent } from './types';

export type FieldDef = { key: string; label: string; hint?: string; caps?: boolean };
export type Section = { title: string; fields: FieldDef[] };

// Matches the text slots of the rose_gold template on the worker.
// An empty value leaves that line out of the video.
export const SECTIONS: Section[] = [
  {
    title: 'Couple card',
    fields: [
      { key: 'couple_title', label: 'Heading', hint: 'VALIMA CEREMONY', caps: true },
      { key: 'groom_short', label: "Groom's short name", hint: 'Ayaan' },
      { key: 'couple_joiner', label: 'Joining word', hint: 'with' },
      { key: 'bride_short', label: "Bride's short name", hint: 'Sara (or: Daughter of)' },
      { key: 'couple_line', label: 'Small line under names', hint: 'INSHA ALLAH', caps: true },
    ],
  },
  {
    title: 'Groom',
    fields: [
      { key: 'groom_name', label: 'Full name', hint: 'Mohammed Ayaan Khan' },
      { key: 'groom_nickname', label: 'Nickname (in brackets)', hint: '(Ayaan)' },
      { key: 'groom_relation', label: 'Relation', hint: 'S/O', caps: true },
      { key: 'groom_parents_label', label: 'Parents label', hint: 'MRS & MR.', caps: true },
      { key: 'groom_father', label: "Father's name", hint: 'MOHAMMED SALEEM KHAN SAHAB', caps: true },
    ],
  },
  {
    title: 'Bride',
    fields: [
      { key: 'bride_name', label: 'Full name', hint: 'Syeda Sara Hussain' },
      { key: 'bride_relation', label: 'Relation', hint: 'D/O', caps: true },
      { key: 'bride_parents_label', label: 'Parents label', hint: 'MRS & MR.', caps: true },
      { key: 'bride_father', label: "Father's name", hint: 'SYED IMRAN HUSSAIN SAHAB', caps: true },
    ],
  },
  {
    title: 'Save the date',
    fields: [
      { key: 'save_line1', label: 'Top line', hint: 'Please' },
      { key: 'save_title', label: 'Title', hint: 'Save the Date' },
      { key: 'save_days', label: 'Day(s)', hint: 'Fri & Sun' },
      { key: 'save_dates', label: 'Date(s)', hint: '12th & 14th Feb 2027' },
    ],
  },
];

export const EVENT_FIELDS: { key: keyof InviteEvent; label: string; hint: string; caps?: boolean }[] = [
  { key: 'title', label: 'Event', hint: 'Nikah Ceremony' },
  { key: 'date', label: 'Date', hint: 'FRI, 12 FEB 2027', caps: true },
  { key: 'time', label: 'Time', hint: 'AFTER ASR / DINNER 8:30 PM', caps: true },
  { key: 'venue', label: 'Venue', hint: 'MASJID-E-NOOR', caps: true },
  { key: 'address1', label: 'Address line 1', hint: 'NEAR CLOCK TOWER, OLD CITY', caps: true },
  { key: 'address2', label: 'Address line 2', hint: 'HYDERABAD', caps: true },
];

export const DEFAULT_FIELDS: Fields = {
  couple_joiner: 'with',
  groom_relation: 'S/O',
  bride_relation: 'D/O',
  groom_parents_label: 'MRS & MR.',
  bride_parents_label: 'MRS & MR.',
  save_line1: 'Please',
  save_title: 'Save the Date',
};

export const emptyEvent = (): InviteEvent => ({
  title: '',
  date: '',
  time: '',
  venue: '',
  address1: '',
  address2: '',
});

export const SAMPLE_FIELDS: Fields = {
  couple_title: 'VALIMA CEREMONY',
  groom_short: 'Ayaan',
  couple_joiner: 'with',
  bride_short: 'Sara',
  couple_line: 'INSHA ALLAH',
  groom_name: 'Mohammed Ayaan Khan',
  groom_nickname: '(Ayaan)',
  groom_relation: 'S/O',
  groom_parents_label: 'MRS & MR.',
  groom_father: 'MOHAMMED SALEEM KHAN SAHAB',
  bride_name: 'Syeda Sara Hussain',
  bride_relation: 'D/O',
  bride_parents_label: 'MRS & MR.',
  bride_father: 'SYED IMRAN HUSSAIN SAHAB',
  save_line1: 'Please',
  save_title: 'Save the Dates',
  save_days: 'Fri & Sun',
  save_dates: '12th & 14th Feb 2027',
};

export const SAMPLE_EVENTS: InviteEvent[] = [
  {
    title: 'Nikah Ceremony',
    date: 'FRI, 12 FEB 2027',
    time: 'AFTER ASR',
    venue: 'MASJID-E-NOOR',
    address1: 'NEAR CLOCK TOWER, OLD CITY',
    address2: 'HYDERABAD',
  },
  {
    title: 'Valima Ceremony',
    date: 'SUN, 14 FEB 2027',
    time: 'DINNER 8:30 PM',
    venue: 'PEARL PALACE FUNCTION HALL',
    address1: 'MAIN ROAD, MEHDIPATNAM',
    address2: 'HYDERABAD',
  },
];

export const CAPS_KEYS = new Set(
  SECTIONS.flatMap((s) => s.fields.filter((f) => f.caps).map((f) => f.key))
);

/** A short title for history lists. */
export function inviteTitle(fields: Fields, events: InviteEvent[]): string {
  const who = fields.groom_short || fields.groom_name || '';
  const what = events[events.length - 1]?.title || fields.couple_title || 'Invitation';
  return who ? `${who}'s ${what}` : what;
}
