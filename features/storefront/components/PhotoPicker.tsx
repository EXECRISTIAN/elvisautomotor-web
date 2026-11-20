'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'

/**
 * Agregar fotos desde la galería/archivos o sacarlas con la cámara.
 * En celular y tablet, "Sacar foto" abre la cámara del dispositivo; en computadora abre la webcam.
 */
export function PhotoPicker({ onFiles, disabled, label = 'Agregar fotos' }: { onFiles: (files: File[]) => void; disabled?: boolean; label?: string }) {
  const [camera, setCamera] = useState(false)
  const mobileCamera = useRef<HTMLInputElement>(null)

  const openCamera = () => {
    const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    if (touch || !navigator.mediaDevices?.getUserMedia) mobileCamera.current?.click()
    else setCamera(true)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <label className={`sf-btn sf-btn-ghost min-h-12 cursor-pointer rounded-[8px] ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <ImagePlus className="size-4" aria-hidden="true" />
        {label}
        <input type="file" accept="image/*" multiple className="sr-only" disabled={disabled} onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) onFiles(files) }} />
      </label>
      <button type="button" className="sf-btn sf-btn-ghost min-h-12 rounded-[8px]" disabled={disabled} onClick={openCamera}>
        <Camera className="size-4" aria-hidden="true" />
        Sacar foto
      </button>
      <input ref={mobileCamera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) onFiles(files) }} />
      {camera && <WebcamDialog onClose={() => setCamera(false)} onShot={(file) => onFiles([file])} />}
    </div>
  )
}

function WebcamDialog({ onClose, onShot }: { onClose: () => void; onShot: (file: File) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')

  useEffect(() => {
    let stream: MediaStream | null = null
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 } }, audio: false })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; void video.current.play() } setError(null) })
      .catch(() => setError('No pudimos abrir la cámara. Revisa que el navegador tenga permiso para usarla, o usa "Agregar fotos".'))
    return () => stream?.getTracks().forEach((track) => track.stop())
  }, [facing])

  const shoot = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d')?.drawImage(v, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      onShot(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      setCount((n) => n + 1)
    }, 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Sacar foto">
      <div className="w-full max-w-2xl">
        <div className="relative overflow-hidden rounded-[12px] bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={video} playsInline muted className="aspect-video w-full object-cover" />
          {error && <p className="absolute inset-0 grid place-items-center p-6 text-center text-white">{error}</p>}
          <button type="button" onClick={onClose} className="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-black/70 text-white" aria-label="Cerrar cámara"><X className="size-5" aria-hidden="true" /></button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={shoot} disabled={Boolean(error)} className="sf-btn sf-btn-primary min-h-14 rounded-full px-8"><Camera className="size-5" aria-hidden="true" />Sacar foto</button>
          <button type="button" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} className="sf-btn sf-btn-ghost min-h-12 rounded-full text-white">Cambiar cámara</button>
          <button type="button" onClick={onClose} className="sf-btn sf-btn-ghost min-h-12 rounded-full text-white">Listo{count ? ` (${count})` : ''}</button>
        </div>
        <p className="mt-2 text-center text-[0.85rem] text-white/70" role="status">{count ? `${count} ${count === 1 ? 'foto agregada' : 'fotos agregadas'}` : 'Encuadra y toca "Sacar foto". Puedes sacar varias.'}</p>
      </div>
    </div>
  )
}
