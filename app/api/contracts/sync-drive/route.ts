import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDriveClient } from '@/lib/googleDrive';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const FOLDER_IDS = (process.env.GOOGLE_DRIVE_FOLDER_IDS ?? process.env.GOOGLE_DRIVE_FOLDER_ID ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const FIELDS = 'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents)';

async function listFilesInFolder(drive: ReturnType<typeof getDriveClient>, folderId: string, folderPath = ''): Promise<Array<Record<string, unknown>>> {
  const files: Array<Record<string, unknown>> = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: FIELDS,
      pageSize: 100,
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    const items = res.data.files ?? [];
    for (const item of items) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        const sub = await listFilesInFolder(drive, item.id!, folderPath ? `${folderPath}/${item.name}` : (item.name ?? ''));
        files.push(...sub);
      } else {
        files.push({ ...item, folderPath });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

// Naive heuristic: extract 14-digit token or client name from file name
function parseFileName(name: string): { client_name: string | null; asset_token: string | null } {
  const tokenMatch = name.match(/\b(\d{14})\b/);
  const asset_token = tokenMatch ? tokenMatch[1] : null;
  // Client name: strip token, extension, and common suffixes
  const cleaned = name
    .replace(/\.\w{2,5}$/, '')
    .replace(/\d{14}/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b(contract|lease|agreement|addendum|noc|qid|passport|visa|tenancy)\b/gi, '')
    .trim();
  const client_name = cleaned.length > 1 ? cleaned : null;
  return { client_name, asset_token };
}

export async function POST() {
  try {
    if (FOLDER_IDS.length === 0) {
      return NextResponse.json({ error: 'GOOGLE_DRIVE_FOLDER_IDS not configured.' }, { status: 400 });
    }

    const drive = getDriveClient();
    const allFiles: Array<Record<string, unknown>> = [];

    for (const folderId of FOLDER_IDS) {
      const files = await listFilesInFolder(drive, folderId);
      allFiles.push(...files);
    }

    if (allFiles.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No files found in the specified folders.' });
    }

    // Fetch existing drive_file_ids to skip
    const { data: existing } = await admin.from('contracts').select('drive_file_id');
    const existingIds = new Set((existing ?? []).map((r: { drive_file_id: string }) => r.drive_file_id));

    const newFiles = allFiles.filter(f => f.id && !existingIds.has(f.id as string));

    if (newFiles.length === 0) {
      return NextResponse.json({ synced: 0, total_found: allFiles.length, message: 'All files already catalogued.' });
    }

    const rows = newFiles.map(f => {
      const { client_name, asset_token } = parseFileName(f.name as string ?? '');
      return {
        drive_file_id:    f.id,
        name:             f.name ?? 'Untitled',
        mime_type:        f.mimeType ?? null,
        client_name,
        asset_token,
        folder_path:      f.folderPath ?? null,
        drive_url:        f.webViewLink ?? null,
        file_size:        f.size ? parseInt(f.size as string, 10) : null,
        drive_created_at:  f.createdTime ?? null,
        drive_modified_at: f.modifiedTime ?? null,
        synced_at:        new Date().toISOString(),
      };
    });

    const { data, error } = await admin.from('contracts').insert(rows).select('id');
    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });

    return NextResponse.json({ synced: data?.length ?? 0, total_found: allFiles.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Sync failed' }, { status: 500 });
  }
}
