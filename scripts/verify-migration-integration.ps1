param([switch]$AsIs)
# Disposable, read-only integration verification for the three competing 0036_ migrations.
# Default: renumber PR migrations to unique test versions (recommended merge shape).
# -AsIs: keep original names so the CI shell glob applies them in alphabetical order.
# This script NEVER touches a live database. It creates a temporary PostgreSQL 16
# container, applies the repository migrations plus the PR migrations with test-only
# unique version numbers, then runs every database contract from tests/db.
# Native psql writes harmless NOTICE messages to stderr; judge success by exit code only.
# Every native call below checks $LASTEXITCODE explicitly and throws on real failures.
$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
$container = 'trustfive-migration-verify-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$sqlRoot = Join-Path $env:TEMP ('trustfive-migration-sql-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$results = @()
$overall = 0

function Write-Step($message) { Write-Output ('==> ' + $message) }

function Run-Psql($file, $label) {
  $remoteFile = '/tmp/' + [System.IO.Path]::GetFileName($file)
  & docker cp $file "${container}:${remoteFile}" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "docker cp failed for $file" }
  $out = & docker exec $container psql -v ON_ERROR_STOP=1 -U postgres -d trustfive_test -f $remoteFile 2>&1 | Out-String
  $code = $LASTEXITCODE
  $short = ($out -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 3) -join ' | '
  if ($short.Length -gt 300) { $short = $short.Substring(0, 300) }
  $script:results += [pscustomobject]@{ Step = $label; Exit = $code; Tail = $short }
  if ($code -ne 0) {
    $script:overall = 1
    Write-Output ('FAIL ' + $label)
    Write-Output $out
  } else {
    Write-Output ('PASS ' + $label)
  }
}

try {
  Write-Step 'Fetching the three PR branches (quiet)'
  $refs = @{
    'agent/antigravity-fk-indexes-issue-13' = '0036_targeted_marketplace_fk_indexes.sql'
    'agent/gemini-professional-onboarding' = '0036_professional_onboarding_verification_and_suspension.sql'
    'agent/agy-bookings-quotes' = '0036_job_contact_prefs_and_quote_availability.sql'
  }
  foreach ($branch in $refs.Keys) {
    $target = 'refs/remotes/origin/' + $branch
    & git -C $repo fetch --quiet origin "refs/heads/${branch}:${target}" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed for $branch" }
  }

  Write-Step 'Staging SQL files with unique test-only version numbers'
  New-Item -ItemType Directory -Path $sqlRoot -Force | Out-Null
  $migrations = Join-Path $sqlRoot 'migrations'
  $contracts = Join-Path $sqlRoot 'contracts'
  New-Item -ItemType Directory -Path $migrations, $contracts -Force | Out-Null

  foreach ($file in (Get-ChildItem (Join-Path $repo 'supabase/migrations/*.sql') | Sort-Object Name)) {
    Copy-Item $file.FullName (Join-Path $migrations $file.Name)
  }
  $number = 36
  foreach ($branch in @('agent/antigravity-fk-indexes-issue-13','agent/gemini-professional-onboarding','agent/agy-bookings-quotes')) {
    $file = $refs[$branch]
    $content = & git -C $repo show ("refs/remotes/origin/${branch}:supabase/migrations/${file}")
    if ($LASTEXITCODE -ne 0) { throw "git show failed for $branch" }
    if ($AsIs) {
      $content | Set-Content -Path (Join-Path $migrations $file) -Encoding UTF8
    } else {
      $prefix = $number.ToString('0000') + '_pr' + $number + '_'
      $content | Set-Content -Path (Join-Path $migrations ($prefix + $file.Substring(5))) -Encoding UTF8
      $number++
    }
  }
  foreach ($file in (Get-ChildItem (Join-Path $repo 'tests/db/*.sql'))) { Copy-Item $file.FullName (Join-Path $contracts $file.Name) }
  foreach ($file in (Get-ChildItem (Join-Path $repo 'tests/sql/*.sql'))) { Copy-Item $file.FullName (Join-Path $contracts $file.Name) }

  Write-Step 'Starting disposable PostgreSQL 16 container'
  & docker run --rm -d --name $container -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=trustfive_test postgres:16 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'docker run failed' }
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    & docker exec $container pg_isready -h 127.0.0.1 -U postgres -d trustfive_test 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'PostgreSQL did not become ready' }

  Run-Psql (Join-Path $repo 'tests/db/bootstrap.sql') 'bootstrap'

  foreach ($file in (Get-ChildItem $migrations | Sort-Object Name)) {
    Run-Psql $file.FullName ('migration ' + $file.Name)
  }

  $contractOrder = @(
    'flows.sql','proximity.sql','security-definer-trigger-acl.sql',
    'public-directory-security-contract.sql','security-definer-grant-matrix.sql',
    'verified_territory_contract.sql','private-booking-contract.sql',
    'private-table-directory-negative-contract.sql','complaint-appeal-rls-contract.sql',
    'community-moderation-rls-contract.sql','launch-readiness-contract.sql',
    'human-territory-review-contract.sql','country-release-signoff-contract.sql',
    'uk-area-interest-contract.sql'
  )
  foreach ($name in $contractOrder) {
    $path = Join-Path $contracts $name
    if (Test-Path $path) { Run-Psql $path ('contract ' + $name) }
  }
} catch {
  Write-Output ('ERROR ' + $_.Exception.Message)
  $overall = 1
} finally {
  if ($container) { & docker rm -f $container 2>&1 | Out-Null }
  if ($sqlRoot -and (Test-Path $sqlRoot)) { Remove-Item -Recurse -Force $sqlRoot -ErrorAction SilentlyContinue }
}

Write-Output ''
$results | Format-Table -AutoSize | Out-String | Write-Output
$failures = @($results | Where-Object { $_.Exit -ne 0 })
Write-Output ('SUMMARY total=' + $results.Count + ' failures=' + $failures.Count)
if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Output ('FAILED_STEP ' + $_.Step) }
}
exit $overall
