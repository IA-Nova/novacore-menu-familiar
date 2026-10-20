export function asDataUri(photo) {
  if (!photo || !['image/jpeg', 'image/webp'].includes(photo.mimeType) ||
      typeof photo.base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo.base64)) return '';
  return `data:${photo.mimeType};base64,${photo.base64}`;
}
