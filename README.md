Brindi Bot
===========

Résumé
------
Brindi Bot est un bot WhatsApp basé sur `@whiskeysockets/baileys`. Ce dépôt contient le code principal (`index.js`) et est prêt à être déployé sur Render.

Points importants
-----------------
- Le dossier de sauvegarde d'auth est configurable via la variable d'environnement `AUTH_DIR`.
  - Exemple recommandé sur Render : `AUTH_DIR=/data/brindi_auth`
- Sur Render, montez un disque persistant (volumes) sur `/data` pour que la session WhatsApp survive aux redéploiements.

Installation locale
-------------------
1. Installer les dépendances :

```powershell
npm install
```

2. Supprimer l'ancienne session (si nécessaire) et lancer le bot :

```powershell
Remove-Item -Recurse -Force .\brindi_auth -ErrorAction SilentlyContinue
npm start
```

3. Scanner le QR affiché dans le terminal via WhatsApp > Paramètres > Appareils liés > Lier un appareil.

Déploiement sur Render (guide rapide)
------------------------------------
Option A — (Recommandée si vous avez accès au disque persistant)
1. Créez un nouveau service "Web Service" ou "Background Worker" (Background Worker convient pour tâches non-HTTP).
2. Choisissez le repo contenant ce projet.
3. Branch: `main` (ou la branche souhaitée).
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Runtime: Node (>=18)
7. Volumes / Disque persistant : ajoutez un disque et montez-le sur `/data`.
8. Ajoutez la variable d'environnement dans Render: `AUTH_DIR=/data/brindi_auth`.
9. Déployez. La première fois vous devrez ouvrir les logs et scanner le QR qui apparaîtra dans les logs (ou configurer la capture du QR). Le dossier `/data/brindi_auth` contiendra les fichiers de session.

Option B — (Si vous n'avez pas de disque persistant)
1. Utiliser un stockage externe (S3) pour sauvegarder/charger les fichiers d'auth. Cela nécessite d'implémenter une logique pour sérialiser `state` et `saveCreds` vers S3 et les restaurer au démarrage. C'est plus avancé.

Remarques & limites
-------------------
- Render supprime l'état local par défaut lors des déploiements si vous n'utilisez pas un disque persistant. Sans disque persistant, la session WhatsApp devra être reliée à chaque redéploiement.
- Conserver la session WhatsApp active nécessite d'éviter que le processus se reconnecte trop souvent (risque de blocage par WhatsApp si les connexions échouent fréquemment).

Commandes PM2 (local)
---------------------
Si vous gérez localement avec PM2 :

```powershell
pm2 start startup.js --name "brindi-bot"
pm2 logs brindi-bot
pm2 stop brindi-bot
pm2 delete brindi-bot
```

Déploiement via Docker (Render ou local)
---------------------------------------
Ce projet contient un `Dockerfile` prêt à builder. Le conteneur attend la variable d'environnement `AUTH_DIR`.

Recommandation : sur Render, montez un volume persistant sur `/data` et définissez la variable d'environnement :

`AUTH_DIR=/data/brindi_auth`

Build localement :

```powershell
# depuis le dossier du projet
docker build -t brindi-bot:latest .

# exécuter localement en montant un dossier pour la session
docker run -it --rm -v C:\path\to\local\brindi_auth:/data/brindi_auth -e AUTH_DIR=/data/brindi_auth brindi-bot:latest
```

Sur Render (Docker):
1. Crée un nouveau service et choisis "Docker".
2. Pousse ce repo sur GitHub/GitLab et connecte Render.
3. Dans les settings du service, configure la variable d'environnement `AUTH_DIR=/data/brindi_auth`.
4. Ajoute un disque persistant et monte-le sur `/data`.
5. Déploie : la première fois, ouvre les logs pour voir le QR et scanne-le depuis WhatsApp.

Notes :
- Si `sharp` ou d'autres modules natifs posent problème pendant `npm install`, vérifie les logs de build — le Dockerfile installe `libvips-dev` pour `sharp`.
- Sans volume persistant, tu devras reconnecter le QR après chaque déploiement.

