#!/bin/bash

function doBuild {
    echo "building 1pcc.."
    rm ./1pcc
    sudo rm /usr/local/bin/1pcc
    go clean -cache
    # go mod init 1pcc
    go mod tidy
    go build -v -o 1pcc ./cmd/main.go
    chmod 777 1pcc
    sudo cp 1pcc /usr/local/bin/1pcc
}
