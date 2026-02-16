import { google } from 'googleapis';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import open from 'open';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKENS_PATH = resolve(PROJECT_ROOT, '.gmail-tokens.json');
const CREDENTIALS_PATH = resolve(PROJECT_ROOT, 'credentials.json');
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

function loadCredentials(): { client_id: string; client_secret: string } {
  try {
    const content = readFileSync(CREDENTIALS_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    const config = credentials.installed || credentials.web;
    if (!config) {
      throw new Error('Invalid credentials.json format. Expected "installed" or "web" key.');
    }
    return { client_id: config.client_id, client_secret: config.client_secret };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error('Error: credentials.json not found.');
      console.error('');
      console.error('To get your credentials:');
      console.error('1. Go to https://console.cloud.google.com/');
      console.error('2. Create a project and enable the Gmail API');
      console.error('3. Go to APIs & Services > Credentials');
      console.error('4. Create an OAuth 2.0 Client ID (Desktop app)');
      console.error('5. Download the JSON and save it as credentials.json in the project root');
      process.exit(1);
    }
    throw err;
  }
}

function waitForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || '', `http://localhost:3000`);
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authorization denied</h1><p>${error}</p><p>You can close this window.</p>`);
        server.close();
        reject(new Error(`Authorization denied: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Missing authorization code</h1><p>You can close this window.</p>');
        server.close();
        reject(new Error('Missing authorization code'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Authorization successful!</h1><p>You can close this window and return to the terminal.</p>');
      server.close();
      resolve(code);
    });

    server.listen(3000, () => {
      console.log('Waiting for authorization on http://localhost:3000/oauth2callback ...');
    });

    server.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        reject(new Error('Port 3000 is already in use. Please free it and try again.'));
      } else {
        reject(err);
      }
    });
  });
}

async function main(): Promise<void> {
  console.log('Gmail MCP Server - OAuth2 Setup');
  console.log('================================');
  console.log('');

  const { client_id, client_secret } = loadCredentials();

  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  const codePromise = waitForAuthCode();

  console.log('Opening browser for authorization...');
  console.log('If the browser does not open, visit this URL manually:');
  console.log('');
  console.log(authUrl);
  console.log('');

  await open(authUrl);

  const code = await codePromise;

  console.log('Exchanging authorization code for tokens...');
  const { tokens } = await oauth2Client.getToken(code);

  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));

  console.log('');
  console.log('Tokens saved to .gmail-tokens.json');
  console.log('You can now start the MCP server with: bun start');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
