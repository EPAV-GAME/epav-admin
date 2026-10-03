export function productImageUrl(product) {
  try {
    const url = new URL(product?.imagemSwift?.url);
    if (url.protocol !== 'https:' || url.host !== 'epav-swift-images.kevinernandes2012.workers.dev' || url.username || url.password || url.search || url.hash) return null;
    return /^\/images\/swift\/[a-f0-9]{64}\.webp$/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}

export function createProductPhoto(product, { large = false } = {}) {
  const box = document.createElement('div');
  box.className = 'product-photo' + (large ? ' product-photo-large' : '');
  const placeholder = document.createElement('span');
  placeholder.className = 'product-photo-placeholder';
  const url = productImageUrl(product);
  placeholder.textContent = url ? 'Carregando foto…' : 'Sem foto disponível';
  box.append(placeholder);
  if (url) {
    const image = document.createElement('img');
    image.alt = 'Foto de ' + product.nome;
    image.width = 512; image.height = 512;
    image.loading = large ? 'eager' : 'lazy';
    image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
    image.style.opacity = '0';
    image.onload = () => { placeholder.hidden = true; image.style.opacity = '1'; };
    image.onerror = () => { image.remove(); placeholder.hidden = false; placeholder.textContent = 'Foto indisponível'; };
    image.src = url;
    box.append(image);
  }
  return box;
}
