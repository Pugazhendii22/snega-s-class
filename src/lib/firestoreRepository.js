import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseClient } from './firebaseClient.js';
import { normaliseRollNo } from './rosterImport.js';

const VALID_ROLL_TYPES = new Set(['MORNING', 'EVENING']);
const VALID_STATUSES = new Set(['present', 'absent', 'leave']);

function firestore() {
  const client = getFirebaseClient();
  if (!client) throw new Error('Firebase is not active. Sign in again before using the live workspace.');
  return client.db;
}

function requireText(value, label, maxLength) {
  const result = String(value ?? '').trim();
  if (!result || result.length > maxLength) throw new Error(`${label} must be 1–${maxLength} characters.`);
  return result;
}

function validateDateAndRoll(dateISO, rollType) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new Error('Choose a valid attendance date.');
  if (!VALID_ROLL_TYPES.has(rollType)) throw new Error('Choose morning or evening roll.');
}

export async function listTeacherClasses(teacherId) {
  const db = firestore();
  const id = requireText(teacherId, 'Teacher ID', 128);
  const result = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', id), limit(10)));
  return result.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
}

export async function createTeacherClass(teacherId, input) {
  const db = firestore();
  const id = requireText(teacherId, 'Teacher ID', 128);
  const name = requireText(input?.name, 'Class name', 80);
  const section = String(input?.section ?? '').trim();
  const yearLabel = String(input?.yearLabel ?? '').trim();
  if (section.length > 24) throw new Error('Section must be 24 characters or fewer.');
  if (yearLabel.length > 40) throw new Error('Year/term label must be 40 characters or fewer.');

  const snapshot = await addDoc(collection(db, 'classes'), {
    teacherId: id,
    name,
    section,
    yearLabel,
    active: true,
    createdAt: serverTimestamp(),
  });
  return { id: snapshot.id, teacherId: id, name, section, yearLabel, active: true };
}

export async function listClassStudents(classId) {
  const db = firestore();
  const id = requireText(classId, 'Class ID', 1500);
  const result = await getDocs(collection(db, 'classes', id, 'students'));
  return result.docs
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((student) => student.active !== false)
    .sort((a, b) => String(a.rollNo).localeCompare(String(b.rollNo), 'en', { numeric: true, sensitivity: 'base' }));
}

export async function importClassStudents(classId, rows) {
  const db = firestore();
  const id = requireText(classId, 'Class ID', 1500);
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) {
    throw new Error('Import between 1 and 100 students at a time.');
  }

  const studentCollection = collection(db, 'classes', id, 'students');
  const batch = writeBatch(db);
  for (const row of rows) {
    const rollNo = requireText(row?.rollNo, 'Roll number', 24);
    const displayName = requireText(row?.displayName, `Name for roll ${rollNo}`, 120);
    const studentRef = doc(studentCollection, `student_${encodeURIComponent(normaliseRollNo(rollNo))}`);
    batch.set(studentRef, {
      rollNo,
      displayName,
      active: true,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return rows.length;
}

function attendanceRef(db, classId, dateISO, rollType) {
  validateDateAndRoll(dateISO, rollType);
  return doc(db, 'classes', classId, 'attendance', `${dateISO}_${rollType}`);
}

export async function loadAttendance(classId, dateISO, rollType) {
  const db = firestore();
  const id = requireText(classId, 'Class ID', 1500);
  const snapshot = await getDoc(attendanceRef(db, id, dateISO, rollType));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

function timestampToIso(value) {
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

export async function listAttendanceHistory(classId) {
  const db = firestore();
  const id = requireText(classId, 'Class ID', 1500);
  const result = await getDocs(collection(db, 'classes', id, 'attendance'));
  const rollOrder = { MORNING: 0, EVENING: 1 };
  return result.docs.map((snapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      dateISO: String(data.dateISO ?? ''),
      rollType: String(data.rollType ?? ''),
      statuses: data.statuses && typeof data.statuses === 'object' ? { ...data.statuses } : {},
      updatedAt: timestampToIso(data.updatedAt),
    };
  }).sort((a, b) => b.dateISO.localeCompare(a.dateISO)
    || (rollOrder[a.rollType] ?? 9) - (rollOrder[b.rollType] ?? 9));
}

function validateCalendarDate(dateISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new Error('Choose a real calendar date in YYYY-MM-DD format.');
  const parsed = new Date(`${dateISO}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateISO) {
    throw new Error('Choose a real calendar date in YYYY-MM-DD format.');
  }
}

export async function listClassCalendarOverrides(classId) {
  const db = firestore();
  const id = requireText(classId, 'Class ID', 1500);
  const result = await getDocs(collection(db, 'classes', id, 'calendarOverrides'));
  return result.docs.map((snapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      dateISO: String(data.dateISO ?? ''),
      kind: String(data.kind ?? ''),
      label: String(data.label ?? ''),
      updatedAt: timestampToIso(data.updatedAt),
    };
  }).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

export async function saveClassCalendarOverride({ classId, dateISO, kind, label, teacherId }) {
  const db = firestore();
  const id = requireText(classId, 'Class ID', 1500);
  const date = requireText(dateISO, 'Calendar date', 10);
  validateCalendarDate(date);
  if (!['HOLIDAY', 'WORKING'].includes(kind)) throw new Error('Choose holiday or working day.');
  const cleanLabel = requireText(label, 'Calendar label', 120);
  const authorId = requireText(teacherId, 'Teacher ID', 128);
  await setDoc(doc(db, 'classes', id, 'calendarOverrides', date), {
    classId: id,
    dateISO: date,
    kind,
    label: cleanLabel,
    teacherId: authorId,
    updatedAt: serverTimestamp(),
  });
  return { id: date, dateISO: date, kind, label: cleanLabel };
}

export async function deleteClassCalendarOverride(classId, dateISO) {
  const db = firestore();
  const id = requireText(classId, 'Class ID', 1500);
  const date = requireText(dateISO, 'Calendar date', 10);
  validateCalendarDate(date);
  await deleteDoc(doc(db, 'classes', id, 'calendarOverrides', date));
}

export async function loadClassExportSnapshot(classId) {
  const db = firestore();
  const id = requireText(classId, 'Class ID', 1500);
  const [classSnapshot, studentSnapshots, attendanceSnapshots, calendarSnapshots] = await Promise.all([
    getDoc(doc(db, 'classes', id)),
    getDocs(collection(db, 'classes', id, 'students')),
    getDocs(collection(db, 'classes', id, 'attendance')),
    getDocs(collection(db, 'classes', id, 'calendarOverrides')),
  ]);
  if (!classSnapshot.exists()) throw new Error('This class could not be found for export.');

  const classData = classSnapshot.data();
  const students = studentSnapshots.docs.map((snapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      rollNo: String(data.rollNo ?? ''),
      displayName: String(data.displayName ?? ''),
      active: data.active !== false,
      createdAt: timestampToIso(data.createdAt),
    };
  }).sort((a, b) => a.rollNo.localeCompare(b.rollNo, 'en', { numeric: true, sensitivity: 'base' }));

  const rollOrder = { MORNING: 0, EVENING: 1 };
  const attendance = attendanceSnapshots.docs.map((snapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      dateISO: String(data.dateISO ?? ''),
      rollType: String(data.rollType ?? ''),
      statuses: data.statuses && typeof data.statuses === 'object' ? { ...data.statuses } : {},
      updatedAt: timestampToIso(data.updatedAt),
    };
  }).sort((a, b) => a.dateISO.localeCompare(b.dateISO) || (rollOrder[a.rollType] ?? 9) - (rollOrder[b.rollType] ?? 9));
  const calendar = calendarSnapshots.docs.map((snapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      dateISO: String(data.dateISO ?? ''),
      kind: String(data.kind ?? ''),
      label: String(data.label ?? ''),
      updatedAt: timestampToIso(data.updatedAt),
    };
  }).sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  return {
    class: {
      id,
      name: String(classData.name ?? ''),
      section: String(classData.section ?? ''),
      yearLabel: String(classData.yearLabel ?? ''),
      active: classData.active !== false,
      createdAt: timestampToIso(classData.createdAt),
    },
    students,
    attendance,
    calendar,
  };
}

export async function saveAttendance({ classId, dateISO, rollType, statuses, teacherId, students }) {
  const db = firestore();
  const id = requireText(classId, 'Class ID', 1500);
  const ownerId = requireText(teacherId, 'Teacher ID', 128);
  validateDateAndRoll(dateISO, rollType);
  if (!Array.isArray(students) || students.length < 1 || students.length > 100) {
    throw new Error('Load a class roster of 1–100 active students before saving attendance.');
  }

  const safeStatuses = {};
  for (const student of students) {
    const status = statuses?.[student.id];
    if (!VALID_STATUSES.has(status)) throw new Error(`Mark ${student.displayName || student.rollNo} before saving.`);
    safeStatuses[student.id] = status;
  }

  const ref = attendanceRef(db, id, dateISO, rollType);
  await setDoc(ref, {
    classId: id,
    dateISO,
    rollType,
    statuses: safeStatuses,
    takenBy: ownerId,
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, classId: id, dateISO, rollType, statuses: safeStatuses, takenBy: ownerId };
}
