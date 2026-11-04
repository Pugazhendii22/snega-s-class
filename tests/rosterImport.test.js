import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRosterCsv } from '../src/lib/rosterImport.js';

test('parses a simple roster and optional header without accepting contact columns', () => {
  assert.deepEqual(parseRosterCsv('Roll No,Student Name\n01,Asha\n02,"Nila, Devi"'), [
    { rollNo: '01', displayName: 'Asha' },
    { rollNo: '02', displayName: 'Nila, Devi' },
  ]);
});

test('rejects duplicate roll numbers case-insensitively and against existing roster', () => {
  assert.throws(() => parseRosterCsv('01,Asha\n01,Nila'), /duplicated/);
  assert.throws(() => parseRosterCsv('02,Nila', [{ rollNo: '02' }]), /duplicated/);
});

test('rejects extra columns, empty values, malformed quoting, and rosters over 100', () => {
  assert.throws(() => parseRosterCsv('01,Asha,9876543210'), /exactly two columns/);
  assert.throws(() => parseRosterCsv('01,'), /student name/);
  assert.throws(() => parseRosterCsv('01,"Asha'), /closing quote/);
  const oversized = Array.from({ length: 101 }, (_, index) => `${index + 1},Student ${index + 1}`).join('\n');
  assert.throws(() => parseRosterCsv(oversized), /limited to 100/);
});
