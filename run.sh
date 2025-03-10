#!/bin/bash
#export GOCACHE=off.

tree >> ./dir_structure.txt
echo "building 1pcc.."
rm ./1pcc
echo "Tr3mble5-----" | sudo -S rm /usr/local/bin/1pcc
# go clean -cache
go mod tidy
# go mod init 1pcc
go build -v -o 1pcc ./cmd/main.go
go build -o 1pcc.exe -ldflags="-s -w" -trimpath -o 1pcc.exe -GOOS=windows ./cmd/main.go
chmod 777 1pcc
echo "Tr3mble5-----" | sudo -S cp 1pcc /usr/local/bin/1pcc
open -na "Google Chrome" "http://localhost:8080/join"
1pcc