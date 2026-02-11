@echo off
REM Create the localities directory
if not exist "C:\code\oboapp\ingest\localities" (
    mkdir "C:\code\oboapp\ingest\localities"
    echo ✓ Directory created: C:\code\oboapp\ingest\localities
) else (
    echo ✓ Directory already exists: C:\code\oboapp\ingest\localities
)

REM Move the file
if exist "C:\code\oboapp\ingest\bg.sofia.geojson" (
    move "C:\code\oboapp\ingest\bg.sofia.geojson" "C:\code\oboapp\ingest\localities\bg.sofia.geojson"
    echo ✓ File moved
) else (
    echo ✗ Source file not found
    exit /b 1
)

REM Verify
if exist "C:\code\oboapp\ingest\localities\bg.sofia.geojson" (
    echo ✓ Verification: File successfully moved to C:\code\oboapp\ingest\localities\bg.sofia.geojson
) else (
    echo ✗ Verification failed: File not found at destination
    exit /b 1
)
