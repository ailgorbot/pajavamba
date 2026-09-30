/**
 * Journal structuré unique : entrées cataloguées, masquage par liste blanche, écriture asynchrone.
 *
 * Couche : haute (OPS). Règles : RI-LOG-01, RI-LOG-05 (aucun texte libre ni donnée personnelle),
 * RI-LOG-06 (liste blanche), RI-LOG-07 (asynchrone), RI-LOG-09 (attributs), RI-LOG-12 (échappement).
 */
import { destination as pinoDestination, pino, type Logger as PinoLogger } from 'pino';
import { LOG_CATALOG, LOG_CATALOG_VERSION, type LogDetail, type LogEntryKey } from './log-catalog.ts';

/** Attributs autorisés dans une entrée (identifiants opaques et valeurs énumérées uniquement). */
const ALLOWED_ATTRIBUTES = new Set([
  'correlationId',
  'traceId',
  'service',
  'method',
  'route',
  'statusCode',
  'durationMs',
  'errorCode',
  'errorClass',
  'action',
  'eventType',
  'count',
  'migration',
  'version',
  'port',
  'reason',
]);

const MAX_ATTRIBUTE_LENGTH = 200;
const DETAIL_ORDER: Readonly<Record<LogDetail, number>> = { functional: 0, technical: 1, debug: 2 };

/** Valeur d'attribut acceptée. */
export type LogAttributeValue = string | number | boolean;

/** Journal applicatif catalogué. */
export interface Logger {
  /**
   * Émet une entrée du catalogue ; les attributs hors liste blanche sont supprimés.
   * @param key clé de l'entrée
   * @param attributes attributs structurés
   */
  emit(key: LogEntryKey, attributes?: Readonly<Record<string, LogAttributeValue>>): void;
}

/**
 * Échappe les caractères de contrôle et borne la longueur d'une valeur.
 * @param value valeur brute
 * @returns valeur sûre
 */
function sanitize(value: LogAttributeValue): LogAttributeValue {
  if (typeof value !== 'string') {
    return value;
  }
  const escaped = value.replaceAll(/\p{Cc}/gu, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return escaped.slice(0, MAX_ATTRIBUTE_LENGTH);
}

/**
 * Filtre les attributs par liste blanche.
 * @param attributes attributs fournis
 * @returns attributs conservés
 */
function filterAttributes(attributes: Readonly<Record<string, LogAttributeValue>>): Record<string, LogAttributeValue> {
  const kept: Record<string, LogAttributeValue> = {};
  for (const [name, value] of Object.entries(attributes)) {
    if (ALLOWED_ATTRIBUTES.has(name)) {
      kept[name] = sanitize(value);
    }
  }
  return kept;
}

/** Options de création du journal. */
export interface LoggerOptions {
  readonly service: string;
  readonly detail: LogDetail;
  /** Destination synchrone réservée aux tests. */
  readonly destination?: NodeJS.WritableStream;
}

/**
 * Crée le journal d'un service.
 * @param options service, niveau de détail et destination
 * @returns journal catalogué
 */
export function createLogger(options: LoggerOptions): Logger {
  const destination = options.destination ?? pinoDestination({ sync: false });
  const base: PinoLogger = pino({ base: { service: options.service }, level: 'debug' }, destination);
  return {
    emit(key, attributes = {}) {
      const entry = LOG_CATALOG[key];
      if (DETAIL_ORDER[entry.detail] > DETAIL_ORDER[options.detail]) {
        return;
      }
      base[entry.severity]({ code: entry.code, catalog: LOG_CATALOG_VERSION, detail: entry.detail, ...filterAttributes(attributes) }, entry.message);
    },
  };
}
