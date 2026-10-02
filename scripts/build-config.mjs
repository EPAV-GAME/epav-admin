import fs from 'node:fs';
const env = { ...process.env };
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !env[match[1]]) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}
const names = { apiKey: 'FIREBASE_API_KEY', authDomain: 'FIREBASE_AUTH_DOMAIN', projectId: 'FIREBASE_PROJECT_ID', storageBucket: 'FIREBASE_STORAGE_BUCKET', messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID', appId: 'FIREBASE_APP_ID' };
const config = Object.fromEntries(Object.entries(names).map(([key, name]) => {
  if (!env[name]) throw new Error('Missing configuration: ' + name);
  return [key, env[name]];
}));
if (config.projectId !== 'epav-game') throw new Error('Unexpected project');
fs.mkdirSync('js', { recursive: true });
fs.writeFileSync('js/firebase-config.js', '// Public web app configuration, generated during build.\nwindow.EPAV_FIREBASE_CONFIG = ' + JSON.stringify(config) + ';\n');
console.log('Firebase web configuration generated.');
