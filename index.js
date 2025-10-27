import makeWASocket, { useMultiFileAuthState, downloadMediaMessage, delay } from "@whiskeysockets/baileys"
import { fileTypeFromBuffer } from 'file-type'
import qrcode from 'qrcode-terminal'
import fs from 'fs'
import { createSticker, downloadYouTube, checkGroupPermissions, formatDuration } from './utils/helpers.js'
import cron from 'node-cron'

// Collection de blagues pour la commande !blague
const blagues = [
  "Que fait une fraise sur un cheval ? Tagada Tagada",
  "Quel est l'animal le plus heureux ? Le hibou, parce que sa femme est chouette",
  "Que fait un crocodile quand il rencontre une superbe femelle ? Il Lacoste",
  "Quel est le sport préféré des insectes ? Le cricket",
  "Pourquoi les poissons vivent dans l'eau salée ? Parce que dans l'eau poivrée, ils éternuent",
  "Qu'est-ce qu'un yaourt dans la forêt ? Un yaourt nature",
  "Quel est le comble pour un électricien ? Ne pas être au courant",
  "Comment appelle-t-on un chat qui va dans l'espace ? Un chatellite",
  "Que fait une vache quand elle ferme les yeux ? Du lait concentré",
  "Pourquoi les chiens n'aiment pas jouer aux cartes ? Parce qu'il y a un chat qui miaou"
]

// Configuration
const config = JSON.parse(fs.readFileSync('./config.json'))
let startTime = Date.now()

// Créer le dossier downloads s'il n'existe pas
if (!fs.existsSync('./downloads')) {
  fs.mkdirSync('./downloads')
}

let sock = null
let restarting = false
// Retry/backoff config to avoid crash loops
let retryCount = 0
const MAX_RETRIES = parseInt(process.env.MAX_RESTARTS || '5')
const BASE_BACKOFF_MS = parseInt(process.env.BACKOFF_MS || '5000')

async function startBrindiBot() {
  if (restarting) return
  restarting = true
  console.log("🤖 Brindi Bot est en train de démarrer...")

  try {

  // Dossier d’authentification (sauvegarde de ta session)
  // Le dossier d'auth peut être configuré via la variable d'environnement AUTH_DIR.
  // Sur Render vous monterez un disque persistant sur /data et vous mettrez AUTH_DIR=/data/brindi_auth
  const authDir = process.env.AUTH_DIR || "brindi_auth"
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  sock = makeWASocket({
    auth: state,
    defaultQueryTimeoutMs: 60000,
  })

  // Sauvegarde automatique des données de connexion
  sock.ev.on("creds.update", saveCreds)

  // Affiche le QR dans le terminal lors de la (re)connexion initiale
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      try {
        qrcode.generate(qr, { small: true })
        console.log('📷 QR code affiché dans le terminal — scanne-le avec WhatsApp.')
      } catch (err) {
        console.log('Erreur lors de la génération du QR :', err)
      }
    }

    if (connection === 'close') {
      console.log('🔌 Connection fermée', lastDisconnect?.error || '')
      // Récupère le code de status si présent
      const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.data?.attrs?.code
      console.log('Reason code (if present):', statusCode)

      // Si c'est une erreur d'auth (401), supprime le dossier d'auth pour forcer un reconnect manuel
      if (statusCode == 401) {
        try {
          console.log('⚠️ Erreur d\'authentification détectée (401). Suppression du dossier d\'auth pour forcer un nouveau scan QR.')
          if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true })
            console.log('🗑️ Dossier d\'auth supprimé:', authDir)
          }
        } catch (e) {
          console.error('Erreur lors de la suppression du dossier d\'auth:', e)
        }
        console.log('🛑 Arrêt du processus. Redémarrez manuellement pour générer un nouveau QR et reconnecter.')
        process.exit(1)
      }

      // Tentative de reconnexion contrôlée avec backoff
      if (retryCount < MAX_RETRIES) {
        const delay = BASE_BACKOFF_MS * Math.pow(2, retryCount)
        console.log(`🔁 Tentative de reconnexion #${retryCount + 1} dans ${delay} ms...`)
        retryCount++
        setTimeout(() => {
          console.log('� Démarrage du socket (reconnect)...')
          restarting = false
          startBrindiBot().catch(err => {
            console.log('Erreur lors du redémarrage :', err)
          })
        }, delay)
      } else {
        console.error(`⛔ Trop de tentatives de reconnexion (${retryCount}). Arrêt du processus pour investigation.`)
        process.exit(1)
      }
    } else if (connection === 'open') {
      console.log('✅ Connecté')
      // reset retry counter on successful connection
      retryCount = 0
      restarting = false
    }
  })

  // Gestion des messages
  sock.ev.on("messages.upsert", async ({ messages }) => {
  const msg = messages[0]
  if (!msg.message) return

  const from = msg.key.remoteJid
  const isGroup = from.endsWith('@g.us')
  const sender = msg.key.participant || msg.key.remoteJid

  // Extract text from multiple possible message shapes
  const conv = msg.message.conversation
  const extText = msg.message.extendedTextMessage?.text
  const imgCaption = msg.message.imageMessage?.caption
  const vidCaption = msg.message.videoMessage?.caption
  const btnText = msg.message.buttonsResponseMessage?.selectedButtonId
  const listText = msg.message.listResponseMessage?.singleSelectReply?.selectedRowId

  const body = (conv || extText || imgCaption || vidCaption || btnText || listText || '')
  const text = body.toString().trim()
  const bodyLower = text.toLowerCase()

  console.log("📩 Message reçu :", text)

    // --- Commandes du bot ---

    if (bodyLower === `${config.prefix}ping`) {
      await sock.sendMessage(from, { text: "🏓 Pong! Je suis là 👋 — Brindi Bot" })
    }

    if (bodyLower === `${config.prefix}alive`) {
      const uptime = formatDuration(Date.now() - startTime)
      await sock.sendMessage(from, { 
        text: `✅ Brindi Bot est en ligne!\n\n⏱️ Uptime: ${uptime}\n🔋 Mémoire: ${process.memoryUsage().heapUsed / 1024 / 1024} MB` 
      })
    }

    if (bodyLower === `${config.prefix}help`) {
      const helpText = `📜 *Commandes Brindi Bot*\n
🔰 Commandes de Base:
${config.prefix}ping - Test de réponse
${config.prefix}alive - État du bot
${config.prefix}help - Cette aide

📱 Stickers & Média:
${config.prefix}sticker - Crée un sticker (envoie avec une image)
${config.prefix}yt - Télécharge audio/vidéo YouTube
${config.prefix}save - Sauvegarde un média
${config.prefix}unview - Convertit un message view-once en normal

👥 Commandes de Groupe:
${config.prefix}tag/tagall - Mentionne tous les membres
${config.prefix}tagadmins - Mentionne les admins
${config.prefix}add - Ajoute un membre
${config.prefix}kick - Exclut un membre
${config.prefix}promote - Nomme admin
${config.prefix}demote - Retire admin
${config.prefix}mute - Passe en mode annonce (admins seuls)
${config.prefix}unmute - Remet en mode normal
${config.prefix}groupinfo - Infos du groupe
${config.prefix}extract - Exporte la liste des membres
${config.prefix}leave - Fait quitter le bot

👤 Infos & Utilisateurs:
${config.prefix}userinfo - Info sur un utilisateur
${config.prefix}whois - Qui a envoyé la commande
${config.prefix}owner - Contact du propriétaire
${config.prefix}info - Infos sur le bot`

      await sock.sendMessage(from, { text: helpText })
    }

    // --- Commandes de stickers ---
      
    // Sticker command: accepts either sending an image with caption '!sticker' or sending '!sticker' replying to an image
    if (bodyLower.startsWith(`${config.prefix}sticker`)) {
      try {
        let buffer = null
        // If current message contains an image
        if (msg.message.imageMessage) {
          buffer = await downloadMediaMessage(msg, 'buffer')
        } else {
          // Check quoted message (reply) for an image
          const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage
          if (quoted && quoted.imageMessage) {
            const quotedMsg = { key: { remoteJid: from, id: msg.key.id }, message: quoted }
            buffer = await downloadMediaMessage(quotedMsg, 'buffer')
          }
        }

        if (!buffer) {
          await sock.sendMessage(from, { text: "❌ Envoie une image **avec** la commande ou répond à une image avec la commande !sticker." })
        } else {
          const sticker = await createSticker(buffer)
          await sock.sendMessage(from, { sticker })
        }
      } catch (error) {
        console.error('Erreur sticker:', error)
        await sock.sendMessage(from, { text: "❌ Erreur lors de la création du sticker." })
      }
    }

    // --- Commandes YouTube ---
      
    if (bodyLower.startsWith(`${config.prefix}yt `)) {
      const url = text.slice((config.prefix + 'yt ').length)
      if (!ytdl || !ytdl.validateURL || !ytdl.validateURL(url)) {
        await sock.sendMessage(from, { text: "❌ URL YouTube invalide ou ytdl non installé." })
        return
      }

      try {
        const { filePath, info } = await downloadYouTube(url)
        await sock.sendMessage(from, { 
          document: fs.readFileSync(filePath),
          mimetype: 'audio/mp4',
          fileName: `${info.title}.mp3`
        })
        fs.unlinkSync(filePath)
      } catch (error) {
        await sock.sendMessage(from, { text: "❌ Erreur lors du téléchargement." })
      }
    }

    // --- Commandes de groupe ---
      
    if (isGroup) {
      const groupMetadata = await sock.groupMetadata(from)
  const { isAdmin, isBotAdmin } = checkGroupPermissions(sock, msg, groupMetadata)

  if (bodyLower.startsWith(`${config.prefix}add `)) {
        if (!isAdmin) {
          await sock.sendMessage(from, { text: "❌ Tu dois être admin pour utiliser cette commande!" })
          return
        }

          const number = text.slice((config.prefix + 'add ').length).replace(/[^0-9]/g, '') + "@s.whatsapp.net"
        try {
          await sock.groupParticipantsUpdate(from, [number], "add")
        } catch (error) {
          await sock.sendMessage(from, { text: "❌ Impossible d'ajouter le membre." })
        }
      }

  if (bodyLower.startsWith(`${config.prefix}kick `)) {
        if (!isAdmin || !isBotAdmin) {
          await sock.sendMessage(from, { text: "❌ Permissions insuffisantes!" })
          return
        }

          const number = text.slice((config.prefix + 'kick ').length).replace(/[^0-9]/g, '') + "@s.whatsapp.net"
        try {
          await sock.groupParticipantsUpdate(from, [number], "remove")
        } catch (error) {
          await sock.sendMessage(from, { text: "❌ Impossible d'exclure le membre." })
        }
      }

      if (text.startsWith(`${config.prefix}promote `)) {
        if (!isAdmin || !isBotAdmin) {
          await sock.sendMessage(from, { text: "❌ Permissions insuffisantes!" })
          return
        }

        const number = text.slice((config.prefix + 'promote ').length).replace(/[^0-9]/g, '') + "@s.whatsapp.net"
        try {
          await sock.groupParticipantsUpdate(from, [number], "promote")
          await sock.sendMessage(from, { text: "✅ Membre promu admin avec succès." })
        } catch (error) {
          await sock.sendMessage(from, { text: "❌ Impossible de promouvoir le membre." })
        }
      }

      if (text.startsWith(`${config.prefix}demote `)) {
        if (!isAdmin || !isBotAdmin) {
          await sock.sendMessage(from, { text: "❌ Permissions insuffisantes!" })
          return
        }

        const number = text.slice((config.prefix + 'demote ').length).replace(/[^0-9]/g, '') + "@s.whatsapp.net"
        try {
          await sock.groupParticipantsUpdate(from, [number], "demote")
          await sock.sendMessage(from, { text: "✅ Membre rétrogradé avec succès." })
        } catch (error) {
          await sock.sendMessage(from, { text: "❌ Impossible de rétrograder le membre." })
        }
      }

  if (bodyLower === `${config.prefix}groupinfo`) {
        const info = `*📊 Infos du Groupe*\n
📝 Nom: ${groupMetadata.subject}
👥 Membres: ${groupMetadata.participants.length}
👑 Créateur: ${groupMetadata.owner}
📅 Créé le: ${new Date(groupMetadata.creation * 1000).toLocaleDateString()}`

         await sock.sendMessage(from, { text: info })
       }

      // Commande tagall pour mentionner tous les membres
      if (bodyLower === `${config.prefix}tagall`) {
        if (!isAdmin) {
          await sock.sendMessage(from, { text: "❌ Tu dois être admin pour utiliser cette commande!" })
          return
        }

        let mentions = groupMetadata.participants.map(participant => participant.id)
        let message = "🔔 *Mention de Groupe*\n\n"
        groupMetadata.participants.forEach(participant => {
          message += `@${participant.id.split('@')[0]}\n`
        })

        await sock.sendMessage(from, { 
          text: message,
          mentions: mentions
        })
      }
    }

    // --- Commandes globales non-groupe ---
    if (bodyLower === `${config.prefix}owner`) {
      // Envoie le contact/nom du propriétaire depuis la config
      const ownerText = config.owner || 'Contact propriétaire non défini dans config.json'
      await sock.sendMessage(from, { text: `👤 Propriétaire: ${ownerText}` })
    }

    if (bodyLower === `${config.prefix}info`) {
      const uptime = formatDuration(Date.now() - startTime)
      const botInfo = `🤖 Brindi Bot\n\n⏱️ Uptime: ${uptime}\n🔋 Mémoire: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n🧭 Node: ${process.version}`
      await sock.sendMessage(from, { text: botInfo })
    }

    // Commande blague - fonctionne partout
    if (bodyLower === `${config.prefix}blague`) {
      const blague = blagues[Math.floor(Math.random() * blagues.length)]
      await sock.sendMessage(from, { 
        text: `😄 *Blague du jour*\n\n${blague}`,
        viewOnce: false  // Désactive la vue unique
      })
    }
  })

    // Planification du redémarrage périodique
    if (config.autoRestart) {
      cron.schedule('0 */12 * * *', () => {
        console.log('🔄 Redémarrage planifié...')
        process.exit(0)
      })
    }

  } catch (err) {
    console.error('Erreur fatale:', err)
    process.exit(1)
  }
}

// Gestion des erreurs globales
// Gestion d'erreurs globales : on log et on quitte (laissez PM2/Docker relancer). Ne relancez pas directement depuis le code.
process.on('uncaughtException', err => {
  console.error('Erreur non gérée (uncaughtException):', err)
  // Quitte avec code d'erreur pour que l'orchestrateur redémarre proprement
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise non gérée rejetée (unhandledRejection):', reason)
  process.exit(1)
})

process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du bot...')
  process.exit(0)
})

startBrindiBot()