export type EventType = 'Hackathon' | 'Corporate' | 'University' | 'Conference';
export type EvaState =
  | 'Monitoring'
  | 'Investigating'
  | 'Decision Needed'
  | 'Critical'
  | 'Resolved';
export type IncidentLifecycle = 'DETECTED' | 'INVESTIGATING' | 'PLAN_CREATED' | 'WAITING_FOR_APPROVAL' | 'EXECUTING' | 'VERIFYING' | 'RESOLVED' | 'FAILED';

export type EventRecord = {
  id: string;
  name: string;
  type: EventType;
  date: string;
  location: string;
  budget: number;
  currentCost: number;
  readiness: number;
  venueId: string;
  spaceId: string;
  meals: number;
  badges: number;
  staff: number;
  cateringArrival: string;
  registrationStatus: 'open' | 'paused' | 'closed';
  operations: {
    guestsPerStaff: number;
    mealUnitCost: number;
    venueChangeCost: number;
  };
  timeline: TimelineRecord[];
};

export type RegistrationRecord = {
  id: string;
  eventId: string;
  name: string;
  status: 'confirmed';
  createdAt: string;
  mealPreference: MealCategory;
};
export type MealCategory =
  | 'standard'
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'allergySensitive';
export type VenueRecord = {
  id: string;
  eventId: string;
  name: string;
  location: string;
};
export type SpaceRecord = {
  id: string;
  venueId: string;
  name: string;
  capacity: number;
  purpose: string;
};
export type TimelineRecord = {
  id: string;
  name: string;
  time: string;
  protected?: boolean;
};
export type TaskRecord = {
  id: string;
  eventId: string;
  title: string;
  owner: string;
  status: 'Done' | 'In progress' | 'Open';
};
export type StaffRecord = {
  id: string;
  eventId: string;
  name: string;
  role: string;
  zone: string;
  shift: string;
  availability: 'Available' | 'Assigned' | 'Unavailable';
  currentAssignment: string;
  email?: string;
  phone?: string;
};
export type ContactRecord = {
  id: string;
  eventId: string;
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  type: 'vendor' | 'staff';
  demo: boolean;
};
export type MealBreakdown = Record<MealCategory, number>;
export type CateringRecord = {
  eventId: string;
  totalMeals: number;
  meals: MealBreakdown;
  vendor: string;
  vendorContactId: string;
  vendorCapacity: number;
  deliveryStatus: 'Confirmed' | 'Delayed' | 'Expedited' | 'Delivered';
  expectedArrival: string;
  servingTime: string;
  assignedStaffIds: string[];
  estimatedAdditionalCost: number;
  internalVendorUpdate: string;
  operationalNotes: string[];
};
export type IncidentMetric = {
  label: string;
  before: string;
  after: string;
};
export type IncidentRecord = {
  id: string;
  eventId: string;
  type: 'checkin_queue' | 'meal_shortage' | 'vendor_delay';
  title: string;
  status: 'Investigating' | 'Resolved' | 'Escalated';
  lifecycle: IncidentLifecycle;
  severity: 'high' | 'medium';
  impact: string;
  analysis: string;
  recoveryPlan: string[];
  verificationResult?: string;
  policyStatus: string;
  metrics: IncidentMetric[];
  evidence: string[];
  createdAt: string;
};
export type EntranceRecord = {
  id: string;
  eventId: string;
  name: string;
  attendeesWaiting: number;
  activeLanes: number;
  maxLanes: number;
  assignedStaff: number;
  availableStaff: number;
  waitMinutes: number;
  redirectedPercent: number;
  status: 'Normal' | 'Busy' | 'Congested';
};
export type FeedbackRecord = {
  id: string;
  eventId: string;
  entranceId: string;
  message: string;
  createdAt: string;
};
export type ActivityRecord = {
  id: string;
  eventId: string;
  title: string;
  detail: string;
  kind: 'monitor' | 'risk' | 'approval' | 'action' | 'resolved';
  createdAt: string;
};
export type OperationalRiskRecord = {
  id: string;
  label: string;
  detail: string;
  severity: 'high' | 'medium';
};
export type PermissionKey =
  | 'createTasks'
  | 'reassignResources'
  | 'updateOperationalData'
  | 'notifyStaff'
  | 'changeVenue'
  | 'spendOver500'
  | 'changeMainSchedule'
  | 'notifyAllAttendees'
  | 'replaceKeynote';

export type DemoDatabase = {
  selectedEventId: string;
  events: EventRecord[];
  registrations: RegistrationRecord[];
  venues: VenueRecord[];
  spaces: SpaceRecord[];
  tasks: TaskRecord[];
  staff: StaffRecord[];
  contacts: ContactRecord[];
  catering: CateringRecord[];
  incidents: IncidentRecord[];
  entrances: EntranceRecord[];
  feedback: FeedbackRecord[];
  activity: ActivityRecord[];
  communications: import('./communications').CommunicationRecord[];
  permissions: Record<PermissionKey, 'automatic' | 'approval'>;
};

const hackathonTimeline: TimelineRecord[] = [
  { id: 't1', name: 'Registration', time: '09:00' },
  { id: 't2', name: 'Opening', time: '10:00' },
  { id: 't3', name: 'Workshop', time: '12:00–12:45' },
  { id: 't4', name: 'Lunch', time: '13:00–14:00' },
  { id: 't5', name: 'Networking', time: '14:00–14:45' },
  { id: 't6', name: 'Judging', time: '15:00–16:30', protected: true },
  { id: 't7', name: 'Closing', time: '17:30', protected: true },
];

function registrations(eventId: string, count: number): RegistrationRecord[] {
  const preferences: MealCategory[] = [
    'standard',
    'standard',
    'halal',
    'standard',
    'vegetarian',
    'halal',
    'standard',
    'vegan',
    'standard',
    'allergySensitive',
  ];
  return Array.from({ length: count }, (_, index) => ({
    id: `${eventId}-reg-${index + 1}`,
    eventId,
    name: `Demo Attendee ${index + 1}`,
    status: 'confirmed' as const,
    createdAt: new Date(Date.UTC(2026, 7, 20, 8, index % 60)).toISOString(),
    mealPreference: preferences[index % preferences.length],
  }));
}

export function createDemoDatabase(): DemoDatabase {
  const events: EventRecord[] = [
    {
      id: 'hackathon',
      name: 'AI Hackathon 2026',
      type: 'Hackathon',
      date: '12 September 2026',
      location: 'Abu Dhabi',
      budget: 40000,
      currentCost: 34700,
      readiness: 94,
      venueId: 'venue-adnec',
      spaceId: 'hall-a',
      meals: 118,
      badges: 118,
      staff: 10,
      cateringArrival: '13:00',
      registrationStatus: 'open',
      operations: {
        guestsPerStaff: 12,
        mealUnitCost: 80,
        venueChangeCost: 1600,
      },
      timeline: hackathonTimeline,
    },
    {
      id: 'leadership',
      name: 'Corporate Leadership Summit',
      type: 'Corporate',
      date: '8 October 2026',
      location: 'Dubai',
      budget: 85000,
      currentCost: 61200,
      readiness: 87,
      venueId: 'venue-dubai',
      spaceId: 'summit-ballroom',
      meals: 240,
      badges: 240,
      staff: 16,
      cateringArrival: '12:30',
      registrationStatus: 'open',
      operations: {
        guestsPerStaff: 15,
        mealUnitCost: 110,
        venueChangeCost: 3500,
      },
      timeline: hackathonTimeline,
    },
    {
      id: 'university',
      name: 'University Innovation Day',
      type: 'University',
      date: '4 November 2026',
      location: 'Sharjah',
      budget: 28000,
      currentCost: 19400,
      readiness: 81,
      venueId: 'venue-campus',
      spaceId: 'campus-hall',
      meals: 320,
      badges: 320,
      staff: 20,
      cateringArrival: '13:00',
      registrationStatus: 'open',
      operations: {
        guestsPerStaff: 18,
        mealUnitCost: 55,
        venueChangeCost: 1200,
      },
      timeline: hackathonTimeline,
    },
    {
      id: 'medical',
      name: 'Medical Conference',
      type: 'Conference',
      date: '19 November 2026',
      location: 'Abu Dhabi',
      budget: 120000,
      currentCost: 88400,
      readiness: 76,
      venueId: 'venue-medical',
      spaceId: 'medical-auditorium',
      meals: 410,
      badges: 410,
      staff: 26,
      cateringArrival: '12:45',
      registrationStatus: 'open',
      operations: {
        guestsPerStaff: 14,
        mealUnitCost: 125,
        venueChangeCost: 5000,
      },
      timeline: hackathonTimeline,
    },
  ];
  return {
    selectedEventId: 'hackathon',
    events,
    registrations: [
      ...registrations('hackathon', 118),
      ...registrations('leadership', 240),
      ...registrations('university', 320),
      ...registrations('medical', 410),
    ],
    venues: [
      {
        id: 'venue-adnec',
        eventId: 'hackathon',
        name: 'Innovation Campus',
        location: 'Abu Dhabi',
      },
      {
        id: 'venue-dubai',
        eventId: 'leadership',
        name: 'Dubai Conference Centre',
        location: 'Dubai',
      },
      {
        id: 'venue-campus',
        eventId: 'university',
        name: 'University Campus',
        location: 'Sharjah',
      },
      {
        id: 'venue-medical',
        eventId: 'medical',
        name: 'Health Sciences Centre',
        location: 'Abu Dhabi',
      },
    ],
    spaces: [
      {
        id: 'hall-a',
        venueId: 'venue-adnec',
        name: 'Hall A',
        capacity: 120,
        purpose: 'Main stage',
      },
      {
        id: 'hall-b',
        venueId: 'venue-adnec',
        name: 'Hall B',
        capacity: 180,
        purpose: 'Main stage alternative',
      },
      {
        id: 'workshop-rooms',
        venueId: 'venue-adnec',
        name: 'Workshop rooms',
        capacity: 72,
        purpose: 'Breakouts',
      },
      {
        id: 'judging-room',
        venueId: 'venue-adnec',
        name: 'Judging room',
        capacity: 24,
        purpose: 'Final judging',
      },
      {
        id: 'summit-ballroom',
        venueId: 'venue-dubai',
        name: 'Summit Ballroom',
        capacity: 300,
        purpose: 'Main stage',
      },
      {
        id: 'campus-hall',
        venueId: 'venue-campus',
        name: 'Campus Hall',
        capacity: 400,
        purpose: 'Main stage',
      },
      {
        id: 'medical-auditorium',
        venueId: 'venue-medical',
        name: 'Medical Auditorium',
        capacity: 500,
        purpose: 'Main stage',
      },
    ],
    tasks: [
      {
        id: 'task-1',
        eventId: 'hackathon',
        title: 'Confirm mentor briefing',
        owner: 'Program team',
        status: 'Done',
      },
      {
        id: 'task-2',
        eventId: 'hackathon',
        title: 'Stage participant badges',
        owner: 'Guest services',
        status: 'In progress',
      },
      {
        id: 'task-3',
        eventId: 'hackathon',
        title: 'Run venue readiness check',
        owner: 'Operations',
        status: 'Open',
      },
    ],
    staff: [
      { id: 'staff-aisha', eventId: 'hackathon', name: 'Aisha Rahman', role: 'Check-in Lead', zone: 'North Entrance', shift: '08:00–14:00', availability: 'Assigned', currentAssignment: 'North Entrance lead' },
      { id: 'staff-omar', eventId: 'hackathon', name: 'Omar Khan', role: 'Check-in', zone: 'East Entrance', shift: '08:00–14:00', availability: 'Assigned', currentAssignment: 'East Entrance QR lane' },
      { id: 'staff-lina', eventId: 'hackathon', name: 'Lina Haddad', role: 'Guest Services', zone: 'Welcome Desk', shift: '08:00–16:00', availability: 'Available', currentAssignment: 'Available pool' },
      { id: 'staff-yusuf', eventId: 'hackathon', name: 'Yusuf Ali', role: 'Runner', zone: 'Operations Hub', shift: '09:00–17:00', availability: 'Available', currentAssignment: 'Available pool' },
      { id: 'staff-maya', eventId: 'hackathon', name: 'Maya Chen', role: 'Catering Coordinator', zone: 'Catering', shift: '11:00–15:00', availability: 'Assigned', currentAssignment: 'Vendor coordination' },
      { id: 'staff-noor', eventId: 'hackathon', name: 'Noor Saeed', role: 'Hospitality', zone: 'Catering', shift: '11:00–15:00', availability: 'Available', currentAssignment: 'Available pool' },
      { id: 'staff-daniel', eventId: 'hackathon', name: 'Daniel Kim', role: 'Hospitality', zone: 'Catering', shift: '11:00–15:00', availability: 'Available', currentAssignment: 'Available pool' },
    ],
    contacts: [
      { id: 'contact-emirates-catering', eventId: 'hackathon', name: 'Layla Mansoor', role: 'Vendor Operations Lead', company: 'Emirates Event Catering', email: 'vendor.demo@example.com', phone: '+971 2 555 0142', type: 'vendor', demo: true },
    ],
    catering: [
      {
        eventId: 'hackathon', totalMeals: 118,
        meals: { standard: 59, vegetarian: 12, vegan: 12, halal: 24, allergySensitive: 11 },
        vendor: 'Emirates Event Catering', vendorContactId: 'contact-emirates-catering', vendorCapacity: 150,
        deliveryStatus: 'Confirmed', expectedArrival: '13:00', servingTime: '13:15',
        assignedStaffIds: ['staff-maya'], estimatedAdditionalCost: 0,
        internalVendorUpdate: 'Order confirmed for 118 meals.', operationalNotes: [],
      },
    ],
    incidents: [],
    entrances: [
      {
        id: 'north-entrance',
        eventId: 'hackathon',
        name: 'North Entrance',
        attendeesWaiting: 18,
        activeLanes: 2,
        maxLanes: 4,
        assignedStaff: 4,
        availableStaff: 2,
        waitMinutes: 4,
        redirectedPercent: 0,
        status: 'Normal',
      },
      {
        id: 'east-entrance',
        eventId: 'hackathon',
        name: 'East Entrance',
        attendeesWaiting: 12,
        activeLanes: 2,
        maxLanes: 3,
        assignedStaff: 3,
        availableStaff: 1,
        waitMinutes: 3,
        redirectedPercent: 0,
        status: 'Normal',
      },
      {
        id: 'vip-entrance',
        eventId: 'hackathon',
        name: 'VIP Entrance',
        attendeesWaiting: 6,
        activeLanes: 1,
        maxLanes: 2,
        assignedStaff: 2,
        availableStaff: 1,
        waitMinutes: 2,
        redirectedPercent: 0,
        status: 'Normal',
      },
    ],
    feedback: [
      {
        id: 'fb-1',
        eventId: 'hackathon',
        entranceId: 'north-entrance',
        message: 'The QR check-in line at North Entrance is building up.',
        createdAt: '10:18',
      },
      {
        id: 'fb-2',
        eventId: 'hackathon',
        entranceId: 'north-entrance',
        message: 'We have been waiting more than twenty minutes to scan.',
        createdAt: '10:20',
      },
    ],
    activity: [
      {
        id: 'act-1',
        eventId: 'hackathon',
        title: 'Event verified stable',
        detail: 'EVA completed the latest operational scan',
        kind: 'monitor',
        createdAt: '2 min ago',
      },
      {
        id: 'act-2',
        eventId: 'hackathon',
        title: '118 registrations synchronized',
        detail: 'Registration database is current',
        kind: 'monitor',
        createdAt: '5 min ago',
      },
    ],
    communications: [],
    permissions: {
      createTasks: 'automatic',
      reassignResources: 'automatic',
      updateOperationalData: 'automatic',
      notifyStaff: 'automatic',
      changeVenue: 'approval',
      spendOver500: 'approval',
      changeMainSchedule: 'approval',
      notifyAllAttendees: 'approval',
      replaceKeynote: 'approval',
    },
  };
}

export function normalizeDemoDatabase(value: unknown): DemoDatabase {
  const seed = createDemoDatabase();
  if (!value || typeof value !== 'object') return seed;
  const stored = value as Partial<DemoDatabase>;
  const incidentDefaults: Record<IncidentRecord['type'], Pick<IncidentRecord, 'severity' | 'impact' | 'analysis'>> = {
    checkin_queue: {
      severity: 'high',
      impact: 'Attendee wait time is above target and the opening experience is at risk.',
      analysis: 'Inspecting entrance telemetry, lane capacity, named staff availability, and arrival routing.',
    },
    meal_shortage: {
      severity: 'high',
      impact: 'Confirmed attendance exceeds prepared meal coverage.',
      analysis: 'Reconciling registrations, dietary requirements, vendor capacity, staffing, and budget.',
    },
    vendor_delay: {
      severity: 'high',
      impact: 'The current vendor ETA is after the planned meal service time.',
      analysis: 'Inspecting the event timeline, vendor contact, catering coverage, staff, and affected activities.',
    },
  };
  return {
    ...seed,
    ...stored,
    selectedEventId: stored.selectedEventId ?? seed.selectedEventId,
    events: stored.events ?? seed.events,
    registrations: stored.registrations ?? seed.registrations,
    venues: stored.venues ?? seed.venues,
    spaces: stored.spaces ?? seed.spaces,
    tasks: stored.tasks ?? seed.tasks,
    staff: stored.staff ?? seed.staff,
    contacts: stored.contacts ?? seed.contacts,
    catering: (stored.catering ?? seed.catering).map((record) => ({
      ...record,
      vendorContactId:
        record.vendorContactId ??
        seed.catering.find((item) => item.eventId === record.eventId)?.vendorContactId ??
        '',
    })),
    incidents: (stored.incidents ?? []).map((incident) => ({
      ...incidentDefaults[incident.type],
      ...incident,
      lifecycle:
        incident.lifecycle ??
        (incident.status === 'Resolved'
          ? 'RESOLVED'
          : incident.status === 'Escalated'
            ? 'FAILED'
            : 'INVESTIGATING'),
      recoveryPlan: incident.recoveryPlan ?? [],
    })),
    entrances: stored.entrances ?? seed.entrances,
    feedback: stored.feedback ?? seed.feedback,
    activity: stored.activity ?? seed.activity,
    communications: stored.communications ?? [],
    permissions: { ...seed.permissions, ...stored.permissions },
  };
}

export const selectEvent = (db: DemoDatabase) =>
  db.events.find((event) => event.id === db.selectedEventId) ?? db.events[0];
export const selectRegistrations = (
  db: DemoDatabase,
  eventId = db.selectedEventId,
) => db.registrations.filter((record) => record.eventId === eventId);
export const selectSpace = (db: DemoDatabase, spaceId: string) =>
  db.spaces.find((space) => space.id === spaceId);
export const selectEventActivity = (db: DemoDatabase) =>
  db.activity.filter((record) => record.eventId === db.selectedEventId);
export const selectMainSpaces = (
  db: DemoDatabase,
  eventId = db.selectedEventId,
) => {
  const event = db.events.find((item) => item.id === eventId);
  return event
    ? db.spaces.filter(
        (space) =>
          space.venueId === event.venueId &&
          space.purpose.toLowerCase().includes('main stage'),
      )
    : [];
};
export const selectMaximumCapacity = (
  db: DemoDatabase,
  eventId = db.selectedEventId,
) =>
  Math.max(0, ...selectMainSpaces(db, eventId).map((space) => space.capacity));
export function selectOperationalRisks(
  db: DemoDatabase,
): OperationalRiskRecord[] {
  const event = selectEvent(db);
  const count = selectRegistrations(db).length;
  const space = selectSpace(db, event.spaceId);
  const maximumCapacity = selectMaximumCapacity(db);
  const requiredStaff = Math.ceil(count / event.operations.guestsPerStaff);
  const congestedEntrance = db.entrances.find(
    (entrance) => entrance.eventId === event.id && entrance.status === 'Congested',
  );
  const catering = selectCatering(db);
  return [
    ...(congestedEntrance
      ? [{ id: 'checkin-congestion', label: 'Check-in queue congestion', detail: `${congestedEntrance.name} has ${congestedEntrance.attendeesWaiting} waiting with a ${congestedEntrance.waitMinutes}-minute wait.`, severity: 'high' as const }]
      : []),
    ...(catering?.deliveryStatus === 'Delayed'
      ? [{ id: 'catering-delay', label: 'Catering vendor delayed', detail: `${catering.vendor} is now expected at ${catering.expectedArrival}, after the ${catering.servingTime} serving target.`, severity: 'high' as const }]
      : []),
    ...(space && count > space.capacity
      ? [
          {
            id: 'venue-capacity',
            label: 'Current hall capacity exceeded',
            detail: `${count} registrations exceed ${space.name}'s ${space.capacity}-seat limit by ${count - space.capacity}.`,
            severity: 'high' as const,
          },
        ]
      : []),
    ...(maximumCapacity > 0 && count >= maximumCapacity
      ? [
          {
            id: 'registration-capacity',
            label: 'Registration capacity exhausted',
            detail: `Registration is closed at the maximum configured capacity of ${maximumCapacity}.`,
            severity: 'high' as const,
          },
        ]
      : []),
    ...(event.meals < count
      ? [
          {
            id: 'catering-shortage',
            label: 'Catering shortage',
            detail: `${count - event.meals} additional meals are required.`,
            severity: 'high' as const,
          },
        ]
      : []),
    ...(event.badges < count
      ? [
          {
            id: 'badge-shortage',
            label: 'Badge shortage',
            detail: `${count - event.badges} additional badges are required.`,
            severity: 'medium' as const,
          },
        ]
      : []),
    ...(event.staff < requiredStaff
      ? [
          {
            id: 'staffing-shortage',
            label: 'Staffing coverage below target',
            detail: `${requiredStaff - event.staff} additional guest-services staff are required for ${count} attendees.`,
            severity: 'medium' as const,
          },
        ]
      : []),
    ...(event.currentCost > event.budget
      ? [
          {
            id: 'budget-overrun',
            label: 'Budget limit exceeded',
            detail: `Committed spend is AED ${(event.currentCost - event.budget).toLocaleString()} over budget.`,
            severity: 'high' as const,
          },
        ]
      : []),
  ];
}

export function addDemoRegistrations(
  db: DemoDatabase,
  count: number,
): DemoDatabase {
  const event = selectEvent(db);
  if (event.registrationStatus !== 'open') return db;
  const existing = selectRegistrations(db);
  const availableSeats = Math.max(
    0,
    selectMaximumCapacity(db) - existing.length,
  );
  const acceptedCount = Math.min(count, availableSeats);
  const added = Array.from({ length: acceptedCount }, (_, index) => ({
    id: `${db.selectedEventId}-reg-${existing.length + index + 1}-${Date.now()}`,
    eventId: db.selectedEventId,
    name: `Demo Attendee ${existing.length + index + 1}`,
    status: 'confirmed' as const,
    createdAt: new Date().toISOString(),
    mealPreference: (['vegetarian', 'halal', 'vegan', 'standard', 'allergySensitive'] as MealCategory[])[index % 5],
  }));
  const nextCount = existing.length + acceptedCount;
  return {
    ...db,
    registrations: [...db.registrations, ...added],
    events: db.events.map((item) =>
      item.id === db.selectedEventId && nextCount >= selectMaximumCapacity(db)
        ? { ...item, registrationStatus: 'closed' }
        : item,
    ),
  };
}

export function setRegistrationStatus(
  db: DemoDatabase,
  status: EventRecord['registrationStatus'],
): DemoDatabase {
  return {
    ...db,
    events: db.events.map((event) =>
      event.id === db.selectedEventId
        ? { ...event, registrationStatus: status }
        : event,
    ),
  };
}

export function appendActivity(
  db: DemoDatabase,
  entries: Omit<ActivityRecord, 'id' | 'eventId'>[],
): DemoDatabase {
  const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const records = entries.map((entry, index) => ({
    ...entry,
    id: `activity-${batchId}-${index}`,
    eventId: db.selectedEventId,
  }));
  return { ...db, activity: [...records, ...db.activity] };
}

export function updateIncidentLifecycle(
  db: DemoDatabase,
  lifecycle: IncidentLifecycle,
  recoveryPlan?: string[],
): DemoDatabase {
  return {
    ...db,
    incidents: db.incidents.map((incident) =>
      incident.eventId === db.selectedEventId && incident.status === 'Investigating'
        ? { ...incident, lifecycle, ...(recoveryPlan ? { recoveryPlan } : {}) }
        : incident,
    ),
  };
}

export function simulateCheckinQueue(db: DemoDatabase): DemoDatabase {
  const north = db.entrances.find((entrance) => entrance.id === 'north-entrance');
  return {
    ...db,
    entrances: db.entrances.map((entrance) =>
      entrance.id === 'north-entrance'
        ? {
            ...entrance,
            attendeesWaiting: 74,
            waitMinutes: 22,
            status: 'Congested',
          }
        : entrance,
    ),
    incidents: [
      {
        id: `incident-checkin-${Date.now()}`,
        eventId: db.selectedEventId,
        type: 'checkin_queue',
        title: 'North Entrance queue recovery',
        status: 'Investigating',
        lifecycle: 'DETECTED', severity: 'high',
        impact: 'Attendee wait time is above target and the opening experience is at risk.',
        analysis: 'Inspecting entrance telemetry, lane capacity, named staff availability, and arrival routing.',
        recoveryPlan: [],
        policyStatus: 'EVA is investigating bounded internal actions.',
        metrics: [
          { label: 'Queue', before: String(north?.attendeesWaiting ?? 0), after: '74' },
          { label: 'Waiting time', before: `${north?.waitMinutes ?? 0} min`, after: '22 min' },
          { label: 'Active lanes', before: String(north?.activeLanes ?? 0), after: String(north?.activeLanes ?? 0) },
          { label: 'Staff', before: String(north?.assignedStaff ?? 0), after: String(north?.assignedStaff ?? 0) },
          { label: 'Incident status', before: 'Normal', after: 'Investigating' },
        ],
        evidence: [],
        createdAt: 'Now',
      },
      ...db.incidents.filter((incident) => incident.type !== 'checkin_queue'),
    ],
  };
}

export const selectStaff = (db: DemoDatabase) =>
  db.staff.filter((record) => record.eventId === db.selectedEventId);
export const selectCatering = (db: DemoDatabase) =>
  db.catering.find((record) => record.eventId === db.selectedEventId);
export function selectMealRequirements(db: DemoDatabase): MealBreakdown {
  const empty: MealBreakdown = { standard: 0, vegetarian: 0, vegan: 0, halal: 0, allergySensitive: 0 };
  return selectRegistrations(db).reduce((totals, registration) => {
    totals[registration.mealPreference] += 1;
    return totals;
  }, empty);
}

export function simulateMealShortage(db: DemoDatabase): DemoDatabase {
  const before = selectRegistrations(db).length;
  const next = addDemoRegistrations(db, 2);
  const after = selectRegistrations(next).length;
  return {
    ...next,
    incidents: [{
      id: `incident-meals-${Date.now()}`, eventId: db.selectedEventId,
      type: 'meal_shortage', title: 'Registration-driven meal shortage', status: 'Investigating',
      lifecycle: 'DETECTED', severity: 'high', impact: 'Confirmed attendance exceeds prepared meal coverage.',
      analysis: 'Reconciling registrations, dietary requirements, vendor capacity, staffing, and budget.', recoveryPlan: [],
      policyStatus: 'EVA is checking budget and catering authority.',
      metrics: [
        { label: 'Confirmed attendees', before: String(before), after: String(after) },
        { label: 'Meal coverage', before: `${before}/${before}`, after: `${selectEvent(next).meals}/${after}` },
        { label: 'Additional cost', before: moneyValue(0), after: moneyValue(0) },
        { label: 'Catering staff assigned', before: String(selectCatering(db)?.assignedStaffIds.length ?? 0), after: String(selectCatering(db)?.assignedStaffIds.length ?? 0) },
        { label: 'Incident status', before: 'Ready', after: 'Investigating' },
      ], evidence: [], createdAt: 'Now',
    }, ...db.incidents.filter((incident) => incident.type !== 'meal_shortage')],
  };
}

export function simulateVendorDelay(db: DemoDatabase): DemoDatabase {
  const catering = selectCatering(db);
  return {
    ...db,
    events: db.events.map((event) => event.id === db.selectedEventId ? { ...event, cateringArrival: '13:30' } : event),
    catering: db.catering.map((record) => record.eventId === db.selectedEventId ? { ...record, expectedArrival: '13:30', deliveryStatus: 'Delayed' } : record),
    incidents: [{
      id: `incident-vendor-${Date.now()}`, eventId: db.selectedEventId,
      type: 'vendor_delay', title: 'Catering vendor delay', status: 'Investigating',
      lifecycle: 'DETECTED', severity: 'high', impact: 'The current vendor ETA is after the planned meal service time.',
      analysis: 'Inspecting the event timeline, vendor contact, catering coverage, staff, and affected activities.', recoveryPlan: [],
      policyStatus: 'EVA is executing internal recovery actions.',
      metrics: [
        { label: 'Vendor arrival', before: '13:30', after: '13:30' },
        { label: 'Expected service delay', before: '15 min', after: '15 min' },
        { label: 'Meal coverage', before: `${catering?.totalMeals ?? 0}`, after: `${catering?.totalMeals ?? 0}` },
        { label: 'Catering staff assigned', before: String(catering?.assignedStaffIds.length ?? 0), after: String(catering?.assignedStaffIds.length ?? 0) },
        { label: 'Additional cost', before: moneyValue(0), after: moneyValue(0) },
        { label: 'Incident status', before: 'Ready', after: 'Investigating' },
      ], evidence: [], createdAt: 'Now',
    }, ...db.incidents.filter((incident) => incident.type !== 'vendor_delay')],
  };
}

const moneyValue = (value: number) => `AED ${value.toLocaleString()}`;

const entranceWait = (entrance: EntranceRecord) =>
  Math.max(
    1,
    Math.ceil(
      (entrance.attendeesWaiting * 0.45) /
        Math.max(1, Math.min(entrance.activeLanes, entrance.assignedStaff)),
    ),
  );

export function applyEvaActions(
  db: DemoDatabase,
  actions: EvaAction[],
): DemoDatabase {
  const next = structuredClone(db);
  for (const action of actions) {
    const event = selectEvent(next);
    if (action.type === 'change_space') {
      const target = next.spaces.find(
        (space) => space.id === action.target || space.name === action.target,
      );
      if (
        target &&
        target.venueId === event.venueId &&
        target.capacity >= selectRegistrations(next).length
      )
        event.spaceId = target.id;
    } else if (action.type === 'update_meals') {
      event.meals = Math.max(event.meals, Number(action.to));
      next.catering = next.catering.map((record) =>
        record.eventId === next.selectedEventId
          ? { ...record, totalMeals: event.meals, meals: selectMealRequirements(next), estimatedAdditionalCost: record.estimatedAdditionalCost + action.estimatedCost }
          : record,
      );
    }
    else if (action.type === 'update_badges')
      event.badges = Math.max(event.badges, Number(action.to));
    else if (action.type === 'set_staff')
      event.staff = Math.max(1, Number(action.to));
    else if (
      action.type === 'set_registration_status' &&
      ['open', 'paused', 'closed'].includes(action.to)
    )
      event.registrationStatus = action.to as EventRecord['registrationStatus'];
    else if (action.type === 'set_checkin_lanes')
      next.entrances = next.entrances.map((entrance) =>
        entrance.id === action.target
          ? {
              ...entrance,
              activeLanes: Math.min(
                entrance.maxLanes,
                Math.max(1, Number(action.to)),
              ),
            }
          : entrance,
      );
    else if (action.type === 'reassign_staff' && action.from) {
      const quantity = Math.max(0, action.quantity ?? 0);
      const source = next.entrances.find(
        (entrance) =>
          entrance.id === action.from || entrance.name === action.from,
      );
      const target = next.entrances.find(
        (entrance) =>
          entrance.id === action.target || entrance.name === action.target,
      );
      if (action.from === 'staff-pool' && target) {
        const selected = next.staff.filter((staff) => (action.staffIds ?? []).includes(staff.id));
        target.assignedStaff += selected.length;
        next.staff = next.staff.map((staff) =>
          selected.some((item) => item.id === staff.id)
            ? { ...staff, zone: target.name, availability: 'Assigned', currentAssignment: `${target.name} queue recovery` }
            : staff,
        );
      } else if (source && target && source.assignedStaff - quantity >= 1) {
        source.assignedStaff -= quantity;
        target.assignedStaff += quantity;
      }
    } else if (action.type === 'redirect_arrivals' && action.from) {
      const source = next.entrances.find(
        (entrance) => entrance.id === action.from,
      );
      const target = next.entrances.find(
        (entrance) => entrance.id === action.target,
      );
      if (source && target) {
        const percent = Math.min(60, Math.max(0, action.quantity ?? 0));
        const redirected = Math.floor(
          source.attendeesWaiting * (percent / 100),
        );
        source.attendeesWaiting -= redirected;
        source.redirectedPercent = percent;
        target.attendeesWaiting += redirected;
      }
    } else if (action.type === 'update_timeline')
      event.timeline = event.timeline.map((slot) =>
        slot.name === action.target && slot.time === action.from
          ? { ...slot, time: action.to }
          : slot,
      );
    else if (action.type === 'create_task')
      next.tasks.unshift({
        id: `eva-task-${Date.now()}`,
        eventId: next.selectedEventId,
        title: action.to,
        owner: action.target,
        status: 'Open',
      });
    else if (action.type === 'assign_catering_staff') {
      const ids = action.staffIds ?? [];
      next.staff = next.staff.map((staff) => ids.includes(staff.id) ? { ...staff, zone: 'Catering', availability: 'Assigned', currentAssignment: action.to } : staff);
      next.catering = next.catering.map((record) => record.eventId === next.selectedEventId ? { ...record, assignedStaffIds: [...new Set([...record.assignedStaffIds, ...ids])] } : record);
    } else if (action.type === 'update_vendor') {
      const expedited = action.to.toLowerCase().includes('expedite');
      next.catering = next.catering.map((record) => record.eventId === next.selectedEventId ? { ...record, internalVendorUpdate: action.to, deliveryStatus: expedited ? 'Expedited' : record.deliveryStatus, expectedArrival: expedited ? '13:10' : record.expectedArrival } : record);
      if (expedited) event.cateringArrival = '13:10';
    }
    else if (action.type === 'update_operational_notes' || action.type === 'notify_internal')
      next.catering = next.catering.map((record) => record.eventId === next.selectedEventId ? { ...record, operationalNotes: [...record.operationalNotes, action.to] } : record);
  }
  const addedCost = actions.reduce(
    (sum, action) => sum + Math.max(0, action.estimatedCost),
    0,
  );
  next.events = next.events.map((event) =>
    event.id === next.selectedEventId
      ? { ...event, currentCost: event.currentCost + addedCost }
      : event,
  );
  next.entrances = next.entrances.map((entrance) => {
    const waitMinutes = entranceWait(entrance);
    return {
      ...entrance,
      waitMinutes,
      status:
        waitMinutes > 15 ? 'Congested' : waitMinutes > 7 ? 'Busy' : 'Normal',
    };
  });
  return next;
}

export function verifyOperationalIncidents(db: DemoDatabase): DemoDatabase {
  const next = structuredClone(db);
  const catering = selectCatering(next);
  const requirements = selectMealRequirements(next);
  next.incidents = next.incidents.map((incident) => {
    if (incident.eventId !== next.selectedEventId || incident.status !== 'Investigating') return incident;
    if (incident.type === 'checkin_queue') {
      const north = next.entrances.find((entrance) => entrance.id === 'north-entrance');
      const recoveredStaff = next.staff.filter((staff) => staff.currentAssignment.includes('queue recovery'));
      const resolved = Boolean(north && north.waitMinutes <= 7 && north.activeLanes >= 4 && recoveredStaff.length >= 2);
      return { ...incident, status: resolved ? 'Resolved' : 'Escalated', lifecycle: resolved ? 'RESOLVED' : 'FAILED', verificationResult: resolved ? 'Queue and wait time returned to operating targets.' : 'Queue remains outside the operating target.',
        policyStatus: resolved ? 'Executed autonomously — within organizer policy.' : 'Escalated to organizer — queue remains outside target.',
        metrics: [
          { label: 'Queue', before: '74', after: String(north?.attendeesWaiting ?? 0) },
          { label: 'Waiting time', before: '22 min', after: `${north?.waitMinutes ?? 0} min` },
          { label: 'Active lanes', before: '2', after: String(north?.activeLanes ?? 0) },
          { label: 'Staff', before: '4', after: `${north?.assignedStaff ?? 0} (${recoveredStaff.map((staff) => staff.name).join(', ')})` },
          { label: 'Incident status', before: 'Congested', after: resolved ? 'Resolved' : 'Escalated' },
        ],
        evidence: [
          ...next.entrances.map((entrance) => `${entrance.name} record — ${entrance.attendeesWaiting} waiting, ${entrance.waitMinutes} min, ${entrance.activeLanes}/${entrance.maxLanes} lanes, ${entrance.assignedStaff} staff`),
          ...next.staff.map((staff) => `Staff record — ${staff.name}, ${staff.role}, ${staff.availability}, ${staff.currentAssignment}`),
          'Organizer policy — task creation, resource reassignment, staff notification, and operational updates are automatic',
        ] };
    }
    if (incident.type === 'meal_shortage' && catering) {
      const dietaryCovered = (Object.keys(requirements) as MealCategory[]).every((key) => catering.meals[key] >= requirements[key]);
      const covered = catering.totalMeals >= selectRegistrations(next).length && dietaryCovered && catering.assignedStaffIds.length >= 2;
      const names = next.staff.filter((staff) => catering.assignedStaffIds.includes(staff.id)).map((staff) => staff.name);
      return { ...incident, status: covered ? 'Resolved' : 'Escalated', lifecycle: covered ? 'RESOLVED' : 'FAILED', verificationResult: covered ? 'Meal quantity, dietary mix, and staffing coverage verified.' : 'Catering coverage remains incomplete.',
        policyStatus: covered ? 'Executed autonomously — catering response within organizer policy.' : 'Organizer approval required — proposed action exceeds EVA’s authority.',
        metrics: [
          { label: 'Meal coverage', before: `118/${selectRegistrations(next).length}`, after: `${catering.totalMeals}/${selectRegistrations(next).length}` },
          { label: 'Dietary coverage', before: 'Shortage detected', after: dietaryCovered ? 'All categories covered' : 'Gap remains' },
          { label: 'Catering staff assigned', before: '1', after: `${names.length} (${names.join(', ')})` },
          { label: 'Additional cost', before: 'AED 0', after: moneyValue(catering.estimatedAdditionalCost) },
          { label: 'Incident status', before: 'Shortage', after: covered ? 'Resolved' : 'Escalated' },
        ], evidence: [
          `Registration records — ${selectRegistrations(next).length} confirmed attendees`,
          `Catering inventory — ${catering.totalMeals} meals; ${Object.entries(catering.meals).map(([key, value]) => `${key} ${value}`).join(', ')}`,
          `Vendor record — ${catering.vendor}, capacity ${catering.vendorCapacity}, arrival ${catering.expectedArrival}`,
          `Budget record — ${moneyValue(selectEvent(next).budget - selectEvent(next).currentCost)} remaining`,
          ...next.staff.filter((staff) => staff.role.includes('Hospitality') || staff.role.includes('Catering')).map((staff) => `Staff record — ${staff.name}, ${staff.availability}, ${staff.currentAssignment}`),
        ] };
    }
    if (incident.type === 'vendor_delay' && catering) {
      const communication = next.communications.find(
        (item) => item.incidentId === incident.id && item.channel === 'email',
      );
      const communicationReviewed =
        communication?.approvalStatus === 'approved' &&
        (communication.status === 'sent' || communication.status === 'failed');
      const internalBufferReady =
        catering.assignedStaffIds.length >= 2 &&
        catering.operationalNotes.some((note) =>
          note.includes('stage refreshments while awaiting the vendor ETA'),
        );
      const recovered = communicationReviewed && internalBufferReady;
      return { ...incident, status: recovered ? 'Resolved' : 'Escalated', lifecycle: recovered ? 'RESOLVED' : 'FAILED', verificationResult: recovered ? `Vendor communication was approved (${communication?.status}); refreshment buffer and catering handoff staffing verified.` : 'Vendor communication approval or the internal service buffer is incomplete.',
        policyStatus: recovered ? 'Organizer-approved communication completed; internal contingency verified.' : 'Organizer approval required — external vendor communication cannot be bypassed.',
        metrics: incident.metrics.map((metric) => metric.label === 'Vendor arrival' ? { ...metric, after: catering.expectedArrival } : metric.label === 'Catering staff assigned' ? { ...metric, after: String(catering.assignedStaffIds.length) } : metric.label === 'Expected service delay' ? { ...metric, after: recovered ? 'Buffered' : '15 min' } : metric.label === 'Incident status' ? { ...metric, after: recovered ? 'Resolved' : 'Escalated' } : metric),
        evidence: [`Vendor record — ${catering.vendor}, ${catering.deliveryStatus}, arrival ${catering.expectedArrival}`, `Communication — ${communication?.status ?? 'not approved'}, ${communication?.to ?? 'no recipient'}`, `Event timeline — service ${catering.servingTime}`, ...catering.operationalNotes.map((note) => `Operational note — ${note}`)] };
    }
    return incident;
  });
  return next;
}

import type { EvaAction } from './eva-agent';
