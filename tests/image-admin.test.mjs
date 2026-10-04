import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePhotoFile, fittedRectangle, uploadPhoto, loadStorage, formatBytes, IMAGE_SERVICE} from '../js/image-admin.mjs';

test('unsupported files and overlarge uploads are rejected before decoding or sending',()=>{
  assert.throws(()=>validatePhotoFile({type:'image/svg+xml',size:100}),/PHOTO_FORMAT/);
  assert.throws(()=>validatePhotoFile({type:'image/png',size:0}),/PHOTO_SIZE/);
  assert.throws(()=>validatePhotoFile({type:'image/jpeg',size:11*1024*1024}),/PHOTO_SIZE/);
  validatePhotoFile({type:'image/webp',size:102400});
});

test('normalization keeps the full product and its proportions inside a square',()=>{
  assert.deepEqual(fittedRectangle(900,600),{x:0,y:85,width:512,height:341});
  assert.deepEqual(fittedRectangle(300,600),{x:128,y:0,width:256,height:512});
  assert.throws(()=>fittedRectangle(9000,9000),/PHOTO_DIMENSIONS/);
});

test('authenticated upload uses only our Worker, an immutable hash and validated metadata',async()=>{
  const blob = new Blob(['test'],{type:'image/webp'}), hash = 'a'.repeat(64);
  const image = {key:'swift/'+hash+'.webp',sha256:hash,url:IMAGE_SERVICE+'/images/swift/'+hash+'.webp',width:512,height:512,bytes:4,format:'webp',manual:true,source:'admin'};
  const options = {digest:async()=>new Uint8Array(32).fill(170).buffer,transport:async(url,options)=>{
    assert.equal(url,IMAGE_SERVICE+'/admin/images/swift/'+hash+'.webp');
    assert.equal(options.headers.Authorization,'Bearer test-token');
    assert.equal(options.method,'PUT'); assert.equal(options.redirect,'error');
    return Response.json({image});
  }};
  assert.deepEqual(await uploadPhoto(blob,'test-token',options),image);
  await assert.rejects(uploadPhoto(blob,'test-token',{...options,transport:async()=>Response.json({image:{...image,url:'https://other.example/file.webp'}})}),/IMAGE_SERVICE/);
});

test('storage denies unauthorized sessions and malformed counters instead of showing fictitious totals',async()=>{
  await assert.rejects(loadStorage('test-token',{transport:async()=>Response.json({}, {status:403})}),/NO_ADMIN/);
  await assert.rejects(loadStorage('test-token',{transport:async()=>Response.json({}, {status:401})}),/AUTH_INVALID/);
  await assert.rejects(loadStorage('test-token',{transport:async()=>Response.json({image_count:-1})}),/IMAGE_SERVICE/);
  const data = {image_count:0,total_bytes:0,average_bytes:0,largest_bytes:0,updated_at:new Date().toISOString()};
  assert.deepEqual(await loadStorage('test-token',{transport:async()=>Response.json(data)}),data);
});

test('sizes are readable, including an empty bucket',()=>{
  assert.equal(formatBytes(0),'0 B'); assert.equal(formatBytes(1024),'1 KB');
  assert.equal(formatBytes(1572864),'1,5 MB'); assert.equal(formatBytes(NaN),'—');
});
