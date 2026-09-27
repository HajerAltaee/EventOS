'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Gauge,
  LayoutDashboard,
  MapPin,
  Mail,
  PackageCheck,
  Plus,
  RefreshCw,
  Settings,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useEventOSStore } from '@/hooks/use-eventos-store';
import {
  addDemoRegistrations,
  appendActivity,
  applyEvaActions,
  selectEvent,
  selectEventActivity,
  selectMaximumCapacity,
  selectCatering,
  selectMealRequirements,
  selectOperationalRisks,
  selectRegistrations,
  selectSpace,
  selectStaff,
  simulateMealShortage,
  simulateVendorDelay,
  simulateCheckinQueue,
  verifyOperationalIncidents,
  updateIncidentLifecycle,
  type DemoDatabase,
  type EvaState,
  type OperationalRiskRecord,
  type PermissionKey,
} from '@/lib/demo-database';
import type {
  EvaAction,
  EvaConnection,
  EvaDecision,
  EvaServiceStatus,
  EventSignal,
} from '@/lib/eva-agent';
import type { CommunicationRecord, GmailStatus } from '@/lib/communications';

type PageName =
  | 'Dashboard'
  | 'Events'
  | 'Timeline'
  | 'Tasks'
  | 'Resources'
  | 'Staff Operations'
  | 'Catering Operations'
  | 'Live Ops'
  | 'Budget'
  | 'Risks'
  | 'EVA Activity'
  | 'Communications'
  | 'Settings';

const money = (value: number) => `AED ${value.toLocaleString()}`;
const actionDelta = (action: EvaAction) => {
  if (action.type === 'update_meals')
    return `Add ${action.quantity} meals: ${action.from} → ${action.to}`;
  if (action.type === 'update_badges')
    return `Add ${action.quantity} badges: ${action.from} → ${action.to}`;
  if (action.type === 'set_staff')
    return `Add ${action.quantity} event staff: ${action.from} → ${action.to}`;
  if (action.type === 'set_checkin_lanes')
    return `Set QR lanes at ${action.target}: ${action.from} → ${action.to}`;
  if (action.type === 'reassign_staff')
    return `Move ${action.quantity} staff: ${action.from} → ${action.target}`;
  if (action.type === 'redirect_arrivals')
    return `Redirect ${action.quantity}% of arrivals: ${action.from} → ${action.target}`;
  if (action.type === 'assign_catering_staff')
    return `Assign named staff to ${action.to}`;
  if (action.type === 'notify_internal') return `Notify ${action.target}: ${action.to}`;
  if (action.type === 'update_vendor') return `${action.target}: ${action.to}`;
  if (action.type === 'update_operational_notes') return `Record note: ${action.to}`;
  if (action.type === 'send_email') return `Draft email to ${action.emailDraft?.to ?? action.target}: ${action.emailDraft?.subject ?? action.to}`;
  if (action.type === 'change_space')
    return `Change event space: ${action.from} → ${action.to}`;
  if (action.type === 'update_timeline')
    return `Reschedule ${action.target}: ${action.from} → ${action.to}`;
  return `${action.type.replaceAll('_', ' ')}: ${action.from ?? action.target} → ${action.to}`;
};

const requestEvaDecision = async (signal: EventSignal, state: DemoDatabase) => {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal, state }),
  });
  const decision = (await response.json()) as EvaDecision & { error?: string };
  if (!response.ok) throw new Error(decision.error || 'EVA analysis failed');
  return decision;
};
const stateTone: Record<EvaState, string> = {
  Monitoring: 'bg-emerald-50 text-emerald-700',
  Investigating: 'bg-blue-50 text-blue-700',
  'Decision Needed': 'bg-amber-50 text-amber-700',
  Critical: 'bg-red-50 text-red-700',
  Resolved: 'bg-violet-50 text-violet-700',
};

export default function Home() {
  const { database, setDatabase, resetDatabase } = useEventOSStore();
  const [page, setPage] = useState<PageName>('Dashboard');
  const [evaState, setEvaState] = useState<EvaState>('Monitoring');
  const [evaCollapsed, setEvaCollapsed] = useState(false);
  const [plan, setPlan] = useState<EvaDecision | null>(null);
  const [busy, setBusy] = useState(false);
  const [evaConnection, setEvaConnection] = useState<EvaConnection | null>(
    null,
  );
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailBusy, setGmailBusy] = useState(false);

  const refreshGmailStatus = useCallback(() => {
    void fetch('/api/gmail/status').then(async (response) => {
      if (response.ok) setGmailStatus(await response.json() as GmailStatus);
    }).catch(() => setGmailStatus({ configured: false, connected: false, email: null, message: 'Gmail status is unavailable.' }));
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/agent')
      .then(async (response) => {
        const status = (await response.json()) as EvaServiceStatus;
        if (active) setEvaConnection(status.connection);
      })
      .catch(() => {
        if (active)
          setEvaConnection({
            provider: 'openai',
            status: 'disconnected',
            model: 'gpt-5.4-mini',
            message:
              'EVA could not read the server connection status. Investigations will not claim an OpenAI connection unless one succeeds.',
          });
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => { refreshGmailStatus(); }, [refreshGmailStatus]);

  const event = selectEvent(database);
  const registrationCount = selectRegistrations(database).length;
  const space = selectSpace(database, event.spaceId);
  const maximumCapacity = selectMaximumCapacity(database);
  const capacityReached =
    maximumCapacity > 0 && registrationCount >= maximumCapacity;
  const currentCapacityExceeded = registrationCount > (space?.capacity ?? 0);
  const operationalRisks = selectOperationalRisks(database);
  const riskPenalty = operationalRisks.reduce(
    (total, risk) => total + (risk.severity === 'high' ? 12 : 6),
    0,
  );
  const operationalReadiness = Math.max(0, event.readiness - riskPenalty);
  const pendingPlanCost =
    plan?.status === 'approval_required'
      ? plan.actions.reduce(
          (total, action) => total + Math.max(0, action.estimatedCost),
          0,
        )
      : 0;
  const projectedCost = event.currentCost + pendingPlanCost;
  // This is a deterministic exposure, not an EVA-selected recovery plan.
  // It reflects only a cost directly proven by the live event data.
  const minimumResourceExposure =
    Math.max(0, registrationCount - event.meals) *
    event.operations.mealUnitCost;
  const budgetForecast = pendingPlanCost
    ? projectedCost
    : event.currentCost + minimumResourceExposure;
  const budgetForecastActive =
    pendingPlanCost > 0 || minimumResourceExposure > 0;
  const budgetOver = event.currentCost > event.budget;
  const projectedBudgetOver = budgetForecast > event.budget;
  const activity = selectEventActivity(database);
  const entrances = database.entrances.filter(
    (entrance) => entrance.eventId === event.id,
  );
  const feedback = database.feedback.filter(
    (item) => item.eventId === event.id,
  );
  const tasks = database.tasks.filter((task) => task.eventId === event.id);
  const staff = selectStaff(database);
  const catering = selectCatering(database);
  const mealRequirements = selectMealRequirements(database);
  const latestIncident = database.incidents.find((incident) => incident.eventId === event.id);

  const runEva = useCallback(
    async (signal: EventSignal, db: DemoDatabase) => {
      setBusy(true);
      setEvaState('Investigating');
      db = updateIncidentLifecycle(db, 'INVESTIGATING');
      setDatabase(db);
      try {
        let next = await requestEvaDecision(signal, db);
        setEvaConnection(next.connection);
        if (next.status === 'ai_unavailable') {
          setPlan(next);
          setEvaState('Critical');
          setDatabase((current) =>
            appendActivity(current, [
              {
                title: 'EVA requires configuration',
                detail: next.decision,
                kind: 'risk',
                createdAt: 'Now',
              },
            ]),
          );
          return;
        }
        const planNeedsApproval = next.actions.some(
          (action) => action.approvalRequired,
        );
        // Keep a coupled recovery package intact: an approval-sensitive plan
        // must be reviewed before any of its otherwise-automatic steps run.
        const automatic = planNeedsApproval ? [] : next.actions;
        const approval = planNeedsApproval ? next.actions : [];
        let updated = updateIncidentLifecycle(
          automatic.length ? applyEvaActions(db, automatic) : db,
          planNeedsApproval ? 'WAITING_FOR_APPROVAL' : next.actions.length ? 'EXECUTING' : 'PLAN_CREATED',
          next.actions.map(actionDelta),
        );
        if (
          automatic.length &&
          !approval.length &&
          signal.type !== 'verification_requested'
        ) {
          const verificationSignal: EventSignal = {
            id: `verify-${Date.now()}`,
            type: 'verification_requested',
            source: 'eva',
            summary:
              'EVA executed authorized actions and must verify the live outcome.',
            changes: automatic.map((action) => ({
              field: action.type,
              before: action.from ?? '',
              after: action.to,
            })),
            occurredAt: new Date().toISOString(),
          };
          const verificationDecision = await requestEvaDecision(
            verificationSignal,
            updated,
          );
          setEvaConnection(verificationDecision.connection);
          if (verificationDecision.status !== 'ai_unavailable')
            next = verificationDecision;
        }
        const verifiedAutomatic = next.actions.filter(
          (action) =>
            !action.approvalRequired &&
            !automatic.some((item) => item.id === action.id),
        );
        const verifiedApproval = next.actions.filter(
          (action) => action.approvalRequired,
        );
        if (verifiedAutomatic.length)
          updated = applyEvaActions(updated, verifiedAutomatic);
        const pendingApproval = approval.length ? approval : verifiedApproval;
        const emailActions = pendingApproval.filter((action) => action.type === 'send_email' && action.emailDraft);
        if (emailActions.length) {
          const now = new Date().toISOString();
          const records: CommunicationRecord[] = emailActions.map((action) => ({
            id: action.id, channel: 'email', status: 'pending', approvalStatus: 'pending',
            ...action.emailDraft!, createdAt: now, updatedAt: now,
          }));
          updated = {
            ...updated,
            communications: [
              ...records.filter((record) => !updated.communications.some((existing) => existing.id === record.id)),
              ...updated.communications,
            ],
          };
        }
        if (!pendingApproval.length) {
          updated = updateIncidentLifecycle(updated, 'VERIFYING');
          updated = verifyOperationalIncidents(updated);
        }
        updated = appendActivity(updated, [
          {
            title: 'Signal investigated',
            detail: `${next.investigations.length} live data sources inspected`,
            kind: 'monitor',
            createdAt: 'Now',
          },
          ...automatic.map((action) => ({ title: `Autonomous action: ${action.type.replaceAll('_', ' ')}`, detail: actionDelta(action), kind: 'action' as const, createdAt: 'Now' })),
          ...(approval.length
            ? [
                {
                  title: 'Organizer decision required',
                  detail: approval
                    .map((action) => action.approvalReason)
                    .filter(Boolean)
                    .join(' · '),
                  kind: 'approval' as const,
                  createdAt: 'Now',
                },
              ]
            : []),
          ...emailActions.map((action) => ({ title: `Email drafted for ${action.emailDraft!.to}`, detail: action.emailDraft!.subject, kind: 'approval' as const, createdAt: 'Now' })),
          ...(!pendingApproval.length
            ? [
                {
                  title: 'Outcome verification completed',
                  detail: next.verification,
                  kind: 'resolved' as const,
                  createdAt: 'Now',
                },
              ]
            : []),
        ]);
        setDatabase(updated);
        setPlan(
          pendingApproval.length ? { ...next, actions: pendingApproval } : next,
        );
        setEvaState(pendingApproval.length ? 'Decision Needed' : 'Resolved');
      } catch (error) {
        const detail =
          error instanceof Error
            ? error.message
            : 'The EVA service could not complete this investigation.';
        const failedDecision: EvaDecision = {
          id: `eva-error-${Date.now()}`,
          status: 'error',
          engine: 'unavailable',
          detected: signal.summary,
          investigations: [],
          decision:
            'EVA could not generate a decision. No event changes were made.',
          risks: [],
          actions: [],
          approvalRequest: null,
          verification: 'Reconnect EVA, then rerun the investigation.',
          toolTrace: [],
          connection: {
            provider: 'openai',
            status: 'disconnected',
            model: evaConnection?.model ?? 'gpt-5.4-mini',
            message: detail,
          },
          generatedAt: new Date().toISOString(),
        };
        setPlan(failedDecision);
        setEvaConnection(failedDecision.connection);
        setDatabase((current) =>
          appendActivity(current, [
            {
              title: 'EVA investigation interrupted',
              detail,
              kind: 'risk',
              createdAt: 'Now',
            },
          ]),
        );
        setEvaState('Critical');
      } finally {
        setBusy(false);
      }
    },
    [evaConnection?.model, setDatabase],
  );

  const addRegistrations = (count: number) => {
    const before = registrationCount;
    const next = addDemoRegistrations(database, count);
    const after = selectRegistrations(next).length;
    const accepted = after - before;
    const blocked = count - accepted;
    let updated = next;
    if (accepted > 0)
      updated = appendActivity(updated, [
        {
          title: `${accepted} registration${accepted > 1 ? 's' : ''} confirmed`,
          detail: `${after} confirmed · capacity guard active at ${maximumCapacity}`,
          kind: 'monitor',
          createdAt: 'Now',
        },
      ]);
    if (blocked > 0) {
      updated = appendActivity(updated, [
        {
          title: 'Registration intake blocked',
          detail: `${blocked} request${blocked > 1 ? 's were' : ' was'} rejected. No configured space exceeds ${maximumCapacity} seats.`,
          kind: 'risk',
          createdAt: 'Now',
        },
      ]);
      setEvaState(plan ? 'Decision Needed' : 'Critical');
    }
    setDatabase(updated);
    if (accepted > 0)
      void runEva(
        {
          id: `signal-${Date.now()}`,
          type: 'data_changed',
          source: 'registrations',
          summary: `${accepted} registrations were added.`,
          changes: [{ field: 'confirmedRegistrations', before, after }],
          occurredAt: new Date().toISOString(),
        },
        updated,
      );
  };

  const triggerCatering = () => {
    if (busy || database.incidents.some((incident) => incident.eventId === event.id && incident.type === 'vendor_delay')) return;
    const before = event.cateringArrival;
    const delayed = simulateVendorDelay(database);
    const updated = appendActivity(delayed, [
      {
        title: 'Vendor update received',
        detail: `Catering arrival ${before} → 13:30`,
        kind: 'risk',
        createdAt: 'Now',
      },
    ]);
    setDatabase(updated);
    void runEva(
      {
        id: `signal-${Date.now()}`,
        type: 'vendor_delay',
        source: 'catering',
        summary: 'The catering vendor changed the confirmed arrival time.',
        changes: [{ field: 'cateringArrival', before, after: '13:30' }],
        occurredAt: new Date().toISOString(),
      },
      updated,
    );
  };

  const runMealScenario = () => {
    if (event.id !== 'hackathon' || busy || registrationCount !== 118) return;
    const updated = appendActivity(simulateMealShortage(database), [{ title: 'Registration-to-catering signal detected', detail: 'Confirmed attendance 118 → 120; EVA is reconciling meal and dietary coverage.', kind: 'risk', createdAt: 'Now' }]);
    setDatabase(updated);
    setPage('Catering Operations');
    void runEva({ id: `signal-${Date.now()}`, type: 'data_changed', source: 'registrations', summary: 'Confirmed registrations increased and catering coverage must be reconciled.', changes: [{ field: 'confirmedRegistrations', before: 118, after: 120 }], occurredAt: new Date().toISOString() }, updated);
  };

  const runCheckinScenario = () => {
    if (event.id !== 'hackathon' || busy || database.incidents.some((incident) => incident.eventId === event.id && incident.type === 'checkin_queue')) return;
    const before =
      entrances.find((item) => item.id === 'north-entrance')
        ?.attendeesWaiting ?? 0;
    const updated = appendActivity(simulateCheckinQueue(database), [
      {
        title: 'Check-in telemetry changed',
        detail: `North Entrance queue ${before} → 74`,
        kind: 'risk',
        createdAt: 'Now',
      },
    ]);
    setDatabase(updated);
    setPage('Live Ops');
    void runEva(
      {
        id: `signal-${Date.now()}`,
        type: 'checkin_queue',
        source: 'checkin',
        summary: 'A check-in queue increased at one entrance.',
        changes: [
          { field: 'northEntrance.attendeesWaiting', before, after: 74 },
        ],
        occurredAt: new Date().toISOString(),
      },
      updated,
    );
  };

  const approvePlan = async () => {
    if (!plan || busy) return;
    setBusy(true);
    setEvaState('Investigating');
    const internalActions = plan.actions.filter((action) => action.type !== 'send_email');
    const emailActions = plan.actions.filter((action) => action.type === 'send_email' && action.emailDraft);
    let recovered = updateIncidentLifecycle(applyEvaActions(database, internalActions), 'EXECUTING');
    const emailActivity: { title: string; detail: string; kind: 'approval' | 'action' | 'risk'; createdAt: string }[] = [];
    for (const action of emailActions) {
      const draft = action.emailDraft!;
      try {
        const approvalResponse = await fetch('/api/gmail/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft }) });
        const approval = await approvalResponse.json() as { approvalToken?: string; error?: string };
        if (!approvalResponse.ok || !approval.approvalToken) throw new Error(approval.error || 'Email approval could not be recorded.');
        const sendResponse = await fetch('/api/gmail/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft, approvalToken: approval.approvalToken }) });
        const sent = await sendResponse.json() as { messageId?: string; error?: string };
        if (!sendResponse.ok || !sent.messageId) throw new Error(sent.error || 'Gmail did not confirm delivery.');
        recovered = { ...recovered, communications: recovered.communications.map((record) => record.id === action.id ? { ...record, status: 'sent', approvalStatus: 'approved', providerMessageId: sent.messageId, updatedAt: new Date().toISOString(), error: undefined } : record) };
        emailActivity.push({ title: 'Email sent successfully', detail: `${draft.to} · ${draft.subject}`, kind: 'action', createdAt: 'Now' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gmail send failed.';
        recovered = { ...recovered, communications: recovered.communications.map((record) => record.id === action.id ? { ...record, status: 'failed', approvalStatus: 'approved', updatedAt: new Date().toISOString(), error: message } : record) };
        emailActivity.push({ title: 'Email delivery failed', detail: message, kind: 'risk', createdAt: 'Now' });
      }
    }
    recovered = appendActivity(recovered, [
      {
        title: 'Organizer authorized EVA',
        detail: plan.decision,
        kind: 'approval',
        createdAt: 'Now',
      },
      {
        title: 'Approved actions executed',
        detail: internalActions.length ? internalActions.map(actionDelta).join(' · ') : 'No internal changes were required.',
        kind: 'action',
        createdAt: 'Now',
      },
      ...emailActivity,
    ]);
    setDatabase(recovered);
    setPlan(null);
    setBusy(false);
    await runEva(
      {
        id: `verify-${Date.now()}`,
        type: 'verification_requested',
        source: 'eva',
        summary:
          'Organizer-approved actions were executed. Verify the updated event state.',
        changes: plan.actions.map((action) => ({
          field: action.type,
          before: action.from ?? '',
          after: action.to,
        })),
        occurredAt: new Date().toISOString(),
      },
      recovered,
    );
  };

  const rejectPlan = () => {
    setPlan(null);
    setEvaState('Monitoring');
    setDatabase((current) =>
      appendActivity({
        ...updateIncidentLifecycle(current, 'WAITING_FOR_APPROVAL'),
        communications: current.communications.map((record) => plan?.actions.some((action) => action.id === record.id) ? { ...record, status: 'rejected' as const, approvalStatus: 'rejected' as const, updatedAt: new Date().toISOString() } : record),
      }, [
        {
          title: 'Recovery plan rejected',
          detail: 'No event changes were executed',
          kind: 'approval',
          createdAt: 'Now',
        },
      ]),
    );
  };
  const modifyPlan = () => setPage('Settings');

  const retryEva = () => {
    if (busy) return;
    void runEva(
      {
        id: `reassess-${Date.now()}`,
        type: 'data_changed',
        source: 'eva',
        summary: 'EVA is reassessing the current live event state.',
        changes: [],
        occurredAt: new Date().toISOString(),
      },
      database,
    );
  };
  const switchEvent = (eventId: string) => {
    setDatabase((current) => ({ ...current, selectedEventId: eventId }));
    setPlan(null);
    setEvaState('Monitoring');
    setPage('Dashboard');
  };
  const connectGmail = () => { window.location.href = '/api/gmail/connect'; };
  const disconnectGmail = async () => {
    setGmailBusy(true);
    try { await fetch('/api/gmail/disconnect', { method: 'POST' }); refreshGmailStatus(); }
    finally { setGmailBusy(false); }
  };

  const kpis = useMemo(() => {
    const riskCount = operationalRisks.length;
    return [
      {
        label: 'Registrations',
        value: registrationCount.toString(),
        detail: capacityReached
          ? `Registration closed · ${maximumCapacity} maximum capacity`
          : currentCapacityExceeded
            ? `${registrationCount - (space?.capacity ?? 0)} over ${space?.name ?? 'current hall'} capacity`
            : `${space?.capacity ?? 0} current · ${maximumCapacity} maximum`,
        icon: Users,
        progress: Math.min(
          100,
          Math.round((registrationCount / Math.max(maximumCapacity, 1)) * 100),
        ),
        critical: currentCapacityExceeded,
      },
      {
        label: budgetForecastActive ? 'Budget forecast' : 'Budget used',
        value: money(budgetForecastActive ? budgetForecast : event.currentCost),
        detail: projectedBudgetOver
          ? `${money(budgetForecast - event.budget)} over budget if authorized`
          : pendingPlanCost
            ? `${money(pendingPlanCost)} pending authorization · ${money(event.currentCost)} committed`
            : minimumResourceExposure
              ? `${money(minimumResourceExposure)} minimum catering exposure · EVA decision pending`
              : budgetOver
                ? `${money(event.currentCost - event.budget)} over budget`
                : `${money(event.budget - event.currentCost)} available`,
        icon: Banknote,
        progress: Math.min(
          100,
          Math.round(
            ((budgetForecastActive ? budgetForecast : event.currentCost) /
              event.budget) *
              100,
          ),
        ),
        critical: projectedBudgetOver,
      },
      {
        label: 'Readiness',
        value: `${operationalReadiness}%`,
        detail:
          operationalRisks.length > 0
            ? `${operationalRisks.length} active risks reducing readiness`
            : evaState === 'Resolved'
              ? 'Verified stable'
              : 'Across all operations',
        icon: Gauge,
        progress: operationalReadiness,
      },
      {
        label: 'Open risks',
        value: String(riskCount),
        detail: riskCount ? 'Operational intervention required' : 'No blockers',
        icon: ShieldAlert,
        progress: riskCount ? 58 : 100,
        critical: riskCount > 0,
      },
    ];
  }, [
    budgetOver,
    capacityReached,
    currentCapacityExceeded,
    event,
    evaState,
    budgetForecast,
    budgetForecastActive,
    maximumCapacity,
    minimumResourceExposure,
    operationalRisks.length,
    operationalReadiness,
    pendingPlanCost,
    projectedBudgetOver,
    registrationCount,
    space,
  ]);

  const navigation: { name: PageName; icon: typeof LayoutDashboard }[] = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Events', icon: CalendarDays },
    { name: 'Timeline', icon: Clock3 },
    { name: 'Tasks', icon: ClipboardCheck },
    { name: 'Resources', icon: PackageCheck },
    { name: 'Staff Operations', icon: Users },
    { name: 'Catering Operations', icon: Utensils },
    { name: 'Live Ops', icon: Activity },
    { name: 'Budget', icon: Banknote },
    { name: 'Risks', icon: ShieldAlert },
    { name: 'EVA Activity', icon: Sparkles },
    { name: 'Communications', icon: Mail },
    { name: 'Settings', icon: Settings },
  ];

  const renderPage = () => {
    if (page === 'Events')
      return <EventsPage database={database} onSelect={switchEvent} />;
    if (page === 'Timeline') return <TimelinePage event={event} />;
    if (page === 'Tasks') return <TasksPage tasks={tasks} />;
    if (page === 'Resources') return <ResourcesPage database={database} />;
    if (page === 'Staff Operations') return <StaffOperationsPage staff={staff} onAssignment={(id: string, assignment: string) => setDatabase((current) => ({ ...current, staff: current.staff.map((record) => record.id === id ? { ...record, currentAssignment: assignment, availability: assignment === 'Available pool' ? 'Available' : 'Assigned', zone: assignment === 'Available pool' ? 'Operations Hub' : assignment } : record) }))} />;
    if (page === 'Catering Operations') return <CateringOperationsPage catering={catering} requirements={mealRequirements} confirmed={registrationCount} staff={staff} incident={latestIncident} onMealShortage={runMealScenario} onVendorDelay={triggerCatering} busy={busy} />;
    if (page === 'Live Ops')
      return (
        <LiveOpsPage
          entrances={entrances}
          feedback={feedback.map((item) => item.message)}
          onRun={runCheckinScenario}
          busy={busy}
          incident={latestIncident}
        />
      );
    if (page === 'Budget')
      return (
        <BudgetPage
          event={event}
          forecastCost={budgetForecast}
          exposure={minimumResourceExposure}
          planPending={pendingPlanCost > 0}
        />
      );
    if (page === 'Risks')
      return <RisksPage plan={plan} operationalRisks={operationalRisks} />;
    if (page === 'EVA Activity') return <ActivityPage activity={activity} />;
    if (page === 'Communications') return <CommunicationsPage communications={database.communications.filter((item) => item.eventId === event.id)} eventName={event.name} />;
    if (page === 'Settings')
      return (
        <SettingsPage
          database={database}
          eventId={event.id}
          registrationCount={registrationCount}
          maximumCapacity={maximumCapacity}
          onAdd={addRegistrations}
          onCatering={triggerCatering}
          onMealShortage={runMealScenario}
          onCheckin={runCheckinScenario}
          busy={busy}
          decisionPending={plan?.status === 'approval_required'}
          onPermission={(key: PermissionKey, automatic: boolean) =>
            setDatabase((current) => ({
              ...current,
              permissions: {
                ...current.permissions,
                [key]: automatic ? 'automatic' : 'approval',
              },
            }))
          }
          onReset={() => {
            resetDatabase();
            setPlan(null);
            setEvaState('Monitoring');
          }}
          gmailStatus={gmailStatus}
          gmailBusy={gmailBusy}
          onConnectGmail={connectGmail}
          onDisconnectGmail={disconnectGmail}
        />
      );
    return (
      <DashboardPage
        event={event}
        spaceName={space?.name ?? 'Unassigned'}
        capacity={space?.capacity ?? 0}
        registrationCount={registrationCount}
        maximumCapacity={maximumCapacity}
        operationalRisks={operationalRisks}
        kpis={kpis}
        entrances={entrances}
        activity={activity}
        plan={plan}
      />
    );
  };

  const displayedEvaState: EvaState =
    plan?.status === 'approval_required'
      ? 'Decision Needed'
      : plan?.status === 'error' || plan?.status === 'ai_unavailable'
        ? 'Critical'
        : plan?.status === 'resolved'
          ? 'Resolved'
          : budgetOver || capacityReached
      ? 'Critical'
      : operationalRisks.length > 0
        ? 'Investigating'
        : evaState;

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#18212f]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[224px] border-r border-[#e7e9ee] bg-white xl:flex xl:flex-col">
        <div className="flex h-[68px] items-center gap-3 border-b border-[#edf0f3] px-5">
          <div className="grid size-9 place-items-center rounded-xl bg-[#111827] text-sm font-bold text-white">
            EO
          </div>
          <div>
            <p className="font-semibold">EventOS</p>
            <p className="text-xs text-[#8a93a3]">Operations control</p>
          </div>
        </div>
        <nav className="space-y-1 p-3 pt-5">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => setPage(name)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${page === name ? 'bg-[#eef2ff] text-[#4f46e5]' : 'text-[#6b7280] hover:bg-[#f5f6f8] hover:text-[#18212f]'}`}
            >
              <Icon size={17} />
              {name}
              {name === 'Risks' && Number(kpis[3].value) > 0 && (
                <span className="ml-auto rounded-full bg-red-600 px-1.5 text-[11px] text-white">
                  {kpis[3].value}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-[#edf0f3] p-4">
          <p className="text-xs text-[#9aa1ae]">Plan with EventOS.</p>
          <p className="text-sm font-semibold">Run it with EVA.</p>
        </div>
      </aside>

      <div className={`xl:ml-[224px] ${evaCollapsed ? '' : '2xl:mr-[348px]'}`}>
        <header className="sticky top-0 z-20 flex min-h-[68px] items-center justify-between gap-4 border-b border-[#e7e9ee] bg-white/95 px-5 backdrop-blur md:px-8">
          <div>
            <p className="text-xs text-[#8a93a3]">
              {event.type} · {event.location}
            </p>
            <h1 className="font-semibold">{page}</h1>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Event switcher"
              value={event.id}
              onChange={(e) => switchEvent(e.target.value)}
              className="h-10 max-w-[230px] rounded-lg border border-[#e0e3e8] bg-white px-3 text-sm font-medium outline-none focus:border-[#6366f1]"
            >
              {database.events.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span
              className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:block ${stateTone[busy ? 'Investigating' : displayedEvaState]}`}
            >
              EVA · {busy ? 'Investigating' : displayedEvaState}
            </span>
            {evaCollapsed && (
              <button
                aria-label="Open EVA panel"
                onClick={() => setEvaCollapsed(false)}
                className="relative size-10 overflow-hidden rounded-lg border-2 border-[#6366f1] bg-[#4f46e5]"
              >
                <img src="/eva.png" alt="EVA" className="size-full object-cover" />
              </button>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1450px] p-5 md:p-8">
          {renderPage()}
        </main>
      </div>

      {!evaCollapsed && (
        <EvaPanel
          state={displayedEvaState}
          busy={busy}
          plan={plan}
          activity={activity}
          riskCount={operationalRisks.length}
          connection={plan?.connection ?? evaConnection}
          onCollapse={() => setEvaCollapsed(true)}
          onApprove={approvePlan}
          onModify={modifyPlan}
          onReject={rejectPlan}
          onRetry={retryEva}
        />
      )}
    </div>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-[#7c8593]">{subtitle}</p>
    </div>
  );
}
function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-[#e5e7eb] bg-white ${className}`}
    >
      {children}
    </section>
  );
}

function DashboardPage({
  event,
  spaceName,
  capacity,
  registrationCount,
  maximumCapacity,
  operationalRisks,
  kpis,
  entrances,
  activity,
  plan,
}: any) {
  const budgetOver = event.currentCost > event.budget;
  const capacityReached = registrationCount >= maximumCapacity;
  const hasHighRisk = operationalRisks.some(
    (risk: OperationalRiskRecord) => risk.severity === 'high',
  );
  const resources = [
    [
      MapPin,
      spaceName,
      `${registrationCount} / ${capacity} seats`,
      registrationCount <= capacity,
    ],
    [
      Utensils,
      `${event.meals} meals`,
      `Delivery ${event.cateringArrival}`,
      event.meals >= registrationCount,
    ],
    [
      BadgeCheck,
      `${event.badges} badges`,
      `${event.staff} staff assigned`,
      event.badges >= registrationCount,
    ],
  ];
  return (
    <>
      <PageTitle
        title={event.name}
        subtitle={`${event.date} · ${event.location}`}
      />
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {kpis.map((kpi: any) => (
          <Card
            key={kpi.label}
            className={`p-5 ${kpi.critical ? 'border-red-300 bg-red-50/60' : ''}`}
          >
            <div
              className={`flex items-center justify-between text-sm ${kpi.critical ? 'text-red-700' : 'text-[#7c8593]'}`}
            >
              <span>{kpi.label}</span>
              <kpi.icon size={17} />
            </div>
            <p
              className={`mt-4 text-2xl font-semibold ${kpi.critical ? 'text-red-700' : ''}`}
            >
              {kpi.value}
            </p>
            <Progress
              value={kpi.progress}
              className={`mt-4 h-1.5 ${kpi.critical ? '[&>div]:bg-red-600' : '[&>div]:bg-[#4f46e5]'}`}
            />
            <p
              className={`mt-2 text-xs ${kpi.critical ? 'font-medium text-red-700' : 'text-[#929aa7]'}`}
            >
              {kpi.detail}
            </p>
          </Card>
        ))}
      </div>
      {(plan || operationalRisks.length > 0) && (
        <Card
          className={`mt-5 p-5 ${hasHighRisk ? 'border-red-300 bg-red-50/70' : 'border-orange-200 bg-orange-50/40'}`}
        >
          <div className="flex gap-3">
            <AlertTriangle
              className={hasHighRisk ? 'text-red-600' : 'text-orange-600'}
            />
            <div>
              <p className="font-semibold">
                {capacityReached
                  ? `Registration intake is closed at the ${maximumCapacity}-seat venue limit.`
                  : budgetOver
                    ? `Budget exceeded by ${money(event.currentCost - event.budget)}.`
                    : (plan?.detected ??
                      `EVA detected ${operationalRisks.length} live operational risks.`)}
              </p>
              <p className="mt-1 text-sm text-[#747d8b]">
                {plan ? plan.decision : operationalRisks[0]?.detail}
              </p>
            </div>
          </div>
        </Card>
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="p-5">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-semibold">Event timeline</p>
              <p className="text-xs text-[#9098a5]">
                Protected milestones stay fixed
              </p>
            </div>
            <span className="text-xs text-[#6366f1]">
              {event.timeline.length} activities
            </span>
          </div>
          <div className="mt-6 flex min-w-[620px] overflow-x-auto">
            {event.timeline.map((slot: any) => (
              <div key={slot.id} className="flex-1">
                <div className="flex items-center">
                  <span className="size-2.5 rounded-full bg-[#6366f1]" />
                  <span className="h-px flex-1 bg-[#e5e7eb]" />
                </div>
                <p className="mt-3 text-xs font-semibold">{slot.name}</p>
                <p className="text-[11px] text-[#929aa7]">{slot.time}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold">Resource status</p>
          <div className="mt-4 space-y-3">
            {resources.map(([Icon, label, detail, healthy]: any) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-lg p-3 ${healthy ? 'bg-[#f7f8fa]' : 'bg-red-50'}`}
              >
                <div
                  className={`grid size-8 place-items-center rounded-lg bg-white ${healthy ? 'text-[#6366f1]' : 'text-red-600'}`}
                >
                  <Icon size={15} />
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p
                    className={`text-xs ${healthy ? 'text-[#929aa7]' : 'text-red-700'}`}
                  >
                    {detail}
                  </p>
                </div>
                {healthy ? (
                  <Check className="ml-auto text-emerald-500" size={15} />
                ) : (
                  <AlertTriangle className="ml-auto text-red-600" size={15} />
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Attendee check-in</p>
              <p className="text-xs text-[#9098a5]">
                Live QR scanning operations
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Live
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {entrances.map((entrance: any) => (
              <div
                key={entrance.id}
                className={`rounded-lg border p-3 ${entrance.status === 'Congested' ? 'border-red-200 bg-red-50/50' : 'border-[#eceef1]'}`}
              >
                <p className="text-xs text-[#8b94a2]">{entrance.name}</p>
                <p className="mt-2 text-lg font-semibold">
                  {entrance.waitMinutes} min
                </p>
                <p className="text-xs text-[#929aa7]">
                  {entrance.attendeesWaiting} waiting · {entrance.activeLanes}{' '}
                  lanes
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">EVA operation</p>
              <p className="text-xs text-[#9098a5]">
                Current case, decision, execution, and verification
              </p>
            </div>
            <Sparkles size={17} className="text-[#4f46e5]" />
          </div>
          {plan ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <WorkItem label="Detected" value={plan.detected} />
              <WorkItem
                label="Investigated"
                value={
                  plan.investigations.join(', ') ||
                  'Waiting for AI investigation'
                }
              />
              <WorkItem label="Decision" value={plan.decision} />
              <WorkItem
                label="Actions"
                value={
                  plan.actions.length
                    ? plan.actions.map(actionDelta).join(' · ')
                    : 'No action selected'
                }
              />
              <WorkItem
                label="Authorization"
                value={
                  plan.status === 'approval_required'
                    ? 'Organizer decision required'
                    : plan.status === 'error' ||
                        plan.status === 'ai_unavailable'
                      ? 'EVA connection required'
                      : 'Within EVA permissions'
                }
              />
              <WorkItem label="Verification" value={plan.verification} />
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-[#f7f8fa] p-4 text-sm text-[#7c8593]">
              {activity[0]?.detail ??
                'No active EVA case. Monitoring continues.'}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function WorkItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f7f8fa] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#929aa7]">
        {label}
      </p>
      <p className="mt-1 text-sm leading-5 text-[#344054]">{value}</p>
    </div>
  );
}

function EventsPage({
  database,
  onSelect,
}: {
  database: DemoDatabase;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <PageTitle
        title="Events"
        subtitle="One operating system for every event format."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {database.events.map((event) => {
          const count = selectRegistrations(database, event.id).length;
          return (
            <Card key={event.id} className="p-5">
              <div className="flex items-start justify-between">
                <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-medium text-[#4f46e5]">
                  {event.type}
                </span>
                <span className="text-xs text-[#8b94a2]">
                  {event.readiness}% ready
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{event.name}</h3>
              <p className="mt-1 text-sm text-[#7c8593]">
                {event.date} · {event.location}
              </p>
              <div className="mt-5 flex gap-6 text-sm">
                <span>
                  <b>{count}</b> registrations
                </span>
                <span>
                  <b>{money(event.currentCost)}</b> used
                </span>
              </div>
              <Button
                onClick={() => onSelect(event.id)}
                variant="outline"
                className="mt-5"
              >
                Open event <ArrowRight />
              </Button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
function TimelinePage({ event }: any) {
  return (
    <>
      <PageTitle title="Timeline" subtitle={`${event.name} · ${event.date}`} />
      <Card className="divide-y divide-[#eceef1]">
        {event.timeline.map((slot: any, i: number) => (
          <div
            key={slot.id}
            className="grid grid-cols-[72px_1fr_auto] items-center gap-4 p-5"
          >
            <span className="text-sm font-semibold text-[#4f46e5]">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <p className="font-medium">{slot.name}</p>
              <p className="text-sm text-[#8b94a2]">{slot.time}</p>
            </div>
            {slot.protected && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                Protected
              </span>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
function TasksPage({ tasks }: any) {
  return (
    <>
      <PageTitle
        title="Tasks"
        subtitle="Work coordinated across event teams."
      />
      <Card className="divide-y divide-[#eceef1]">
        {tasks.length ? (
          tasks.map((task: any) => (
            <div key={task.id} className="flex items-center gap-4 p-5">
              <ClipboardCheck className="text-[#6366f1]" size={18} />
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-sm text-[#8b94a2]">{task.owner}</p>
              </div>
              <span className="ml-auto rounded-full bg-[#f4f5f7] px-2.5 py-1 text-xs">
                {task.status}
              </span>
            </div>
          ))
        ) : (
          <p className="p-8 text-sm text-[#8b94a2]">
            No tasks for this demo event.
          </p>
        )}
      </Card>
    </>
  );
}
function ResourcesPage({ database }: { database: DemoDatabase }) {
  const event = selectEvent(database);
  const venue = database.venues.find((v) => v.id === event.venueId);
  const spaces = database.spaces.filter((s) => s.venueId === event.venueId);
  return (
    <>
      <PageTitle
        title="Resources"
        subtitle={`${venue?.name ?? 'Venue'} · ${venue?.location ?? event.location}`}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {spaces.map((space) => (
          <Card key={space.id} className="p-5">
            <div className="flex justify-between">
              <div className="grid size-9 place-items-center rounded-lg bg-[#eef2ff] text-[#4f46e5]">
                <MapPin size={17} />
              </div>
              <span className="text-sm font-semibold">{space.capacity}</span>
            </div>
            <p className="mt-4 font-semibold">{space.name}</p>
            <p className="text-sm text-[#8b94a2]">{space.purpose}</p>
          </Card>
        ))}
      </div>
    </>
  );
}

function IncidentOutcome({ incident }: { incident: any }) {
  if (!incident) return null;
  const resolved = incident.status === 'Resolved';
  return (
    <Card className={`p-5 ${resolved ? 'border-emerald-200 bg-emerald-50/40' : incident.status === 'Escalated' ? 'border-red-200 bg-red-50/40' : 'border-blue-200 bg-blue-50/40'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-[#7c8593]">Incident command</p><h3 className="mt-1 text-lg font-semibold">{incident.title}</h3><p className="mt-1 text-xs text-[#8b94a2]">Detected {incident.createdAt} · {incident.severity} severity</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${resolved ? 'bg-emerald-100 text-emerald-800' : incident.lifecycle === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{incident.lifecycle?.replaceAll('_', ' ') ?? incident.status}</span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-lg bg-white/80 p-3"><p className="text-xs font-semibold uppercase text-[#7c8593]">Operational impact</p><p className="mt-1 text-sm text-[#344054]">{incident.impact}</p></div><div className="rounded-lg bg-white/80 p-3"><p className="text-xs font-semibold uppercase text-[#7c8593]">EVA analysis</p><p className="mt-1 text-sm text-[#344054]">{incident.analysis}</p></div></div>
      <p className="mt-3 rounded-lg bg-white/80 p-3 text-sm font-semibold text-[#344054]">{incident.policyStatus}</p>
      {incident.recoveryPlan?.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider text-[#7c8593]">Recovery plan & actions</p><div className="mt-2 space-y-1.5">{incident.recoveryPlan.map((item: string) => <p key={item} className="flex gap-2 rounded-md bg-white/70 px-3 py-2 text-xs text-[#667085]"><Check size={13} className="mt-0.5 shrink-0 text-[#4f46e5]"/>{item}</p>)}</div></div>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{incident.metrics.map((metric: any) => <div key={metric.label} className="rounded-lg border border-white bg-white/80 p-3"><p className="text-xs text-[#8b94a2]">{metric.label}</p><p className="mt-1 text-sm"><span className="text-[#98a2b3] line-through">{metric.before}</span><ArrowRight className="mx-2 inline" size={13}/><b>{metric.after}</b></p></div>)}</div>
      {incident.evidence.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider text-[#7c8593]">Evidence inspected</p><div className="mt-2 space-y-1.5">{incident.evidence.map((item: string) => <p key={item} className="rounded-md bg-white/70 px-3 py-2 text-xs text-[#667085]">{item}</p>)}</div></div>}
      {incident.verificationResult && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><b>Verification:</b> {incident.verificationResult}</p>}
    </Card>
  );
}

function StaffOperationsPage({ staff, onAssignment }: any) {
  return <><PageTitle title="Staff Operations" subtitle="Named staff availability and live assignments used by EVA."/><Card className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b bg-[#f7f8fa] text-xs text-[#667085]"><tr>{['Name','Role','Zone','Shift','Availability','Current assignment','Assignment control'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y">{staff.map((record: any) => <tr key={record.id}><td className="px-4 py-4 font-medium">{record.name}</td><td className="px-4 py-4">{record.role}</td><td className="px-4 py-4">{record.zone}</td><td className="px-4 py-4">{record.shift}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs ${record.availability === 'Available' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{record.availability}</span></td><td className="px-4 py-4">{record.currentAssignment}</td><td className="px-4 py-4"><select aria-label={`Assignment for ${record.name}`} value={record.currentAssignment === 'Available pool' ? 'Available pool' : record.zone} onChange={(event) => onAssignment(record.id, event.target.value)} className="rounded-md border border-[#d0d5dd] bg-white px-2 py-1.5 text-xs"><option>Available pool</option><option>North Entrance</option><option>East Entrance</option><option>Catering</option></select></td></tr>)}</tbody></table></Card></>;
}

function CateringOperationsPage({ catering, requirements, confirmed, staff, incident, onMealShortage, onVendorDelay, busy }: any) {
  if (!catering) return <Card className="p-8">No catering record is configured for this event.</Card>;
  const labels: Record<string,string> = { standard: 'Standard', vegetarian: 'Vegetarian', vegan: 'Vegan', halal: 'Halal', allergySensitive: 'Allergy-sensitive' };
  const shortage = Math.max(0, confirmed - catering.totalMeals);
  const assigned = staff.filter((record: any) => catering.assignedStaffIds.includes(record.id));
  return <><div className="flex flex-wrap items-start justify-between gap-3"><PageTitle title="Catering Operations" subtitle="Live meal readiness, vendor delivery, staffing, and budget controls."/><div className="flex gap-2"><Button variant="outline" disabled={busy || confirmed !== 118} onClick={onMealShortage}><Utensils/> Simulate meal shortage</Button><Button variant="outline" disabled={busy || incident?.type === 'vendor_delay'} onClick={onVendorDelay}><Clock3/> Simulate vendor delay</Button></div></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Card className="p-4"><p className="text-xs text-[#8b94a2]">Confirmed attendees</p><p className="mt-1 text-2xl font-semibold">{confirmed}</p><p className="text-xs text-[#667085]">Meals required: {confirmed}</p></Card><Card className="p-4"><p className="text-xs text-[#8b94a2]">Meals available</p><p className="mt-1 text-2xl font-semibold">{catering.totalMeals}</p><p className={`text-xs ${shortage ? 'text-red-600' : 'text-emerald-600'}`}>{shortage ? `${shortage} meal shortage` : `${catering.totalMeals-confirmed} surplus · covered`}</p></Card><Card className="p-4"><p className="text-xs text-[#8b94a2]">Delivery</p><p className="mt-1 font-semibold">{catering.deliveryStatus} · {catering.expectedArrival}</p><p className="text-xs text-[#667085]">Serving time {catering.servingTime}</p></Card><Card className="p-4"><p className="text-xs text-[#8b94a2]">Additional cost</p><p className="mt-1 text-xl font-semibold">{money(catering.estimatedAdditionalCost)}</p><p className="text-xs text-[#667085]">Vendor: {catering.vendor}</p></Card></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2"><Card className="p-5"><p className="font-semibold">Meal mix</p><div className="mt-4 space-y-3">{Object.entries(catering.meals).map(([key,value]) => <div key={key} className="flex items-center justify-between rounded-lg bg-[#f7f8fa] p-3 text-sm"><span>{labels[key]}</span><b>{String(value)} available / {requirements[key]} required</b></div>)}</div></Card><Card className="p-5"><p className="font-semibold">Operational coverage</p><div className="mt-4 space-y-3 text-sm"><p><b>Vendor capacity:</b> {catering.vendorCapacity} meals</p><p><b>Assigned staff:</b> {assigned.map((record: any) => record.name).join(', ') || 'None'}</p><p><b>Vendor update:</b> {catering.internalVendorUpdate}</p><p><b>Food risks:</b> {shortage ? `Short by ${shortage} meals` : catering.deliveryStatus === 'Delayed' ? 'Delivery may miss service time' : 'No active food coverage risk'}</p></div></Card></div>
    <div className="mt-4"><IncidentOutcome incident={incident && (incident.type === 'meal_shortage' || incident.type === 'vendor_delay') ? incident : null}/></div>
  </>;
}
function LiveOpsPage({ entrances, feedback, onRun, busy, incident }: any) {
  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <PageTitle
          title="Live Ops"
          subtitle="Real-time QR check-in, queues, staffing, and arrival flow."
        />
        <Button
          disabled={busy || !entrances.length || Boolean(incident)}
          onClick={onRun}
          className="bg-[#4f46e5] text-white"
        >
          <Sparkles /> {busy ? 'EVA investigating' : 'Simulate check-in queue'}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {entrances.map((entrance: any) => (
          <Card
            key={entrance.id}
            className={`p-5 ${entrance.status === 'Congested' ? 'border-red-200 bg-red-50/30' : ''}`}
          >
            <div className="flex justify-between">
              <div className="grid size-9 place-items-center rounded-lg bg-[#f4f5f7]">
                <CircleDot size={17} />
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs ${entrance.status === 'Congested' ? 'bg-red-100 text-red-700' : entrance.status === 'Busy' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
              >
                {entrance.status}
              </span>
            </div>
            <h3 className="mt-5 font-semibold">{entrance.name}</h3>
            <p className="mt-1 text-2xl font-semibold">
              {entrance.waitMinutes} min wait
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <span>{entrance.attendeesWaiting} waiting</span>
              <span>
                {entrance.activeLanes}/{entrance.maxLanes} lanes
              </span>
              <span>{entrance.assignedStaff} assigned</span>
              <span>{entrance.availableStaff} available</span>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <p className="font-semibold">Attendee feedback</p>
          <div className="mt-4 space-y-3">
            {feedback.map((message: string) => (
              <div
                key={message}
                className="rounded-lg bg-[#f7f8fa] p-3 text-sm"
              >
                “{message}”
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <p className="font-semibold">Check-in capacity</p>
          <div className="mt-4 space-y-3">
            {entrances.map((entrance: any) => (
              <div
                key={entrance.id}
                className="flex justify-between border-b border-[#eceef1] pb-3 text-sm"
              >
                <span className="text-[#7c8593]">{entrance.name}</span>
                <b>{entrance.activeLanes} active QR lanes</b>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-5"><IncidentOutcome incident={incident}/></div>
    </>
  );
}
function BudgetPage({
  event,
  forecastCost,
  exposure,
  planPending,
}: {
  event: any;
  forecastCost: number;
  exposure: number;
  planPending: boolean;
}) {
  const used = Math.round((event.currentCost / event.budget) * 100);
  const over = Math.max(0, event.currentCost - event.budget);
  const forecastOver = Math.max(0, forecastCost - event.budget);
  return (
    <>
      <PageTitle
        title="Budget"
        subtitle="Committed spend, controls, and approval thresholds."
      />
      {over > 0 && (
        <Card className="mb-5 border-red-300 bg-red-50 p-5">
          <div className="flex gap-3 text-red-800">
            <ShieldAlert />
            <div>
              <p className="font-semibold">
                Budget limit exceeded by {money(over)}
              </p>
              <p className="mt-1 text-sm">
                EVA has flagged this as a critical financial exception. Further
                discretionary spend requires organizer approval.
              </p>
            </div>
          </div>
        </Card>
      )}
      <Card className={`p-6 ${over > 0 ? 'border-red-300' : ''}`}>
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-[#8b94a2]">Committed spend</p>
            <p
              className={`mt-2 text-3xl font-semibold ${over > 0 ? 'text-red-700' : ''}`}
            >
              {money(event.currentCost)}
            </p>
          </div>
          <p
            className={`text-sm font-semibold ${over > 0 ? 'text-red-700' : ''}`}
          >
            {used}%
          </p>
        </div>
        <Progress
          value={Math.min(100, used)}
          className={`mt-6 h-2 ${over > 0 ? '[&>div]:bg-red-600' : '[&>div]:bg-[#4f46e5]'}`}
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-[#f7f8fa] p-4">
            <p className="text-xs text-[#8b94a2]">Total budget</p>
            <p className="mt-1 font-semibold">{money(event.budget)}</p>
          </div>
          <div
            className={`rounded-lg p-4 ${over > 0 ? 'bg-red-50' : 'bg-[#f7f8fa]'}`}
          >
            <p
              className={`text-xs ${over > 0 ? 'text-red-700' : 'text-[#8b94a2]'}`}
            >
              {over > 0 ? 'Over budget' : 'Available'}
            </p>
            <p
              className={`mt-1 font-semibold ${over > 0 ? 'text-red-700' : ''}`}
            >
              {money(over > 0 ? over : event.budget - event.currentCost)}
            </p>
          </div>
          <div className="rounded-lg bg-[#f7f8fa] p-4">
            <p className="text-xs text-[#8b94a2]">Approval threshold</p>
            <p className="mt-1 font-semibold">AED 500</p>
          </div>
        </div>
        {(exposure > 0 || planPending) && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              {planPending ? 'EVA plan forecast' : 'Live operational exposure'}
            </p>
            <p className="mt-1 text-lg font-semibold text-[#1d2939]">
              {money(forecastCost)}
            </p>
            <p className="mt-1 text-sm text-[#7c5a16]">
              {planPending
                ? 'Forecast after the proposed recovery plan is authorized.'
                : `${money(exposure)} minimum catering exposure from the current shortage. Venue and staffing costs require EVA’s decision.`}
              {forecastOver > 0
                ? ` This would exceed the budget by ${money(forecastOver)}.`
                : ''}
            </p>
          </div>
        )}
      </Card>
    </>
  );
}
function RisksPage({
  operationalRisks,
}: {
  plan: EvaDecision | null;
  operationalRisks: OperationalRiskRecord[];
}) {
  const risks = operationalRisks;
  return (
    <>
      <PageTitle
        title="Risks"
        subtitle="Live exceptions derived directly from event data."
      />
      {risks.length ? (
        <div className="space-y-4">
          {risks.map((r) => (
            <Card
              key={r.label}
              className={`p-5 ${r.severity === 'high' ? 'border-red-200 bg-red-50/40' : ''}`}
            >
              <div className="flex gap-3">
                <AlertTriangle
                  className={
                    r.severity === 'high' ? 'text-red-600' : 'text-amber-500'
                  }
                  size={18}
                />
                <div>
                  <p className="font-semibold">{r.label}</p>
                  <p className="mt-1 text-sm text-[#7c8593]">{r.detail}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="grid place-items-center p-12 text-center">
          <Check className="text-emerald-500" />
          <p className="mt-3 font-semibold">No open risks</p>
          <p className="text-sm text-[#8b94a2]">
            EVA is continuing to monitor the event.
          </p>
        </Card>
      )}
    </>
  );
}
function ActivityPage({ activity }: any) {
  return (
    <>
      <PageTitle
        title="EVA Activity"
        subtitle="Meaningful decisions, actions, and verification—not hidden reasoning."
      />
      <Card className="divide-y divide-[#eceef1]">
        {activity.map((item: any) => (
          <div key={item.id} className="flex gap-4 p-5">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef2ff] text-[#4f46e5]">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-[#8b94a2]">{item.detail}</p>
            </div>
            <span className="ml-auto text-xs text-[#a0a7b2]">
              {item.createdAt}
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}
function CommunicationsPage({ communications, eventName }: { communications: CommunicationRecord[]; eventName: string }) {
  const tones: Record<CommunicationRecord['status'], string> = {
    pending: 'bg-amber-50 text-amber-700', sent: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-red-50 text-red-700', rejected: 'bg-slate-100 text-slate-600',
  };
  const counts = (['pending', 'sent', 'failed', 'rejected'] as const).map((status) => ({ status, count: communications.filter((item) => item.status === status).length }));
  return <>
    <PageTitle title="Communications" subtitle={`Approval-gated operational messages for ${eventName}.`}/>
    <div className="grid gap-3 sm:grid-cols-4">{counts.map(({status,count}) => <Card key={status} className="p-4"><p className="text-xs capitalize text-[#8b94a2]">{status === 'pending' ? 'Pending approval' : status}</p><p className="mt-1 text-2xl font-semibold">{count}</p></Card>)}</div>
    <div className="mt-5 space-y-3">
      {!communications.length && <Card className="p-10 text-center"><Mail className="mx-auto text-[#9aa1ae]"/><p className="mt-3 font-semibold">No operational communications yet</p><p className="mt-1 text-sm text-[#8b94a2]">Run the vendor-delay demo to let EVA investigate and draft a vendor email.</p></Card>}
      {communications.map((item) => <Card key={item.id} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Mail size={16} className="text-[#4f46e5]"/><p className="font-semibold">{item.subject}</p></div><p className="mt-1 text-sm text-[#667085]">To: {item.to}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${tones[item.status]}`}>{item.status === 'pending' ? 'Pending approval' : item.status}</span></div>
        <p className="mt-4 whitespace-pre-wrap rounded-lg bg-[#f7f8fa] p-4 text-sm leading-6 text-[#475467]">{item.body}</p>
        <div className="mt-4 grid gap-3 text-xs text-[#667085] sm:grid-cols-3"><p><b>Reason:</b> {item.reason}</p><p><b>Approval:</b> {item.approvalStatus}</p><p><b>Updated:</b> {new Date(item.updatedAt).toLocaleString()}</p></div>
        {item.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{item.error}</p>}
      </Card>)}
    </div>
  </>;
}

function SettingsPage({
  database,
  eventId,
  registrationCount,
  maximumCapacity,
  onAdd,
  onCatering,
  onMealShortage,
  onCheckin,
  busy,
  decisionPending,
  onPermission,
  onReset,
  gmailStatus,
  gmailBusy,
  onConnectGmail,
  onDisconnectGmail,
}: any) {
  const automatic: [PermissionKey, string][] = [
    ['createTasks', 'Create tasks'],
    ['reassignResources', 'Reassign internal resources'],
    ['updateOperationalData', 'Update operational data'],
    ['notifyStaff', 'Notify staff'],
  ];
  const approvals: [PermissionKey, string][] = [
    ['changeVenue', 'Change hall or venue'],
    ['spendOver500', 'Spend over AED 500'],
    ['changeMainSchedule', 'Change main schedule'],
    ['notifyAllAttendees', 'Notify all attendees'],
    ['replaceKeynote', 'Replace keynote speaker'],
  ];
  const registrationStatus =
    database.events.find((item: any) => item.id === eventId)
      ?.registrationStatus ?? 'open';
  const locked = registrationStatus !== 'open' || decisionPending;
  const full = registrationStatus === 'closed';
  return (
    <>
      <PageTitle
        title="Settings"
        subtitle="EVA permissions and safe hackathon controls."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-600"><Mail size={19}/></div>
              <div><p className="font-semibold">Gmail</p><p className="text-sm text-[#8b94a2]">{gmailStatus?.message ?? 'Checking secure server connection…'}</p></div>
            </div>
            {gmailStatus?.connected ? (
              <Button variant="outline" disabled={gmailBusy} onClick={onDisconnectGmail}>Disconnect</Button>
            ) : (
              <Button disabled={gmailBusy || !gmailStatus?.configured} onClick={onConnectGmail}><Mail/> Connect Gmail</Button>
            )}
          </div>
          {!gmailStatus?.configured && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Gmail integration is not configured. EVA can still investigate, draft communications, run internal recovery actions, and log the failed send truthfully.</p>}
        </Card>
        <Card className="p-5">
          <p className="font-semibold">EVA permissions</p>
          <p className="mt-1 text-sm text-[#8b94a2]">
            Automatic actions are restricted to internal operations.
          </p>
          <div className="mt-5 space-y-3">
            {automatic.map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg bg-[#f7f8fa] p-3"
              >
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-emerald-600">Automatic</p>
                </div>
                <Switch
                  checked={database.permissions[key] === 'automatic'}
                  onCheckedChange={(v) => onPermission(key, v)}
                />
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[#9aa1ae]">
            Approval required
          </p>
          <div className="mt-3 space-y-3">
            {approvals.map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-[#eceef1] p-3"
              >
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-amber-600">Organizer approval</p>
                </div>
                <Switch
                  checked={database.permissions[key] === 'automatic'}
                  onCheckedChange={(v) => onPermission(key, v)}
                />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <p className="font-semibold">Demo Controls</p>
          <p className="mt-1 text-sm text-[#8b94a2]">
            Each control changes event data, then sends EVA one generic signal.
          </p>
          {eventId === 'hackathon' ? (
            <>
              {locked && (
                <div
                  className={`mt-5 rounded-lg border p-4 ${full ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}
                >
                  <p
                    className={`text-sm font-semibold ${full ? 'text-red-800' : 'text-amber-800'}`}
                  >
                    {full
                      ? 'Registration closed'
                      : 'Registration paused by EVA'}
                  </p>
                  <p
                    className={`mt-1 text-xs ${full ? 'text-red-700' : 'text-amber-700'}`}
                  >
                    {full
                      ? `${registrationCount} / ${maximumCapacity} seats confirmed. No larger configured hall is available.`
                      : 'An EVA decision is awaiting organizer authorization.'}
                  </p>
                </div>
              )}
              <div className="mt-5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#9aa1ae]">
                  Registration records
                </p>
                <span
                  className={`text-xs font-medium ${locked ? 'text-red-700' : 'text-[#7c8593]'}`}
                >
                  {registrationCount} / {maximumCapacity}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[1, 5, 20].map((n) => (
                  <Button
                    key={n}
                    disabled={locked || busy}
                    variant="outline"
                    onClick={() => onAdd(n)}
                  >
                    <Plus /> {n} Registration{n > 1 ? 's' : ''}
                  </Button>
                ))}
              </div>
              <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[#9aa1ae]">
                Operational signals
              </p>
              <div className="mt-3 space-y-2">
                <Button
                  disabled={busy || registrationCount !== 118}
                  onClick={onMealShortage}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Utensils /> Simulate Meal Shortage
                </Button>
                <Button
                  disabled={busy}
                  onClick={onCatering}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Utensils /> Simulate Vendor Delay
                </Button>
                <Button
                  disabled={busy}
                  onClick={onCheckin}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <CircleDot /> Simulate Check-in Queue
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-lg bg-[#f7f8fa] p-4 text-sm text-[#8b94a2]">
              Detailed demo controls are enabled for AI Hackathon 2026.
            </p>
          )}
          <Button
            onClick={onReset}
            variant="ghost"
            className="mt-8 text-[#dc2626]"
          >
            <RefreshCw /> Reset demo database
          </Button>
        </Card>
      </div>
    </>
  );
}

function EvaPanel({
  state,
  busy,
  plan,
  activity,
  riskCount,
  connection,
  onCollapse,
  onApprove,
  onModify,
  onReject,
  onRetry,
}: any) {
  const effectiveState: EvaState = busy ? 'Investigating' : state;
  const connectionTone =
    connection?.status === 'connected'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : connection?.status === 'configured'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : connection?.status === 'fallback'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-red-200 bg-red-50 text-red-700';
  const connectionLabel =
    connection?.status === 'connected'
      ? 'OpenAI connected'
      : connection?.status === 'configured'
        ? 'OpenAI configured'
      : connection?.status === 'fallback'
          ? 'EVA operational'
          : connection
            ? 'OpenAI disconnected'
            : 'Checking OpenAI';
  return (
    <aside className="border-l border-[#e7e9ee] bg-white 2xl:fixed 2xl:inset-y-0 2xl:right-0 2xl:z-30 2xl:w-[348px]">
      <div className="flex h-[68px] items-center gap-3 border-b border-[#edf0f3] px-5">
        <div className="relative size-11 shrink-0 overflow-visible rounded-xl border-2 border-[#6366f1] bg-[#111827] shadow-sm">
          <img src="/eva.png" alt="EVA agent portrait" className="size-full rounded-[10px] object-cover" />
          <span
            className={`absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-white ${effectiveState === 'Critical' ? 'bg-red-500' : effectiveState === 'Investigating' || effectiveState === 'Decision Needed' ? 'bg-amber-500' : 'bg-emerald-500'}`}
          />
        </div>
        <div>
          <p className="font-semibold">EVA</p>
          <p className="text-xs text-[#8b94a2]">
            Event Manager Agent
          </p>
        </div>
        <button
          onClick={onCollapse}
          className="ml-auto grid size-8 place-items-center rounded-lg hover:bg-[#f4f5f7]"
          aria-label="Collapse EVA panel"
        >
          <ChevronRight size={17} />
        </button>
      </div>
      <div className="flex flex-col p-5">
        {connection?.status !== 'fallback' && <div
          className={`order-3 mt-5 rounded-lg border px-3 py-2.5 ${connectionTone}`}
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold">{connectionLabel}</p>
            <span className="text-[11px] opacity-80">
              {connection?.model ?? 'Checking'}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 opacity-90">
            {connection?.message ??
              'EVA is checking the server configuration without exposing your API key.'}
          </p>
        </div>}
        {plan &&
          (plan.status === 'error' || plan.status === 'ai_unavailable') && (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
                EVA needs attention
              </p>
              <p className="mt-2 font-semibold">{plan.decision}</p>
              <p className="mt-1 text-xs leading-5 text-red-700">
                {plan.verification}
              </p>
              <Button
                onClick={onRetry}
                disabled={busy}
                variant="outline"
                className="mt-3 w-full border-red-200 bg-white text-red-700"
              >
                Reassess event now
              </Button>
            </div>
          )}
        {plan?.risks?.length > 0 && (
            <div className="order-2 mt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9aa1ae]">
                Risks EVA is tracking
              </p>
              <span className="text-xs font-semibold text-red-600">
                {plan.risks.length} open
              </span>
            </div>
            <p className="mt-2 rounded-lg bg-white/80 p-2.5 text-xs font-semibold text-amber-800">Organizer approval required — proposed action exceeds EVA’s authority.</p>
            <div className="mt-3 space-y-2">
              {plan.risks.slice(0, 4).map((risk: any) => (
                <div
                  key={risk.id}
                  className="rounded-lg border border-red-100 bg-red-50/60 p-2.5"
                >
                  <p className="text-xs font-semibold text-red-800">
                    {risk.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-red-700">
                    {risk.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {plan && plan.status === 'approval_required' && (
          <div className="order-1 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Approval request
              </p>
              <span className="text-xs font-medium text-amber-700">
                {riskCount} live risks
              </span>
            </div>
            <p className="mt-2 font-semibold">
              {plan.approvalRequest?.title ?? 'Organizer decision required'}
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              {plan.approvalRequest?.summary ?? plan.decision}
            </p>
            {plan.actions.find((action: EvaAction) => action.type === 'send_email')?.emailDraft && (() => {
              const draft = plan.actions.find((action: EvaAction) => action.type === 'send_email')!.emailDraft!;
              return <div className="mt-4 rounded-lg border border-amber-200 bg-white p-3 text-xs"><div className="flex items-center gap-2 font-semibold text-[#344054]"><Mail size={14}/> External email draft</div><p className="mt-2"><b>To:</b> {draft.to}</p><p className="mt-1"><b>Subject:</b> {draft.subject}</p><p className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-[#f7f8fa] p-2 leading-5">{draft.body}</p><p className="mt-2 text-amber-800"><b>Why:</b> {draft.reason}</p><p className="mt-1 text-[#667085]"><b>Related:</b> {draft.eventId} · {draft.incidentId}</p></div>;
            })()}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                onClick={onApprove}
                className="h-11 bg-[#4f46e5] px-3 font-semibold text-white shadow-sm hover:bg-[#4338ca]"
              >
                <Send /> {plan.actions.some((action: EvaAction) => action.type === 'send_email') ? 'Approve & send' : 'Approve & execute'}
              </Button>
              <Button
                variant="outline"
                onClick={onReject}
                className="h-11 border-2 border-[#d0d5dd] bg-white px-3 font-semibold text-[#344054] hover:bg-[#f2f4f7]"
              >
                <X /> Reject
              </Button>
            </div>
            <Button onClick={onModify} variant="ghost" className="mt-1 w-full text-xs text-[#667085]">
              Review permission controls
            </Button>
            <div className="mt-3 space-y-3">
              {plan.actions.map((a: EvaAction) => (
                <div
                  key={a.id}
                  className="rounded-lg bg-white/70 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Check size={12} className="text-[#4f46e5]" />
                    <span className="font-medium">
                      {a.type.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 pl-5 text-[#667085]">{actionDelta(a)}</p>
                  {a.context?.map((item) => <p key={item} className="mt-1 pl-5 text-[11px] leading-4 text-[#7c5a16]">{item}</p>)}
                </div>
              ))}
            </div>
            {plan.approvalRequest && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-white/80 p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#667085]">Estimated added cost</span>
                  <span className="font-semibold">
                    {money(plan.approvalRequest.estimatedCost)}
                  </span>
                </div>
                {plan.approvalRequest.reasons.map((reason: string) => (
                  <p
                    key={reason}
                    className="mt-1 text-[11px] leading-4 text-amber-800"
                  >
                    {reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        <div className={`order-4 ${plan ? 'mt-6' : ''}`}>
          <div className="flex justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9aa1ae]">
              Operations audit
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-medium ${riskCount ? 'text-red-600' : 'text-emerald-600'}`}
              >
                {riskCount ? `${riskCount} live risks` : 'Stable'}
              </span>
              <Activity size={14} className="text-[#9aa1ae]" />
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {activity.slice(0, 5).map((item: any) => (
              <div key={item.id} className="flex gap-3">
                <div
                  className={`mt-1 size-2 shrink-0 rounded-full ${item.kind === 'risk' ? 'bg-red-500' : item.kind === 'resolved' ? 'bg-emerald-500' : 'bg-[#6366f1]'}`}
                />
                <div>
                  <p className="text-xs font-medium">{item.title}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#929aa7]">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
