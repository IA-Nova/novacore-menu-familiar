const FULL_MAX = 120 * 1024;
const THUMB_MAX = 15 * 1024;

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('No se pudo leer la fotografía.'));
    reader.readAsDataURL(blob);
  });
}
function canvasBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}
function scaledCanvas(source, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no puede procesar imágenes.');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}
async function encode(source, originalWidth, originalHeight, maxSide, targetBytes) {
  let factor = Math.min(1, maxSide / Math.max(originalWidth, originalHeight));
  for (let reduction = 0; reduction < 5; reduction++) {
    const width = Math.max(1, Math.round(originalWidth * factor));
    const height = Math.max(1, Math.round(originalHeight * factor));
    const canvas = scaledCanvas(source, width, height);
    for (const quality of [0.82, 0.7, 0.56, 0.42]) {
      // JPEG is supported consistently on desktop and mobile browsers.
      const blob = await canvasBlob(canvas, 'image/jpeg', quality);
      if (blob && blob.type === 'image/jpeg' && blob.size <= targetBytes) {
        return { mimeType: 'image/jpeg', base64: await toBase64(blob), width, height, sizeBytes: blob.size };
      }
    }
    factor *= 0.75;
  }
  throw new Error('No se pudo reducir la imagen al tamaño permitido. Prueba con otra foto.');
}
async function decodeImage(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Selecciona una imagen JPG, PNG o WebP.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Selecciona una fotografía menor de 20 MB.');
  if (typeof createImageBitmap === 'function') {
    try { const bitmap = await createImageBitmap(file); return { source: bitmap, close: () => bitmap.close() }; }
    catch { throw new Error('La fotografía está dañada o no es válida.'); }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('La fotografía está dañada o no es válida.'));
      element.src = url;
    });
    return { source: img, close: () => URL.revokeObjectURL(url) };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}
export async function processDishPhoto(file) {
  const { source, close } = await decodeImage(file);
  try {
    const width = source.width; const height = source.height;
    if (!width || !height || width * height > 80_000_000)
      throw new Error('La fotografía tiene dimensiones no permitidas.');
    const [photo, thumbnail] = await Promise.all([
      encode(source, width, height, 960, FULL_MAX),
      encode(source, width, height, 320, THUMB_MAX),
    ]);
    return { photo, thumbnail };
  } finally { close(); }
}
