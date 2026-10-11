# Debug Session: electron-sqlite-abi
- **Status**: [OPEN]
- **Issue**: L'application Electron packagée ne peut pas ouvrir la base SQLite car `better-sqlite3.node` a été compilé pour `NODE_MODULE_VERSION 137` alors que le runtime packagé demande `130`.
- **Debug Server**: pending
- **Log File**: .dbg/trae-debug-log-electron-sqlite-abi.ndjson

## Reproduction Steps
1. Générer le build Electron dans `dist-electron-v40`.
2. Lancer `Vente en Ligne.exe`.
3. Déclencher une route qui ouvre la base de données, par exemple l'import produit.
4. Observer l'erreur `ERR_DLOPEN_FAILED` liée à `better-sqlite3`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Le build packagé embarque un binaire `better-sqlite3` compilé pour la mauvaise ABI Node | High | Low | Confirmed: le hash du binaire dans `dist-electron-v40/.../better_sqlite3.node` diffère de celui du workspace courant |
| B | Le rebuild natif est fait pour le Node du poste et pas pour l'Electron cible | High | Low | Rejected: `electron-builder install-app-deps` cible `electronVersion=33.4.11` et `ELECTRON_RUN_AS_NODE=1 electron.cmd` charge `better-sqlite3` avec `modules=130` |
| C | Le packaging copie le mauvais dossier `node_modules/better-sqlite3` dans `build/standalone` | Medium | Medium | Confirmed: `scripts/prepare-electron.js` ne remplace les dépendances critiques que si la destination n'existe pas déjà |
| D | La version d'Electron configurée et la version utilisée pendant le rebuild ne correspondent pas | Medium | Low | Rejected: la version installée et utilisée pendant le rebuild est `33.4.11` |
| E | L'ouverture DB pointe vers un chemin packagé correct, mais le preload/runtime charge un autre `node` natif que prévu | Low | Medium | Rejected: le chemin d'erreur pointe bien vers `resources/app/build/standalone/node_modules/better-sqlite3/...` |

## Log Evidence
- Node local du poste: `24.14.1` (`modules=137`)
- Runtime Electron de build: `33.4.11` avec Node `20.18.3` (`modules=130`)
- `ELECTRON_RUN_AS_NODE=1 .\\node_modules\\.bin\\electron.cmd` charge bien `better-sqlite3`
- Hash `node_modules/better-sqlite3/build/Release/better_sqlite3.node`: `A790C3F5...`
- Hash `.next/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node`: `A790C3F5...`
- Hash `build/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node`: `A790C3F5...`
- Hash `dist-electron-v40/win-unpacked/resources/app/build/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node`: `D57F5F98...`
- Après correctif, hash `dist-electron-v40/win-unpacked/resources/app/build/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node`: `A790C3F5...`
- Le dernier `electron:build` a échoué sur `Accès refusé` en supprimant `dist-electron-v40/win-unpacked/d3dcompiler_47.dll`, avec plusieurs processus `Vente en Ligne.exe` encore ouverts.

## Verification Conclusion
- Cause confirmée 1: le build packagé actuellement lancé par l'utilisateur contient encore un ancien binaire `better-sqlite3` distinct de celui du workspace courant.
- Cause confirmée 2: le script de préparation ne force pas le remplacement des dépendances critiques dans le dossier packagé, ce qui permet à un ancien module natif de survivre d'un build à l'autre.
- Cause confirmée 3: la reconstruction propre de `dist-electron-v40` a été empêchée par des exécutables `Vente en Ligne.exe` encore en cours d'exécution.
- Vérification post-correctif: le chemin exact de l'erreur initiale dans `win-unpacked/resources/app/build/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node` contient désormais le même binaire que le workspace rebuildé pour Electron.
