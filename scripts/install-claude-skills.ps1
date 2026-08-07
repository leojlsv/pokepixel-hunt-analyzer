param(
    [string]$SourceRepo = "https://github.com/Jeffallan/claude-skills.git"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git was not found in PATH."
}

$repoRoot = (Get-Location).Path
$skillsRoot = Join-Path $repoRoot ".claude\skills"
$tempRoot = Join-Path $env:TEMP ("claude-skills-" + [guid]::NewGuid().ToString("N"))
$wantedSkills = @("javascript-pro", "test-master")

try {
    Write-Host "Cloning third-party skills repository..."
    git clone --depth 1 $SourceRepo $tempRoot

    foreach ($skill in $wantedSkills) {
        $source = Join-Path $tempRoot ("skills\" + $skill)
        $target = Join-Path $skillsRoot $skill

        if (-not (Test-Path $source)) {
            throw "Skill '$skill' was not found at $source."
        }

        New-Item -ItemType Directory -Path $target -Force | Out-Null
        $gitkeep = Join-Path $target ".gitkeep"
        if (Test-Path $gitkeep) { Remove-Item $gitkeep -Force }

        Copy-Item -Path (Join-Path $source "*") -Destination $target -Recurse -Force
        Write-Host "Installed $skill"
    }

    Write-Host "Review third-party SKILL.md files before committing them."
}
finally {
    if (Test-Path $tempRoot) {
        Remove-Item $tempRoot -Recurse -Force
    }
}
