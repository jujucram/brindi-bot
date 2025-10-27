const { exec } = require('child_process');
const path = require('path');

// Chemin vers le fichier principal du bot
const botPath = path.join(__dirname, 'index.js');

// Démarrage du bot
exec(`node ${botPath}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Erreur d'exécution: ${error}`);
    return;
  }
  console.log(`Sortie: ${stdout}`);
  console.error(`Erreurs: ${stderr}`);
});