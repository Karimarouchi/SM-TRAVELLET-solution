$ErrorActionPreference = 'Stop'

$candidatePorts = @(5500, 5501, 5502, 8080)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = $null
$prefix = $null

# Build Tailwind CSS before starting the local server.
# This removes stale styles and keeps production parity.
Push-Location $root
try {
  if (Test-Path (Join-Path $root 'package.json') -PathType Leaf) {
    Write-Host 'Compilation CSS en cours (npm run build:css)...'
    & npm.cmd run build:css
    if ($LASTEXITCODE -ne 0) {
      throw 'Échec de la compilation CSS (npm run build:css).'
    }
    Write-Host 'Compilation CSS terminée.'
  }
  else {
    Write-Host 'package.json introuvable, build CSS ignoré.'
  }
}
finally {
  Pop-Location
}

foreach ($port in $candidatePorts) {
  $testListener = [System.Net.HttpListener]::new()
  $testPrefix = "http://localhost:$port/"
  $testListener.Prefixes.Add($testPrefix)

  try {
    $testListener.Start()
    $listener = $testListener
    $prefix = $testPrefix
    break
  }
  catch {
    $testListener.Close()
  }
}

if (-not $listener) {
  throw 'Aucun port libre trouvé pour démarrer le site local.'
}

Write-Host "Site SM Travel disponible sur $prefix"
Write-Host "Laissez cette fenêtre ouverte pendant l'utilisation du site."
Start-Process $prefix

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relativePath = $context.Request.Url.AbsolutePath.TrimStart('/')
    # Décoder les caractères URL-encodés (%20 → espace, etc.)
    $relativePath = [System.Uri]::UnescapeDataString($relativePath)

    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      $relativePath = 'index.html'
    }

    $filePath = Join-Path $root $relativePath

    if (Test-Path $filePath -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()

      switch ($extension) {
        '.html' { $context.Response.ContentType = 'text/html; charset=utf-8' }
        '.css' { $context.Response.ContentType = 'text/css; charset=utf-8' }
        '.js' { $context.Response.ContentType = 'application/javascript; charset=utf-8' }
        '.json' { $context.Response.ContentType = 'application/json; charset=utf-8' }
        '.png' { $context.Response.ContentType = 'image/png' }
        '.jpg' { $context.Response.ContentType = 'image/jpeg' }
        '.jpeg' { $context.Response.ContentType = 'image/jpeg' }
        '.svg' { $context.Response.ContentType = 'image/svg+xml' }
        '.webp' { $context.Response.ContentType = 'image/webp' }
        '.mp3' { $context.Response.ContentType = 'audio/mpeg' }
        default { $context.Response.ContentType = 'application/octet-stream' }
      }

      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    else {
      $context.Response.StatusCode = 404
      $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
      $context.Response.OutputStream.Write($body, 0, $body.Length)
    }

    $context.Response.OutputStream.Close()
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}