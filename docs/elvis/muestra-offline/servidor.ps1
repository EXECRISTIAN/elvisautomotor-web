# Elvis Automotores - muestra local. Sirve la carpeta "sitio" en http://localhost:8080 y abre el navegador.
# No instala nada: usa PowerShell, que viene con Windows. Para cerrarlo, cierra esta ventana.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web
$root = Join-Path $PSScriptRoot 'sitio'
# Todo lo que se carga en la muestra (consultas, usuarios, autos, fotos) se guarda en esta carpeta.
$datos = Join-Path $PSScriptRoot 'datos'
$fotos = Join-Path $datos 'fotos'
New-Item -ItemType Directory -Force -Path $fotos | Out-Null
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript'; '.css'='text/css'; '.json'='application/json';
  '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.webp'='image/webp'; '.ico'='image/x-icon'; '.pdf'='application/pdf'; '.doc'='application/msword'; '.docx'='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  '.woff2'='font/woff2'; '.woff'='font/woff'; '.txt'='text/plain; charset=utf-8'; '.xml'='application/xml' }

$listener = $null
# Siempre el mismo puerto si esta libre: asi el navegador conserva los datos guardados.
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
Write-Host '  ELVIS AUTOMOTORES - muestra local' -ForegroundColor Yellow
Write-Host "  Abierta en $base  (deja esta ventana abierta mientras la miras)"
Write-Host ''
Start-Process $base

$raw = Join-Path $root '_raw'
function Inside([string]$f) { $full = [IO.Path]::GetFullPath($f); return $full.StartsWith([IO.Path]::GetFullPath($root)) -or $full.StartsWith([IO.Path]::GetFullPath($datos)) }
function Find-File($url) {
  $path = $url.AbsolutePath
  $query = $url.Query.TrimStart('?')
  if ($path -like '/_local/fotos/*') {
    $f = Join-Path $fotos ([IO.Path]::GetFileName([System.Uri]::UnescapeDataString($path.Substring(14))))
    if (Test-Path -LiteralPath $f -PathType Leaf) { return $f }
    return $null
  }
  if ($path -eq '/_next/image') {
    $img = [System.Web.HttpUtility]::ParseQueryString($query)['url']
    if ($img -like '/_local/fotos/*') { $f = Join-Path $fotos ([IO.Path]::GetFileName($img)); if (Test-Path -LiteralPath $f -PathType Leaf) { return $f }; return $null }
    if ($img) { $f = Join-Path $root ($img.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)); if ((Test-Path -LiteralPath $f -PathType Leaf) -and (Inside $f)) { return $f } }
    return $null
  }
  if ($query -match '_rsc=') { return $null }
  $rel = [System.Uri]::UnescapeDataString($path).Trim('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
  $candidates = @()
  if ($query) { $candidates += (Join-Path $raw ($rel + '@' + $query + '.html')) }
  if ($rel -like 'dashboard*' -or $rel -like 'account*' -or $rel -like 'signin*') { $rel = 'panel' }
  $name = $(if ($rel -eq '') { 'index' } else { $rel })
  $candidates += (Join-Path $raw ($name + '.html'))
  $candidates += (Join-Path $root $rel)
  foreach ($c in $candidates) { if ((Test-Path -LiteralPath $c -PathType Leaf) -and (Inside $c)) { return $c } }
  # Autos agregados desde el panel: se usa una ficha como plantilla y la pagina carga el auto por su direccion.
  if ($rel -like ('inventory' + [IO.Path]::DirectorySeparatorChar + '*')) {
    $tpl = Get-ChildItem -LiteralPath (Join-Path $raw 'inventory') -Filter '*.html' | Select-Object -First 1
    if ($tpl) { return $tpl.FullName }
  }
  return $null
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    $path = $req.Url.AbsolutePath
    if ($path -eq '/_local/db') {
      $dbFile = Join-Path $datos 'datos.json'
      if ($req.HttpMethod -eq 'PUT' -or $req.HttpMethod -eq 'POST') {
        $reader = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        [IO.File]::WriteAllText($dbFile, $body, (New-Object Text.UTF8Encoding($false)))
        $res.StatusCode = 204; $res.OutputStream.Close(); continue
      }
      $json = $(if (Test-Path -LiteralPath $dbFile) { [IO.File]::ReadAllText($dbFile, [Text.Encoding]::UTF8) } else { '{}' })
      $bytes = [Text.Encoding]::UTF8.GetBytes($json)
      $res.ContentType = 'application/json; charset=utf-8'; $res.Headers.Add('Cache-Control', 'no-store')
      $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes, 0, $bytes.Length); $res.OutputStream.Close(); continue
    }
    if ($path -like '/_local/fotos/*') {
      $name = [IO.Path]::GetFileName([System.Uri]::UnescapeDataString($path.Substring(14)))
      if ($name -notmatch '^[A-Za-z0-9._-]{1,120}$') { $res.StatusCode = 400; $res.OutputStream.Close(); continue }
      $target = Join-Path $fotos $name
      if ($req.HttpMethod -eq 'PUT' -or $req.HttpMethod -eq 'POST') {
        $fs = [IO.File]::Create($target); $req.InputStream.CopyTo($fs); $fs.Close()
        $res.StatusCode = 204; $res.OutputStream.Close(); continue
      }
      if ($req.HttpMethod -eq 'DELETE') { if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target }; $res.StatusCode = 204; $res.OutputStream.Close(); continue }
    }
    $file = $(if ($req.HttpMethod -eq 'GET') { Find-File $req.Url } else { $null })
    if ($file) {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
      # Paginas y datos: sin copia en el navegador, asi siempre se ve la ultima version de la muestra.
      if ($ext -eq '.html' -or $ext -eq '.json' -or $path -eq '/_next/image') { $res.Headers.Add('Cache-Control', 'no-store') } else { $res.Headers.Add('Cache-Control', 'no-cache') }
      $bytes = [IO.File]::ReadAllBytes($file)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
    $res.OutputStream.Close()
  } catch { }
}
