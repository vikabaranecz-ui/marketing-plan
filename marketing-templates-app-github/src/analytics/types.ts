import type { AnalyticsSource } from '../types';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'setup_required' | 'not_available';
export type MetricAggregation = 'sum' | 'average' | 'weighted_average' | 'latest';

export interface IntegrationConnection {
  id: string;
  userId: string;
  clientId: string;
  provider: Exclude<AnalyticsSource, 'manual'>;
  status: IntegrationStatus;
  externalAccountId?: string;
  externalAccountName?: string;
  propertyId?: string;
  propertyUrl?: string;
  lastSyncedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsProvider {
  getConnectionStatus(clientId: string): Promise<IntegrationConnection | null>;
  getOverview(clientId: string, days: 7 | 30 | 90): Promise<unknown>;
  getChannelMetrics(clientId: string, days: 7 | 30 | 90): Promise<unknown>;
  getContentMetrics(clientId: string, days: 7 | 30 | 90): Promise<unknown>;
  sync(clientId: string): Promise<{ syncedAt: string }>;
}
