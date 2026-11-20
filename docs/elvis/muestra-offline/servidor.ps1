# Elvis Automotores — muestra local. Sirve la carpeta "sitio" en http://localhost:8080 y abre el navegador.
# No instala nada: usa PowerShell, que viene con Windows. Para cerrarlo, cierra esta ventana.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web
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

$raw = Join-Path $root '_raw'
function Inside([string]$f) { return ([IO.Path]::GetFullPath($f)).StartsWith([IO.Path]::GetFullPath($root)) }
function Find-File($url) {
  $path = $url.AbsolutePath
  $query = $url.Query.TrimStart('?')
  if ($path -eq '/_next/image') {
    $img = [System.Web.HttpUtility]::ParseQueryString($query)['url']
    if ($img) { $f = Join-Path $root ($img.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)); if ((Test-Path -LiteralPath $f -PathType Leaf) -and (Inside $f)) { return $f } }
    return $null
  }
  if ($query -match '_rsc=') { return $null }
  $rel = [System.Uri]::UnescapeDataString($path).Trim('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
  $candidates = @()
  if ($query) { $candidates += (Join-Path $raw ($rel + '@' + $query + '.html')) }
  $name = $(if ($rel -eq '') { 'index' } else { $rel })
  $candidates += (Join-Path $raw ($name + '.html'))
  $candidates += (Join-Path $root $rel)
  foreach ($c in $candidates) { if ((Test-Path -LiteralPath $c -PathType Leaf) -and (Inside $c)) { return $c } }
  return $null
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    $file = $(if ($req.HttpMethod -eq 'GET') { Find-File $req.Url } else { $null })
    if ($file) {
      $ext = [IO.Path]::GetExtension($file).ToLower()
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
