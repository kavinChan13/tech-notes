# Batch-inject the shared site-theme.css and site-theme.js into every doc.
# Idempotent: skips files that already reference site-theme.

param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# Files that already have their own sticky top nav / toolbar / left rail and
# should suppress the auto-injected topbar (they get the floating Home FAB
# + scroll-progress bar instead).
$overlayFiles = @(
    'software_management_guide.html',
    'management_knowledge_system.html',
    'tech_lead_interview_guide.html',
    'cpp_os_fundamentals.html',
    'cpp_templates_guide.html',
    'cpp_networking_guide.html',
    'cpp_interview_cards.html',
    'cpp_memory_leak_guide.html'
)

# Files we never touch (the entry page has its own theme).
$skipFiles = @(
    'index.html'
)

# Files already converted manually.
$pptFiles = @(
    'cpp_modern_features_ppt.html',
    'cpp_stl_containers_ppt.html',
    'cpp_stl_algorithms_ppt.html',
    'cpp_design_patterns_ppt.html'
)

$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path
$targets  = Get-ChildItem -Path $repoRoot -Filter '*.html' -File |
            Where-Object { $skipFiles -notcontains $_.Name -and $pptFiles -notcontains $_.Name }

# Optional: also extend to em-templates? User asked root only -> skip subfolders.

foreach ($f in $targets) {
    $path = $f.FullName
    $name = $f.Name
    # Always read as UTF-8 to avoid Windows ANSI fallback mangling Chinese chars.
    $content = [System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false))

    $changed = $false

    if ($content -notmatch 'assets/site-theme\.css') {
        if ($content -match '</title>') {
            $linkTag = '<link rel="stylesheet" href="./assets/site-theme.css">'
            # Insert the <link> tag on its own line right after </title>.
            $content = $content -replace '</title>', "</title>`r`n$linkTag"
            $changed = $true
        } else {
            Write-Warning "[$name] no </title> found, skipping CSS injection."
        }
    }

    if ($content -notmatch 'assets/site-theme\.js') {
        if ($content -match '</body>') {
            $scriptTag = '<script src="./assets/site-theme.js" defer></script>'
            $content = $content -replace '</body>', "$scriptTag`r`n</body>"
            $changed = $true
        } else {
            Write-Warning "[$name] no </body> found, skipping JS injection."
        }
    }

    # Ensure the body has the right shell class. PowerShell's -replace doesn't
    # accept script-block replacements, so handle the two cases explicitly.
    if ($overlayFiles -contains $name) {
        if ($content -notmatch '<body[^>]*\btn-shell-overlay\b') {
            if ($content -match '<body\s+class="([^"]*)"') {
                # Append to existing class list.
                $content = $content -replace '<body(\s+)class="([^"]*)"', '<body$1class="$2 tn-shell-overlay"'
            } else {
                # No class attribute yet.
                $content = $content -replace '<body(>|\s)', '<body class="tn-shell-overlay"$1'
            }
            $changed = $true
        }
    }

    if ($changed) {
        if ($DryRun) {
            Write-Host "[would-modify] $name"
        } else {
            # Preserve UTF-8 (without BOM).
            [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
            Write-Host "[modified]    $name"
        }
    } else {
        Write-Host "[unchanged]   $name"
    }
}
