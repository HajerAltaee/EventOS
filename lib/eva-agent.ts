import type { DemoDatabase } from './demo-database';
import type { EmailDraft } from './communications';

export type EventSignal = {
  id: string;
  type:
    | 'data_changed'
    | 'vendor_delay'
    | 'checkin_queue'
    | 'verification_requested';
  source: 'registrations' | 'catering' | 'checkin' | 'eva';
  summary: string;
  changes: { field: string; before: string | number; after: string | number }[];
  occurredAt: string;
};

export type EvaActionType =
  | 'change_space'
  | 'update_meals'
  | 'update_badges'
  | 'set_staff'
  | 'set_checkin_lanes'
  | 'reassign_staff'
  | 'redirect_arrivals'
  | 'update_timeline'
  | 'create_task'
  | 'assign_catering_staff'
  | 'notify_internal'
  | 'update_vendor'
  | 'update_operational_notes'
  | 'send_email'
  | 'set_registration_status';

export type EvaAction = {
  id: string;
  type: EvaActionType;
  target: string;
  from: string | null;
  to: string;
  quantity: number | null;
  estimatedCost: number;
  reason: string;
  approvalRequired: boolean;
  approvalReason: string | null;
  staffIds?: string[];
  dietaryBreakdown?: Record<string, number>;
  context?: string[];
  emailDraft?: EmailDraft;
};

export type EvaRisk = {
  id: string;
  area: 'venue' | 'registration' | 'catering' | 'checkin' | 'badges' | 'staffing' | 'budget';
  title: string;
  detail: string;
  severity: 'high' | 'medium';
  status: 'open';
};

export type EvaApprovalRequest = {
  id: string;
  status: 'pending';
  title: string;
  summary: string;
  actionIds: string[];
  riskIds: string[];
  estimatedCost: number;
  reasons: string[];
  requestedAt: string;
};

export type EvaConnection = {
  provider: 'openai';
  status: 'configured' | 'connected' | 'fallback' | 'disconnected';
  model: string;
  message: string;
};

export type EvaServiceStatus = {
  configured: boolean;
  connection: EvaConnection;
};

export type EvaDecision = {
  id: string;
  status:
    | 'ready'
    | 'approval_required'
    | 'resolved'
    | 'ai_unavailable'
    | 'error';
  engine: 'openai' | 'fallback' | 'unavailable';
  detected: string;
  investigations: string[];
  decision: string;
  risks: EvaRisk[];
  actions: EvaAction[];
  approvalRequest: EvaApprovalRequest | null;
  verification: string;
  toolTrace: string[];
  connection: EvaConnection;
  generatedAt: string;
};

export type EvaSnapshot = Pick<
  DemoDatabase,
  | 'events'
  | 'registrations'
  | 'venues'
  | 'spaces'
  | 'tasks'
  | 'staff'
  | 'catering'
  | 'incidents'
  | 'entrances'
  | 'feedback'
  | 'permissions'
  | 'contacts'
  | 'selectedEventId'
>;
