import { selectCatering, selectEvent, type DemoDatabase } from './demo-database.ts';
import type { EvaAction } from './eva-agent.ts';

export function vendorDelayRecoveryActions(
  state: DemoDatabase,
  idPrefix: string,
): EvaAction[] {
  const event = selectEvent(state);
  const catering = selectCatering(state);
  const incident = state.incidents.find(
    (item) => item.eventId === event.id && item.type === 'vendor_delay',
  );
  const contact = state.contacts.find(
    (item) => item.id === catering?.vendorContactId && item.type === 'vendor',
  );
  if (!catering || !incident || !contact) return [];

  const action = (
    suffix: string,
    value: Omit<EvaAction, 'id' | 'estimatedCost' | 'approvalRequired' | 'approvalReason'> &
      Partial<Pick<EvaAction, 'estimatedCost' | 'approvalRequired' | 'approvalReason'>>,
  ): EvaAction => ({
    id: `${idPrefix}-${suffix}`,
    estimatedCost: 0,
    approvalRequired: false,
    approvalReason: null,
    ...value,
  });

  return [
    action('vendor-task', {
      type: 'create_task', target: 'Catering', from: null,
      to: `Obtain approved ETA confirmation from ${catering.vendor}`, quantity: null,
      reason: 'Track the required external vendor communication and response.',
    }),
    action('delay-staff', {
      type: 'assign_catering_staff', target: 'Catering', from: 'Available pool',
      to: 'Refreshment buffer and distribution preparation', quantity: 1,
      reason: 'Add named staff coverage for the delayed handoff.',
    }),
    action('delay-notify', {
      type: 'notify_internal', target: 'Catering and operations', from: null,
      to: 'Vendor delay detected; use refreshments as a temporary buffer.', quantity: null,
      reason: 'Notify affected internal teams.',
    }),
    action('delay-note', {
      type: 'update_operational_notes', target: 'Catering notes', from: null,
      to: 'Protect the public schedule; stage refreshments while awaiting the vendor ETA.', quantity: null,
      reason: 'Record the bounded internal contingency.',
    }),
    action('vendor-email', {
      type: 'send_email', target: contact.email, from: null,
      to: `Urgent: Updated ETA Required – ${event.name}`, quantity: null,
      reason: 'Request a confirmed arrival time so EVA can coordinate the catering handoff.',
      approvalRequired: true,
      approvalReason: 'External communication always requires organizer approval.',
      emailDraft: {
        to: contact.email,
        subject: `Urgent: Updated ETA Required – ${event.name}`,
        body: `Hello ${contact.name},\n\nWe received an updated catering arrival time of ${catering.expectedArrival}, which is after the planned service time of ${catering.servingTime}. Please confirm your current ETA and whether the delivery can be expedited.\n\nOur on-site catering team is preparing a refreshment buffer and handoff coverage. A prompt confirmation will help us protect the event schedule.\n\nRegards,\nEventOS Operations for ${event.name}`,
        reason: 'Request a confirmed vendor ETA for the active catering delay.',
        eventId: event.id,
        incidentId: incident.id,
      },
    }),
  ];
}
