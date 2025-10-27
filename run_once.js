// Lance le bot puis termine après 8s pour permettre de voir le QR au démarrage
import('./index.js')
setTimeout(() => process.exit(0), 8000)
