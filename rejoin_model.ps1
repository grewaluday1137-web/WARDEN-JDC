# This script joins the split model parts back into the original .gguf file.
$targetFiles = @(
    "WARDEN/Responder Desktop App/src-tauri/binaries/gemma-4-e2b.gguf",
    "WARDEN/Staff Desktop App/app/src-tauri/binaries/gemma-4-e2b.gguf"
)

foreach ($file in $targetFiles) {
    if (Test-Path "$file.part1") {
        Write-Host "Rejoining $file..."
        Get-Content "$file.part*" -Encoding Byte -Raw | Set-Content $file -Encoding Byte
        Write-Host "Successfully recreated $file"
    } else {
        Write-Host "Parts for $file not found. Skipping."
    }
}
