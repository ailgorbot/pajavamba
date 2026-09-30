/**
 * Catalogue versionné des entrées de journal : aucun message libre n'est émis.
 *
 * Couche : haute (OPS). Règles : RI-LOG-02 (trois niveaux de détail), RI-LOG-03 (catalogue),
 * RI-LOG-04 (messages en français), §15.2.
 */

/** Niveau de détail cumulatif, distinct de la sévérité. */
export type LogDetail = 'functional' | 'technical' | 'debug';

/** Sévérité d'une entrée. */
export type LogSeverity = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** Définition d'une entrée du catalogue. */
export interface LogEntryDefinition {
  readonly code: string;
  readonly severity: LogSeverity;
  readonly detail: LogDetail;
  readonly message: string;
}

/** Version du catalogue, portée par chaque entrée émise. */
export const LOG_CATALOG_VERSION = '1';

/** Entrées du catalogue OPS. */
export const LOG_CATALOG = {
  serviceStarted: { code: 'OPS-START-001', severity: 'info', detail: 'functional', message: 'Service démarré' },
  serviceStopping: { code: 'OPS-START-002', severity: 'info', detail: 'functional', message: 'Arrêt du service demandé' },
  configInvalid: { code: 'OPS-CONF-001', severity: 'fatal', detail: 'functional', message: 'Configuration invalide' },
  requestCompleted: { code: 'OPS-HTTP-001', severity: 'info', detail: 'technical', message: 'Requête traitée' },
  requestFailed: { code: 'OPS-HTTP-002', severity: 'error', detail: 'technical', message: 'Erreur technique lors du traitement' },
  migrationApplied: { code: 'OPS-MIG-001', severity: 'info', detail: 'functional', message: 'Migration appliquée' },
  migrationChecksumMismatch: { code: 'OPS-MIG-002', severity: 'fatal', detail: 'functional', message: 'Somme de contrôle de migration divergente' },
  actionExecuted: { code: 'OPS-ACT-001', severity: 'info', detail: 'functional', message: 'Action exécutée' },
  actionDenied: { code: 'OPS-ACT-002', severity: 'warn', detail: 'functional', message: 'Action refusée' },
  eventRelayed: { code: 'OPS-EVT-001', severity: 'debug', detail: 'debug', message: 'Événement relayé' },
  eventConsumerFailed: { code: 'OPS-EVT-002', severity: 'error', detail: 'technical', message: "Échec d'un consommateur d'événements" },
  jobCompleted: { code: 'OPS-JOB-001', severity: 'info', detail: 'functional', message: 'Tâche planifiée exécutée' },
  tokenInUrlRejected: { code: 'OPS-SEC-001', severity: 'warn', detail: 'functional', message: "Jeton transmis dans l'URL refusé" },
  loginThrottled: { code: 'OPS-SEC-002', severity: 'warn', detail: 'functional', message: 'Tentatives de connexion ralenties' },
} as const satisfies Readonly<Record<string, LogEntryDefinition>>;

/** Clé d'une entrée du catalogue. */
export type LogEntryKey = keyof typeof LOG_CATALOG;
