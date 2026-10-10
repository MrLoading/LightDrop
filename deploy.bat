@echo off
rem ==============================================================================
rem LightDrop Windows 一键部署入口 (Command Prompt / 资源管理器双击)
rem ==============================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy.ps1" %*
