@echo off
cd /d "C:\Users\yuzuk\OneDrive\デスクトップ\my-review-app"

echo Gitステータス確認...
git status

echo.
echo 変更をステージング...
git add .

echo.
echo コミット...
git commit -m "fix: TypeScript errors and import paths for RealtimeStore"

echo.
echo GitHubにプッシュ...
git push origin main

echo.
echo 完了！
pause
