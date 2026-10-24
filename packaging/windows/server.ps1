# Serves the Python Discovery web app on http://localhost:4173 and opens it as an app window.
# Uses only what ships with Windows (PowerShell and Edge). Nothing is installed and nothing leaves this computer.
$ErrorActionPreference = 'Stop'
$Port = 4173
$Url = "http://localhost:$Port/"
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'app'))

function Open-App {
    $candidates = @(
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe"
    )
    foreach ($browser in $candidates) {
        if ($browser -and (Test-Path $browser)) {
            Start-Process -FilePath $browser -ArgumentList "--app=$Url"
            return
        }
    }
    # No Chromium-based browser found: use the default browser (works, but without the app-style window).
    Start-Process $Url
}

if (-not (Test-Path (Join-Path $Root 'index.html'))) {
    Write-Host "The 'app' folder next to this script is missing. Unzip the whole download, then run again." -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}

$types = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript'; '.mjs' = 'text/javascript'; '.css' = 'text/css'
    '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'; '.wasm' = 'application/wasm'
    '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.txt' = 'text/plain; charset=utf-8'
    '.zip' = 'application/zip'; '.map' = 'application/json'; '.woff2' = 'font/woff2'; '.woff' = 'font/woff'; '.ttf' = 'font/ttf'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($Url)
try {
    $listener.Start()
} catch {
    # The port is taken. If it is another copy of this app, just open a window for it.
    try {
        $probe = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        if ($probe.Content -match 'Python Discovery') { Open-App; exit 0 }
    } catch { }
    Write-Host "Port $Port is in use by something else. Close that program and run this again." -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}

Write-Host 'Python Discovery is running. Leave this window open (minimize it); close it to stop the app.'
Open-App

while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
        $relative = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/')
        if ($relative -eq '') { $relative = 'index.html' }
        $path = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))
        # Only files inside the app folder are ever served.
        $isInside = $path.StartsWith($Root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
        if ($isInside -and (Test-Path $path -PathType Leaf)) {
            $extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
            $type = $types[$extension]
            if (-not $type) { $type = 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($path)
            $context.Response.ContentType = $type
            $context.Response.Headers.Add('Cache-Control', 'no-cache')
            $context.Response.ContentLength64 = $bytes.Length
            $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $context.Response.StatusCode = 404
        }
    } catch {
        try { $context.Response.StatusCode = 500 } catch { }
    } finally {
        try { $context.Response.OutputStream.Close() } catch { }
        try { $context.Response.Close() } catch { }
    }
}
