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
const emailConfig = { serviceUrl: env.PASSWORD_RESET_SERVICE_URL || '', turnstileSiteKey: env.TURNSTILE_SITE_KEY || '' };
if (emailConfig.serviceUrl) {
  const url = new URL(emailConfig.serviceUrl);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid password reset service URL');
}
fs.writeFileSync('js/firebase-config.js', '// Public web app configuration, generated during build.\nwindow.EPAV_FIREBASE_CONFIG = ' + JSON.stringify(config) + ';\nwindow.EPAV_EMAIL_CONFIG = ' + JSON.stringify(emailConfig) + ';\nwindow.EPAV_IMAGE_CONFIG = ' + JSON.stringify({manualUploadsEnabled:env.MANUAL_PHOTOS_ENABLED === 'true'}) + ';\n');
console.log('Firebase web configuration generated.');
