import { describe, expect, it } from 'vitest';
import { mergeSkills } from './mergeSkills';

describe('mergeSkills', () => {
  it('keeps saved skills first and appends only new ones (case-insensitive)', () => {
    const merged = mergeSkills([{ name: 'Java', endorsements: 3 }, { name: 'AWS' }], [{ name: 'java' }, { name: 'Docker' }, { name: ' aws ' }]);
    expect(merged.map((s) => s.name)).toEqual(['Java', 'AWS', 'Docker']);
    expect(merged[0].endorsements).toBe(3);
  });

  it('drops blanks, trims and caps names, and respects the 200-skill limit', () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ name: `Skill ${i}` }));
    expect(mergeSkills([], many)).toHaveLength(200);
    expect(mergeSkills([], [{ name: '   ' }, { name: 'x'.repeat(150) }])[0].name).toHaveLength(100);
  });
});
