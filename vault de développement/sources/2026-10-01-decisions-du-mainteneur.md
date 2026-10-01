---
type: source
date: 2026-10-01
immuable: oui
---

# Consignes et choix du mainteneur (29/09 → 01/10/2026)

Instantané immuable, reformulé fidèlement depuis les conversations. Synthèse vivante : [[journal-des-decisions]].

| Date | Consigne ou choix du mainteneur |
|---|---|
| 29/09 | Amorcer le dépôt public avec un commit initial non signé (aucune clé de signature n'existait encore). |
| 30/09 | « Construis le MVP de PajaVamba », le déployer sur le VPS avec Coolify (accès par MCP et jeton fournis), mettre à jour la documentation et les user stories sur GitHub. |
| 30/09 | Signature des commits : le mainteneur charge lui-même sa clé SSH dans l'agent Windows. |
| 30/09 | Licence : d'abord « décider plus tard », puis « Je choisis Apache-2.0 ». |
| 30/09 | Format des PR : une PR par lot (PR empilées) pour le MVP. |
| 30/09 | Disque D: défaillant : d'abord rester sur D:, puis tout déplacer vers `G:\Claude\PajaVamba`. |
| 30/09 | Ne plus traiter ni mentionner certains sujets hors périmètre signalés en passant (jetons d'autres applications, révocation de la clé Coolify). |
| 30/09 | « Le MVP est OK » : recette validée. Puis « oui » pour résorber la dette de lint. |
| 01/10 | Signale deux échecs de CI sur GitHub et demande de les corriger avant de reprendre. |
| 01/10 | « continue » : reprendre les stories partiellement livrées, une PR par story (≤ 400 lignes). |
| 01/10 | Fusionne #256 (gouvernance) et #257 (modèles). |
| 01/10 | Demande le vault de développement selon la méthode LLM Wiki de Karpathy : mémoire secondaire consultée d'abord (puis code qui fait foi, puis GitHub, puis questions via grill-me), mise à jour avant compactage et à chaque livraison, initialisée avec l'existant, inscrite comme règle immuable et comportement de base. |
