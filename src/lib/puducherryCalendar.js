const HOLIDAY_LIST_2026 = 'https://py.gov.in/sites/default/files/listofholidays-2026.pdf.pdf';
const BHOGI_ORDER = 'https://py.gov.in/sites/default/files/home13012026.pdf';
const RAMZAN_CORRIGENDUM = 'https://py.gov.in/sites/default/files/home19032026go22.pdf';
const ELECTION_ORDER = 'https://py.gov.in/sites/default/files/home23032026go25.pdf';
const MUHARRAM_ORDER = 'https://py.gov.in/sites/default/files/home25062026go53.pdf';
const DEEPAVALI_ORDER = 'https://py.gov.in/sites/default/files/home04112026go108.pdf';

export const PUDUCHERRY_CALENDAR_SOURCE = {
  title: 'Puducherry Government public holidays — 2026',
  region: 'Puducherry and Karaikal defaults',
  primaryUrl: HOLIDAY_LIST_2026,
  noticeUrl: 'https://py.gov.in/gos-and-notification',
  note: 'Government holiday dates are editable defaults, not a substitute for the college academic calendar. Verify moon-dependent dates and college-specific closures.',
};

export const PUDUCHERRY_2026_DEFAULTS = [
  { dateISO: '2026-01-01', kind: 'HOLIDAY', label: 'New Year', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-01-14', kind: 'HOLIDAY', label: 'Bhogi', source: 'G.O. Ms. No. 2 (13 Jan 2026)', sourceUrl: BHOGI_ORDER },
  { dateISO: '2026-01-15', kind: 'HOLIDAY', label: 'Pongal', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-01-16', kind: 'HOLIDAY', label: 'Thiruvalluvar Day / Mattu Pongal', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-01-26', kind: 'HOLIDAY', label: 'Republic Day', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-01-31', kind: 'WORKING', label: 'Compensatory working day for Bhogi', source: 'G.O. Ms. No. 2 (13 Jan 2026)', sourceUrl: BHOGI_ORDER },
  { dateISO: '2026-03-21', kind: 'HOLIDAY', label: 'Ramzan (Id-ul-Fitr) · moon-dependent', source: 'G.O. Ms. No. 22 corrigendum (19 Mar 2026)', sourceUrl: RAMZAN_CORRIGENDUM },
  { dateISO: '2026-04-03', kind: 'HOLIDAY', label: 'Good Friday', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-04-09', kind: 'HOLIDAY', label: 'Puducherry Legislative Assembly election', source: 'G.O. Ms. No. 25 (23 Mar 2026)', sourceUrl: ELECTION_ORDER },
  { dateISO: '2026-04-14', kind: 'HOLIDAY', label: 'Tamil New Year / Dr. Ambedkar’s Birthday', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-05-01', kind: 'HOLIDAY', label: 'May Day', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-05-28', kind: 'HOLIDAY', label: 'Bakrid (Id-ul-Alha) · moon-dependent', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-06-26', kind: 'HOLIDAY', label: 'Muharram', source: 'G.O. Ms. No. 53 (25 Jun 2026)', sourceUrl: MUHARRAM_ORDER },
  { dateISO: '2026-07-04', kind: 'WORKING', label: 'Compensatory working day for Muharram', source: 'G.O. Ms. No. 53 (25 Jun 2026)', sourceUrl: MUHARRAM_ORDER },
  { dateISO: '2026-08-15', kind: 'HOLIDAY', label: 'Independence Day', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-08-26', kind: 'HOLIDAY', label: 'Milad-Un-Nabi · moon-dependent', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-09-14', kind: 'HOLIDAY', label: 'Vinayagar Chathurthi', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-10-02', kind: 'HOLIDAY', label: 'Gandhi Jayanthi', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-10-19', kind: 'HOLIDAY', label: 'Saraswathi Pooja / Ayudha Pooja', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-11-01', kind: 'HOLIDAY', label: 'Puducherry Liberation Day', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
  { dateISO: '2026-11-09', kind: 'HOLIDAY', label: 'Deepavali', source: 'G.O. Ms. No. 108 (4 Nov 2026)', sourceUrl: DEEPAVALI_ORDER },
  { dateISO: '2026-11-21', kind: 'WORKING', label: 'Compensatory working day for Deepavali', source: 'G.O. Ms. No. 108 (4 Nov 2026)', sourceUrl: DEEPAVALI_ORDER },
  { dateISO: '2026-12-25', kind: 'HOLIDAY', label: 'Christmas', source: 'G.O. Ms. No. 73 (2026 holiday list)', sourceUrl: HOLIDAY_LIST_2026 },
];

export function mergePuducherryCalendar(year, overrides = []) {
  const yearText = String(year);
  const defaults = year === 2026 ? PUDUCHERRY_2026_DEFAULTS : [];
  const baseByDate = new Map(defaults.map((event) => [event.dateISO, event]));
  const overrideByDate = new Map((Array.isArray(overrides) ? overrides : [])
    .filter((event) => String(event?.dateISO ?? '').startsWith(`${yearText}-`))
    .map((event) => [event.dateISO, event]));
  const dates = new Set([...baseByDate.keys(), ...overrideByDate.keys()]);

  return [...dates].sort().map((dateISO) => {
    const base = baseByDate.get(dateISO);
    const override = overrideByDate.get(dateISO);
    return {
      dateISO,
      kind: override?.kind ?? base?.kind ?? 'HOLIDAY',
      label: override?.label ?? base?.label ?? '',
      isOverride: Boolean(override),
      defaultKind: base?.kind ?? null,
      defaultLabel: base?.label ?? null,
      source: override ? (base ? 'Teacher override' : 'Teacher-added date') : base.source,
      sourceUrl: base?.sourceUrl ?? null,
    };
  });
}
