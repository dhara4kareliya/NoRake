@echo off

echo Pulling from GitHub
git pull "origin"

echo Deploying GameServer

pushd GameServer
cmd /d /c npm install
if not exist .env copy .env.example .env
popd

echo Deploying TableManager

pushd TableManager
cmd /d /c npm install
if not exist .env copy .env.example .env
popd

echo Deploying TableServer
pushd TableServer
cmd /d /c npm install
cmd /d /c npx rimraf dist
cmd /d /c npm run build
if not exist .env copy .env.example .env
popd

echo Success
pause
