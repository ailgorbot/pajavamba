---
titre: Catalogue de journalisation
public: développeurs, exploitants
statut: généré
version_min: 0.4.0
---

# Catalogue de journalisation

> Document **généré** par `tools/reference/generate-catalogs.ts` depuis le catalogue de `packages/ops` (RI-DOC-03). Ne pas modifier à la main.

Version du catalogue : 1 (portée par chaque entrée émise). Le niveau de détail (`PV_APP_LOG_DETAIL`) filtre les entrées : `functional` < `technical` < `debug`.

| Code | Sévérité | Détail | Message | Clé |
|---|---|---|---|---|
| `OPS-START-001` | `info` | `functional` | Service démarré | `serviceStarted` |
| `OPS-START-002` | `info` | `functional` | Arrêt du service demandé | `serviceStopping` |
| `OPS-CONF-001` | `fatal` | `functional` | Configuration invalide | `configInvalid` |
| `OPS-HTTP-001` | `info` | `technical` | Requête traitée | `requestCompleted` |
| `OPS-HTTP-002` | `error` | `technical` | Erreur technique lors du traitement | `requestFailed` |
| `OPS-MIG-001` | `info` | `functional` | Migration appliquée | `migrationApplied` |
| `OPS-MIG-002` | `fatal` | `functional` | Somme de contrôle de migration divergente | `migrationChecksumMismatch` |
| `OPS-ACT-001` | `info` | `functional` | Action exécutée | `actionExecuted` |
| `OPS-ACT-002` | `warn` | `functional` | Action refusée | `actionDenied` |
| `OPS-EVT-001` | `debug` | `debug` | Événement relayé | `eventRelayed` |
| `OPS-EVT-002` | `error` | `technical` | Échec d'un consommateur d'événements | `eventConsumerFailed` |
| `OPS-JOB-001` | `info` | `functional` | Tâche planifiée exécutée | `jobCompleted` |
| `OPS-SEC-001` | `warn` | `functional` | Jeton transmis dans l'URL refusé | `tokenInUrlRejected` |
| `OPS-SEC-002` | `warn` | `functional` | Tentatives de connexion ralenties | `loginThrottled` |
