import { describe, expect, it } from 'vitest';
import { aggregateMetric, filterMetricsByRange } from './normalize';

describe('analytics normalization', () => {
  it('filters real date ranges', () => {
    const points = [{ id: '1', source: 'manual' as const, metric: 'sessions', value: 1, date: '2026-09-08' }, { id: '2', source: 'manual' as const, metric: 'sessions', value: 2, date: '2026-08-01' }];
    expect(filterMetricsByRange(points, 7, new Date('2026-09-08T12:00:00Z'))).toHaveLength(1);
  });
  it('averages rates and positions instead of summing them', () => {
    const points = [10, 20].map((value, index) => ({ id: String(index), source: 'manual' as const, metric: 'search_ctr', value }));
    expect(aggregateMetric(points, 'search_ctr')).toBe(15);
  });
});
