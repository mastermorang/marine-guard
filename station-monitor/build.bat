@echo off
setlocal

set ROOT=%~dp0
set PROJECT_ROOT=%ROOT%..
set SRC_DIR=%ROOT%src
set OUT_DIR=%ROOT%out
set LIB_JAR=%PROJECT_ROOT%\lib\jssc.jar
set JAVA_HOME_LOCAL=%PROJECT_ROOT%\java

if not exist "%JAVA_HOME_LOCAL%\bin\javac.exe" (
  echo Bundled JDK not found at "%JAVA_HOME_LOCAL%".
  exit /b 1
)

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
pushd "%SRC_DIR%"
"%JAVA_HOME_LOCAL%\bin\javac.exe" ^
  -encoding UTF-8 ^
  -cp "%LIB_JAR%" ^
  -d "%OUT_DIR%" ^
  com\marineguard\station\*.java
set BUILD_RESULT=%ERRORLEVEL%
popd

if errorlevel 1 exit /b %BUILD_RESULT%

echo Build completed.
