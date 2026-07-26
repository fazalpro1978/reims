// ─────────────────────────────────────────────────────────────────────────────
// User Seed Script — creates all ACM users in Supabase (testing + production)
// Run: npx tsx scripts/seed-users.ts
// ─────────────────────────────────────────────────────────────────────────────

const ENVIRONMENTS = [
  {
    name: 'reims-testing',
    url:  'https://hsulqoavwmsvffsbzoan.supabase.co',
    key:  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzdWxxb2F2d21zdmZmc2J6b2FuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg0NjgyOSwiZXhwIjoyMDk2NDIyODI5fQ.zgKW_Q7D0saX5NwKYgPmp7MFyvQyYasof-Gd8F4wBdw',
  },
  {
    name: 'reims-production',
    url:  'https://hbpxufqrdqaycwovirns.supabase.co',
    key:  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicHh1ZnFyZHFheWN3b3Zpcm5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg0Mzg3OSwiZXhwIjoyMDk2NDE5ODc5fQ.DKEwAyd5Vk8Tgr7fat1mzjgBhe2Y_nB1pZ8nYWhxoVk',
  },
];

const TEMP_PASSWORD = 'PriveRE@2026';

const USERS = [
  { email: 'ahmedali@privegroupre.com',   fullName: 'Ahmed Ali',               role: 'superuser',     platforms: ['reims', 'dinges'] },
  { email: 'admin@privegroupre.com',       fullName: 'Nadeem E Leeman',          role: 'administrator', platforms: ['reims', 'dinges'] },
  { email: 'elazazy@privegroupre.com',     fullName: 'Mohamed Elazazy',          role: 'staff',         platforms: ['reims'] },
  { email: 'abid@privegroupre.com',        fullName: 'Abid Hussain',             role: 'staff',         platforms: ['reims'] },
  { email: 'shihan.b@privegroupre.com',    fullName: 'Shihan Buhary',            role: 'staff',         platforms: ['reims'] },
  { email: 'a.shahan@privegroupre.com',    fullName: 'Abdul Shahan',             role: 'staff',         platforms: ['reims'] },
  { email: 'fmushaffiq@privegroupre.com',  fullName: 'Fazlur Rahman Mushaffiq',  role: 'staff',         platforms: ['reims'] },
  { email: 'saahir@privegroupre.com',      fullName: 'Mohammed Saahir',          role: 'agent',         platforms: ['reims'] },
];

function headers(key: string) {
  return {
    apikey:         key,
    Authorization:  `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function createAuthUser(url: string, key: string, u: typeof USERS[0]): Promise<string | null> {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method:  'POST',
    headers: headers(key),
    body:    JSON.stringify({
      email:         u.email,
      password:      TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.fullName },
    }),
  });

  if (res.status === 422) {
    // User already exists — look up their id
    const listRes = await fetch(
      `${url}/auth/v1/admin/users?email=${encodeURIComponent(u.email)}`,
      { headers: headers(key) },
    );
    if (listRes.ok) {
      const data = await listRes.json() as { users?: { id: string; email: string }[] };
      const found = data.users?.find(x => x.email.toLowerCase() === u.email.toLowerCase());
      if (found) {
        console.log(`  ⚠ SKIP     ${u.email.padEnd(40)} (already exists)`);
        return found.id;
      }
    }
    console.log(`  ⚠ SKIP     ${u.email.padEnd(40)} (already exists, id lookup failed)`);
    return null;
  }

  if (!res.ok) {
    const err = await res.text();
    console.log(`  ✕ AUTH     ${u.email.padEnd(40)} ${res.status}: ${err}`);
    return null;
  }

  const data = await res.json() as { id: string };
  return data.id;
}

async function upsertProfile(url: string, key: string, userId: string, u: typeof USERS[0]) {
  const res = await fetch(`${url}/rest/v1/profiles`, {
    method:  'POST',
    headers: {
      ...headers(key),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id:         userId,
      email:      u.email.toLowerCase(),
      full_name:  u.fullName,
      role:       u.role,
      department: 'Privé Group Real Estate',
      platforms:  u.platforms,
      is_active:  true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.log(`  ✕ PROFILE  ${u.email.padEnd(40)} ${res.status}: ${err}`);
    return false;
  }
  return true;
}

async function seedEnv(env: typeof ENVIRONMENTS[0]) {
  console.log(`\n── ${env.name} ${'─'.repeat(42 - env.name.length)}`);

  for (const u of USERS) {
    const userId = await createAuthUser(env.url, env.key, u);
    if (!userId) continue;

    const ok = await upsertProfile(env.url, env.key, userId, u);
    if (ok) {
      console.log(`  ✓ CREATED  ${u.email.padEnd(40)} → ${u.role}`);
    }
  }
}

async function main() {
  console.log('\nVanguard REOS — User Seed Script');
  console.log('='.repeat(50));
  console.log(`Creating ${USERS.length} users across ${ENVIRONMENTS.length} environments\n`);

  for (const env of ENVIRONMENTS) {
    await seedEnv(env);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✓ Seed complete.\n');
  console.log('Temporary password for all accounts:');
  console.log(`  ${TEMP_PASSWORD}`);
  console.log('\nEach person should change their password on first login.\n');
}

main().catch(err => {
  console.error('\n✗ Seed failed:', err.message);
  process.exit(1);
});
