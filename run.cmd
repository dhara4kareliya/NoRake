@echo off

echo Running GameServer

pushd GameServer
cmd /d /c start npm start
popd

echo Running TableManager

pushd TableManager
cmd /d /c start npm start
popd

echo Running Multi-TableManager

pushd MultiTableManager
cmd /d /c start npm start
popd
