#!/usr/bin/env node
/**
 * Test Runner - Esecutore test completo
 * Permette di eseguire test unitari, di integrazione e E2E
 * Uso:
 *   npm run test          - Esegue tutti i test
 *   npm run test:unit    - Solo test unitari
 *   npm run test:integration - Solo test di integrazione
 *   npm run test:e2e      - Solo test E2E
 *   npm run test:coverage - Test con coverage
 */

import { createApp } from '../src/app.js';
import { initDb, closeDb } from '../db/index.js';
import { config } from '../src/lib/config.js';
import { TestFramework } from '../src/lib/testing.js';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const { TestRunner, ApiTestClient, TestReporter, TestDataGenerator } = TestFramework;

// ============================================
// CONFIGURAZIONE TEST
// ============================================

const TEST_CONFIG = {
  port: 4174, // Porta diversa dal server principale
  host: '127.0.0.1',
  timeout: 30000, // 30 secondi
  coverage: false,
  verbose: false,
  reportDir: 'test/reports'
};

// ============================================
// TEST RUNNER PRINCIPALE
// ============================================

/**
 * Esegue tutti i test
 */
async function runAllTests() {
  console.log('='.repeat(80));
  console.log('  SAMURAI DI AVAKIN - TEST RUNNER');
  console.log('='.repeat(80));

  const reporter = new TestReporter();
  const allResults = [];

  // Esegue test per tipo
  for (const suiteType of ['unit', 'integration', 'e2e']) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`  ESEGUZIONE TEST ${suiteType.toUpperCase()}`);
    console.log('='.repeat(80));

    const results = await runTestSuite(suiteType);
    allResults.push(...results);
  }

  // Genera report finale
  const total = allResults.length;
  const passed = allResults.filter(r => r.status === 'passed').length;
  const failed = allResults.filter(r => r.status === 'failed').length;
  const skipped = allResults.filter(r => r.status === 'skipped').length;

  console.log('\n' + '='.repeat(80));
  console.log('  REPORT FINALE');
  console.log('='.repeat(80));
  console.log(`  Totale: ${total}`);
  console.log(`  Passati: ${passed}`);
  console.log(`  Falliti: ${failed}`);
  console.log(`  Saltati: ${skipped}`);
  console.log(`  Successo: ${((passed / total) * 100).toFixed(2)}%`);
  console.log('='.repeat(80));

  // Salva report
  await reporter.saveSuiteResult({
    suite: 'all',
    name: 'Tutti i test',
    total,
    passed,
    failed,
    skipped,
    results: allResults
  });

  // Genera report HTML
  const htmlReport = reporter.generateHtmlReport({
    suite: 'all',
    name: 'Tutti i test',
    total,
    passed,
    failed,
    skipped,
    results: allResults
  });

  // Salva report HTML
  try {
    await fs.mkdir(TEST_CONFIG.reportDir, { recursive: true });
    await fs.writeFile(path.join(TEST_CONFIG.reportDir, 'test-report.html'), htmlReport);
    console.log(`\n  ✓ Report HTML salvato in ${TEST_CONFIG.reportDir}/test-report.html`);
  } catch (err) {
    console.log('\n  ⚠ Errore salvataggio report HTML:', err.message);
  }

  return failed === 0;
}

/**
 * Esegue test di un tipo specifico
 */
async function runTestSuite(suiteType) {
  let testFiles = [];

  try {
    // Leggi file di test dalla cartella corrispondente
    const testDir = path.join(process.cwd(), 'test', suiteType);
    const files = await fs.readdir(testDir);
    
    testFiles = files
      .filter(f => f.endsWith('.js') && f.startsWith('test.'))
      .map(f => path.join(testDir, f));
  } catch (err) {
    // Cartella non esiste - nessun test di questo tipo
    console.log(`  ⚠ Nessun test ${suiteType} trovato`);
    return [];
  }

  if (testFiles.length === 0) {
    console.log(`  ⚠ Nessun test ${suiteType} trovato`);
    return [];
  }

  const results = [];

  // Per ogni file di test
  for (const testFile of testFiles) {
    console.log(`\n  📄 Caricamento test: ${path.basename(testFile)}`);

    try {
      // Importa modulo di test
      const module = await import(testFile);
      
      if (module.default && Array.isArray(module.default)) {
        // Formato: array di test
        const testRunner = new TestRunner({
          suite: suiteType,
          name: path.basename(testFile),
          tests: module.default
        });

        const result = await testRunner.run();
        results.push(...result.results);
      } else if (module.default && typeof module.default === 'function') {
        // Formato: funzione che restituisce test
        const tests = await module.default();
        const testRunner = new TestRunner({
          suite: suiteType,
          name: path.basename(testFile),
          tests
        });

        const result = await testRunner.run();
        results.push(...result.results);
      }
    } catch (err) {
      console.error(`  ✗ Errore caricamento ${testFile}:`, err.message);
      results.push({
        name: path.basename(testFile),
        status: 'failed',
        startTime: Date.now(),
        duration: 0,
        error: {
          message: `Errore caricamento: ${err.message}`,
          stack: err.stack
        }
      });
    }
  }

  return results;
}

// ============================================
// TEST API
// ============================================

/**
 * Test per API
 */
async function testApi() {
  console.log('\n' + '='.repeat(80));
  console.log('  TEST API');
  console.log('='.repeat(80));

  // Avvia server di test
  let testServer = null;
  let testPort = null;

  try {
    await initDb();
    
    const app = createApp();
    testServer = createServer(app);
    
    testServer.listen(0, TEST_CONFIG.host, () => {
      const addr = testServer.address();
      testPort = addr.port;
      console.log(`  Server di test avviato su porta ${testPort}`);
    });

    // Aspetta che il server sia pronto
    await new Promise(resolve => setTimeout(resolve, 500));

    const apiClient = new ApiTestClient(`http://${TEST_CONFIG.host}:${testPort}`);

    const results = [];

    // Test autenticazione
    console.log('\n  ▶ Test Autenticazione');
    try {
      // Registrazione
      const testUser = TestDataGenerator.generateUser();
      const registerRes = await apiClient.register(testUser);
      if (registerRes.ok) {
        console.log('  ✓ Registrazione');
        results.push({ name: 'Auth - Register', status: 'passed', duration: 0 });
      } else {
        console.log('  ✗ Registrazione fallita:', registerRes.error);
        results.push({ name: 'Auth - Register', status: 'failed', duration: 0, error: registerRes.error });
      }

      // Login
      const loginRes = await apiClient.login(testUser.email, testUser.password);
      if (loginRes.ok) {
        console.log('  ✓ Login');
        results.push({ name: 'Auth - Login', status: 'passed', duration: 0 });
      } else {
        console.log('  ✗ Login fallito:', loginRes.error);
        results.push({ name: 'Auth - Login', status: 'failed', duration: 0, error: loginRes.error });
      }

      // Me
      const meRes = await apiClient.me();
      if (meRes.ok && meRes.data.authenticated) {
        console.log('  ✓ Get current user');
        results.push({ name: 'Auth - Me', status: 'passed', duration: 0 });
      } else {
        console.log('  ✗ Me fallito');
        results.push({ name: 'Auth - Me', status: 'failed', duration: 0 });
      }
    } catch (err) {
      console.log('  ✗ Errore test auth:', err.message);
      results.push({ name: 'Auth - All', status: 'failed', duration: 0, error: err.message });
    }

    // Test CMS
    console.log('\n  ▶ Test CMS');
    try {
      // Ottieni pagine
      const pagesRes = await apiClient.request('GET', '/api/cms/pages');
      if (pagesRes.ok && pagesRes.data.pages) {
        console.log(`  ✓ Get pages (${pagesRes.data.pages.length} pagine)`);
        results.push({ name: 'CMS - Get Pages', status: 'passed', duration: 0 });
      } else {
        console.log('  ✗ Get pages fallito');
        results.push({ name: 'CMS - Get Pages', status: 'failed', duration: 0 });
      }

      // Ottieni articoli
      const articlesRes = await apiClient.request('GET', '/api/cms/articles');
      if (articlesRes.ok) {
        console.log(`  ✓ Get articles (${articlesRes.data.articles?.length || 0} articoli)`);
        results.push({ name: 'CMS - Get Articles', status: 'passed', duration: 0 });
      } else {
        console.log('  ✗ Get articles fallito');
        results.push({ name: 'CMS - Get Articles', status: 'failed', duration: 0 });
      }
    } catch (err) {
      console.log('  ✗ Errore test CMS:', err.message);
      results.push({ name: 'CMS - All', status: 'failed', duration: 0, error: err.message });
    }

    // Test Chat
    console.log('\n  ▶ Test Chat');
    try {
      // Ottieni canali
      const channelsRes = await apiClient.request('GET', '/api/chat/channels');
      if (channelsRes.ok) {
        console.log(`  ✓ Get channels (${channelsRes.data.channels?.length || 0} canali)`);
        results.push({ name: 'Chat - Get Channels', status: 'passed', duration: 0 });
      } else {
        console.log('  ✗ Get channels fallito');
        results.push({ name: 'Chat - Get Channels', status: 'failed', duration: 0 });
      }
    } catch (err) {
      console.log('  ✗ Errore test Chat:', err.message);
      results.push({ name: 'Chat - All', status: 'failed', duration: 0, error: err.message });
    }

    // Test Push (solo structure)
    console.log('\n  ▶ Test Push Notifications');
    try {
      // Crea subscription
      const subRes = await apiClient.request('POST', '/api/push/subscribe', {
        subscription: {
          endpoint: 'https://test.endpoint',
          keys: {
            auth: 'test_auth',
            p256dh: 'test_p256dh'
          }
        }
      });
      
      if (subRes.ok) {
        console.log('  ✓ Create subscription');
        results.push({ name: 'Push - Create Subscription', status: 'passed', duration: 0 });
      } else {
        console.log('  ✗ Create subscription fallito');
        results.push({ name: 'Push - Create Subscription', status: 'failed', duration: 0 });
      }
    } catch (err) {
      console.log('  ✗ Errore test Push:', err.message);
      results.push({ name: 'Push - All', status: 'failed', duration: 0, error: err.message });
    }

    // Chiudi server
    testServer.close();
    await closeDb();

    return results;
  } catch (err) {
    console.error('  ✗ Errore generale test API:', err);
    if (testServer) testServer.close();
    await closeDb();
    return [];
  }
}

// ============================================
// TEST DI INTEGRAZIONE
// ============================================

/**
 * Test di integrazione
 */
async function testIntegration() {
  console.log('\n' + '='.repeat(80));
  console.log('  TEST DI INTEGRAZIONE');
  console.log('='.repeat(80));

  await initDb();

  const testRunner = new TestRunner({
    suite: 'integration',
    name: 'Test di Integrazione',
    tests: [
      // Test flusso completo autenticazione + account
      async function testAuthFlow({ api, createTestUser }) {
        const user = await createTestUser();
        
        // Login
        await api.login(user.email, user.password);
        
        // Me
        const me = await api.me();
        if (!me.data.authenticated) {
          throw new Error('Utente non autenticato dopo login');
        }
        
        // Account
        const account = await api.request('GET', '/api/account');
        if (!account.ok) {
          throw new Error('Errore caricamento account');
        }
        
        // Logout
        await api.logout();
        
        const meAfter = await api.me();
        if (meAfter.data.authenticated) {
          throw new Error('Utente ancora autenticato dopo logout');
        }
      },

      // Test flusso CMS
      async function testCmsFlow({ api }) {
        // Ottieni pagine
        const pages = await api.request('GET', '/api/cms/pages');
        if (!pages.ok || !pages.data.pages) {
          throw new Error('Errore caricamento pagine CMS');
        }
        
        // Ottieni articoli
        const articles = await api.request('GET', '/api/cms/articles');
        if (!articles.ok) {
          throw new Error('Errore caricamento articoli CMS');
        }
        
        // Ottieni galleria
        const gallery = await api.request('GET', '/api/cms/gallery');
        if (!gallery.ok) {
          throw new Error('Errore caricamento galleria CMS');
        }
      },

      // Test flusso Chat
      async function testChatFlow({ api }) {
        // Ottieni canali
        const channels = await api.request('GET', '/api/chat/channels');
        if (!channels.ok) {
          throw new Error('Errore caricamento canali chat');
        }
        
        // Se ci sono canali, ottieni messaggi
        if (channels.data.channels && channels.data.channels.length > 0) {
          const channel = channels.data.channels[0];
          const messages = await api.request('GET', `/api/chat/channels/${channel.id}/messages`);
          if (!messages.ok) {
            throw new Error('Errore caricamento messaggi chat');
          }
        }
      }
    ]
  });

  const result = await testRunner.run();
  await closeDb();
  
  return result.results;
}

// ============================================
// TEST E2E
// ============================================

/**
 * Test End-to-End
 */
async function testE2E() {
  console.log('\n' + '='.repeat(80));
  console.log('  TEST E2E');
  console.log('='.repeat(80));

  // Nota: I test E2E richiedono browser reale o strumenti come Playwright/Cypress
  // Qui implementiamo una versione semplificata che testa solo il flusso HTTP
  
  console.log('  [i] Test E2E richiedono browser reale o Playwright/Cypress');
  console.log('  [i] Salta test E2E in questo ambiente');
  
  return [];
}

// ============================================
// TEST LOAD (Carico)
// ============================================

/**
 * Test di carico (semplificato)
 */
async function testLoad() {
  console.log('\n' + '='.repeat(80));
  console.log('  TEST DI CARICO');
  console.log('='.repeat(80));

  console.log('  [i] Test di carico richiedono strumenti dedicati come k6 o Artillery');
  console.log('  [i] Salta test di carico in questo ambiente');
  
  return [];
}

// ============================================
// COMANDI
// ============================================

/**
 * Esegue comando da CLI
 */
async function runCommand(command) {
  switch (command) {
    case 'unit':
      return runTestSuite('unit');
    case 'integration':
      return testIntegration();
    case 'e2e':
      return testE2E();
    case 'load':
      return testLoad();
    case 'api':
      return testApi();
    case 'all':
    default:
      return runAllTests();
  }
}

// ============================================
// MAIN
// ============================================

const command = process.argv[2] || 'all';

// Imposta config in base agli argomenti
if (process.argv.includes('--verbose')) {
  TEST_CONFIG.verbose = true;
}
if (process.argv.includes('--coverage')) {
  TEST_CONFIG.coverage = true;
}

runCommand(command)
  .then(success => {
    if (!success) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Errore fatale:', err);
    process.exit(1);
  });

// Esporta per uso programmatico
export { runAllTests, runTestSuite, testApi, testIntegration, testE2E, testLoad, runCommand };
