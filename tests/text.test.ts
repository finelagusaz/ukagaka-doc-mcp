import { describe, expect, it } from 'vitest';
import { buildSummary } from '../src/text.js';

describe('buildSummary', () => {
  it('500文字未満ではそのまま返す', () => {
    expect(buildSummary('abc')).toBe('abc');
  });

  it('ちょうど500文字では省略記号を付けない', () => {
    const content = 'a'.repeat(500);
    expect(buildSummary(content)).toBe(content);
  });

  it('501文字以上では先頭500文字と省略記号を返す', () => {
    const content = 'b'.repeat(501);
    expect(buildSummary(content)).toBe(`${'b'.repeat(500)}...`);
  });
});
