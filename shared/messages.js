const SESSION_LABELS = {
  en: { MORNING: 'morning', EVENING: 'evening' },
  ta: { MORNING: 'காலை நேர', EVENING: 'மாலை நேர' },
};

function oneLine(value, name, maxLength = 80) {
  if (typeof value !== 'string') throw new TypeError(`${name} must be text`);
  const clean = value.trim();
  if (!clean || clean.length > maxLength || /[\r\n<>]/.test(clean)) {
    throw new TypeError(`${name} is invalid`);
  }
  return clean;
}

function formatDate(dateISO) {
  if (typeof dateISO !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    throw new TypeError('dateISO must be YYYY-MM-DD');
  }
  const date = new Date(`${dateISO}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new TypeError('dateISO is invalid');
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

/**
 * Builds a neutral parent-facing preview. This function never sends anything.
 * Keep wording factual: an attendance mark is not proof of where a student is.
 */
export function renderParentMessage({ studentLabel, rollNo, rollType, dateISO, language = 'en' }) {
  const name = oneLine(studentLabel, 'studentLabel');
  const roll = oneLine(rollNo, 'rollNo', 16);
  if (!Object.hasOwn(SESSION_LABELS.en, rollType)) throw new TypeError('rollType is invalid');
  if (language !== 'en' && language !== 'ta') throw new TypeError('language is invalid');

  const date = formatDate(dateISO);
  const session = SESSION_LABELS[language][rollType];

  if (language === 'ta') {
    return [
      'அன்பார்ந்த பெற்றோர் / பாதுகாவலருக்கு,',
      `${name} (வரிசை எண் ${roll}), ${date} அன்று ${session} வருகைப் பதிவில் வரவில்லை எனப் பதிவு செய்யப்பட்டுள்ளது.`,
      'இது வருகைப் பதிவை மட்டுமே தெரிவிக்கிறது. பதிவு தவறாக இருப்பதாக நினைத்தால் அல்லது விளக்கம் தேவைப்பட்டால், வகுப்பு ஆசிரியரைத் தொடர்புகொள்ளவும்.',
      '',
      '— வகுப்பு ஆசிரியர்',
    ].join('\n');
  }

  return [
    'Dear Parent/Guardian,',
    `${name} (Roll No. ${roll}) was marked absent during the ${session} roll on ${date}.`,
    'This notice only reflects the attendance record. If you believe it is incorrect or need clarification, please contact the class teacher.',
    '',
    '— Class Teacher',
  ].join('\n');
}
