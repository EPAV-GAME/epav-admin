export const IMAGE_SERVICE = 'https://epav-swift-images.kevinernandes2012.workers.dev';
export const MAX_PHOTO_BYTES = 100 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validatePhotoFile(file) {
  if (!file || !allowedTypes.has(file.type)) throw new Error('PHOTO_FORMAT');
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('PHOTO_SIZE');
}

export function fittedRectangle(width, height, edge = 512) {
  if (!(width > 0 && height > 0) || !Number.isFinite(width * height) || width * height > 40_000_000) throw new Error('PHOTO_DIMENSIONS');
  const scale = Math.min(edge / width, edge / height);
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  return {x:Math.floor((edge - w)/2), y:Math.floor((edge - h)/2), width:w, height:h};
}

export async function preparePhoto(file) {
  validatePhotoFile(file);
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = new TextDecoder().decode(signature);
  if (!(signature[0] === 255 && signature[1] === 216 && signature[2] === 255) &&
      !(signature[0] === 137 && text.slice(1,4) === 'PNG') &&
      !(text.slice(0,4) === 'RIFF' && text.slice(8,12) === 'WEBP')) throw new Error('PHOTO_FORMAT');
  let image;
  try { image = await createImageBitmap(file, {imageOrientation:'from-image'}); }
  catch { throw new Error('PHOTO_DECODE'); }
  try {
    const rect = fittedRectangle(image.width,image.height);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; context.fillRect(0,0,512,512);
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(image,rect.x,rect.y,rect.width,rect.height);
    for (const quality of [.82,.76,.68,.60,.50,.40,.30,.20]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/webp',quality));
      if (!blob || blob.type !== 'image/webp') throw new Error('PHOTO_BROWSER');
      if (blob.size <= MAX_PHOTO_BYTES) return blob;
    }
    throw new Error('PHOTO_COMPRESS');
  } finally { image.close(); }
}

async function adminRequest(path, token, {transport = fetch, ...options} = {}) {
  const response = await transport(IMAGE_SERVICE + path, {
    ...options, redirect:'error', signal:AbortSignal.timeout(20000),
    headers:{...options.headers, Authorization:'Bearer '+token},
  });
  if (!response.ok) {
    const code = response.status === 401 ? 'AUTH_INVALID' : response.status === 403 ? 'NO_ADMIN' : response.status === 429 ? 'IMAGE_RATE_LIMIT' : 'IMAGE_SERVICE';
    throw new Error(code);
  }
  return response.json();
}

export async function uploadPhoto(blob, token, {transport = fetch, digest = bytes => crypto.subtle.digest('SHA-256',bytes)} = {}) {
  if (blob.type !== 'image/webp' || !blob.size || blob.size > MAX_PHOTO_BYTES) throw new Error('PHOTO_COMPRESS');
  const hash = [...new Uint8Array(await digest(await blob.arrayBuffer()))].map(value=>value.toString(16).padStart(2,'0')).join('');
  const result = await adminRequest('/admin/images/swift/'+hash+'.webp',token,{method:'PUT',headers:{'Content-Type':'image/webp'},body:blob,transport});
  const image = result.image;
  if (!image || image.sha256 !== hash || image.key !== 'swift/'+hash+'.webp' ||
      image.url !== IMAGE_SERVICE+'/images/swift/'+hash+'.webp' || image.width !== 512 || image.height !== 512 ||
      image.bytes !== blob.size || image.format !== 'webp' || image.manual !== true || image.source !== 'admin') throw new Error('IMAGE_SERVICE');
  return image;
}

export async function loadStorage(token, {transport = fetch} = {}) {
  const data = await adminRequest('/admin/storage',token,{method:'GET',transport});
  for (const field of ['image_count','total_bytes','average_bytes','largest_bytes']) {
    if (!Number.isSafeInteger(data[field]) || data[field] < 0) throw new Error('IMAGE_SERVICE');
  }
  if (!Number.isFinite(Date.parse(data.updated_at))) throw new Error('IMAGE_SERVICE');
  return data;
}

export function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return '—';
  const units = ['B','KB','MB','GB','TB'];
  let index = 0;
  while (value >= 1024 && index < units.length-1) {value /= 1024;index++;}
  return value.toLocaleString('pt-BR',{maximumFractionDigits:index ? 2 : 0}) + ' ' + units[index];
}
