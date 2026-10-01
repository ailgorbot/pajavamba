/**
 * Contrôle des couches et des frontières entre services (L0-13).
 *
 * Règles : RI-ARC-01 à RI-ARC-03 (sens des dépendances, couche fonctionnelle sans framework), RI-ARC-08,
 * RI-SRV-02 (aucun import entre services), RI-COD-13 (aucun cycle).
 * Les paquets internes sont résolus vers leur source (`node_modules/@pajavamba/*` → dossier du dépôt).
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'fonctionnel-vers-structure',
      comment: "La couche fonctionnelle n'importe jamais la couche moyenne (RI-ARC-02).",
      severity: 'error',
      from: { path: '^services/[^/]+/fonctionnel/' },
      to: { path: '^services/[^/]+/structure/' },
    },
    {
      name: 'fonctionnel-hors-noyau',
      comment: "La couche fonctionnelle n'importe que le noyau et son propre service (RI-ARC-03, RI-ARC-08).",
      severity: 'error',
      from: { path: '^services/([^/]+)/fonctionnel/' },
      to: { pathNot: ['^services/$1/fonctionnel/', '^packages/kernel/'] },
    },
    {
      name: 'service-vers-autre-service',
      comment: "Un service n'importe jamais un autre service : événements ou contrats uniquement (RI-SRV-02).",
      severity: 'error',
      from: { path: '^services/([^/]+)/' },
      to: { path: '^services/', pathNot: '^services/$1/' },
    },
    {
      name: 'socle-vers-services',
      comment: 'Les paquets du socle (kernel, contracts, ops, ui) ne connaissent aucun service ni aucune application.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^(services|apps|deploy)/' },
    },
    {
      name: 'noyau-autonome',
      comment: "Le noyau ne dépend d'aucun autre paquet interne.",
      severity: 'error',
      from: { path: '^packages/kernel/' },
      to: { path: '^packages/', pathNot: '^packages/kernel/' },
    },
    {
      name: 'aucun-cycle',
      comment: 'Aucune dépendance circulaire (RI-COD-13).',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|node_modules|tests)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    preserveSymlinks: false,
    combinedDependencies: false,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'default'], extensions: ['.ts', '.tsx', '.js'] },
  },
};
