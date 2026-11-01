param(
  [Parameter(Mandatory = $true)]
  [string]$ApkPath,
  [string]$Testers = '',
  [string]$ReleaseNotes = 'Accurate Sales test build'
)

$firebaseAppId = '1:219751118014:android:6d80d23124605ef9a21aef'

if (-not (Test-Path -LiteralPath $ApkPath)) {
  throw "APK not found: $ApkPath"
}

$arguments = @('appdistribution:distribute', $ApkPath, '--app', $firebaseAppId, '--release-notes', $ReleaseNotes)
if ($Testers.Trim()) {
  $arguments += @('--testers', $Testers)
}

npx firebase-tools @arguments
