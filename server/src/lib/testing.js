/**
 * Testing Framework per Samurai di Avakin
 * Framework completo per test unitari, di integrazione e E2E
 * Supporta test API, database, e WebSocket
 */

import { createApp } from "../app.js";
import { initDb, query, closeDb } from "../../db/index.js";
import { config } from "./config.js";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

// ============================================
// TEST RUNNER PRINCIPALE
// ============================================

/**
 * TestRunner - Esegue suite di test
 * @param {Object} options - Opzioni del test runner
 * @param {string} options.suite - Tipo di suite ('unit', 'integration', 'e2e')
 * @param {string} options.name - Nome della suite
 * @param {Function[]} options.tests - Array di funzioni test
 */
export class TestRunner {
  constructor(options = {}) {
    this.suite = options.suite || 'unit';
    this.name = options.name || 'Unnamed Suite';
    this.tests = options.tests || [];
    this.results = [];
    this.startTime = null;
    this.endTime = null;
    this.app = null;
    this.server = null;
    this.wsServer = null;
    this.testServerPort = null;
  }

  /**
   * Avvia l'esecuzione dei test
   */
  async run() {
    this.startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ESECUZIONE TEST: ${this.name} (${this.suite})`);
    console.log(`${'='.repeat(60)}\n`);

    // Setup ambiente test
    await this.setup();

    // Esegui tutti i test
    for (const testFn of this.tests) {
      const testName = testFn.name || 'Unknown Test';
      const result = await this.runTest(testName, testFn);
      this.results.push(result);
    }

    // Cleanup
    await this.cleanup();

    this.endTime = Date.now();
    this.printSummary();

    return this.getSummary();
  }

  /**
   * Setup ambiente test
   */
  async setup() {
    // Inizializza database per test
    await initDb();
    
    // Se è integration o e2e, avvia server di test
    if (this.suite === 'integration' || this.suite === 'e2e') {
      await this.startTestServer();
    }
  }

  /**
   * Avvia server di test su porta casuale
   */
  async startTestServer() {
    this.app = createApp();
    this.server = createServer(this.app);
    
    return new Promise((resolve) => {
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server.address();
        this.testServerPort = addr.port;
        
        // Avvia WebSocket server per chat test
        this.wsServer = new WebSocketServer({ server: this.server, path: '/ws/chat' });
        this.wsServer.on('connection', (ws) => {
          ws.on('message', (data) => {
            // Echo per test
            ws.send(data.toString());
          });
        });
        
        console.log(`  Server di test avviato su porta ${this.testServerPort}`);
        resolve();
      });
    });
  }

  /**
   * Cleanup ambiente test
   */
  async cleanup() {
    // Chiudi server di test
    if (this.server) {
      this.server.close();
    }
    
    // Chiudi WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
    }
    
    // Chiudi connessione DB
    try {
      await closeDb();
    } catch (err) {
      console.log('  Errore chiusura DB:', err.message);
    }
  }

  /**
   * Esegue un singolo test
   */
  async runTest(name, fn) {
    const result = {
      name,
      status: 'pending',
      startTime: Date.now(),
      duration: 0,
      error: null,
      messages: []
    };

    try {
      // Setup context del test
      const context = this.createTestContext();
      
      // Esegui il test
      const testStart = Date.now();
      await fn.test(context);
      result.duration = Date.now() - testStart;
      result.status = 'passed';
      
      console.log(`  ✓ ${name} (${result.duration}ms)`);
    } catch (err) {
      result.duration = Date.now() - result.startTime;
      result.status = 'failed';
      result.error = {
        message: err.message,
        stack: err.stack,
        cause: err.cause
      };
      
      console.log(`  ✗ ${name} (${result.duration}ms)`);
      console.log(`    Errore: ${err.message}`);
      if (err.stack) {
        const stackLines = err.stack.split('\n').slice(1, 5);
        stackLines.forEach(line => console.log(`    ${line.trim()}`));
      }
    }

    return result;
  }

  /**
   * Crea contesto per il test
   */
  createTestContext() {
    return {
      runner: this,
      db: {
        query: async (...args) => query(...args),
        one: async (sql, params) => {
          const result = await query(sql, params);
          return result.rows[0] || null;
        }
      },
      api: {
        baseUrl: `http://127.0.0.1:${this.testServerPort}`,
        request: async (method, path, body = null, headers = {}) => {
          if (!this.server) {
            throw new Error('Server di test non avviato');
          }
          
          const url = new URL(path, `http://127.0.0.1:${this.testServerPort}`);
          const options = {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...headers
            }
          };
          
          if (body) {
            options.body = JSON.stringify(body);
          }
          
          const response = await fetch(url.toString(), options);
          const data = await response.json();
          
          return {
            status: response.status,
            data,
            headers: Object.fromEntries(response.headers.entries())
          };
        }
      },
      // Helper per creare utenti di test
      createTestUser: async (overrides = {}) => {
        const defaultUser = {
          email: `test-${randomUUID()}@test.com`,
          password: 'TestPass123!',
          confirm_password: 'TestPass123!',
          termini: true,
          data_nascita: '2000-01-01',
          name: `Test User ${randomUUID().slice(0, 8)}`,
          handle: `TEST_${randomUUID().slice(0, 8).toUpperCase()}`,
          region: 'Europa',
          device: 'PC'
        };
        
        const user = { ...defaultUser, ...overrides };
        
        // Registra utente
        const response = await this.api.request('POST', '/api/auth/register', user);
        
        if (response.status !== 201) {
          throw new Error(`Failed to create test user: ${JSON.stringify(response.data)}`);
        }
        
        return {
          ...user,
          id: response.data.user.id,
          accessToken: response.headers['set-cookie']
        };
      },
      // Helper per login
      login: async (email, password) => {
        const response = await this.api.request('POST', '/api/auth/login', {
          email,
          password
        });
        
        if (response.status !== 200) {
          throw new Error(`Login failed: ${JSON.stringify(response.data)}`);
        }
        
        return {
          user: response.data.user,
          accessToken: response.headers['set-cookie']
        };
      }
    };
  }

  /**
   * Stampa sommario dei test
   */
  printSummary() {
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const total = this.results.length;
    const duration = this.endTime - this.startTime;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  SOMMARIO TEST`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  Suite: ${this.name}`);
    console.log(`  Tipo:  ${this.suite}`);
    console.log(`  Totale: ${total} test`);
    console.log(`  Passati: ${passed}`);
    console.log(`  Falliti: ${failed}`);
    console.log(`  Saltati: ${skipped}`);
    console.log(`  Tempo: ${duration}ms`);
    console.log(`${'='.repeat(60)}\n`);

    if (failed > 0) {
      console.log('  [X] ALMENO UN TEST E\' FALLITO');
    } else {
      console.log('  [OK] TUTTI I TEST PASSATI');
    }
  }

  /**
   * Ritorna sommario come oggetto
   */
  getSummary() {
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;

    return {
      suite: this.suite,
      name: this.name,
      total: this.results.length,
      passed,
      failed,
      skipped,
      duration: this.endTime - this.startTime,
      results: this.results
    };
  }
}

// ============================================
// TEST API CLIENT
// ============================================

/**
 * API Test Client per test HTTP
 */
export class ApiTestClient {
  constructor(baseUrl = 'http://127.0.0.1:4173') {
    this.baseUrl = baseUrl;
    this.cookies = {};
    this.headers = {};
  }

  /**
   * Imposta cookie
   */
  setCookie(name, value) {
    this.cookies[name] = value;
  }

  /**
   * Imposta header
   */
  setHeader(name, value) {
    this.headers[name] = value;
  }

  /**
   * Esegue richiesta API
   */
  async request(method, path, body = null, customHeaders = {}) {
    const url = new URL(path, this.baseUrl);
    const headers = {
      'Content-Type': 'application/json',
      ...this.headers,
      ...customHeaders
    };

    // Aggiungi cookie
    const cookieString = Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    
    if (cookieString) {
      headers.Cookie = cookieString;
    }

    const options = { method, headers };
    if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url.toString(), options);
      const data = await response.json();

      return {
        status: response.status,
        ok: response.ok,
        data,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (err) {
      return {
        status: 0,
        ok: false,
        error: err.message,
        data: null
      };
    }
  }

  /**
   * Metodi HTTP shorthand
   */
  async get(path, headers = {}) {
    return this.request('GET', path, null, headers);
  }

  async post(path, body, headers = {}) {
    return this.request('POST', path, body, headers);
  }

  async patch(path, body, headers = {}) {
    return this.request('PATCH', path, body, headers);
  }

  async put(path, body, headers = {}) {
    return this.request('PUT', path, body, headers);
  }

  async delete(path, headers = {}) {
    return this.request('DELETE', path, null, headers);
  }

  /**
   * Login e salva token
   */
  async login(email, password) {
    const response = await this.post('/api/auth/login', { email, password });
    if (response.ok && response.headers['set-cookie']) {
      const cookies = response.headers['set-cookie'];
      // Estrai cookie di sessione
      const sessionCookie = cookies.find(c => c.includes('samurai_session')) || cookies[0];
      this.setCookie('samurai_session', sessionCookie.split(';')[0].split('=')[1]);
    }
    return response;
  }

  /**
   * Registra utente di test
   */
  async register(userData) {
    return this.post('/api/auth/register', userData);
  }

  /**
   * Ottieni utente corrente
   */
  async me() {
    return this.get('/api/auth/me');
  }

  /**
   * Logout
   */
  async logout() {
    const response = await this.post('/api/auth/logout');
    this.cookies = {};
    return response;
  }

  /**
   * Verifica che una route restituisca un certo status
   */
  async expectStatus(method, path, expectedStatus, body = null) {
    const response = await this.request(method, path, body);
    if (response.status !== expectedStatus) {
      throw new Error(
        `Expected status ${expectedStatus}, got ${response.status}. ` +
        `Body: ${JSON.stringify(response.data)}`
      );
    }
    return response;
  }

  /**
   * Verifica che una route restituisca success
   */
  async expectSuccess(method, path, body = null) {
    const response = await this.request(method, path, body);
    if (!response.ok || !response.data?.ok) {
      throw new Error(
        `Expected success, got: ${JSON.stringify(response.data)}`
      );
    }
    return response;
  }
}

// ============================================
// WEB SOCKET TEST CLIENT
// ============================================

/**
 * WebSocket Test Client per testare chat in tempo reale
 */
export class WSTestClient {
  constructor(url = 'ws://127.0.0.1:4173/ws/chat') {
    this.url = url;
    this.ws = null;
    this.messages = [];
    this.openHandlers = [];
    this.closeHandlers = [];
    this.errorHandlers = [];
  }

  /**
   * Connetti al WebSocket
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        this.openHandlers.forEach(handler => handler());
        resolve(this);
      };

      this.ws.onmessage = (event) => {
        const data = typeof event.data === 'string' 
          ? event.data 
          : JSON.stringify(event.data);
        this.messages.push(data);
      };

      this.ws.onclose = (event) => {
        this.closeHandlers.forEach(handler => handler(event));
      };

      this.ws.onerror = (error) => {
        this.errorHandlers.forEach(handler => handler(error));
        reject(error);
      };
    });
  }

  /**
   * Disconnetti
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Invia messaggio
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket non connesso');
    }
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Aspetta un messaggio
   */
  async waitForMessage(predicate = () => true, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const message = this.messages.find(predicate);
      if (message) {
        return message;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Timeout in attesa messaggio (${timeout}ms)`);
  }

  /**
   * Svuota la lista messaggi
   */
  clearMessages() {
    this.messages = [];
  }

  /**
   * Registra handler
   */
  onOpen(handler) {
    this.openHandlers.push(handler);
  }

  onClose(handler) {
    this.closeHandlers.push(handler);
  }

  onError(handler) {
    this.errorHandlers.push(handler);
  }
}

// ============================================
// TEST DATA GENERATOR
// ============================================

/**
 * Generatore di dati di test realistic
 */
export class TestDataGenerator {
  static generateEmail(prefix = 'test') {
    return `${prefix}-${randomUUID().slice(0, 8)}@test.com`;
  }

  static generateHandle(prefix = 'TEST') {
    return `${prefix}_${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  static generatePassword() {
    return 'TestPass123!' + randomUUID().slice(0, 4);
  }

  static generateUser(overrides = {}) {
    const password = this.generatePassword();
    return {
      email: this.generateEmail(),
      password,
      confirm_password: password,
      termini: true,
      data_nascita: '2000-01-01',
      name: `Test User`,
      handle: this.generateHandle(),
      region: 'Europa',
      device: 'PC',
      ...overrides
    };
  }

  static generateArticle() {
    return {
      title: `Articolo Test ${randomUUID().slice(0, 8)}`,
      slug: `articolo-test-${randomUUID().slice(0, 8)}`,
      summary: 'Questo è un articolo di test',
      content: 'Contenuto dettagliato dell\'articolo di test...',
      category: 'news',
      tags: ['test', 'cms']
    };
  }

  static generateMessage() {
    return {
      body: `Messaggio di test ${randomUUID().slice(0, 8)}`,
      attachments: []
    };
  }

  static generateEvent() {
    return {
      slug: `evento-test-${randomUUID().slice(0, 8)}`,
      title: `Evento Test ${randomUUID().slice(0, 8)}`,
      summary: 'Evento di test per il clan',
      category: 'raid',
      starts_at: new Date(Date.now() + 86400000).toISOString(), // domani
      ends_at: new Date(Date.now() + 86400000 * 2).toISOString(), // dopodomani
      capacity: 10
    };
  }
}

// ============================================
// TEST REPORTER
// ============================================

/**
 * Reporter per salvare risultati test nel database
 */
export class TestReporter {
  constructor() {
    this.runId = randomUUID();
    this.startTime = new Date();
  }

  /**
   * Salva risultato di un singolo test
   */
  async saveTestResult(testResult) {
    try {
      // Verifica che il database sia inizializzato
      const { driver } = await import('../../db/index.js');
      if (!driver) {
        console.log('  ⚠ Database non inizializzato - salta salvataggio risultato test');
        return;
      }
      
      await query(
        `INSERT INTO test_runs 
         (id, suite, name, status, duration_ms, started_at, completed_at, error_message, error_stack, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          randomUUID(),
          testResult.suite || 'unit',
          testResult.name,
          testResult.status,
          testResult.duration,
          new Date(testResult.startTime),
          new Date(testResult.startTime + testResult.duration),
          testResult.error?.message || '',
          testResult.error?.stack || '',
          JSON.stringify({ runId: this.runId })
        ]
      );
    } catch (err) {
      console.log('Errore salvataggio risultato test:', err.message);
    }
  }

  /**
   * Salva risultato di una suite completa
   */
  async saveSuiteResult(summary) {
    try {
      // Verifica che il database sia inizializzato
      const { driver } = await import('../../db/index.js');
      if (!driver) {
        console.log('  ⚠ Database non inizializzato - salta salvataggio suite');
        return;
      }
      
      const endTime = new Date();
      const duration = endTime - this.startTime;

      for (const result of summary.results) {
        await this.saveTestResult(result);
      }

      // Salva summary generale
      await query(
        `INSERT INTO test_runs 
         (id, suite, name, status, duration_ms, started_at, completed_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          this.runId,
          summary.suite,
          `SUMMARY_${summary.name}`,
          summary.failed > 0 ? 'failed' : 'passed',
          duration,
          this.startTime,
          endTime,
          JSON.stringify({
            total: summary.total,
            passed: summary.passed,
            failed: summary.failed,
            skipped: summary.skipped
          })
        ]
      );

      console.log(`  ✓ Risultati salvati nel database (run: ${this.runId})`);
    } catch (err) {
      console.log('Errore salvataggio summary:', err.message);
    }
  }

  /**
   * Genera report HTML
   */
  generateHtmlReport(summary) {
    const passed = summary.passed;
    const failed = summary.failed;
    const skipped = summary.skipped;
    const total = summary.total;
    const passRate = ((passed / total) * 100).toFixed(2);

    const testRows = summary.results.map(r => {
      const statusClass = r.status === 'passed' ? 'passed' : 
                          r.status === 'failed' ? 'failed' : 'skipped';
      return `
        <tr class="${statusClass}">
          <td>${r.name}</td>
          <td>${r.status}</td>
          <td>${r.duration}ms</td>
          <td>${r.error?.message ? '<pre>' + this.escapeHtml(r.error.message) + '</pre>' : '-'}</td>
        </tr>
      `;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Test Report - ${summary.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #01030a; color: #e0e0e0; }
    .header { background: linear-gradient(135deg, #03060f, #01030a); padding: 20px; border-radius: 10px; margin-bottom: 20px; }
    .header h1 { margin: 0; color: #5aa8ff; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }
    .card { background: #03060f; padding: 20px; border-radius: 10px; text-align: center; }
    .card .number { font-size: 32px; font-weight: bold; color: #5aa8ff; }
    .card .label { font-size: 14px; color: #888; }
    table { width: 100%; border-collapse: collapse; background: #03060f; border-radius: 10px; overflow: hidden; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #01030a; }
    th { background: #01030a; color: #5aa8ff; }
    .passed { background: #003300; color: #00ff00; }
    .failed { background: #330000; color: #ff6666; }
    .skipped { background: #333300; color: #ffff66; }
    pre { white-space: pre-wrap; word-wrap: break-word; font-size: 12px; }
    .footer { margin-top: 20px; padding: 10px; text-align: center; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Test Report: ${this.escapeHtml(summary.name)}</h1>
    <p>Suite: ${summary.suite} | Data: ${new Date().toLocaleString('it-IT')}</p>
  </div>

  <div class="summary">
    <div class="card">
      <div class="number">${passed}</div>
      <div class="label">Passati</div>
    </div>
    <div class="card">
      <div class="number">${failed}</div>
      <div class="label">Falliti</div>
    </div>
    <div class="card">
      <div class="number">${skipped}</div>
      <div class="label">Saltati</div>
    </div>
    <div class="card">
      <div class="number">${passRate}%</div>
      <div class="label">Successo</div>
    </div>
  </div>

  <h2>Dettagli Test</h2>
  <table>
    <thead>
      <tr>
        <th>Nome</th>
        <th>Stato</th>
        <th>Durata</th>
        <th>Errore</th>
      </tr>
    </thead>
    <tbody>
      ${testRows}
    </tbody>
  </table>

  <div class="footer">
    <p>Samurai di Avakin - Testing Framework v1.0.0</p>
  </div>
</body>
</html>
    `;
  }

  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// ============================================
// EXPORT
// ============================================

export const TestFramework = {
  TestRunner,
  ApiTestClient,
  WSTestClient,
  TestDataGenerator,
  TestReporter
};

export default TestFramework;
