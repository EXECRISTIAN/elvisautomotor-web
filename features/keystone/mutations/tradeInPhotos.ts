import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { SubmissionError } from './submissionErrors'

const PHOTO_STORAGE = 'my_images'
export const MAX_TRADE_IN_PHOTOS = 8
const TOKEN_TTL_MS = 60 * 60 * 1000
const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

/** Emite un código de un solo uso (1 hora) para adjuntar fotos a un usado recién enviado. Guarda solo el hash. */
export async function issueTradeInPhotoToken(context: any, tradeInId: string) {
  const token = randomBytes(24).toString('base64url')
  await context.sudo().prisma.tradeIn.update({
    where: { id: tradeInId },
    data: { photoTokenHash: hashToken(token), photoTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  })
  return token
}

/**
 * Mutación pública: adjunta una foto a un usado ofrecido. Requiere el código temporal emitido al enviar
 * el formulario; valida tipo, tamaño y cantidad. No devuelve datos del usado.
 */
export async function attachTradeInPhoto(_root: unknown, { tradeInId, photoToken, photo }: { tradeInId: string; photoToken: string; photo: any }, context: any) {
  const id = String(tradeInId || '').trim()
  const token = String(photoToken || '').trim()
  if (!id || token.length < 20 || token.length > 100) throw new SubmissionError('Código de fotos inválido.', 403, 'PHOTO_TOKEN_INVALID')

  const sudo = context.sudo()
  const tradeIn = await sudo.prisma.tradeIn.findUnique({
    where: { id },
    select: { id: true, rooftopId: true, photoTokenHash: true, photoTokenExpiresAt: true, _count: { select: { photos: true } } },
  })
  const expected = Buffer.from(tradeIn?.photoTokenHash || '', 'hex')
  const actual = Buffer.from(hashToken(token), 'hex')
  const valid = Boolean(tradeIn) && expected.length === actual.length && timingSafeEqual(expected, actual)
  if (!valid || !tradeIn?.photoTokenExpiresAt || tradeIn.photoTokenExpiresAt.getTime() < Date.now()) {
    throw new SubmissionError('El plazo para adjuntar fotos venció. Envíalas por WhatsApp.', 403, 'PHOTO_TOKEN_INVALID')
  }
  if (tradeIn._count.photos >= MAX_TRADE_IN_PHOTOS) {
    throw new SubmissionError(`Puedes adjuntar hasta ${MAX_TRADE_IN_PHOTOS} fotos.`, 400, 'PHOTO_LIMIT')
  }

  const upload = await photo?.upload
  if (!upload?.createReadStream) throw new SubmissionError('Elige una foto.', 400, 'PHOTO_MISSING')
  const extension = String(upload.filename || '').split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.has(extension) || !/^image\/(jpeg|png|webp)$/.test(String(upload.mimetype || ''))) {
    throw new SubmissionError('Las fotos deben ser JPG, PNG o WebP.', 400, 'PHOTO_TYPE')
  }

  let stored: any
  try {
    stored = await context.images(PHOTO_STORAGE).getDataFromStream(upload.createReadStream(), String(upload.filename || 'foto'))
  } catch {
    throw new SubmissionError('No pudimos procesar la foto. Prueba con otra imagen.', 400, 'PHOTO_UNREADABLE')
  }
  if (!stored || stored.filesize > MAX_PHOTO_BYTES) {
    if (stored) await context.images(PHOTO_STORAGE).deleteAtSource(stored.id, stored.extension).catch(() => {})
    throw new SubmissionError('Cada foto puede pesar hasta 8 MB.', 400, 'PHOTO_TOO_LARGE')
  }

  await sudo.prisma.tradeInPhoto.create({
    data: {
      rooftop: { connect: { id: tradeIn.rooftopId } },
      tradeIn: { connect: { id: tradeIn.id } },
      image_id: stored.id,
      image_extension: stored.extension,
      image_filesize: stored.filesize,
      image_width: stored.width,
      image_height: stored.height,
      sortOrder: tradeIn._count.photos,
    },
  })
  return { count: tradeIn._count.photos + 1 }
}
