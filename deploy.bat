@echo off
rem ==============================================================================
rem LightDrop Windows 一键部署入口 (Command Prompt / 资源管理器双击)
rem ==============================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy.ps1" %*
if %errorlevel% neq 0 (
  echo.
  echo [Error] Deployment failed with exit code %errorlevel%.
)
echo %cmdcmdline% | find /i "%~0" >nul && pause
