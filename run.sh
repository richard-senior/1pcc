#!/bin/bash
#export GOCACHE=off.
echo "building 1pcc.."
rm ./1pcc
echo "Tr3mble5-----" | sudo -S rm /usr/local/bin/1pcc
go clean -cache
go mod tidy
# go mod init 1pcc
go build -v -o 1pcc ./cmd/main.go
chmod 777 1pcc
echo "Tr3mble5-----" | sudo -S cp 1pcc /usr/local/bin/1pcc

1pcc