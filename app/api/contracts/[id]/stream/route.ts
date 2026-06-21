import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDriveClient } from '@/lib/googleDrive';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: contract, error } = await admin
      .from('contracts')
      .select('drive_file_id, mime_type, name')
      .eq('id', params.id)
      .single();

    if (error || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const drive = getDriveClient();
    const mime = contract.mime_type as string | null;

    // Google Workspace files must be exported
    const isGoogleDoc   = mime === 'application/vnd.google-apps.document';
    const isGoogleSheet = mime === 'application/vnd.google-apps.spreadsheet';

    let stream: NodeJS.ReadableStream;
    let contentType: string;

    if (isGoogleDoc || isGoogleSheet) {
      const exportMime = isGoogleDoc ? 'application/pdf' : 'application/pdf';
      const res = await drive.files.export(
        { fileId: contract.drive_file_id, mimeType: exportMime },
        { responseType: 'stream' },
      );
      stream = res.data as unknown as NodeJS.ReadableStream;
      contentType = 'application/pdf';
    } else {
      const res = await drive.files.get(
        { fileId: contract.drive_file_id, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' },
      );
      stream = res.data as unknown as NodeJS.ReadableStream;
      contentType = mime ?? 'application/octet-stream';
    }

    // Pipe stream to Response — inline, no download
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const body = Buffer.concat(chunks);

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${contract.name}"`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Stream failed' }, { status: 500 });
  }
}
