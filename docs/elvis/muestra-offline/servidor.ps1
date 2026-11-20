# Elvis Automotores — muestra local. Sirve la carpeta "sitio" en http://localhost:8080 y abre el navegador.
# No instala nada: usa PowerShell, que viene con Windows. Para cerrarlo, cierra esta ventana.
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'sitio'
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript'; '.css'='text/css'; '.json'='application/json';
  '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.webp'='image/webp'; '.ico'='image/x-icon';
  '.woff2'='font/woff2'; '.woff'='font/woff'; '.txt'='text/plain; charset=utf-8'; '.xml'='application/xml' }

$listener = $null
foreach ($port in 8080, 8081, 8082, 8090, 8765) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$port/")
    $l.Start(); $listener = $l; break
  } catch { }
}
if (-not $listener) { Write-Host 'No se pudo abrir un puerto local. Cierra otros programas e intenta de nuevo.'; Read-Host 'Enter para salir'; exit 1 }
$base = $listener.Prefixes | Select-Object -First 1
Write-Host ''
Write-Host '  ELVIS AUTOMOTORES — muestra local' -ForegroundColor Yellow
Write-Host "  Abierta en $base  (deja esta ventana abierta mientras la miras)"
Write-Host ''
Start-Process $base

function Find-File([string]$path, [string]$query) {
  $rel = [System.Uri]::UnescapeDataString($path).TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
  $candidates = @()
  if ($query) {
    $q = $query.TrimStart('?')
    $candidates += (Join-Path $root ($rel + '@' + $q + '.html'))
    $candidates += (Join-Path $root ($rel + '@' + $q))
  }
  if ($rel -eq '') { $candidates += (Join-Path $root 'index.html') }
  $candidates += (Join-Path $root $rel)
  $candidates += (Join-Path $root ($rel + '.html'))
  $candidates += (Join-Path $root (Join-Path $rel 'index.html'))
  foreach ($c in $candidates) { if ((Test-Path -LiteralPath $c -PathType Leaf) -and ([IO.Path]::GetFullPath($c)).StartsWith([IO.Path]::GetFullPath($root))) { return $c } }
  return $null
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    $file = Find-File $req.Url.AbsolutePath $req.Url.Query
    # Pedidos internos de navegación (_rsc) o datos del servidor: no existen en la muestra.
    if ($req.Url.Query -match '_rsc=' -or $req.HttpMethod -ne 'GET') { $file = $null }
    if ($file) {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      if ($file -match '@url=') { $ext = [IO.Path]::GetExtension(($file -split '@url=')[1].Split('&')[0]).ToLower() }
      $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
      $bytes = [IO.File]::ReadAllBytes($file)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
    $res.OutputStream.Close()
  } catch { }
}
