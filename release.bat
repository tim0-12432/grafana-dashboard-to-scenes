@echo on

@REM npm login

set /p commit=Enter the commit message:
set /p version=Enter the new version number:

@REM npm run build
@REM npm publish --access public

git add .
git commit -S -m "%commit%"
git push origin main

git tag -s v%version% -m "v%version%"
git push --tags
