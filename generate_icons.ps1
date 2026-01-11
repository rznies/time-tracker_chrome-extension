Add-Type -AssemblyName System.Drawing

function Create-Icon($size) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $color = [System.Drawing.Color]::CornflowerBlue
    $brush = New-Object System.Drawing.SolidBrush $color
    $graphics.FillRectangle($brush, 0, 0, $size, $size)
    $bitmap.Save("chrome-time-tracker/icons/icon$size.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
}

Create-Icon 16
Create-Icon 48
Create-Icon 128
Write-Host "Icons generated successfully."