import { describe, it, expect } from 'vitest';
import { nearestInDirection } from '../src/lib/nav.js';

describe('nearestInDirection', () => {
  it('picks the only candidate that lies in the requested direction', () => {
    var candidates = [{ x: 10, y: 0 }];
    expect(nearestInDirection('right', 0, 0, candidates)).toBe(candidates[0]);
  });

  it('excludes candidates that are not past the direction threshold', () => {
    var behind = { x: -10, y: 0 }; // to the left, not a valid "right" target
    expect(nearestInDirection('right', 0, 0, [behind])).toBeNull();
  });

  it('excludes candidates within the 1px same-position tolerance', () => {
    var tooClose = { x: 0, y: -1 }; // dy=-1 is excluded by the "up" boundary check
    var valid = { x: 0, y: -2 };
    expect(nearestInDirection('up', 0, 0, [tooClose, valid])).toBe(valid);
  });

  it('prefers the candidate aligned on the cross axis over a closer misaligned one', () => {
    // Regression: a toggle directly below the current element must win over
    // one that is nominally nearer but offset sideways — cross-axis distance
    // is weighted x2 in the score.
    var aligned = { x: 0, y: 20 };   // score = 20 + 0*2  = 20
    var offset = { x: 10, y: 15 };   // score = 15 + 10*2 = 35
    expect(nearestInDirection('down', 0, 0, [aligned, offset])).toBe(aligned);
  });

  it('returns null when no candidate lies in the given direction', () => {
    var candidates = [{ x: -5, y: -5 }, { x: -5, y: 5 }];
    expect(nearestInDirection('right', 0, 0, candidates)).toBeNull();
  });

  it('works for the left direction using absolute dx as the primary distance', () => {
    var near = { x: -5, y: 0 };
    var far = { x: -20, y: 0 };
    expect(nearestInDirection('left', 0, 0, [near, far])).toBe(near);
  });
});
