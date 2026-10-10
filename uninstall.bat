@echo off
rem ==============================================================================
rem LightDrop Windows 一键卸载入口 (Command Prompt / 资源管理器双击)
rem ==============================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\uninstall.ps1" %*
if %errorlevel% neq 0 (
  echo.
  echo [Error] Uninstall failed with exit code %errorlevel%.
)
echo %cmdcmdline% | find /i "%~0" >nul && pause
