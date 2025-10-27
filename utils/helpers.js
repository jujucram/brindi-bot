import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { fileTypeFromBuffer } from 'file-type';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import ytdl from 'ytdl-core';
import sharp from 'sharp';

// Téléchargement de médias
export async function downloadMedia(message, path) {
  const buffer = await downloadMediaMessage(message, 'buffer');
  const type = await fileTypeFromBuffer(buffer);
  const filePath = `${path}/${Date.now()}.${type.ext}`;
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// Création de sticker
export async function createSticker(imagePath, options = {}) {
  const img = sharp(imagePath);
  const resized = await img
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp()
    .toBuffer();
  return resized;
}

// Téléchargement YouTube
export async function downloadYouTube(url, type = 'audio') {
  try {
    const info = await ytdl.getInfo(url);
    const format = type === 'audio' 
      ? ytdl.chooseFormat(info.formats, { quality: 'highestaudio' })
      : ytdl.chooseFormat(info.formats, { quality: 'highest' });
    
    const fileName = `${Date.now()}.${format.container}`;
    const filePath = `./downloads/${fileName}`;
    
    return new Promise((resolve, reject) => {
      ytdl(url, { format })
        .pipe(fs.createWriteStream(filePath))
        .on('finish', () => resolve({ filePath, info }))
        .on('error', reject);
    });
  } catch (error) {
    throw new Error(`Erreur lors du téléchargement YouTube: ${error.message}`);
  }
}

// Vérification des permissions de groupe
export function checkGroupPermissions(sock, msg, groupMetadata) {
  const sender = msg.key.participant || msg.key.remoteJid;
  const isAdmin = groupMetadata?.participants?.find(p => p.id === sender)?.admin;
  const botNumber = sock.user.id.split(':')[0] + "@s.whatsapp.net";
  const isBotAdmin = groupMetadata?.participants?.find(p => p.id === botNumber)?.admin;
  
  return { isAdmin, isBotAdmin };
}

// Formateur de durée
export function formatDuration(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  
  return `${days}j ${hours}h ${minutes}m ${seconds}s`;
}