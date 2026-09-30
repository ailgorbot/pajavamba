/**
 * Génère la référence des actions (routes, permissions, niveaux de risque, règles) depuis le
 * registre d'actions ; la CI échoue si le fichier commité diffère (`--check`).
 *
 * Outillage. Règles : RI-DOC-03 (référence générée depuis le code, jamais écrite à la main),
 * RI-API-01, RI-MET-08.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERMISSIONS, type ActionDefinition, type RegisteredAction } from '@pajavamba/contracts';
import { toEntityId } from '@pajavamba/kernel';
import type pg from 'pg';

const OUTPUT = join(import.meta.dirname, '../../docs/reference/actions.md');
const RISK_LABELS: Readonly<Record<string, string>> = { R0: 'R0 — lecture', R1: 'R1 — écriture réversible', R2: 'R2 — écriture sensible', R3: 'R3 — administration (interface + MFA récente)' };

/**
 * Collecte les déclarations de toutes les actions, sans connexion à la base.
 * @returns déclarations triées par chemin
 */
async function collect(): Promise<readonly ActionDefinition[]> {
  const pool = {} as pg.Pool;
  const clock = { now: () => 0 };
  const ids = { next: () => toEntityId<'x'>('00000000-0000-7000-8000-000000000000') };
  const policy = { authorize: () => Promise.resolve({ allowed: true as const }), projectsWith: () => Promise.resolve({ all: true as const }) };
  const notify = (): void => undefined;
  const { createIdentityRuntime, createIdentityService, createSecretService } = await import('@pajavamba/identity-structure');
  const { createPortfolioService } = await import('@pajavamba/portfolio-structure');
  const { createWorkflowService } = await import('@pajavamba/workflow-structure');
  const { createWorkItemService } = await import('@pajavamba/workitem-structure');
  const { createQueryService } = await import('@pajavamba/query-structure');
  const { createAuditService } = await import('@pajavamba/audit-structure');
  const common = { pool, clock, ids, policy, notify };
  const secrets = createSecretService({ pepper: 'x'.repeat(32), setupCode: 'x'.repeat(16), dummyPasswordHash: '' });
  const services: readonly { readonly actions: readonly RegisteredAction[] }[] = [
    createIdentityService(createIdentityRuntime({ ...common, secrets, fieldKey: Buffer.alloc(32) })),
    createPortfolioService(common), createWorkflowService(common), createWorkItemService(common),
    createQueryService({ pool, policy }), createAuditService({ pool, policy, auditTypes: [], notify }),
  ];
  return services.flatMap((service) => service.actions.map((action) => action.definition)).sort((left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method));
}

/**
 * Libellé de l'accès exigé par une action.
 * @param action déclaration
 * @returns libellé Markdown
 */
function accessLabel(action: ActionDefinition): string {
  if (action.permission === 'public') return 'publique';
  if (action.permission === 'self') return 'utilisateur authentifié';
  return '`' + action.permission + '`';
}

/**
 * Produit le document Markdown.
 * @param actions déclarations
 * @returns contenu
 */
function render(actions: readonly ActionDefinition[]): string {
  const rows = actions.map((action) => `| \`${action.method} /api/v1${action.path}\` | \`${action.id}\` | ${accessLabel(action)} | ${RISK_LABELS[action.risk] ?? action.risk} | ${action.description} | ${action.rules.join(', ') || '—'} |`);
  const permissions = Object.entries(PERMISSIONS).map(([name, definition]) => `| \`${name}\` | ${definition.risk} | ${definition.description} |`);
  return [
    '---',
    'titre: Référence des actions de l’API',
    'public: développeurs, intégrateurs',
    'statut: généré',
    'version_min: 0.4.0',
    '---',
    '',
    '# Référence des actions',
    '',
    '> Document **généré** par `tools/reference/generate-actions-reference.ts` depuis le registre d’actions (RI-DOC-03). Ne pas modifier à la main.',
    '',
    `Nombre d’actions : ${String(actions.length)}.`,
    '',
    '| Route | Action | Accès | Niveau de risque | Description | Règles |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Catalogue des permissions',
    '',
    '| Permission | Niveau | Description |',
    '|---|---|---|',
    ...permissions,
    '',
  ].join('\n');
}

const content = render(await collect());
if (process.argv.includes('--check')) {
  const current = readFileSync(OUTPUT, 'utf8');
  if (current !== content) {
    console.error('La référence des actions est désynchronisée : exécutez pnpm reference.');
    process.exitCode = 1;
  }
} else {
  writeFileSync(OUTPUT, content);
}
