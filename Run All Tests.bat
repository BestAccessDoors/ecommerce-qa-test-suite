@echo off
REM ====================================================================
REM  RUN ALL TESTS - tests every store in Chrome, one after another.
REM  Just double-click it.
REM ====================================================================
title Best Access Doors Tests - Run All Stores
REM  pushd, not cd /d: cd /d cannot enter a UNC path (\\server\share).
pushd "%~dp0"
if errorlevel 1 (
  echo  [X] Could not open the tests folder.
  pause
  exit /b 1
)

REM --- Make sure Node.js is usable ----------------------------------
REM  This must come BEFORE the node_modules check below, because
REM  "First Time Setup.bat" itself needs Node.js to do anything.
REM  It also puts a portable Node.js on PATH if that's what we have.
call "%~dp0scripts\ensure-node.bat"
if errorlevel 1 (
  popd
  pause
  exit /b 1
)

REM --- Never let an inherited variable arm this run ---------------------
REM  setlocal keeps these blanks inside this window (PATH from ensure-node
REM  above is already set, and survives). cmd variable names are case-
REM  insensitive, so this also clears e.g. a "setx place_order true".
REM  Live leads and real orders are CLI-only; see README "Option 6 - Live Submission".
setlocal
set "LIVE_SUBMIT="
set "I_KNOW_THIS_IS_LIVE="
set "PLACE_ORDER="
set "I_KNOW_THIS_PLACES_ORDERS="
set "CYPRESS_LIVE_SUBMIT="
set "CYPRESS_I_KNOW_THIS_IS_LIVE="
set "CYPRESS_PLACE_ORDER="
set "CYPRESS_I_KNOW_THIS_PLACES_ORDERS="

REM --- Make sure setup was done first -------------------------------
if not exist "node_modules" (
  echo.
  echo  [!] It looks like setup hasn't run yet.
  echo      Running "First Time Setup" for you now...
  echo.
  call "First Time Setup.bat"
  if errorlevel 1 (
    popd
    exit /b 1
  )
)

echo.
echo  ============================================================
echo   RUNNING ALL STORES IN CHROME
echo   This takes a while. Leave it alone until it finishes.
echo  ============================================================
echo.

call npm run test:all

echo.
echo  ============================================================
echo   FINISHED. Scroll up to see the PASS / FAIL summary.
echo   Results were also saved in:  results\test-results.log
echo  ============================================================
echo.
popd
pause
