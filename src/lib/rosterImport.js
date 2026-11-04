const MAX_STUDENTS_PER_CLASS = 100;

function parseCsvLine(line, lineNumber) {
  const fields = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }

  if (quoted) throw new Error(`Line ${lineNumber}: an opening quote is missing its closing quote.`);
  fields.push(value.trim());
  return fields;
}

function normaliseRollNo(value) {
  return String(value ?? '').trim().replace(/\s+/g, '').toLocaleUpperCase('en-IN');
}

/** Parse a two-column CSV: roll number,student name. No contact columns are accepted. */
export function parseRosterCsv(text, existingStudents = []) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Paste roster rows first.');

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const rows = [];
  const seenRollNos = new Set(existingStudents.map((student) => normaliseRollNo(student.rollNo)));

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim()) continue;
    const fields = parseCsvLine(lines[index], index + 1);

    if (rows.length === 0 && fields.length >= 2
      && /^(roll\s*no\.?|rollnumber)$/i.test(fields[0])
      && /^(name|student\s*name)$/i.test(fields[1])) {
      continue;
    }

    if (fields.length !== 2) {
      throw new Error(`Line ${index + 1}: enter exactly two columns—roll number and student name. Do not include phone numbers.`);
    }

    const [rollNo, displayName] = fields;
    const normalised = normaliseRollNo(rollNo);
    if (!normalised || normalised.length > 24) throw new Error(`Line ${index + 1}: the roll number must be 1–24 characters.`);
    if (!displayName || displayName.length > 120) throw new Error(`Line ${index + 1}: the student name must be 1–120 characters.`);
    if (seenRollNos.has(normalised)) throw new Error(`Line ${index + 1}: roll number “${rollNo}” is duplicated or already in this class.`);

    seenRollNos.add(normalised);
    rows.push({ rollNo: rollNo.trim(), displayName: displayName.trim() });
    if (existingStudents.length + rows.length > MAX_STUDENTS_PER_CLASS) {
      throw new Error(`This class is limited to ${MAX_STUDENTS_PER_CLASS} active students.`);
    }
  }

  if (rows.length === 0) throw new Error('No student rows found. Use one roll number and name per line.');
  return rows;
}

export { MAX_STUDENTS_PER_CLASS, normaliseRollNo };
