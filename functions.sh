#!/bin/bash
#export GOCACHE=off.

function read_properties {
    local search_key="$1"
    local file="${HOME}/.aws/passwords.txt"

    if [ -z "$search_key" ]; then
        echo "Error: No key provided" >&2
        return 1
    fi

    if [ ! -f "$file" ]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    # Use -r to prevent backslash escaping
    # Use -d '' to read the entire line including the ending
    while IFS='=' read -r -d $'\n' key value || [ -n "$key" ]; do
        # Skip comments and empty lines
        [[ $key =~ ^#.*$ || -z $key ]] && continue

        # Remove any leading/trailing whitespace
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)

        if [ "$key" = "$search_key" ]; then
            echo "$value"
            return 0
        fi
    done < "$file"

    return 1
}

function buildLinux {
    export GOOS=linux
    export GOARCH=amd64
    go build -o 1pcc-amd-linux -ldflags="-s -w" -trimpath ./cmd/main.go
    if [ $? -ne 0 ]; then
        echo "failed to build"
        return 1
    fi
    chmod 777 1pcc-amd-linux
}

function buildMac {
    export GOOS=darwin
    export GOARCH=arm64
    go build -o 1pcc-silicon-macos -ldflags="-s -w" -trimpath ./cmd/main.go
    if [ $? -ne 0 ]; then
        echo "failed to build"
        return
    fi
    chmod 777 1pcc-silicon-macos
}

function buildWindows {
    export GOOS=windows
    export GOARCH=amd64
    go build -o 1pcc.exe -ldflags="-s -w" -trimpath ./cmd/main.go
}

function buildAndroid {
    export GOOS=android
    export GOARCH=arm64
    export GOARM=7
    export CGO_ENABLED=0
    go build -o 1pcc-android-arm64 -ldflags="-s -w" -trimpath ./cmd/main.go
    # Build for 32-bit arm (older devices)
    export GOOS=android
    export GOARCH=arm
    export GOARM=7
    export CGO_ENABLED=0
    go build -o 1pcc-android-arm -ldflags="-s -w" -trimpath ./cmd/main.go
    # Build for x86_64 (emulators and some devices)
    export GOOS=android
    export GOARCH=amd64
    export CGO_ENABLED=0
    go build -o 1pcc-android-x86_64 -ldflags="-s -w" -trimpath ./cmd/main.go
}

function build {
    #buildMac
    buildLinux
    #buildWindows
}

function run {
    tree >> ./dir_structure.txt
    # go clean -cache
    go mod tidy
    mv ./1pcc-silicon-macos ./1pcc
    ./1pcc --1pcc-port 8080
}
