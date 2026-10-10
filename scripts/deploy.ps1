# ==============================================================================
# LightDrop Windows 原生 PowerShell 构建与部署脚本
# 支持：
# 1. 自动适配 Windows 10/11/Server 运行环境
# 2. 多种生命周期管理模式：
#    • task:       Windows 任务计划程序 (原生静默后台常驻，推荐)
#    • startup:    Windows 开机自启文件夹 (用户级免提权)
#    • docker:     Docker Desktop 容器化部署
#    • pm2:        PM2 进程托管
#    • standalone: 原生独立后台进程
# 3. 开机自启动配置支持 (可选/可配置)
# 4. 自适应默认工作目录 ($env:LOCALAPPDATA\LightDrop)
# 5. 持久化记录部署元数据至 <工作路径>\runinfo\lightdrop-runinfo.json
# ==============================================================================

[CmdletBinding()]
param (
    [string]$Mode = "",
    [Nullable[bool]]$AutoStart = $null,
    [string]$WorkDir = "",
    [int]$Port = 8080,
    [string]$DataDir = "",
    [string]$Lang = "zh",
    [string]$ImageTar = "",
    [switch]$SkipBuild,
    [switch]$Yes,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

if ($Help) {
    Write-Host @"
LightDrop Windows 构建与部署工具

用法:
  .\deploy.ps1 [选项]

选项:
  -Mode <模式>          部署方式: task (任务计划程序, 推荐) | startup (自启文件夹) | docker | pm2 | standalone
  -AutoStart <bool>     是否配置开机自启动 ($true / $false)
  -WorkDir <路径>       工作目录 (默认: `$env:LOCALAPPDATA\LightDrop)
  -Port <端口>          服务端口 (默认: 8080)
  -DataDir <路径>       数据目录 (默认: <工作路径>\data)
  -Lang <zh|en>         语言 (默认: zh)
  -SkipBuild            跳过编译步骤
  -Yes                  非交互确认模式
  -Help                 显示此帮助信息
"@
    exit 0
}

# 默认工作路径
$DefaultWorkDir = if ($env:LOCALAPPDATA) { "$env:LOCALAPPDATA\LightDrop" } else { "C:\ProgramData\LightDrop" }
if (-not $WorkDir) {
    $WorkDir = $DefaultWorkDir
}

# 检测 Node.js
$NodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
    Write-Error "未检测到 Node.js，请先安装 Node.js (https://nodejs.org/)"
    exit 1
}
$NodeBin = $NodeCmd.Source

# 交互式向导
$IsInteractive = [Environment]::UserInteractive -and (-not $Yes)

if ($IsInteractive) {
    Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  🌐 请选择语言 / Select Language                               ║" -ForegroundColor Cyan
    Write-Host "╠════════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
    Write-Host "║  [1] 简体中文 (默认)                                           ║"
    Write-Host "║  [2] English                                                   ║"
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    $LangChoice = Read-Host "请输入选项 [1-2] (默认: 1)"
    if ($LangChoice -eq "2" -or $LangChoice -like "en*") {
        $Lang = "en"
    }

    if (-not $Mode) {
        Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
        Write-Host "║  🚀 请选择适配 Windows 的生命周期部署方式                      ║" -ForegroundColor Cyan
        Write-Host "╠════════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
        Write-Host "║  [1] task       - Windows 任务计划程序守护 (推荐，静默常驻)       ║"
        Write-Host "║  [2] startup    - Windows 开机自启文件夹 (免管理员权限)          ║"
        Write-Host "║  [3] docker     - Docker 容器化部署                              ║"
        Write-Host "║  [4] pm2        - PM2 进程守护管理                               ║"
        Write-Host "║  [5] standalone - 原生独立后台进程                               ║"
        Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
        $ModeChoice = Read-Host "请输入选项 [1-5] (默认: 1 - task)"
        switch ($ModeChoice) {
            "2" { $Mode = "startup" }
            "3" { $Mode = "docker" }
            "4" { $Mode = "pm2" }
            "5" { $Mode = "standalone" }
            Default { $Mode = "task" }
        }
    }

    if ($null -eq $AutoStart) {
        $AutoStartInput = Read-Host "`n是否配置系统开机/登录自启动？[Y/n] (默认: Y 开启)"
        if ($AutoStartInput -like "n*") {
            $AutoStart = $false
        } else {
            $AutoStart = $true
        }
    }

    $InputWorkDir = Read-Host "`n工作路径 [默认: $WorkDir]"
    if ($InputWorkDir) {
        $WorkDir = $InputWorkDir
    }

    $InputPort = Read-Host "运行端口 [默认: $Port]"
    if ($InputPort) {
        $Port = [int]$InputPort
    }
}

if (-not $Mode) {
    $Mode = "task"
}
if ($null -eq $AutoStart) {
    $AutoStart = $true
}
if (-not $DataDir) {
    $DataDir = Join-Path $WorkDir "data"
}

$RunInfoDir = Join-Path $WorkDir "runinfo"
$RunInfoFile = Join-Path $RunInfoDir "lightdrop-runinfo.json"
$AppDir = Join-Path $WorkDir "app"
$LogDir = Join-Path $WorkDir "logs"
$PidFile = Join-Path $RunInfoDir "lightdrop.pid"
$TaskName = "LightDrop"
$ContainerName = "lightdrop"
$ImageName = "lightdrop:latest"
$Pm2Name = "lightdrop"

Write-Host "`n━━━ [1/5] 初始化工作目录与运行环境 ━━━" -ForegroundColor Cyan
Write-Host "  ℹ 操作系统: Windows" -ForegroundColor Cyan
Write-Host "  ℹ 部署模式: $Mode" -ForegroundColor Cyan
Write-Host "  ℹ 工作路径: $WorkDir" -ForegroundColor Cyan
Write-Host "  ℹ 开机自启: $(if ($AutoStart) { '已启用' } else { '未启用' })" -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path (Join-Path $DataDir "files") | Out-Null
New-Item -ItemType Directory -Force -Path $RunInfoDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Write-Host "  ✓ 目录结构准备就绪" -ForegroundColor Green

Write-Host "`n━━━ [2/5] 编译构建应用程序 ━━━" -ForegroundColor Cyan
if ($SkipBuild -and (Test-Path "$RepoRoot\dist\client") -and (Test-Path "$RepoRoot\dist\server")) {
    Write-Host "  ℹ 检测到已有构建产物，跳过编译"
} else {
    Push-Location $RepoRoot
    Remove-Item "tsconfig.server.tsbuildinfo", "tsconfig.client.tsbuildinfo" -ErrorAction SilentlyContinue
    if (Get-Command "pnpm" -ErrorAction SilentlyContinue) {
        pnpm build
    } elseif (Get-Command "npm" -ErrorAction SilentlyContinue) {
        npm run build
    } else {
        Write-Error "未找到 pnpm 或 npm"
        exit 1
    }
    Pop-Location
    Write-Host "  ✓ 应用全量构建完成" -ForegroundColor Green
}

Write-Host "`n━━━ [3/5] 装配运行资源与配置文件 ━━━" -ForegroundColor Cyan
if ($Mode -ne "docker") {
    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
    Copy-Item -Recurse -Force "$RepoRoot\dist" "$AppDir\dist"
    Copy-Item -Recurse -Force "$RepoRoot\public" "$AppDir\public"
    Copy-Item -Force "$RepoRoot\package.json" "$AppDir\package.json"
    Copy-Item -Force "$RepoRoot\ecosystem.config.cjs" "$AppDir\ecosystem.config.cjs"
    if (Test-Path "$RepoRoot\pnpm-lock.yaml") {
        Copy-Item -Force "$RepoRoot\pnpm-lock.yaml" "$AppDir\pnpm-lock.yaml"
    }

    $BootstrapConfig = @{
        storageDir = $DataDir.Replace("\", "/")
        port = $Port
    } | ConvertTo-Json
    Set-Content -Path "$AppDir\lightdrop.config.json" -Value $BootstrapConfig -Encoding UTF8

    if ((Test-Path "$RepoRoot\node_modules") -and (-not (Test-Path "$AppDir\node_modules"))) {
        Write-Host "  ℹ 同步 node_modules 运行时依赖..."
        Copy-Item -Recurse -Force "$RepoRoot\node_modules" "$AppDir\node_modules"
    }
}

Write-Host "`n━━━ [4/5] 配置生命周期并启动服务 [$Mode] ━━━" -ForegroundColor Cyan

# 生成静默启动 VBScript
$SilentVbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$($AppDir.Replace('\', '\\'))"
WshShell.Environment("PROCESS")("PORT") = "$Port"
WshShell.Environment("PROCESS")("NODE_ENV") = "production"
WshShell.Run """$($NodeBin.Replace('\', '\\'))"" dist\server\index.js", 0, False
"@
Set-Content -Path "$AppDir\run_silent.vbs" -Value $SilentVbsContent -Encoding UTF8

switch ($Mode) {
    "task" {
        schtasks.exe /End /TN $TaskName 2>$null | Out-Null
        schtasks.exe /Delete /TN $TaskName /F 2>$null | Out-Null

        if ($AutoStart) {
            Write-Host "  ℹ 注册 Windows 开机自启计划任务: $TaskName..."
            schtasks.exe /Create /TN $TaskName /TR "wscript.exe `"$AppDir\run_silent.vbs`"" /SC ONLOGON /F | Out-Null
        } else {
            Write-Host "  ℹ 注册 Windows 手动计划任务: $TaskName..."
            schtasks.exe /Create /TN $TaskName /TR "wscript.exe `"$AppDir\run_silent.vbs`"" /SC ONCE /ST 00:00 /F | Out-Null
        }
        schtasks.exe /Run /TN $TaskName | Out-Null
        Write-Host "  ✓ Windows 任务计划程序守护服务已启动 ($TaskName)" -ForegroundColor Green
    }
    "startup" {
        $StartupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
        $StartupFile = "$StartupDir\LightDrop.vbs"
        if ($AutoStart -and (Test-Path $StartupDir)) {
            Copy-Item -Force "$AppDir\run_silent.vbs" $StartupFile
            Write-Host "  ✓ 已写入 Windows 开机自启动文件夹: $StartupFile" -ForegroundColor Green
        }
        Start-Process "wscript.exe" -ArgumentList "`"$AppDir\run_silent.vbs`""
        Write-Host "  ✓ 服务已在后台静默启动" -ForegroundColor Green
    }
    "docker" {
        $RestartPolicy = if ($AutoStart) { "unless-stopped" } else { "no" }
        docker rm -f $ContainerName 2>$null | Out-Null
        docker run -d --name $ContainerName --restart $RestartPolicy -p "${Port}:8080" -v "${DataDir}:/app/data" -e PORT=8080 -e NODE_ENV=production $ImageName | Out-Null
        Write-Host "  ✓ Docker 容器启动成功" -ForegroundColor Green
    }
    "pm2" {
        Push-Location $AppDir
        pm2 delete $Pm2Name 2>$null | Out-Null
        pm2 start ecosystem.config.cjs --name $Pm2Name --env production
        pm2 save | Out-Null
        Pop-Location
        Write-Host "  ✓ PM2 服务托管成功" -ForegroundColor Green
    }
    "standalone" {
        Start-Process "wscript.exe" -ArgumentList "`"$AppDir\run_silent.vbs`""
        Write-Host "  ✓ 独立后台进程已启动" -ForegroundColor Green
    }
}

Write-Host "`n━━━ [5/5] 记录运行信息至持久化归档 ━━━" -ForegroundColor Cyan
$CurrentTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$LocalIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254*" } | Select-Object -First 1).IPAddress
if (-not $LocalIp) { $LocalIp = "127.0.0.1" }

$RunInfoObj = @{
    appName = "lightdrop"
    version = "1.0.0"
    os = "windows"
    osPretty = "Windows"
    deployMode = $Mode
    autostart = $AutoStart
    autostartTarget = if ($Mode -eq "task") { $TaskName } elseif ($Mode -eq "startup") { "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\LightDrop.vbs" } else { $Mode }
    language = $Lang
    workDir = $WorkDir.Replace("\", "/")
    dataDir = $DataDir.Replace("\", "/")
    runInfoDir = $RunInfoDir.Replace("\", "/")
    runInfoFile = $RunInfoFile.Replace("\", "/")
    port = $Port
    containerName = $ContainerName
    taskName = $TaskName
    pm2Name = $Pm2Name
    pidFile = $PidFile.Replace("\", "/")
    installedAt = $CurrentTime
    status = "running"
}
$RunInfoJson = $RunInfoObj | ConvertTo-Json -Depth 4
Set-Content -Path $RunInfoFile -Value $RunInfoJson -Encoding UTF8
Copy-Item -Force $RunInfoFile (Join-Path $RunInfoDir "runinfo.json")

Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " ✔ LightDrop 已在 Windows 成功完成构建与部署" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  操作系统:      Windows"
Write-Host "  部署方式:      $Mode"
Write-Host "  开机自启:      $(if ($AutoStart) { '已开启' } else { '未开启' })"
Write-Host "  本机访问:      http://localhost:$Port"
Write-Host "  局域网访问:    http://${LocalIp}:${Port}"
Write-Host "  工作路径:      $WorkDir"
Write-Host "  数据存储:      $DataDir"
Write-Host "  运行记录:      $RunInfoFile"
Write-Host "`n  一键卸载:      .\uninstall.ps1 -WorkDir `"$WorkDir`"`n"
