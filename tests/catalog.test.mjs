import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEdit, filterProducts, fingerprint, TYPES, OCCASIONS } from '../js/catalog.mjs';
const product = { id: 'row2', codigo: 102, nome: 'Filé de frango', disponivelNoJogo: true, tiposProduto: ['Aves'], ocasioes: ['Dia a dia'], dadosOriginais: { Marca: 'Swift', Familia: 'Frango', 'Margem de Contribuição': 0.321, 'Unidade Medida': 'KG', 'Status Produto': 'ATIVO', 'Descricao Produto': 'Filé de frango' } };
test('edits preserve commercial values and synchronize classifications', () => {
  const edit = makeEdit(product, { name: ' Frango Swift ', available: false, types: ['Aves'], occasions: ['Família', 'Dia a dia'] });
  assert.equal(edit.dadosOriginais['Margem de Contribuição'], 0.321);
  assert.equal(edit.dadosOriginais['Unidade Medida'], 'KG');
  assert.equal(edit.dadosOriginais['Status Produto'], 'ATIVO');
  assert.equal(edit.dadosOriginais['Descricao Produto'], edit.nome);
  assert.equal(edit.dadosOriginais['Disponível no jogo'], 'NÃO');
  for (const type of TYPES) assert.equal(edit.dadosOriginais[type], edit.tiposProduto.includes(type) ? 'SIM' : 'NÃO');
  for (const occasion of OCCASIONS) assert.equal(edit.dadosOriginais[occasion], edit.ocasioes.includes(occasion) ? 'SIM' : 'NÃO');
  assert.equal(edit.dadosOriginais['Ocasiões'], 'Dia a dia; Família');
});
test('invalid categories and empty names cannot be saved', () => {
  assert.throws(() => makeEdit(product, { name: '', available: true, types: [], occasions: [] }));
  assert.throws(() => makeEdit(product, { name: 'Frango', available: true, types: ['Qualquer coisa'], occasions: [] }));
});
test('search combines accents, code and filters without merging duplicate codes', () => {
  const duplicate = { ...product, id: 'row3' };
  assert.equal(filterProducts([product, duplicate], { search: 'file 102', type: 'Aves', occasion: 'Dia a dia', available: 'yes' }).length, 2);
  assert.equal(filterProducts([product], { available: 'no' }).length, 0);
  assert.equal(filterProducts([product], { occasion: 'Leve' }).length, 0);
});
test('concurrency comparison ignores map order but detects value changes', () => {
  assert.equal(fingerprint({ a: 1, b: { c: 2 } }), fingerprint({ b: { c: 2 }, a: 1 }));
  assert.notEqual(fingerprint(product), fingerprint({ ...product, disponivelNoJogo: false }));
});
