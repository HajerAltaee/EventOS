import { env } from 'cloudflare:workers';
import type { DemoDatabase } from '@/lib/demo-database';
import {
  selectEvent,
  selectCatering,
  selectMealRequirements,
  selectMainSpaces,
  selectOperationalRisks,
  selectRegistrations,
  selectSpace,
} from '@/lib/demo-database';
import type {
  EvaAction,
  EvaActionType,
  EvaApprovalRequest,
  EvaConnection,
  EvaDecision,
  EvaRisk,
  EventSignal,
} from '@/lib/eva-agent';
import { vendorDelayRecoveryActions } from '@/lib/vendor-delay-recovery';

type AgentRequest = { signal?: EventSignal; state?: DemoDatabase };
type FunctionCall = {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
};
type ResponseOutput = FunctionCall | { type: string; [key: string]: unknown };
type EvaRuntimeBindings = {
  OPENAI_API_KEY?: string;
  EVA_MODEL?: string;
};
type EvaRuntimeConfig = {
  apiKey: string | null;
  model: string;
  source: 'cloudflare' | 'process' | 'missing';
};

const DEFAULT_EVA_MODEL = 'gpt-5.4-mini';

const cleanEnvironmentValue = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )
    return trimmed.slice(1, -1).trim() || null;
  return trimmed;
};

function getEvaRuntimeConfig(): EvaRuntimeConfig {
  let runtime: EvaRuntimeBindings = {};
  try {
    runtime = env as EvaRuntimeBindings;
  } catch {
    // Node-based local checks may not expose the Cloudflare runtime module.
  }
  const cloudflareKey = cleanEnvironmentValue(runtime.OPENAI_API_KEY);
  const processKey = cleanEnvironmentValue(process.env.OPENAI_API_KEY);
  const runtimeModel = cleanEnvironmentValue(runtime.EVA_MODEL);
  const processModel = cleanEnvironmentValue(process.env.EVA_MODEL);
  return {
    apiKey: cloudflareKey ?? processKey,
    model: runtimeModel ?? processModel ?? DEFAULT_EVA_MODEL,
    source: cloudflareKey ? 'cloudflare' : processKey ? 'process' : 'missing',
  };
}

function connection(
  config: EvaRuntimeConfig,
  status: EvaConnection['status'],
  message: string,
): EvaConnection {
  return { provider: 'openai', status, model: config.model, message };
}

function trackedRisks(state: DemoDatabase): EvaRisk[] {
  return selectOperationalRisks(state).map((risk) => ({
    id: risk.id,
    area: risk.id.startsWith('venue')
      ? 'venue'
      : risk.id.startsWith('checkin')
        ? 'checkin'
      : risk.id.startsWith('registration')
        ? 'registration'
        : risk.id.startsWith('catering')
          ? 'catering'
          : risk.id.startsWith('badge')
            ? 'badges'
            : risk.id.startsWith('staff')
              ? 'staffing'
              : 'budget',
    title: risk.label,
    detail: risk.detail,
    severity: risk.severity,
    status: 'open' as const,
  }));
}

function approvalRequest(
  decisionId: string,
  actions: EvaAction[],
  risks: EvaRisk[],
): EvaApprovalRequest | null {
  const protectedActions = actions.filter((action) => action.approvalRequired);
  if (!protectedActions.length) return null;
  const reasons = [
    ...new Set(
      protectedActions
        .map((action) => action.approvalReason)
        .filter((reason): reason is string => Boolean(reason)),
    ),
  ];
  return {
    id: `approval-${decisionId}`,
    status: 'pending',
    title: 'Organizer approval requested',
    summary: `${protectedActions.length} protected action${protectedActions.length === 1 ? '' : 's'} must be approved before EVA can execute this recovery package.`,
    actionIds: protectedActions.map((action) => action.id),
    riskIds: risks.map((risk) => risk.id),
    estimatedCost: actions.reduce(
      (total, action) => total + Math.max(0, action.estimatedCost),
      0,
    ),
    reasons,
    requestedAt: new Date().toISOString(),
  };
}
const objectTool = (
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
) => ({
  type: 'function',
  name,
  description,
  strict: true,
  parameters: {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  },
});

const tools = [
  objectTool(
    'inspect_event_state',
    'Inspect the selected event, current venue, status, and operating policies.',
  ),
  objectTool(
    'inspect_registrations',
    'Inspect confirmed registration records and intake status.',
  ),
  objectTool(
    'inspect_venue_capacity',
    'Inspect every configured event space and capacity.',
  ),
  objectTool(
    'inspect_catering',
    'Inspect meal inventory, vendor delivery time, and unit cost.',
  ),
  objectTool(
    'inspect_staffing',
    'Inspect event staffing coverage and entrance staff.',
  ),
  objectTool(
    'inspect_budget',
    'Inspect approved budget, committed spend, and available funds.',
  ),
  objectTool(
    'inspect_timeline',
    'Inspect the run of show and protected milestones.',
  ),
  objectTool(
    'inspect_checkin_operations',
    'Inspect entrances, QR lanes, queues, staff, and waiting times.',
  ),
  objectTool(
    'change_space',
    'Propose changing the main event space.',
    { target_space: { type: 'string' }, reason: { type: 'string' } },
    ['target_space', 'reason'],
  ),
  objectTool(
    'update_resource',
    'Propose changing a resource only when a measured shortage exists.',
    {
      resource: { type: 'string', enum: ['meals', 'badges'] },
      target_quantity: { type: 'integer', minimum: 0 },
      reason: { type: 'string' },
    },
    ['resource', 'target_quantity', 'reason'],
  ),
  objectTool(
    'set_event_staff',
    'Propose an event staffing target.',
    {
      target_staff: { type: 'integer', minimum: 1 },
      reason: { type: 'string' },
    },
    ['target_staff', 'reason'],
  ),
  objectTool(
    'set_checkin_lanes',
    'Propose active QR lanes at an entrance.',
    {
      entrance: { type: 'string' },
      active_lanes: { type: 'integer', minimum: 1 },
      reason: { type: 'string' },
    },
    ['entrance', 'active_lanes', 'reason'],
  ),
  objectTool(
    'reassign_staff',
    'Propose moving check-in staff between entrances.',
    {
      from_entrance: { type: 'string' },
      to_entrance: { type: 'string' },
      staff_count: { type: 'integer', minimum: 1 },
      reason: { type: 'string' },
    },
    ['from_entrance', 'to_entrance', 'staff_count', 'reason'],
  ),
  objectTool(
    'redirect_arrivals',
    'Propose redirecting incoming attendees from a congested entrance to a less busy entrance.',
    {
      from_entrance: { type: 'string' },
      to_entrance: { type: 'string' },
      percent: { type: 'integer', minimum: 0, maximum: 60 },
      reason: { type: 'string' },
    },
    ['from_entrance', 'to_entrance', 'percent', 'reason'],
  ),
  objectTool(
    'update_timeline',
    'Propose one schedule change after inspecting dependencies.',
    {
      activity: { type: 'string' },
      from_time: { type: 'string' },
      to_time: { type: 'string' },
      reason: { type: 'string' },
    },
    ['activity', 'from_time', 'to_time', 'reason'],
  ),
  objectTool(
    'create_task',
    'Create an operational task.',
    {
      title: { type: 'string' },
      owner: { type: 'string' },
      reason: { type: 'string' },
    },
    ['title', 'owner', 'reason'],
  ),
  objectTool(
    'set_registration_status',
    'Propose opening, pausing, or closing registration.',
    {
      status: { type: 'string', enum: ['open', 'paused', 'closed'] },
      reason: { type: 'string' },
    },
    ['status', 'reason'],
  ),
  objectTool(
    'send_email',
    'Draft an external operational email. This action always requires organizer approval and never sends directly.',
    {
      to: { type: 'string' },
      subject: { type: 'string' },
      body: { type: 'string' },
      reason: { type: 'string' },
      event_id: { type: 'string' },
      incident_id: { type: 'string' },
    },
    ['to', 'subject', 'body', 'reason', 'event_id', 'incident_id'],
  ),
  objectTool(
    'request_approval',
    'Record why organizer authorization is required.',
    { reason: { type: 'string' } },
    ['reason'],
  ),
  objectTool(
    'verify_outcome',
    'State measurable checks that confirm the response worked.',
    { checks: { type: 'array', items: { type: 'string' } } },
    ['checks'],
  ),
  objectTool(
    'submit_operational_decision',
    'Finish the investigation and submit EVA’s decision.',
    {
      detected: { type: 'string' },
      decision: { type: 'string' },
      verification: { type: 'string' },
    },
    ['detected', 'decision', 'verification'],
  ),
] as const;

function inspect(name: string, state: DemoDatabase) {
  const event = selectEvent(state);
  const registrations = selectRegistrations(state);
  const space = selectSpace(state, event.spaceId);
  if (name === 'inspect_event_state') return { event, currentSpace: space };
  if (name === 'inspect_registrations')
    return {
      confirmed: registrations.length,
      status: event.registrationStatus,
    };
  if (name === 'inspect_venue_capacity')
    return {
      currentSpace: space,
      spaces: state.spaces.filter((item) => item.venueId === event.venueId),
    };
  if (name === 'inspect_catering')
    return {
      registrations: registrations.length,
      meals: event.meals,
      delivery: event.cateringArrival,
      unitCost: event.operations.mealUnitCost,
      record: state.catering.find((item) => item.eventId === event.id),
      vendorContact: state.contacts.find((item) => item.id === state.catering.find((record) => record.eventId === event.id)?.vendorContactId),
    };
  if (name === 'inspect_staffing')
    return {
      eventStaff: event.staff,
      guestsPerStaff: event.operations.guestsPerStaff,
      entrances: state.entrances.filter((item) => item.eventId === event.id),
      namedStaff: state.staff.filter((item) => item.eventId === event.id),
    };
  if (name === 'inspect_budget')
    return {
      budget: event.budget,
      committed: event.currentCost,
      available: event.budget - event.currentCost,
      approvalThreshold: 500,
    };
  if (name === 'inspect_timeline') return event.timeline;
  if (name === 'inspect_checkin_operations')
    return state.entrances.filter((item) => item.eventId === event.id);
  return null;
}

function actionFromCall(
  call: FunctionCall,
  args: Record<string, unknown>,
): EvaAction | null {
  const reason = String(args.reason ?? '');
  const id = `${call.name}-${call.call_id}`;
  const make = (
    type: EvaActionType,
    target: string,
    from: string | null,
    to: string,
    quantity: number | null,
  ): EvaAction => ({
    id,
    type,
    target,
    from,
    to,
    quantity,
    estimatedCost: 0,
    reason,
    approvalRequired: false,
    approvalReason: null,
  });
  if (call.name === 'change_space')
    return make(
      'change_space',
      String(args.target_space),
      null,
      String(args.target_space),
      null,
    );
  if (call.name === 'update_resource')
    return make(
      args.resource === 'meals' ? 'update_meals' : 'update_badges',
      String(args.resource),
      null,
      String(args.target_quantity),
      Number(args.target_quantity),
    );
  if (call.name === 'set_event_staff')
    return make(
      'set_staff',
      'Event staff',
      null,
      String(args.target_staff),
      Number(args.target_staff),
    );
  if (call.name === 'set_checkin_lanes')
    return make(
      'set_checkin_lanes',
      String(args.entrance),
      null,
      String(args.active_lanes),
      Number(args.active_lanes),
    );
  if (call.name === 'reassign_staff')
    return make(
      'reassign_staff',
      String(args.to_entrance),
      String(args.from_entrance),
      String(args.to_entrance),
      Number(args.staff_count),
    );
  if (call.name === 'redirect_arrivals')
    return make(
      'redirect_arrivals',
      String(args.to_entrance),
      String(args.from_entrance),
      `${args.percent}%`,
      Number(args.percent),
    );
  if (call.name === 'update_timeline')
    return make(
      'update_timeline',
      String(args.activity),
      String(args.from_time),
      String(args.to_time),
      null,
    );
  if (call.name === 'create_task')
    return make(
      'create_task',
      String(args.owner),
      null,
      String(args.title),
      null,
    );
  if (call.name === 'set_registration_status')
    return make(
      'set_registration_status',
      'Registration intake',
      null,
      String(args.status),
      null,
    );
  if (call.name === 'send_email') {
    const action = make('send_email', String(args.to), null, String(args.subject), null);
    action.emailDraft = {
      to: String(args.to), subject: String(args.subject), body: String(args.body),
      reason, eventId: String(args.event_id), incidentId: String(args.incident_id),
    };
    action.approvalRequired = true;
    action.approvalReason = 'External communication always requires organizer approval.';
    return action;
  }
  return null;
}

function validate(state: DemoDatabase, actions: EvaAction[]): EvaAction[] {
  const event = selectEvent(state);
  const count = selectRegistrations(state).length;
  const currentSpace = selectSpace(state, event.spaceId);
  return actions.flatMap((action) => {
    const next = { ...action };
    if (action.type === 'change_space') {
      const target = selectMainSpaces(state).find(
        (item) => item.name === action.target || item.id === action.target,
      );
      if (
        !target ||
        target.capacity < count ||
        target.id === currentSpace?.id ||
        (currentSpace?.capacity ?? 0) >= count
      )
        return [];
      next.target = target.id;
      next.from = currentSpace
        ? `${currentSpace.name} · ${currentSpace.capacity}`
        : null;
      next.to = `${target.name} · ${target.capacity}`;
      next.estimatedCost = event.operations.venueChangeCost;
      next.approvalRequired = state.permissions.changeVenue === 'approval';
      next.approvalReason = next.approvalRequired
        ? 'Changing the main event space requires organizer approval.'
        : null;
    } else if (action.type === 'update_meals') {
      const target = Number(action.to);
      if (target <= event.meals || target < count) return [];
      next.from = String(event.meals);
      next.to = String(target);
      next.quantity = target - event.meals;
      next.estimatedCost = next.quantity * event.operations.mealUnitCost;
      next.dietaryBreakdown = selectMealRequirements(state);
      const catering = selectCatering(state);
      next.context = [
        `Dietary breakdown: ${Object.entries(next.dietaryBreakdown).map(([key, value]) => `${key} ${value}`).join(', ')}`,
        `Vendor availability: ${catering?.vendor ?? 'Not configured'} can prepare up to ${catering?.vendorCapacity ?? 0} meals`,
        `Expected delivery: ${catering?.expectedArrival ?? event.cateringArrival}; serving time ${catering?.servingTime ?? 'not configured'}`,
        'If rejected: confirmed attendees may not receive a suitable meal and service readiness remains at risk.',
      ];
    } else if (action.type === 'update_badges') {
      const target = Number(action.to);
      if (target <= event.badges || target < count) return [];
      next.from = String(event.badges);
      next.to = String(target);
      next.quantity = target - event.badges;
    } else if (action.type === 'set_staff') {
      const target = Number(action.to);
      const required = Math.ceil(count / event.operations.guestsPerStaff);
      if (event.staff >= required || target < required) return [];
      next.from = String(event.staff);
      next.approvalRequired =
        state.permissions.reassignResources === 'approval';
    } else if (action.type === 'set_checkin_lanes') {
      const entrance = state.entrances.find(
        (item) => item.name === action.target || item.id === action.target,
      );
      const target = Number(action.to);
      if (
        !entrance ||
        target === entrance.activeLanes ||
        target < 1 ||
        target > entrance.maxLanes ||
        target > entrance.assignedStaff ||
        (target > entrance.activeLanes && entrance.waitMinutes <= 7) ||
        (target < entrance.activeLanes &&
          (entrance.waitMinutes > 3 || entrance.attendeesWaiting > 10))
      )
        return [];
      next.target = entrance.id;
      next.from = String(entrance.activeLanes);
      next.approvalRequired =
        state.permissions.updateOperationalData === 'approval';
    } else if (action.type === 'reassign_staff') {
      const source = state.entrances.find(
        (item) => item.name === action.from || item.id === action.from,
      );
      const target = state.entrances.find(
        (item) => item.name === action.target || item.id === action.target,
      );
      if (action.from === 'staff-pool') {
        const available = state.staff.filter((item) => item.eventId === event.id && item.availability === 'Available' && item.role !== 'Hospitality').slice(0, action.quantity ?? 0);
        if (!target || available.length < (action.quantity ?? 0)) return [];
        next.from = 'staff-pool';
        next.target = target.id;
        next.staffIds = available.map((item) => item.id);
        next.approvalRequired = state.permissions.reassignResources === 'approval';
      } else if (
        !source ||
        !target ||
        target.waitMinutes <= source.waitMinutes ||
        target.waitMinutes <= 7 ||
        source.assignedStaff - (action.quantity ?? 0) < 1
      )
        return [];
      else {
        next.from = source.id;
        next.target = target.id;
        next.approvalRequired = state.permissions.reassignResources === 'approval';
      }
    } else if (action.type === 'redirect_arrivals') {
      const source = state.entrances.find(
        (item) => item.name === action.from || item.id === action.from,
      );
      const target = state.entrances.find(
        (item) => item.name === action.target || item.id === action.target,
      );
      if (
        !source ||
        !target ||
        source.id === target.id ||
        source.waitMinutes <= 7 ||
        target.waitMinutes >= source.waitMinutes ||
        (action.quantity ?? 0) <= 0 ||
        (action.quantity ?? 0) > 60
      )
        return [];
      next.from = source.id;
      next.target = target.id;
      next.approvalRequired =
        state.permissions.updateOperationalData === 'approval';
    } else if (action.type === 'update_timeline') {
      const item = event.timeline.find((slot) => slot.name === action.target);
      if (!item || item.time !== action.from || item.protected) return [];
      next.approvalRequired =
        state.permissions.changeMainSchedule === 'approval';
      next.approvalReason = next.approvalRequired
        ? 'Changing the main schedule requires organizer approval.'
        : null;
    } else if (action.type === 'send_email') {
      const incident = state.incidents.find((item) => item.id === action.emailDraft?.incidentId && item.eventId === event.id);
      const contact = state.contacts.find((item) => item.eventId === event.id && item.email.toLowerCase() === action.emailDraft?.to.toLowerCase());
      if (!action.emailDraft || !incident || !contact || contact.type !== 'vendor') return [];
      next.target = contact.email;
      next.approvalRequired = true;
      next.approvalReason = 'External communication always requires organizer approval.';
    } else if (action.type === 'create_task')
      next.approvalRequired = state.permissions.createTasks === 'approval';
    else if (action.type === 'assign_catering_staff') {
      const available = state.staff.filter((item) => item.eventId === event.id && item.availability === 'Available' && item.role === 'Hospitality').slice(0, action.quantity ?? 1);
      if (!available.length) return [];
      next.staffIds = available.map((item) => item.id);
      next.quantity = available.length;
      next.approvalRequired = state.permissions.reassignResources === 'approval';
    } else if (action.type === 'notify_internal')
      next.approvalRequired = state.permissions.notifyStaff === 'approval';
    else if (action.type === 'update_vendor' || action.type === 'update_operational_notes')
      next.approvalRequired = state.permissions.updateOperationalData === 'approval';
    if (next.approvalRequired && !next.approvalReason)
      next.approvalReason =
        'This action is outside EVA’s automatic permissions.';
    if (
      next.estimatedCost > 500 &&
      state.permissions.spendOver500 === 'approval'
    ) {
      next.approvalRequired = true;
      next.approvalReason = `Additional spend of AED ${next.estimatedCost.toLocaleString()} exceeds the approval threshold.`;
    }
    return [next];
  });
}

function requiredRecoveryCandidates(
  state: DemoDatabase,
  idPrefix: string,
  signal?: EventSignal,
): EvaAction[] {
  const event = selectEvent(state);
  const registrations = selectRegistrations(state).length;
  const currentSpace = selectSpace(state, event.spaceId);
  const candidates: EvaAction[] = [];
  const add = (
    type: EvaActionType,
    target: string,
    to: string,
    reason: string,
  ) =>
    candidates.push({
      id: `${idPrefix}-${type}-${candidates.length}`,
      type,
      target,
      from: null,
      to,
      quantity: null,
      estimatedCost: 0,
      reason,
      approvalRequired: false,
      approvalReason: null,
    });
  const addDetailed = (action: EvaAction) => candidates.push(action);

  if (signal?.type === 'checkin_queue') {
    const north = state.entrances.find((item) => item.id === 'north-entrance');
    const target = state.entrances.filter((item) => item.id !== 'north-entrance').sort((a, b) => a.waitMinutes - b.waitMinutes)[0];
    if (north && north.waitMinutes > 7) {
      add('set_checkin_lanes', north.id, String(north.maxLanes), 'Open all configured North Entrance lanes to restore throughput.');
      addDetailed({ id: `${idPrefix}-named-staff`, type: 'reassign_staff', target: north.id, from: 'staff-pool', to: north.id, quantity: 2, estimatedCost: 0, reason: 'Assign named available staff to the congested entrance.', approvalRequired: false, approvalReason: null });
      if (target) addDetailed({ id: `${idPrefix}-redirect`, type: 'redirect_arrivals', target: target.id, from: north.id, to: '25%', quantity: 25, estimatedCost: 0, reason: 'Redirect a bounded share to the least crowded entrance.', approvalRequired: false, approvalReason: null });
      add('create_task', 'Operations', 'Monitor North Entrance recovery until queue is below eight minutes', 'Create an owned incident-response task.');
    }
  }

  if ((currentSpace?.capacity ?? 0) < registrations) {
    const alternative = selectMainSpaces(state)
      .filter(
        (space) =>
          space.id !== currentSpace?.id && space.capacity >= registrations,
      )
      .sort((a, b) => a.capacity - b.capacity)[0];
    if (alternative)
      add(
        'change_space',
        alternative.name,
        alternative.name,
        `Move to the smallest configured space that safely accommodates all ${registrations} confirmed attendees.`,
      );
    else if (event.registrationStatus === 'open')
      add(
        'set_registration_status',
        'Registration intake',
        'paused',
        'No configured event space can safely accommodate the confirmed registrations.',
      );
  }
  if (event.meals < registrations)
    add(
      'update_meals',
      'meals',
      String(registrations),
      'Match meal inventory to confirmed attendance.',
    );
  if (event.meals < registrations) {
    add('create_task', 'Catering', `Prepare ${registrations} meals with verified dietary coverage`, 'Coordinate the catering shortage response.');
    addDetailed({ id: `${idPrefix}-catering-staff`, type: 'assign_catering_staff', target: 'Catering', from: 'Available pool', to: 'Meal preparation and distribution', quantity: 1, estimatedCost: 0, reason: 'Assign an available named hospitality staff member.', approvalRequired: false, approvalReason: null });
    add('update_vendor', 'Catering vendor', `Internal order update: prepare ${registrations} meals with dietary breakdown`, 'Send the existing vendor an internal operational update.');
    add('notify_internal', 'Catering and operations', 'Meal shortage recovery is active; preparation task and staffing updated.', 'Notify internal teams only.');
  }
  if (signal?.type === 'vendor_delay') {
    candidates.push(...vendorDelayRecoveryActions(state, idPrefix));
  }
  if (event.badges < registrations)
    add(
      'update_badges',
      'badges',
      String(registrations),
      'Prepare one badge for every confirmed attendee.',
    );
  const requiredStaff = Math.ceil(
    registrations / event.operations.guestsPerStaff,
  );
  if (event.staff < requiredStaff)
    add(
      'set_staff',
      'Event staff',
      String(requiredStaff),
      'Restore the configured guest-to-staff coverage target.',
    );

  return candidates;
}

function safetyFallback(
  signal: EventSignal,
  state: DemoDatabase,
  config: EvaRuntimeConfig,
  fallbackReason: string,
): EvaDecision {
  const id = `safety-${Date.now()}`;
  const actions = validate(state, requiredRecoveryCandidates(state, id, signal));
  const approvalRequired = actions.some((action) => action.approvalRequired);
  const risks = trackedRisks(state);
  const request = approvalRequest(id, actions, risks);
  return {
    id,
    status: approvalRequired
      ? 'approval_required'
      : actions.length
        ? 'ready'
        : 'resolved',
    engine: 'fallback',
    detected: signal.summary,
    investigations: [
      'registration records',
      'venue capacity',
      'catering inventory',
      'staffing coverage',
      'budget permissions',
    ],
    decision: actions.length
      ? 'A validated recovery package has been prepared from the current event state.'
      : 'No operational change is required from the current event state.',
    risks,
    actions,
    approvalRequest: request,
    verification: actions.length
      ? 'After authorization, re-check assigned-space capacity, resource counts, staffing coverage, and committed budget.'
      : 'Current assigned capacity, resource counts, staffing coverage, and budget are stable.',
    toolTrace: [
      'inspect_registrations',
      'inspect_venue_capacity',
      'inspect_catering',
      'inspect_staffing',
      'inspect_budget',
      'submit_operational_decision',
    ],
    connection: connection(config, 'fallback', fallbackReason),
    generatedAt: new Date().toISOString(),
  };
}

async function runOpenAiEva(
  signal: EventSignal,
  state: DemoDatabase,
  config: EvaRuntimeConfig,
): Promise<EvaDecision> {
  if (!config.apiKey) throw new Error('OpenAI API key is not configured.');
  const input: unknown[] = [
    {
      role: 'user',
      content: `A live event signal was received. Investigate using tools, act only on shortages proven by current data, and submit a decision. Signal: ${JSON.stringify(signal)}`,
    },
  ];
  const investigations: string[] = [];
  const proposed: EvaAction[] = [];
  const trace: string[] = [];
  let verification = '';
  let final: Record<string, unknown> | null = null;
  for (let turn = 0; turn < 8 && !final; turn++) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        store: false,
        parallel_tool_calls: true,
        instructions:
          'You are EVA, the accountable senior event manager for the selected event. Treat tool results as the source of truth. Inspect every data source relevant to the signal and at least two sources overall. Identify each proven operational risk, its consequence, and the smallest safe recovery package. Never invent IDs, contacts, capacity, staff, costs, times, availability, or completed work. Use action tools only for proven gaps. For vendor delays, draft a contextual email to the configured vendor contact with send_email. External email always requires explicit organizer approval and is never already sent. Request organizer approval for protected actions or spend above policy; never imply those actions already happened. Keep related actions together so approval resolves the full risk. Use verify_outcome with measurable checks, then submit_operational_decision. Communicate like a calm event manager: state what changed, what is at risk, what you recommend, what needs approval, and how success will be verified. Return operational conclusions, never hidden chain-of-thought.',
        input,
        tools,
        tool_choice: 'required',
        max_output_tokens: 900,
      }),
    });
    if (!response.ok) {
      const rawError = await response.text();
      let message = `OpenAI response failed: ${response.status}`;
      try {
        const parsed = JSON.parse(rawError) as {
          error?: { message?: string };
        };
        if (parsed.error?.message) message += ` — ${parsed.error.message}`;
      } catch {
        // The provider may return a non-JSON network error. Do not expose it.
      }
      throw new Error(message);
    }
    const data = (await response.json()) as { output?: ResponseOutput[] };
    const output = data.output ?? [];
    input.push(...output);
    const calls = output.filter(
      (item): item is FunctionCall => item.type === 'function_call',
    );
    for (const call of calls) {
      const args = JSON.parse(call.arguments || '{}') as Record<
        string,
        unknown
      >;
      trace.push(call.name);
      let result: unknown = { accepted: true };
      if (call.name.startsWith('inspect_')) {
        result = inspect(call.name, state);
        investigations.push(
          call.name.replace('inspect_', '').replaceAll('_', ' '),
        );
      } else if (call.name === 'verify_outcome')
        verification = Array.isArray(args.checks)
          ? args.checks.join(' · ')
          : '';
      else if (call.name === 'submit_operational_decision') {
        if (new Set(investigations).size < 2)
          result = {
            accepted: false,
            error: 'Inspect at least two relevant sources before submitting.',
          };
        else {
          final = args;
          result = { accepted: true };
        }
      } else if (new Set(investigations).size < 2)
        result = {
          accepted: false,
          error:
            'Inspect at least two relevant sources before proposing actions.',
        };
      else {
        const action = actionFromCall(call, args);
        if (action) proposed.push(action);
        result = action
          ? { accepted: true, proposedActionId: action.id }
          : { accepted: true };
      }
      input.push({
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }
  }
  if (!final) throw new Error('EVA did not submit a decision.');
  const validatedModelActions = validate(state, proposed);
  const modelActionTypes = new Set(
    validatedModelActions.map((action) => action.type),
  );
  const requiredActions = validate(
    state,
    requiredRecoveryCandidates(state, `required-${Date.now()}`, signal),
  ).filter((action) => !modelActionTypes.has(action.type));
  const actions = [
    ...new Map(
      [...validatedModelActions, ...requiredActions].map((action) => [
        `${action.type}:${action.from}:${action.target}:${action.to}`,
        action,
      ]),
    ).values(),
  ];
  const approvalRequired = actions.some((action) => action.approvalRequired);
  const decisionId = `eva-${Date.now()}`;
  const risks = trackedRisks(state);
  return {
    id: decisionId,
    status: approvalRequired
      ? 'approval_required'
      : actions.length
        ? 'ready'
        : 'resolved',
    engine: 'openai',
    detected: String(final.detected ?? signal.summary),
    investigations: [...new Set(investigations)],
    decision: String(final.decision ?? 'No change required.'),
    risks,
    actions,
    approvalRequest: approvalRequest(decisionId, actions, risks),
    verification:
      verification ||
      String(
        final.verification ?? 'Reinspect affected operations after execution.',
      ),
    toolTrace: trace,
    connection: connection(
      config,
      'connected',
      `Connected to OpenAI Responses API with ${config.model}.`,
    ),
    generatedAt: new Date().toISOString(),
  };
}

async function runEva(
  signal: EventSignal,
  state: DemoDatabase,
): Promise<EvaDecision> {
  const config = getEvaRuntimeConfig();
  if (!config.apiKey)
    return safetyFallback(
      signal,
      state,
      config,
      'OpenAI is not configured in this runtime. EVA is using validated fallback rules; no AI connection is being claimed.',
    );
  try {
    return await runOpenAiEva(signal, state, config);
  } catch (error) {
    console.error(
      'OpenAI EVA transport unavailable; using validated safety fallback.',
      {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    );
    return safetyFallback(
      signal,
      state,
      config,
      'The OpenAI request failed. EVA is using validated fallback rules and has not executed protected actions.',
    );
  }
}

export async function GET() {
  const config = getEvaRuntimeConfig();
  const configured = Boolean(config.apiKey);
  return Response.json({
    configured,
    connection: connection(
      config,
      configured ? 'configured' : 'disconnected',
      configured
        ? `OpenAI credentials are configured for ${config.model}. The connection is confirmed on EVA’s next investigation.`
        : 'OPENAI_API_KEY is missing from the server runtime. EVA will use validated fallback rules until it is configured.',
    ),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentRequest;
    if (!body.signal || !body.state)
      return Response.json(
        {
          error: 'A generic event signal and current event state are required.',
        },
        { status: 400 },
      );
    return Response.json(await runEva(body.signal, body.state));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'EVA analysis failed.';
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : undefined;
    console.error('EVA agent request failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message,
      cause,
    });
    const connectionFailure = message.startsWith('internal error; reference =');
    return Response.json(
      {
        error: connectionFailure
          ? 'EVA could not establish a secure connection to OpenAI. This computer needs its network or proxy root certificate trusted by Node before EVA can use the API.'
          : message,
      },
      { status: 502 },
    );
  }
}
