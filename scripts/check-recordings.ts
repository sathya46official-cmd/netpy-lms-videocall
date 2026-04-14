import { createAdminClient } from './lib/supabase/admin';

async function check() {
  const db = createAdminClient();
  const { data, error } = await db.from('recordings').select('*').order('created_at', { ascending: false });
  
  if (error) {
    console.error('❌ DB Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('📭 No recordings found in the database yet.');
  } else {
    console.log(`✅ Found ${data.length} recording(s):`);
    console.log(JSON.stringify(data, null, 2));
  }
}

check().catch(err => {
  console.error('💥 Fatal error in check-recordings script:');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
