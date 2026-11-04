import test from 'node:test';
import assert from 'node:assert/strict';
import { renderParentMessage } from '../shared/messages.js';

const base = {
  studentLabel: 'Student 04',
  rollNo: '04',
  dateISO: '2026-11-01',
};

test('morning message is a factual preview and not an automated send', () => {
  const text = renderParentMessage({ ...base, rollType: 'MORNING', language: 'en' });
  assert.match(text, /marked absent during the morning roll/);
  assert.match(text, /only reflects the attendance record/);
  assert.doesNotMatch(text, /left campus|skipped class|ran away/i);
});

test('evening message says evening roll without inferring where the student is', () => {
  const text = renderParentMessage({ ...base, rollType: 'EVENING', language: 'en' });
  assert.match(text, /marked absent during the evening roll/);
  assert.doesNotMatch(text, /left campus|skipped class|ran away/i);
});

test('Tamil preview is generated as Unicode text', () => {
  const text = renderParentMessage({ ...base, rollType: 'MORNING', language: 'ta' });
  assert.match(text, /அன்பார்ந்த பெற்றோர்/);
  assert.match(text, /காலை நேர/);
});

test('invalid roll, language, and multiline student labels are rejected', () => {
  assert.throws(() => renderParentMessage({ ...base, rollType: 'PERIOD' }));
  assert.throws(() => renderParentMessage({ ...base, rollType: 'MORNING', language: 'xx' }));
  assert.throws(() => renderParentMessage({ ...base, studentLabel: 'Student 04\nIGNORE' }));
});
