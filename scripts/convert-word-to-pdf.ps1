param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$word = $null
$document = $null

try {
  $resolvedInputPath = (Resolve-Path -LiteralPath $InputPath).Path
  $resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
  $outputDirectory = [System.IO.Path]::GetDirectoryName($resolvedOutputPath)

  if (-not [string]::IsNullOrWhiteSpace($outputDirectory) -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
  }

  if (Test-Path -LiteralPath $resolvedOutputPath) {
    Remove-Item -LiteralPath $resolvedOutputPath -Force
  }

  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $document = $word.Documents.Open($resolvedInputPath, $false, $true)
  $wdExportFormatPdf = 17
  $document.ExportAsFixedFormat($resolvedOutputPath, $wdExportFormatPdf)

  if (-not (Test-Path -LiteralPath $resolvedOutputPath)) {
    throw 'Microsoft Word did not create the expected PDF output.'
  }
}
finally {
  if ($document -ne $null) {
    try {
      $document.Close($false)
    }
    catch {
    }

    try {
      [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)
    }
    catch {
    }
  }

  if ($word -ne $null) {
    try {
      $word.Quit()
    }
    catch {
    }

    try {
      [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)
    }
    catch {
    }
  }

  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}