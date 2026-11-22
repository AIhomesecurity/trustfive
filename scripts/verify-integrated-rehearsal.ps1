# Disposable, read-only PostgreSQL 16 verification for the integrated rehearsal.
# Applies every migration in supabase/migrations in glob order, then runs every
# SQL contract referenced by .github/workflows/database-tests.yml in workflow
# order. Never touches a live database, Supabase project or production data.
$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
$container = 'trustfive-rehearsal-verify-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
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
  $workflow = Join-Path $repo '.github/workflows/database-tests.yml'
  if (-not (Test-Path $workflow)) { throw 'database-tests.yml not found' }
  $contractPaths = @()
  foreach ($match in [regex]::Matches((Get-Content $workflow -Raw), '-f\s+(tests/[A-Za-z0-9_./-]+\.sql)')) {
    $relative = $match.Groups[1].Value
    if ($contractPaths -notcontains $relative) { $contractPaths += $relative }
  }
  if ($contractPaths.Count -lt 10) { throw "expected all DB contract steps, found $($contractPaths.Count)" }
  Write-Step ("Found " + $contractPaths.Count + " SQL steps in database workflow")

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

  foreach ($file in (Get-ChildItem (Join-Path $repo 'supabase/migrations/*.sql') | Sort-Object Name)) {
    Run-Psql $file.FullName ('migration ' + $file.Name)
  }

  foreach ($relative in $contractPaths) {
    if ($relative -like 'tests/db/bootstrap.sql') { continue }
    $path = Join-Path $repo $relative
    if (-not (Test-Path $path)) { throw "missing contract file: $relative" }
    Run-Psql $path ('contract ' + $relative)
  }
} catch {
  Write-Output ('ERROR ' + $_.Exception.Message)
  $overall = 1
} finally {
  if ($container) { & docker rm -f $container 2>&1 | Out-Null }
}

Write-Output ''
$results | Format-Table -AutoSize | Out-String | Write-Output
$failures = @($results | Where-Object { $_.Exit -ne 0 })
Write-Output ('SUMMARY total=' + $results.Count + ' failures=' + $failures.Count)
if ($failures.Count -gt 0) { $failures | ForEach-Object { Write-Output ('FAILED_STEP ' + $_.Step) } }
exit $overall
