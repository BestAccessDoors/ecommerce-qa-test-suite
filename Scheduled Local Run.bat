@echo off
REM ====================================================================
REM  SCHEDULED LOCAL RUN - run by Windows Task Scheduler at 10:00 and
REM  15:00 on weekdays (install with scripts\install-local-schedule.ps1).
REM  Tests every store in Chrome, then publishes a small summary to the
REM  "local-runs" branch on GitHub for the morning dashboard review.
REM  Unattended: no pauses. Output goes to results\scheduled-local.log.
REM  Extra arguments go to run-all.js, e.g.  --stores pda
REM ====================================================================
REM  pushd, not cd /d: cd /d cannot enter a UNC path (\\server\share).
pushd "%~dp0"
if errorlevel 1 exit /b 1

if not exist "results" mkdir "results"
set "SL_LOG=%~dp0results\scheduled-local.log"
echo.>> "%SL_LOG%"
echo ==== Scheduled local run started %DATE% %TIME% ====>> "%SL_LOG%"

REM  Detect-only, like the other run launchers: puts the portable Node on PATH.
call "%~dp0scripts\ensure-node.bat" >> "%SL_LOG%" 2>&1
if errorlevel 1 (
  echo [X] No usable Node.js. Run "First Time Setup.bat" once.>> "%SL_LOG%"
  popd
  exit /b 1
)

if not exist "node_modules" (
  echo [X] Setup has not run. Run "First Time Setup.bat" once.>> "%SL_LOG%"
  popd
  exit /b 1
)

REM --- Never let an inherited variable arm this run ---------------------
setlocal
set "LIVE_SUBMIT="
set "I_KNOW_THIS_IS_LIVE="
set "PLACE_ORDER="
set "I_KNOW_THIS_PLACES_ORDERS="
set "CYPRESS_LIVE_SUBMIT="
set "CYPRESS_I_KNOW_THIS_IS_LIVE="
set "CYPRESS_PLACE_ORDER="
set "CYPRESS_I_KNOW_THIS_PLACES_ORDERS="

node scripts\publishLocalRun.js --run %* >> "%SL_LOG%" 2>&1
set "SL_EXIT=%ERRORLEVEL%"
echo ==== Scheduled local run finished %DATE% %TIME% (exit %SL_EXIT%) ====>> "%SL_LOG%"

endlocal & set "SL_EXIT=%SL_EXIT%"
popd
exit /b %SL_EXIT%
