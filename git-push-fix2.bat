@echo off
cd /d "C:\Users\yuzuk\OneDrive\デスクトップ\my-review-app"

echo TypeScriptエラーを修正してプッシュします...
git add .
git commit -m "fix: deleteProblem関数の引数エラーを修正 - DBオブジェクトを正しく渡すように変更"
git push origin main

echo 完了！
pause
