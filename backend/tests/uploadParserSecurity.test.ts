import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { processUploadedImage, uploadProductImageFile } from '../src/middleware/upload.middleware';
import { MAX_PRODUCT_IMAGE_BYTES, processImageBuffer } from '../src/middleware/imageProcessor';

const boundary = 'f32-fixture-boundary';
const field = (name: string) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\nx\r\n`);
const file = (data: Buffer, mime = 'image/png') => Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="fixture.png"\r\nContent-Type: ${mime}\r\n\r\n`), data, Buffer.from('\r\n'),
]);
async function upload(parts: Buffer[], closing = true) {
  const body = Buffer.concat([...parts, ...(closing ? [Buffer.from(`--${boundary}--\r\n`)] : [])]);
  const req: any = Readable.from([body]);
  req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(body.length) };
  req.method = 'POST';
  return new Promise<{ status: number; req: any; body?: any }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Multipart parser did not finish')), 3000);
    let status = 200;
    const finish = (data?: any) => { clearTimeout(timer); resolve({ status, req, body: data }); };
    const res: any = { status(code: number) { status = code; return this; }, json: finish };
    uploadProductImageFile(req, res, () => {
      processUploadedImage(req, res, () => finish()).catch(reject);
    });
  });
}

test('F32 installed native parser versions and lock are patched', () => {
  const atLeast = (actual: string, floor: string) => {
    const a = actual.split('.').map(Number), b = floor.split('.').map(Number);
    for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
    return true;
  };
  assert.ok(atLeast(sharp.versions.sharp, '0.35.4'));
  assert.ok(atLeast(sharp.versions.vips, '8.18.3'));
  assert.ok(atLeast(sharp.versions.heif, '1.23.2'));
  assert.ok(atLeast(require('multer/package.json').version, '2.4.0'));
  const lock = require('../package-lock.json');
  assert.equal(lock.packages['node_modules/sharp'].version, sharp.versions.sharp);
  assert.equal(lock.packages['node_modules/multer'].version, require('multer/package.json').version);
});

test('F32 real multipart to native image processor preserves valid image contract', async () => {
  const source = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#cc3311' } }).png().toBuffer();
  const result = await upload([file(source)]);
  assert.equal(result.status, 200); assert.equal(result.req.processedImage.width, 8);
  assert.equal(result.req.processedImage.height, 8);
});

for (const name of ['x[4294967295]', `x${'[a]'.repeat(20)}`]) {
  test(`F32 crafted multipart field rejected safely: ${name}`, async () => {
    const source = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#112233' } }).png().toBuffer();
    const result = await upload([field(name), file(source)]);
    assert.equal(result.status, 400); assert.equal(result.req.processedImage, undefined);
    assert.equal(Object.prototype.hasOwnProperty.call(result.req.body, 'x'), false);
    assert.equal(JSON.stringify(result.body).includes('stack'), false);
  });
}

test('F32 truncated multipart fails without hanging', async () => {
  const result = await upload([file(Buffer.from('truncated'))], false);
  assert.equal(result.status, 400); assert.equal(result.req.processedImage, undefined);
});

test('F32 oversized file keeps existing 413 contract', async () => {
  const result = await upload([file(Buffer.alloc(MAX_PRODUCT_IMAGE_BYTES + 1))]);
  assert.equal(result.status, 413); assert.equal(result.req.processedImage, undefined);
});

test('F32 rejects forged PNG and multiple files without publishing an image', async () => {
  for (const parts of [[file(Buffer.from('<svg onload="alert(1)"/>'))], [file(Buffer.from('x')), file(Buffer.from('y'))]]) {
    const result = await upload(parts); assert.equal(result.status, 400); assert.equal(result.req.processedImage, undefined);
  }
});

test('F32 unsupported native formats still fail the business allowlist', async () => {
  const image = sharp({ create: { width: 2, height: 2, channels: 3, background: '#112233' } });
  for (const source of [await image.clone().tiff().toBuffer(), await image.clone().avif().toBuffer(), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>')]) {
    await assert.rejects(processImageBuffer(source, 'forged.png'), /JPEG|PNG|WebP/);
  }
});
