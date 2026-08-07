$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$SidePanel = Join-Path $Root "sidepanel"
$Url = "http://127.0.0.1:8000/preview.html"

Write-Host ""
Write-Host "PokePixel Hunt Counter - Preview" -ForegroundColor Cyan
Write-Host "Pasta: $SidePanel"
Write-Host "URL:   $Url"
Write-Host ""

$PythonCommand = $null

if (Get-Command py -ErrorAction SilentlyContinue) {
    $PythonCommand = "py"
}
elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $PythonCommand = "python"
}
else {
    Write-Host "Python não encontrado no PATH." -ForegroundColor Red
    Write-Host "Você também pode usar a extensão Live Server do VS Code."
    Read-Host "Pressione Enter para fechar"
    exit 1
}

Start-Process $Url
Push-Location $SidePanel

try {
    if ($PythonCommand -eq "py") {
        & py -m http.server 8000 --bind 127.0.0.1
    }
    else {
        & python -m http.server 8000 --bind 127.0.0.1
    }
}
finally {
    Pop-Location
}
