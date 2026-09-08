import type { MetricPoint } from '../types';
import type { MetricAggregation } from './types';

const AVERAGE_METRICS = new Set(['search_ctr', 'search_position', 'engagement_rate']);
export const metricAggregation = (metric: string): MetricAggregation => AVERAGE_METRICS.has(metric) ? 'average' : 'sum';

export const filterMetricsByRange = (points: readonly MetricPoint[], days: number, now = new Date()) => {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - days + 1);
  const fromKey = from.toISOString().slice(0, 10);
  const toKey = now.toISOString().slice(0, 10);
  return points.filter(point => !point.date || (point.date >= fromKey && point.date <= toKey));
};

export const aggregateMetric = (points: readonly MetricPoint[], metric: string) => {
  const values = points.filter(point => point.metric === metric).map(point => point.value);
  if (!values.length) return 0;
  return metricAggregation(metric) === 'average'
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : values.reduce((sum, value) => sum + value, 0);
};
