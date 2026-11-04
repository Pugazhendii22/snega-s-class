import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

const projectId = 'demo-namma-class-rules';
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const emulator = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const [host, portText] = emulator.split(':');
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules, host, port: Number(portText) },
});

const teacherDb = testEnv.authenticatedContext('teacher-1').firestore();
const otherTeacherDb = testEnv.authenticatedContext('teacher-2').firestore();
const emptyTeacherDb = testEnv.authenticatedContext('teacher-3').firestore();
const anonymousDb = testEnv.unauthenticatedContext().firestore();

async function seed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'teachers/teacher-1'), { active: true });
    await setDoc(doc(db, 'teachers/teacher-2'), { active: true });
    await setDoc(doc(db, 'teachers/teacher-3'), { active: true });
    await setDoc(doc(db, 'teachers/inactive'), { active: false });
    await setDoc(doc(db, 'classes/class-a'), { teacherId: 'teacher-1', name: 'Class A' });
    await setDoc(doc(db, 'classes/class-b'), { teacherId: 'teacher-2', name: 'Class B' });
    await setDoc(doc(db, 'classes/class-a/students/demo-01'), { rollNo: '01', displayName: 'Synthetic 01', active: true });
    await setDoc(doc(db, 'classes/class-b/students/demo-02'), { rollNo: '02', displayName: 'Synthetic 02', active: true });
    await setDoc(doc(db, 'classes/class-a/attendance/2026-11-04_MORNING'), {
      classId: 'class-a', dateISO: '2026-11-04', rollType: 'MORNING',
      statuses: { 'demo-01': 'present' }, takenBy: 'teacher-1', updatedAt: new Date(),
    });
    await setDoc(doc(db, 'attendance/record-b'), {
      classId: 'class-b', dateISO: '2026-11-04', rollType: 'MORNING',
      statuses: { 'demo-02': 'present' }, takenBy: 'teacher-2', updatedAt: new Date(),
    });
    await setDoc(doc(db, 'parents/parent-a'), { classId: 'class-a', phone: 'synthetic-only' });
  });
}

async function scenario(name, run) {
  await seed();
  await run();
  console.log(`PASS ${name}`);
}

try {
  await scenario('anonymous users cannot read class, roster, attendance, or parent paths', async () => {
    await assertFails(getDoc(doc(anonymousDb, 'classes/class-a')));
    await assertFails(getDoc(doc(anonymousDb, 'classes/class-a/students/demo-01')));
    await assertFails(getDoc(doc(anonymousDb, 'classes/class-a/attendance/2026-11-04_MORNING')));
    await assertFails(getDoc(doc(anonymousDb, 'attendance/record-b')));
    await assertFails(getDoc(doc(anonymousDb, 'parents/parent-a')));
  });

  await scenario('a teacher can read only their own approval record and class data', async () => {
    await assertSucceeds(getDoc(doc(teacherDb, 'teachers/teacher-1')));
    await assertFails(getDoc(doc(teacherDb, 'teachers/teacher-2')));
    await assertSucceeds(getDoc(doc(teacherDb, 'classes/class-a')));
    await assertSucceeds(getDoc(doc(teacherDb, 'classes/class-a/students/demo-01')));
    const ownRoster = await assertSucceeds(getDocs(collection(teacherDb, 'classes/class-a/students')));
    assert.equal(ownRoster.size, 1);
    await assertSucceeds(getDoc(doc(teacherDb, 'classes/class-a/attendance/2026-11-04_MORNING')));
    await assertFails(getDoc(doc(teacherDb, 'classes/class-b')));
    await assertFails(getDoc(doc(teacherDb, 'classes/class-b/students/demo-02')));
    await assertFails(getDoc(doc(teacherDb, 'classes/class-b/attendance/2026-11-04_MORNING')));
  });

  await scenario('an approved teacher can list only their own classes, including an empty first-run list', async () => {
    const ownClasses = await assertSucceeds(getDocs(query(collection(teacherDb, 'classes'), where('teacherId', '==', 'teacher-1'))));
    assert.equal(ownClasses.size, 1);
    const emptyClasses = await assertSucceeds(getDocs(query(collection(emptyTeacherDb, 'classes'), where('teacherId', '==', 'teacher-3'))));
    assert.equal(emptyClasses.size, 0);
    await assertFails(getDocs(query(collection(teacherDb, 'classes'), where('teacherId', '==', 'teacher-2'))));
  });

  await scenario('teacher approval cannot be created, edited, or self-enabled by a client', async () => {
    await assertFails(setDoc(doc(teacherDb, 'teachers/new-teacher'), { active: true }));
    await assertFails(updateDoc(doc(teacherDb, 'teachers/teacher-1'), { active: false }));
    await assertFails(updateDoc(doc(teacherDb, 'teachers/inactive'), { active: true }));
  });

  await scenario('an approved teacher can create only the limited class schema they own', async () => {
    const classData = {
      teacherId: 'teacher-1', name: 'Class C', section: 'A', yearLabel: 'Year II',
      active: true, createdAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(teacherDb, 'classes/class-c'), classData));
    await assertFails(setDoc(doc(teacherDb, 'classes/class-d'), { ...classData, teacherId: 'teacher-2' }));
    await assertFails(setDoc(doc(teacherDb, 'classes/class-e'), { ...classData, parentPhone: 'not-allowed' }));
    await assertFails(updateDoc(doc(teacherDb, 'classes/class-a'), { name: 'Changed' }));
  });

  await scenario('an approved teacher can create only the limited roster schema in their own class', async () => {
    await assertSucceeds(setDoc(doc(teacherDb, 'classes/class-a/students/demo-03'), {
      rollNo: '03', displayName: 'Synthetic 03', active: true, createdAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(teacherDb, 'classes/class-a/students/demo-04'), {
      rollNo: '04', displayName: 'Synthetic 04', active: true, createdAt: serverTimestamp(), parentPhone: 'not-allowed',
    }));
    await assertFails(setDoc(doc(teacherDb, 'classes/class-b/students/demo-05'), {
      rollNo: '05', displayName: 'Synthetic 05', active: true, createdAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(teacherDb, 'classes/class-a/students/demo-01'), { displayName: 'Changed' }));
  });

  await scenario('attendance reads work before a roll exists and writes stay in the owning class', async () => {
    await assertSucceeds(getDoc(doc(teacherDb, 'classes/class-a/attendance/2026-11-05_EVENING')));
    const valid = {
      classId: 'class-a', dateISO: '2026-11-05', rollType: 'EVENING',
      statuses: { 'demo-01': 'absent', 'demo-02': 'leave' },
      takenBy: 'teacher-1', updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(teacherDb, 'classes/class-a/attendance/2026-11-05_EVENING'), valid));
    await assertFails(setDoc(doc(teacherDb, 'classes/class-b/attendance/2026-11-05_EVENING'), { ...valid, classId: 'class-b' }));
    await assertFails(setDoc(doc(teacherDb, 'classes/class-a/attendance/2026-11-05_MORNING'), valid));
    await assertFails(setDoc(doc(otherTeacherDb, 'classes/class-a/attendance/2026-11-05_EVENING'), valid));
  });

  await scenario('attendance cannot change its class, date, roll session, or be deleted', async () => {
    const ref = doc(teacherDb, 'classes/class-a/attendance/2026-11-04_MORNING');
    await assertFails(updateDoc(ref, { classId: 'class-b', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { dateISO: '2026-11-05', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { rollType: 'EVENING', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(ref));
  });

  await scenario('parent contact and consent paths remain inaccessible to clients', async () => {
    await assertFails(getDoc(doc(teacherDb, 'parents/parent-a')));
    await assertFails(setDoc(doc(teacherDb, 'parents/new-parent'), { classId: 'class-a', phone: 'synthetic-only' }));
  });

  console.log('Firestore rule scenarios passed.');
} finally {
  await testEnv.cleanup();
}
