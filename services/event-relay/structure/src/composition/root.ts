/**
 * Racine de composition du service event-relay (câblage manuel, RI-ARC-09).
 *
 * Couche : moyenne (event-relay/structure).
 */
import { join } from 'node:path';
import type { MigrationSet } from '@pajavamba/ops';

export { AUDIT_ENTRY_TYPE, createEventRelay, type EventRelay, type EventRelaySettings } from '../relay/event-relay.ts';

/** Migrations du socle et du relais (appliquées en premier). */
export const EVENT_RELAY_MIGRATIONS: MigrationSet = { service: 'event-relay', directory: join(import.meta.dirname, '../../migrations') };
