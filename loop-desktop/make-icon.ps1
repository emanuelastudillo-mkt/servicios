$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskBitmap = [Drawing.Bitmap]::new(256, 256)
$taskGraphics = [Drawing.Graphics]::FromImage($taskBitmap)
$taskGraphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$taskGraphics.Clear([Drawing.Color]::Transparent)
$taskPath = [Drawing.Drawing2D.GraphicsPath]::new()
foreach ($taskArc in @(@(0,0,144,144,180,90),@(112,0,144,144,270,90),@(112,112,144,144,0,90),@(0,112,144,144,90,90))) { $taskGraphicsPathArgs = $taskArc; $taskPath.AddArc($taskArc[0],$taskArc[1],$taskArc[2],$taskArc[3],$taskArc[4],$taskArc[5]) }
$taskPath.CloseFigure()
$taskBrush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#c7f69b'))
$taskGraphics.FillPath($taskBrush, $taskPath)
$taskPen = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#151b14'), 16)
$taskPen.StartCap = $taskPen.EndCap = [Drawing.Drawing2D.LineCap]::Round
foreach ($taskLine in @(@(56,108,148),@(84,72,184),@(112,88,168),@(144,72,184),@(172,88,168),@(200,108,148))) { $taskGraphics.DrawLine($taskPen,$taskLine[0],$taskLine[1],$taskLine[0],$taskLine[2]) }
$taskPng = [IO.MemoryStream]::new(); $taskBitmap.Save($taskPng,[Drawing.Imaging.ImageFormat]::Png)
$taskFile = [IO.File]::Create((Join-Path $PSScriptRoot 'seis.ico')); $taskWriter = [IO.BinaryWriter]::new($taskFile)
$taskWriter.Write([uint16]0); $taskWriter.Write([uint16]1); $taskWriter.Write([uint16]1)
$taskWriter.Write([byte]0); $taskWriter.Write([byte]0); $taskWriter.Write([byte]0); $taskWriter.Write([byte]0)
$taskWriter.Write([uint16]1); $taskWriter.Write([uint16]32); $taskWriter.Write([uint32]$taskPng.Length); $taskWriter.Write([uint32]22)
$taskWriter.Write($taskPng.ToArray()); $taskWriter.Dispose(); $taskPng.Dispose(); $taskPen.Dispose(); $taskBrush.Dispose(); $taskPath.Dispose(); $taskGraphics.Dispose(); $taskBitmap.Dispose()
