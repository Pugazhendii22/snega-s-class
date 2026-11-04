const belowThreshold = new Set([6, 12, 20, 25, 30, 41, 50, 58]);

// Synthetic identifiers only. No real student or parent data belongs in demo mode.
export const DEMO_STUDENTS = Array.from({ length: 60 }, (_, index) => {
  const roll = index + 1;
  const low = belowThreshold.has(roll);
  const attendancePct = low ? 66 + ((roll * 3) % 9) : 82 + ((roll * 7) % 18);

  return {
    id: `demo-${String(roll).padStart(2, '0')}`,
    rollNo: String(roll).padStart(2, '0'),
    label: `Student ${String(roll).padStart(2, '0')}`,
    attendancePct,
  };
});
