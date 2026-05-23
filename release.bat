@echo on

npm login

set /p commit=Enter the commit message:
set /p version=Enter the new version number:

npm run build
npm publish --access public

git add .
git commit -S -m "%commit%"
git push origin main

git tag -s v%version% -m "v%version%"
git push --tags
