// Run with the local Firestore emulator on 127.0.0.1:8590, project demo-epav-photo.
// This test intentionally cannot address the production database.
import assert from 'node:assert/strict';
import {TYPES, OCCASIONS} from '../js/catalog.mjs';
const base = 'http://127.0.0.1:8590/v1/projects/demo-epav-photo/databases/(default)/documents';
const documentName = 'projects/demo-epav-photo/databases/(default)/documents/';
const uid = 'test-admin', email = 'admin@example.test';
const jwt = admin => {
  const now = Math.floor(Date.now()/1000), encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  return encode({alg:'none',typ:'JWT'})+'.'+encode({iss:'https://securetoken.google.com/demo-epav-photo',
    aud:'demo-epav-photo',iat:now,exp:now+3600,auth_time:now,user_id:uid,sub:uid,email,admin,
    firebase:{sign_in_provider:'custom',identities:{}}})+'.';
};
function encode(value) {
  if (Array.isArray(value)) return {arrayValue:{values:value.map(encode)}};
  if (value && typeof value === 'object') return {mapValue:{fields:fields(value)}};
  if (typeof value === 'boolean') return {booleanValue:value};
  if (Number.isInteger(value)) return {integerValue:String(value)};
  return {stringValue:value};
}
const fields = value => Object.fromEntries(Object.entries(value).map(([key,value])=>[key,encode(value)]));
const original = {'Descricao Produto':'Produto teste','Disponível no jogo':'SIM','Tipo Produto':'Carnes','Ocasiões':'Churrasco'};
for (const category of [...TYPES,...OCCASIONS]) original[category] = ['Carnes','Churrasco'].includes(category) ? 'SIM' : 'NÃO';
const baseline = {nome:'Produto teste',codigo:'1',disponivelNoJogo:true,tiposProduto:['Carnes'],ocasioes:['Churrasco'],dadosOriginais:original};
const hash = 'a'.repeat(64);
const image = {bucket:'epav-swift-images',key:'swift/'+hash+'.webp',url:'https://epav-swift-images.kevinernandes2012.workers.dev/images/swift/'+hash+'.webp',
  format:'webp',width:512,height:512,bytes:2500,sha256:hash,manual:true,source:'admin',transformVersion:'admin-webp-v1',updatedAt:new Date().toISOString()};
let counter = 0;
async function attempt({photo = image, admin = true, audit = true} = {}) {
  const id = String(++counter).padStart(20,'a');
  const seeded = await fetch(base+'/produtos_swift/p',{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:fields(baseline)})});
  assert.equal(seeded.status,200);
  const updated = {...baseline,...(photo ? {imagemSwift:photo} : {}),atualizadoPor:uid,ultimaAlteracaoId:id};
  const product = {update:{name:documentName+'produtos_swift/p',fields:fields(updated)},updateTransforms:[{fieldPath:'atualizadoEm',setToServerValue:'REQUEST_TIME'}]};
  const history = {update:{name:documentName+'auditoria_catalogo/'+id,fields:fields({produtoId:'p',autorUid:uid,autorEmail:email,antes:baseline,depois:updated})},
    updateTransforms:[{fieldPath:'criadoEm',setToServerValue:'REQUEST_TIME'},{fieldPath:'depois.atualizadoEm',setToServerValue:'REQUEST_TIME'}]};
  const response = await fetch(base+':commit',{method:'POST',headers:{Authorization:'Bearer '+jwt(admin),'Content-Type':'application/json'},body:JSON.stringify({writes:audit ? [product,history] : [product]})});
  return response.status;
}
const cases = [
  ['admin photo with matching audit is allowed',{},200],
  ['existing admin edit without photo still works',{photo:null},200],
  ['ordinary account is intentionally rejected',{admin:false},403],
  ['edit without history is intentionally rejected',{audit:false},403],
  ['external image URL is intentionally rejected',{photo:{...image,url:'https://other.example/photo.webp'}},403],
  ['overlarge image is intentionally rejected',{photo:{...image,bytes:102401}},403],
  ['wrong dimensions are intentionally rejected',{photo:{...image,width:1024}},403],
  ['missing manual protection is intentionally rejected',{photo:{...image,manual:false}},403],
  ['wrong hash/key is intentionally rejected',{photo:{...image,key:'swift/'+ 'b'.repeat(64)+'.webp'}},403],
];
for (const [label,options,expected] of cases) {
  const status = await attempt(options);
  assert.equal(status,expected,label);
  console.log('PASS: '+label+' (expected '+expected+', received '+status+')');
}
const adminRead = await fetch(base+'/produtos_swift/p',{headers:{Authorization:'Bearer '+jwt(true)}});
assert.equal(adminRead.status,200); console.log('PASS: existing admin catalog read remains allowed (200)');
const ordinaryRead = await fetch(base+'/produtos_swift/p',{headers:{Authorization:'Bearer '+jwt(false)}});
assert.equal(ordinaryRead.status,403); console.log('PASS: ordinary catalog read remains intentionally rejected (403)');
console.log('11 local Firestore checks PASSED; there are no failed checks. Expected PERMISSION_DENIED responses verify access protection.');
