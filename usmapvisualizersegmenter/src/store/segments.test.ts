import { beforeEach, describe, expect, it } from 'vitest';
import { nextColor, SEGMENT_COLORS, segmentMembers, useSegments } from './segments';

const state = () => useSegments.getState();

beforeEach(() => {
  state().replaceAll({ segments: [], zipSegment: {}, citySegment: {} });
});

describe('segments store', () => {
  it('creates segments with default names and distinct colors, and selects the new one', () => {
    const a = state().addSegment();
    const b = state().addSegment({ name: '  West  ' });
    expect(state().segments.map((s) => s.name)).toEqual(['Segment 1', 'West']);
    expect(state().segments.map((s) => s.color)).toEqual([SEGMENT_COLORS[0], SEGMENT_COLORS[1]]);
    expect(state().activeId).toBe(b);
    expect(a).not.toBe(b);
  });

  it('keeps each area in one segment at most', () => {
    const a = state().addSegment();
    const b = state().addSegment();
    state().assign('zip', ['02134', '02135'], a);
    state().assign('zip', ['02135'], b);
    expect(state().zipSegment).toEqual({ '02134': a, '02135': b });
  });

  it('toggle adds to the active segment, moves from another, and removes on a second click', () => {
    const a = state().addSegment();
    const b = state().addSegment();
    state().assign('city', ['x'], a);
    state().setActive(b);
    state().toggle('city', 'x');
    expect(state().citySegment).toEqual({ x: b });
    state().toggle('city', 'x');
    expect(state().citySegment).toEqual({});
  });

  it('toggle does nothing without an active segment', () => {
    state().addSegment();
    state().setActive(null);
    state().toggle('zip', '02134');
    expect(state().zipSegment).toEqual({});
  });

  it('removing a segment removes its areas and clears the selection', () => {
    const a = state().addSegment();
    const b = state().addSegment();
    state().assign('zip', ['1'], a);
    state().assign('zip', ['2'], b);
    state().assign('city', ['c'], b);
    state().removeSegment(b);
    expect(state().segments.map((s) => s.id)).toEqual([a]);
    expect(state().zipSegment).toEqual({ '1': a });
    expect(state().citySegment).toEqual({});
    expect(state().activeId).toBeNull();
  });

  it('clearSegment empties one segment only', () => {
    const a = state().addSegment();
    const b = state().addSegment();
    state().assign('zip', ['1', '2'], a);
    state().assign('zip', ['3'], b);
    state().clearSegment(a);
    expect(state().zipSegment).toEqual({ '3': b });
  });

  it('segmentMembers lists sorted ZIPs and cities', () => {
    const a = state().addSegment();
    state().assign('zip', ['9', '1'], a);
    state().assign('city', ['c'], a);
    expect(segmentMembers(state(), a)).toEqual({ zips: ['1', '9'], cityIds: ['c'] });
  });
});

describe('nextColor', () => {
  it('picks the first unused palette color, then cycles', () => {
    const used = (n: number) => SEGMENT_COLORS.slice(0, n).map((color, i) => ({ id: `${i}`, name: '', color, visible: true }));
    expect(nextColor(used(2))).toBe(SEGMENT_COLORS[2]);
    expect(nextColor(used(SEGMENT_COLORS.length))).toBe(SEGMENT_COLORS[0]);
  });
});
