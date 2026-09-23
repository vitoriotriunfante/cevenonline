// Script pontual: sobe um arquivo pro Google Drive usando a service account,
// sem depender de rclone instalado. Usa só módulos nativos do Node (crypto, https).
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

const KEY_PATH = process.argv[2];
const LOCAL_FILE = process.argv[3];
const FOLDER_ID = process.argv[4];

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function httpsRequest(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = [];
      res.on('data', (c) => data.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(data) }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken(key) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claim));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(key.private_key).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = unsigned + '.' + signature;

  const bodyStr = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
  const res = await httpsRequest({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(bodyStr) }
  }, bodyStr);
  const json = JSON.parse(res.body.toString());
  if (!json.access_token) throw new Error('Falha ao obter token: ' + res.body.toString());
  return json.access_token;
}

async function findFileId(token, name, folderId) {
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\'")}' and '${folderId}' in parents and trashed=false`);
  const res = await httpsRequest({
    hostname: 'www.googleapis.com',
    path: `/drive/v3/files?q=${q}&fields=files(id,name)`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const json = JSON.parse(res.body.toString());
  return (json.files && json.files[0]) ? json.files[0].id : null;
}

async function uploadNewFile(token, name, folderId, filePath) {
  const boundary = '-------314159265358979323846';
  const metadata = JSON.stringify({ name, parents: [folderId] });
  const fileData = fs.readFileSync(filePath);
  const mimeType = 'application/octet-stream';
  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(pre), fileData, Buffer.from(post)]);
  const res = await httpsRequest({
    hostname: 'www.googleapis.com',
    path: '/upload/drive/v3/files?uploadType=multipart',
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': body.length }
  }, body);
  return res;
}

async function updateFile(token, fileId, filePath) {
  const fileData = fs.readFileSync(filePath);
  const res = await httpsRequest({
    hostname: 'www.googleapis.com',
    path: `/upload/drive/v3/files/${fileId}?uploadType=media`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Content-Length': fileData.length }
  }, fileData);
  return res;
}

async function main() {
  const key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  const token = await getAccessToken(key);
  const name = path.basename(LOCAL_FILE);
  const existingId = await findFileId(token, name, FOLDER_ID);
  let res;
  if (existingId) {
    res = await updateFile(token, existingId, LOCAL_FILE);
    console.log(`Arquivo existente atualizado (id=${existingId}), status=${res.status}`);
  } else {
    res = await uploadNewFile(token, name, FOLDER_ID, LOCAL_FILE);
    console.log(`Arquivo novo criado, status=${res.status}`);
  }
  if (res.status >= 300) console.log(res.body.toString());
}

main().catch(e => { console.error(e); process.exit(1); });
