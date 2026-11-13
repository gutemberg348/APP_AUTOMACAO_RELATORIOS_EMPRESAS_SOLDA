import { expect, it } from 'vitest';
import {
  insertDrawingSheet,
  moveDrawingSheet,
} from '../../../app/features/reports/drawing-sheet-order';

it('inserts a drawing first, between others, or last without replacing their data', () => {
  const sheets = [{ id: 'a' }, { id: 'b' }],
    added = { id: 'new' };
  for (const [position, expected] of [
    [0, ['new', 'a', 'b']],
    [1, ['a', 'new', 'b']],
    [2, ['a', 'b', 'new']],
  ] as const) {
    const next = insertDrawingSheet(sheets, added, position);
    expect(next.map((s) => s.id)).toEqual(expected);
    expect(next.find((s) => s.id === 'a')).toBe(sheets[0]);
    expect(next.find((s) => s.id === 'b')).toBe(sheets[1]);
  }
  expect(sheets.map((s) => s.id)).toEqual(['a', 'b']);
});

it('moves every sheet to any final position, retaining identities and element links', () => {
  const sheets = ['a', 'b', 'c', 'd'].map((id) => ({ id, elements: [{ reportPointId: id }] }));
  for (let from = 0; from < sheets.length; from++) {
    for (let to = 0; to < sheets.length; to++) {
      const moved = moveDrawingSheet(sheets, from, to);
      expect(moved[to]).toBe(sheets[from]);
      expect(moved.filter((s) => s !== sheets[from])).toEqual(
        sheets.filter((s) => s !== sheets[from]),
      );
      expect(new Set(moved)).toHaveLength(4);
    }
  }
  expect(sheets.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
  expect(moveDrawingSheet(sheets, 0, 20)).toBe(sheets);
});
