import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
const anonymousDb = testEnv.unauthenticatedContext().firestore();

async function seed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'teachers/teacher-1'), { active: true });
    await setDoc(doc(db, 'teachers/teacher-2'), { active: true });
    await setDoc(doc(db, 'teachers/inactive'), { active: false });
    await setDoc(doc(db, 'classes/class-a'), { teacherId: 'teacher-1', name: 'Class A' });
    await setDoc(doc(db, 'classes/class-b'), { teacherId: 'teacher-2', name: 'Class B' });
    await setDoc(doc(db, 'classes/class-a/students/demo-01'), { rollNo: '01', label: 'Synthetic 01' });
    await setDoc(doc(db, 'classes/class-b/students/demo-02'), { rollNo: '02', label: 'Synthetic 02' });
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
    await assertFails(getDoc(doc(anonymousDb, 'attendance/record-b')));
    await assertFails(getDoc(doc(anonymousDb, 'parents/parent-a')));
  });

  await scenario('a teacher can read only their own approval record and class data', async () => {
    await assertSucceeds(getDoc(doc(teacherDb, 'teachers/teacher-1')));
    await assertFails(getDoc(doc(teacherDb, 'teachers/teacher-2')));
    await assertSucceeds(getDoc(doc(teacherDb, 'classes/class-a')));
    await assertSucceeds(getDoc(doc(teacherDb, 'classes/class-a/students/demo-01')));
    await assertFails(getDoc(doc(teacherDb, 'classes/class-b')));
    await assertFails(getDoc(doc(teacherDb, 'classes/class-b/students/demo-02')));
  });

  await scenario('teacher approval cannot be created, edited, or self-enabled by a client', async () => {
    await assertFails(setDoc(doc(teacherDb, 'teachers/new-teacher'), { active: true }));
    await assertFails(updateDoc(doc(teacherDb, 'teachers/teacher-1'), { active: false }));
    await assertFails(updateDoc(doc(teacherDb, 'teachers/inactive'), { active: true }));
  });

  await scenario('an approved teacher can create their own class but cannot assign it to someone else', async () => {
    await assertSucceeds(setDoc(doc(teacherDb, 'classes/class-c'), { teacherId: 'teacher-1', name: 'Class C' }));
    await assertFails(setDoc(doc(teacherDb, 'classes/class-d'), { teacherId: 'teacher-2', name: 'Class D' }));
  });

  await scenario('attendance writes require the owner, a valid roll type, and server timestamp', async () => {
    const valid = {
      classId: 'class-a',
      dateISO: '2026-11-04',
      rollType: 'MORNING',
      statuses: { 'demo-01': 'present', 'demo-02': 'leave' },
      takenBy: 'teacher-1',
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(teacherDb, 'attendance/new-record'), valid));
    await assertFails(setDoc(doc(teacherDb, 'attendance/wrong-owner'), { ...valid, takenBy: 'teacher-2', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(teacherDb, 'attendance/wrong-roll'), { ...valid, rollType: 'LUNCH', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(otherTeacherDb, 'attendance/foreign-class'), { ...valid, takenBy: 'teacher-2', updatedAt: serverTimestamp() }));
  });

  await scenario('an attendance record cannot be moved to another class/date/session or deleted', async () => {
    const valid = {
      classId: 'class-a', dateISO: '2026-11-04', rollType: 'EVENING',
      statuses: { 'demo-01': 'absent' }, takenBy: 'teacher-1', updatedAt: serverTimestamp(),
    };
    await setDoc(doc(teacherDb, 'attendance/record-a'), valid);
    await assertFails(updateDoc(doc(teacherDb, 'attendance/record-a'), { classId: 'class-b', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(teacherDb, 'attendance/record-a'), { dateISO: '2026-11-05', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(teacherDb, 'attendance/record-a'), { rollType: 'MORNING', updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(teacherDb, 'attendance/record-a')));
  });

  await scenario('parent contact and consent paths remain inaccessible to clients', async () => {
    await assertFails(getDoc(doc(teacherDb, 'parents/parent-a')));
    await assertFails(setDoc(doc(teacherDb, 'parents/new-parent'), { classId: 'class-a', phone: 'synthetic-only' }));
  });

  console.log('Firestore rule scenarios passed.');
} finally {
  await testEnv.cleanup();
}
