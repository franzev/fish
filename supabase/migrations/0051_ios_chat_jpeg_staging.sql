-- iOS normalizes selected photos with ImageIO, which can decode but cannot
-- encode WebP. JPEG is accepted only as a private staging representation;
-- ready message images remain server-produced WebP display/thumbnail files.
update storage.buckets
set allowed_mime_types = array[
  'image/webp', 'image/jpeg',
  'application/pdf', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]
where id = 'chat-images';
