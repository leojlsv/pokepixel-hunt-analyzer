$ErrorActionPreference = "Stop"

$dirs = @(
    ".claude\skills\javascript-pro",
    ".claude\skills\test-master",
    "background", "domain", "data", "services",
    "tests\unit", "tests\integration", "tests\fixtures",
    "prompts", "scripts", "docs"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Write-Host "Created $dir"
    }
}

$gitkeepDirs = @(
    ".claude\skills\javascript-pro",
    ".claude\skills\test-master",
    "background", "domain", "data", "services",
    "tests\unit", "tests\integration", "tests\fixtures"
)

foreach ($dir in $gitkeepDirs) {
    $gitkeep = Join-Path $dir ".gitkeep"
    if (-not (Test-Path $gitkeep)) {
        New-Item -ItemType File -Path $gitkeep | Out-Null
    }
}

Write-Host "Project folder structure is ready."
