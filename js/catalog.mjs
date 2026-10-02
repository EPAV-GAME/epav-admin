export const TYPES = ['Carnes', 'Aves', 'Pescados', 'Acompanhamentos', 'Sobremesas', 'Despensa'];
export const OCCASIONS = ['Praticidade', 'Dia a dia', 'Churrasco', 'Lanches', 'Receitas', 'Família', 'Ocasiões especiais', 'Leve'];
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filterProducts(products, { search = '', available = '', type = '', occasion = '' } = {}) {
  const words = normalize(search).trim().split(/\s+/).filter(Boolean);
  return products.filter(product => {
    const haystack = normalize([product.nome, product.codigo, product.dadosOriginais?.Marca, product.dadosOriginais?.Familia].join(' '));
    return words.every(word => haystack.includes(word))
      && (!available || product.disponivelNoJogo === (available === 'yes'))
      && (!type || product.tiposProduto.includes(type)) && (!occasion || product.ocasioes.includes(occasion));
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id.localeCompare(b.id));
}
export function makeEdit(product, { name, available, types, occasions }) {
  name = name.trim();
  if (!name || name.length > 240 || typeof available !== 'boolean') throw new Error('VALIDATION');
  if (!Array.isArray(types) || !Array.isArray(occasions) || types.some(type => !TYPES.includes(type)) || occasions.some(occasion => !OCCASIONS.includes(occasion))) throw new Error('VALIDATION');
  types = TYPES.filter(type => types.includes(type));
  occasions = OCCASIONS.filter(occasion => occasions.includes(occasion));
  const original = { ...product.dadosOriginais, 'Descricao Produto': name, 'Disponível no jogo': available ? 'SIM' : 'NÃO', 'Tipo Produto': types.join('; '), 'Ocasiões': occasions.join('; ') };
  for (const category of [...TYPES, ...OCCASIONS]) original[category] = (types.includes(category) || occasions.includes(category)) ? 'SIM' : 'NÃO';
  return { nome: name, disponivelNoJogo: available, tiposProduto: types, ocasioes: occasions, dadosOriginais: original };
}
export function fingerprint(value) {
  if (value?.toMillis) return String(value.toMillis());
  if (Array.isArray(value)) return '[' + value.map(fingerprint).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + fingerprint(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
