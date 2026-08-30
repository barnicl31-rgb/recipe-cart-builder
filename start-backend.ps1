$ProjectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodePath = "C:\Users\finan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

Set-Location -LiteralPath $ProjectPath
& $NodePath server.js
