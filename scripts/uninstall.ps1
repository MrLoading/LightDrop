# ==============================================================================
# LightDrop Windows 原生 PowerShell 卸载与清理脚本
# 支持：
# 1. 自动解析 Windows 工作路径与 runinfo 运行记录
# 2. 精准注销 Windows 任务计划程序、开机自启文件夹、Docker 及后台进程
# 3. 数据安全保留 vs 彻底清理选项支持
# 4. 彻底清理程序运行目录
# ==============================================================================

[CmdletBinding()]
param (
    [string]$WorkDir = "",
    [switch]$DeleteData,
    [switch]$KeepData,
    [switch]$Yes,
    [switch]$Force,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
    Write-Host @"
LightDrop Windows 服务卸载工具

用法:
  .\uninstall.ps1 [选项]

选项:
  -WorkDir <路径>   工作目录 (默认: `$env:LOCALAPPDATA\LightDrop)
  -DeleteData       【彻底删除】所有上传文件与运行数据
  -KeepData         【安全保留】所有上传文件，仅卸载服务
  -Yes              非交互确认模式 (默认保留数据)
  -Force            强制卸载模式
  -Help             显示此帮助信息
"@
    exit 0
}

$DefaultWorkDir = if ($env:LOCALAPPDATA) { "$env:LOCALAPPDATA\LightDrop" } else { "C:\ProgramData\LightDrop" }
if (-not $WorkDir) {
    $WorkDir = $DefaultWorkDir
}

if (-not (Test-Path $WorkDir)) {
    Write-Host "工作路径不存在: $WorkDir，无需卸载。" -ForegroundColor Yellow
    exit 0
}

$RunInfoDir = Join-Path $WorkDir "runinfo"
$RunInfoFile = Join-Path $RunInfoDir "lightdrop-runinfo.json"
$DeployMode = "task"
$DataDir = Join-Path $WorkDir "data"
$TaskName = "LightDrop"
$ContainerName = "lightdrop"
$Pm2Name = "lightdrop"

if (Test-Path $RunInfoFile) {
    try {
        $Json = Get-Content $RunInfoFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($Json.deployMode) { $DeployMode = $Json.deployMode }
        if ($Json.dataDir) { $DataDir = $Json.dataDir.Replace("/", "\") }
        if ($Json.taskName) { $TaskName = $Json.taskName }
        if ($Json.containerName) { $ContainerName = $Json.containerName }
        if ($Json.pm2Name) { $Pm2Name = $Json.pm2Name }
    } catch {}
}

# 确认数据保留
$PurgeData = $false
if ($DeleteData) {
    $PurgeData = $true
} elseif ($KeepData) {
    $PurgeData = $false
} elseif ($Yes) {
    $PurgeData = $false
} else {
    Write-Host "`n┌──────────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
    Write-Host "│  📦 数据保留选项确认                                         │" -ForegroundColor Yellow
    Write-Host "├──────────────────────────────────────────────────────────────┤" -ForegroundColor Yellow
    Write-Host "│  数据存储目录: $DataDir"
    Write-Host "│  是否彻底删除已上传的文件和历史数据？                        │"
    Write-Host "│  [y] 彻底删除 (包含所有上传的文件与设置)                     │"
    Write-Host "│  [N] 安全保留 (仅停止并注销服务，上传的文件完好保留)         │"
    Write-Host "└──────────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
    $Choice = Read-Host "请输入选择 [y/N] (默认保留 N)"
    if ($Choice -like "y*") {
        $PurgeData = $true
    }
}

Write-Host "`n━━━ [1/3] 停止并注销 Windows 服务与自启动项 ━━━" -ForegroundColor Cyan
switch ($DeployMode) {
    "task" {
        schtasks.exe /End /TN $TaskName 2>$null | Out-Null
        schtasks.exe /Delete /TN $TaskName /F 2>$null | Out-Null
        Get-Process "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*node*" } | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ 任务计划程序 ($TaskName) 已注销" -ForegroundColor Green
    }
    "startup" {
        $StartupFile = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\LightDrop.vbs"
        if (Test-Path $StartupFile) {
            Remove-Item -Force $StartupFile
            Write-Host "  ✓ 开机自启项已移除: $StartupFile" -ForegroundColor Green
        }
        Get-Process "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }
    "docker" {
        docker stop $ContainerName 2>$null | Out-Null
        docker rm -f $ContainerName 2>$null | Out-Null
        Write-Host "  ✓ Docker 容器已移除: $ContainerName" -ForegroundColor Green
    }
    "pm2" {
        pm2 delete $Pm2Name 2>$null | Out-Null
        pm2 save 2>$null | Out-Null
        Write-Host "  ✓ PM2 任务已移除: $Pm2Name" -ForegroundColor Green
    }
    Default {
        Get-Process "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "`n━━━ [2/3] 清理程序与工作目录 ━━━" -ForegroundColor Cyan
if ($PurgeData) {
    if (Test-Path $DataDir) {
        Remove-Item -Recurse -Force $DataDir -ErrorAction SilentlyContinue
    }
    if (Test-Path $WorkDir) {
        Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
    }
    Write-Host "  ✓ 工作目录及所有上传数据已彻底删除" -ForegroundColor Green
} else {
    foreach ($sub in @("app", "runinfo", "logs", "bin")) {
        $p = Join-Path $WorkDir $sub
        if (Test-Path $p) {
            Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue
        }
    }
    Remove-Item (Join-Path $WorkDir "lightdrop.config.json") -ErrorAction SilentlyContinue
    Write-Host "  ✓ 程序与配置已清理，安全保留数据目录: $DataDir" -ForegroundColor Green
}

Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " ✔ LightDrop 卸载作业全部完成" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  服务状态:      已注销"
Write-Host "  数据处理:      $(if ($PurgeData) { '已彻底删除' } else { '已安全保留' })"
if (-not $PurgeData) {
    Write-Host "  数据路径:      $DataDir`n"
}
