const path = require('path');
const cloudSync = require('../electron/cloudSync.cjs');
const db = require('../electron/database.cjs');

async function main() {
  const args = process.argv.slice(2);
  let url = args[0];
  let key = args[1];

  if (!url || !key) {
    if (cloudSync.isConfigured()) {
      url = cloudSync.config.supabaseUrl;
      key = cloudSync.config.supabaseAnonKey;
      console.log(`Using existing Supabase configuration: ${url}`);
    } else {
      console.log(`
Usage:
  node scripts/pushToSupabase.cjs <SUPABASE_URL> <SUPABASE_ANON_KEY>

Example:
  node scripts/pushToSupabase.cjs https://xyzproject.supabase.co eyJhbGciOi...
`);
      process.exit(1);
    }
  }

  console.log(`Connecting to Supabase at: ${url}...`);
  const testRes = await cloudSync.testConnection(url, key);
  if (!testRes.success) {
    console.error('Connection test failed:', testRes.error);
    process.exit(1);
  }

  console.log('Connection successful!');
  console.log('Saving configuration...');
  cloudSync.saveConfig({ supabaseUrl: url, supabaseAnonKey: key, autoSyncEnabled: true });

  console.log('Starting full synchronization of bills, audit logs, expenses, menu items, rooms, and tables...');
  const syncRes = await cloudSync.syncAll();
  console.log('Sync result:', syncRes);

  if (syncRes.success) {
    console.log('All hotel data has been successfully pushed to your Supabase project!');
  } else {
    console.error('Sync error:', syncRes.error);
  }
}

main().catch(console.error);
