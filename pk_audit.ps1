$raw = Get-Content "sql/check_it_registry.sql" -Raw
$parts = $raw -split "CREATE TABLE "
$results = @()
foreach ($part in $parts) {
    if ($part -match "^`([^`]+)`") {
        $tbl = $matches[1]
        $hasPK = [int]($part -match "PRIMARY\s+KEY")
        $results += [PSCustomObject]@{Table=$tbl; PK=$hasPK}
    }
}
$missing = $results | Where-Object { $_.PK -eq 0 }
Write-Output "=== TABLES WITHOUT PRIMARY KEY ==="
$missing | Format-Table -AutoSize
Write-Output "Total tables without PK: $($missing.Count)"
Write-Output "Total tables: $($results.Count)"
