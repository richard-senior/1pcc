#!/bin/bash
#export GOCACHE=off.

function isApplicationInstalled() {
    if [ -z "$1" ]; then
      echo "must supply the name of the command in the first parameter"
      return 1
    fi
    if [ -z "$(command -v $1)" ]; then
        return 1
    else
        return 0
    fi
}

function buildLinux {
    echo "--linux"
    export GOOS=linux
    go env -w GOOS=linux
    export GOARCH=amd64
    go env -w GOARCH=amd64
    go build -o felm -ldflags="-s -w" -trimpath ./cmd/main.go
    if [ $? -ne 0 ]; then
        return 1
    fi
    chmod +x ./felm
    return 0
}

function run {
    # Detect the operating system
    local os_type=$(uname -s)

    case "$os_type" in
        "Darwin")  # macOS
            if [ -f "./felmm" ]; then
                ./felmm "$@"
            else
                echo "Error: macOS executable (felmm) not found"
                return 1
            fi
            ;;
        "Linux")   # Linux
            if [ -f "./felm" ]; then
                ./felm "$@"
            else
                echo "Error: Linux executable (felm) not found"
                return 1
            fi
            ;;
        *)
            echo "Error: Unsupported operating system: $os_type"
            return 1
            ;;
    esac
}

function publish {
    echo "todo"
}

function install {
    if isApplicationInstalled "go"; then
        return 0
    fi

    echo "Installing Go..."

    # Detect OS
    local os_type=$(uname -s)

    case "$os_type" in
        "Darwin")  # macOS
            if ! isApplicationInstalled "brew"; then
                echo "Homebrew is required but not installed. Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                if [ $? -ne 0 ]; then
                    echo "Failed to install Homebrew"
                    return 1
                fi
            fi

            brew install go
            if [ $? -ne 0 ]; then
                echo "Failed to install Go"
                return 1
            fi
            ;;

        "Linux")
            # Detect distribution
            if [ -f /etc/os-release ]; then
                . /etc/os-release
                case "$ID" in
                    "ubuntu"|"debian")
                        sudo apt-get update
                        sudo apt-get install -y golang-go curl
                        ;;
                    "fedora")
                        sudo dnf install -y golang curl
                        ;;
                    "rhel"|"centos")
                        sudo yum install -y golang curl
                        ;;
                    "alpine")
                        apk update
                        apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community go
                        apk add --no-cache curl
                        ;;
                    *)
                        echo "Unsupported Linux distribution: $ID"
                        return 1
                        ;;
                esac

                if [ $? -ne 0 ]; then
                    echo "Failed to install Go"
                    return 1
                fi
            else
                echo "Could not determine Linux distribution"
                return 1
            fi
            ;;

        *)
            echo "Unsupported operating system: $os_type"
            return 1
            ;;
    esac

    # Verify installation
    if ! isApplicationInstalled "go"; then
        echo "Go installation failed"
        return 1
    fi

    echo "Go has been successfully installed"
    echo "Go version: $(go version)"
    return 0
}



function build {
    install
}