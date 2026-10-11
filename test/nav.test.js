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

  it('does not skip a full-width play button whose center is far to the side', () => {
    const source = { left: 100, top: 100, width: 80, height: 40 };
    const play = { x: 500, y: 190, rect: { left: 20, top: 170, width: 960, height: 40 } };
    const copy = { x: 140, y: 260, rect: { left: 100, top: 240, width: 80, height: 40 } };
    expect(nearestInDirection('down', 140, 120, [copy, play], source)).toBe(play);
    expect(nearestInDirection('up', 140, 260, [play, { x: 140, y: 120, rect: source }], copy.rect)).toBe(play);
  });

  it('prefers the next row of cards without losing horizontal alignment', () => {
    const source = { left: 100, top: 100, width: 120, height: 180 };
    const aligned = { x: 160, y: 390, rect: { left: 100, top: 300, width: 120, height: 180 } };
    const adjacent = { x: 300, y: 390, rect: { left: 240, top: 300, width: 120, height: 180 } };
    expect(nearestInDirection('down', 160, 190, [adjacent, aligned], source)).toBe(aligned);
  });
  it('does not move sideways on Down when same-row controls have different heights', () => {
    const source = { left: 100, top: 100, width: 80, height: 40 };
    const sameRow = { x: 228, y: 130, rect: { left: 188, top: 100, width: 80, height: 60 } };
    const nextRow = { x: 140, y: 200, rect: { left: 100, top: 180, width: 80, height: 40 } };
    expect(nearestInDirection('down', 140, 120, [sameRow, nextRow], source)).toBe(nextRow);
  });
  it('does not move down on Right when same-column controls have different widths', () => {
    const source = { left: 100, top: 100, width: 80, height: 40 };
    const sameColumn = { x: 150, y: 168, rect: { left: 100, top: 148, width: 100, height: 40 } };
    const nextColumn = { x: 260, y: 120, rect: { left: 220, top: 100, width: 80, height: 40 } };
    expect(nearestInDirection('right', 140, 120, [sameColumn, nextColumn], source)).toBe(nextColumn);
  });
});
