export const MIME_LABELS: Record<string, string> = {
  'application/pdf':                                                            'PDF',
  'application/vnd.google-apps.document':                                       'Google Doc',
  'application/vnd.google-apps.spreadsheet':                                    'Google Sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':    'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':          'Excel',
  'image/jpeg':                                                                  'Image',
  'image/png':                                                                   'Image',
  'image/webp':                                                                  'Image',
};

export function mimeLabel(mime: string | null | undefined): string {
  if (!mime) return 'File';
  return MIME_LABELS[mime] ?? mime.split('/').pop() ?? 'File';
}

export function isPreviewable(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return (
    mime === 'application/pdf' ||
    mime.startsWith('image/') ||
    mime.startsWith('application/vnd.google-apps.')
  );
}
