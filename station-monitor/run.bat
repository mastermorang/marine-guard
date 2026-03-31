@echo off
setlocal

set ROOT=%~dp0
set PROJECT_ROOT=%ROOT%..
set OUT_DIR=%ROOT%out
set LIB_JAR=%PROJECT_ROOT%\lib\jssc.jar
set JAVA_HOME_LOCAL=%PROJECT_ROOT%\java

call "%ROOT%build.bat"
if errorlevel 1 exit /b 1

"%JAVA_HOME_LOCAL%\bin\java.exe" -cp "%OUT_DIR%;%LIB_JAR%" com.marineguard.station.StationMonitorMain
