// Fotos oficiales de fábrica para los 0 km de la muestra. Se enlazan desde la web del fabricante (no se
// descargan): con internet se ven las originales; sin internet la foto falla y se muestra "Foto próximamente".
export const PLACEHOLDER_PHOTO = '/images/vehicles/foto-proximamente.jpg'

const OEM: Record<string, string[]> = {
  'fiat|600': [
    'https://600.fiat.com.ar//asset/versoes/600/blanco.png',
    'https://600.fiat.com.ar/asset/home/desktop.jpg',
    ...['estilo', 'rendimiento', 'seguridad', 'tecnologia'].map((n) => `https://600.fiat.com.ar//asset/highlights/${n}.jpg`),
    ...['disenio', 'performance', 'seguridad', 'tecnologia'].map((n) => `https://600.fiat.com.ar//asset/productDetails/mosaic/${n}.jpg`),
  ],
  'fiat|titano': [
    'https://titano.fiat.com.ar/images/Versions/endurance-mt/principal/249.png',
    'https://titano.fiat.com.ar/images/HeroDesktop/backgrounds/desktop.jpg',
    'https://titano.fiat.com.ar/images/Stories/mobile.jpg',
    'https://titano.fiat.com.ar/images/Stories/hero_versatilidad_mobile.jpg',
    'https://titano.fiat.com.ar/images/Stories/hero-scr-mobile.jpg',
  ],
  'fiat|toro': [
    'https://toro.fiat.com.ar/asset/versoes/volcano-13t/Negro_Carbon.png',
    'https://toro.fiat.com.ar/asset/home/desktop.jpg',
    'https://toro.fiat.com.ar/asset/versoes/freedom/Negro_Carbon.png',
    'https://toro.fiat.com.ar/asset/versoes/volcano-22td/Negro_Carbon.png',
    ...['robustez', 'turbo', 'interior', 'tecnologia'].map((n) => `https://toro.fiat.com.ar//asset/highlights/${n}.jpg`),
    ...['design', 'comfort', 'performance', 'tecnologia', 'seguridad'].map((n) => `https://toro.fiat.com.ar//asset/productDetails/mosaic/${n}.jpg`),
  ],
}

// 0 km de ejemplo para la muestra (precios ilustrativos).
const DEMO_0KM = [
  { id: 'demo-0km-fiat-600', model: '600', trim: 'Hybrid 1.2', price: 38900000, color: 'Blanco', fuelType: 'híbrido', transmission: 'automatica', engine: '1.2 Hybrid' },
  { id: 'demo-0km-fiat-titano', model: 'Titano', trim: 'Endurance 4x4 MT', price: 46500000, color: 'Gris', fuelType: 'diesel', transmission: 'manual', engine: '2.2 TD' },
  { id: 'demo-0km-fiat-toro', model: 'Toro', trim: 'Volcano 1.3T', price: 41200000, color: 'Negro Carbón', fuelType: 'nafta', transmission: 'automatica', engine: '1.3 Turbo' },
]

type Car = Record<string, any>
const key = (v: Car) => `${String(v.make ?? '').toLowerCase()}|${String(v.model ?? '').toLowerCase()}`
const onlyPlaceholder = (v: Car) => !v.images?.length || v.images.every((i: Car) => (i.imagePath || i.image?.url || PLACEHOLDER_PHOTO) === PLACEHOLDER_PHOTO)

function withPhotos(v: Car): Car {
  const urls = OEM[key(v)]
  if (!urls || v.condition !== 'new' || !onlyPlaceholder(v)) return v
  const images = urls.map((imagePath, i) => ({ id: `${v.id}-oem-${i}`, imagePath, isPrimary: i === 0, sortOrder: i, caption: `${v.year} ${v.make} ${v.model}` }))
  return { ...v, images, imagesCount: images.length }
}

/** Suma los 0 km de ejemplo (si faltan) y les pone las fotos de fábrica. */
export function withOemCatalog(list: Car[]): Car[] {
  const template = list.find((v) => v.condition === 'new')
  const extra = template ? DEMO_0KM.filter((d) => !list.some((v) => v.id === d.id)).map((d, i) => ({
    ...template, ...d, make: 'Fiat', year: 2026, mileage: 0, condition: 'new', status: 'available', vin: '', stockNumber: `EA-3${String(i + 1).padStart(2, '0')}`,
    previousPrice: null, isFeatured: false, progressiveOffer: false, features: ['0 km', 'Garantía oficial de fábrica'],
    description: `Fiat ${d.model} ${d.trim} 0 km. Consulta financiación y Plan Canje. Unidad de ejemplo para la demostración del sitio; precio ilustrativo. Fotos: sitio oficial de Fiat Argentina.`,
  })) : []
  return [...list, ...extra].map(withPhotos)
}

/** Si una foto de fábrica no carga (sin internet), muestra "Foto próximamente". */
export function installPhotoFallback() {
  if (typeof document === 'undefined' || (window as any).__elvPhotoFallback) return
  ;(window as any).__elvPhotoFallback = true
  document.addEventListener('error', (e) => {
    const img = e.target as HTMLImageElement
    if (!(img instanceof HTMLImageElement) || !/^https?:\/\//.test(img.getAttribute('src') || '') || img.src.startsWith(location.origin)) return
    img.removeAttribute('srcset')
    img.src = PLACEHOLDER_PHOTO
  }, true)
}
