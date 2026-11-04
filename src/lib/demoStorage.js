const STORAGE_KEY = 'namma-class-demo-rolls-v1';

export function readDemoRolls() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function writeDemoRolls(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function rollKey(dateISO, rollType) {
  return `${dateISO}:${rollType}`;
}

export function emptyRoll(students) {
  return {
    statuses: Object.fromEntries(students.map((student) => [student.id, 'unmarked'])),
    savedAt: null,
    dirty: false,
  };
}
