---
type: concept
mise_a_jour: 2026-10-01
sources: [services/identity, packages/ops/src/secrets.ts, services/api-gateway]
---

# Authentification

- **Initialisation** : code d'initialisation généré dans `/secrets/setup_code` du conteneur `pv-app`, jamais journalisé ; page `/initialisation` crée l'organisation et le propriétaire.
- **Mots de passe** : argon2id (`@node-rs/argon2`), contrôle des mots de passe compromis, hachage factice pour les comptes inconnus (temps constant), ralentissement après échecs. Un échec de connexion est **commité** (`openSession` renvoie `{ status: 'rejected' }`) pour que le compteur ne soit pas annulé par le retour arrière.
- **Session** : cookie `__Host-pv_session` (Secure, HTTPS obligatoire) + jeton CSRF pour les écritures depuis l'interface.
- **MFA** : TOTP (`otpauth`) et codes de récupération ; « MFA récente » (< 15 min) exigée pour R3. WebAuthn à venir (L1-19).
- **Clé API** personnelle : format `pvb_key_…` avec somme de contrôle CRC32 (détection par les scanners), stockée en HMAC avec un poivre (`pepper`) ; jamais acceptée dans l'URL ; jamais pour R3.
- Secrets d'exécution lus en fichiers `*_FILE` (aucun en variable d'environnement), générés par `pv-init` ([[pv-app-et-compose]]).

Voir [[identity]], [[autorisation]].
