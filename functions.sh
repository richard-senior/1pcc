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

function deleteFileAndVerify {
    if [ -z "$1" ]; then
        echo "Must pass filename in first parameter" >&2
        return 1
    fi
    local file="$1"
    if [ -f "$file" ]; then
        rm "$file" 2>/dev/null
        if [ -f "$file" ]; then
            echo "Failed to delete $file" >&2
            exit 1
        fi
    fi
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

function appendToMainFile {
    if [ -z "$1" ]; then
        echo "must pass js filename in first parameter"
        return 1
    fi
    local output_file="./static/js/main.js"
    local js_dir="./static/js"
    local file_path="$js_dir/$1"
    if [ -f "$file_path" ]; then
        # Print any class declarations found in the file
        #local foo=`grep "^[[:space:]]*class[[:space:]]\+" "$file_path"`
        #echo "$foo"

        # Add separator with filename
        echo -e "\n" >> "$output_file"
        echo -e "// *******************************************************" >> "$output_file"
        echo -e "// ***** $ordered_file " >> "$output_file"
        echo -e "// *******************************************************" >> "$output_file"
        # Append the contents of the file
        cat "$file_path" >> "$output_file"
    else
        echo "Warning: Ordered file $1 not found"
    fi
}

function combineJsFiles {
    echo "Combining Javascript files"
    local output_file="./static/js/main.js"
    local js_dir="./static/js"

    # Define ordered files (add to this array for specific ordering)
    local top=(
        "GameAPI.js"
        "PageElement.js"
    )
    local bottom=(
        "_main.js"
    )

    # delete and recreate
    if [ -f "$output_file" ]; then
        deleteFileAndVerify "$output_file"
    fi
    touch "$output_file"

    # Check if directory exists
    if [ ! -d "$js_dir" ]; then
        echo "Error: Directory $js_dir does not exist"
        return 1
    fi

    # First process the ordered files
    for ordered_file in "${top[@]}"; do
        appendToMainFile "$ordered_file"
    done

    # Then process remaining files
    for file in "$js_dir"/*.js; do
        local basename_file=$(basename "$file")
        # Skip main.js and already processed ordered files
        if [ "$basename_file" = "main.js" ]; then continue; fi
        if [[ " ${top[*]} " =~ " ${basename_file} " ]]; then continue; fi
        if [[ " ${bottom[*]} " =~ " ${basename_file} " ]]; then continue; fi
        appendToMainFile "$basename_file"
    done

    # First process the ordered files
    for foo in "${bottom[@]}"; do
        appendToMainFile "$foo"
    done
    echo "JavaScript files have been combined into $output_file"
}

function buildMac {
    # if any compiled files exist from the previous build then silently delete them
    deleteFileAndVerify "./1pcc-silicon-macos"
    export GOOS=darwin
    export GOARCH=arm64
    go build -o 1pcc-silicon-macos -ldflags="-s -w" -trimpath ./cmd/main.go
    if [ $? -ne 0 ]; then return 1; fi
    chmod 777 1pcc-silicon-macos
}

function buildWindows {
    # if any compiled files exist from the previous build then silently delete them
    deleteFileAndVerify "./1pcc.exe"
    export GOOS=windows
    export GOARCH=amd64
    go build -o 1pcc.exe -ldflags="-s -w" -trimpath ./cmd/main.go
    if [ $? -ne 0 ]; then return 1; fi
}

function buildAndroid {
    # if any compiled files exist from the previous build then silently delete them
    deleteFileAndVerify "./1pcc-android-arm"
    go build -o 1pcc-android-arm -trimpath ./cmd/main.go
    if [ $? -ne 0 ]; then return 1; fi
    echo "Built for Android"
    cp ./1pcc-android-arm ./1pcc
    chmod 777 ./1pcc
}

function build {
    # if any compiled files exist from the previous build then silently delete them
    deleteFileAndVerify "./1pcc"
    combineJsFiles
    buildMac
    mv /Users/richard/1pcc/1pcc-silicon-macos /Users/richard/1pcc/1pcc
    # buildAndroid
    if [ $? -ne 0 ]; then echo "build failed"; return 1; fi
    # buildLinux
    #buildWindows
}

function run {
    # tree >> ./dir_structure.txt
    # go clean -cache
    go mod tidy
    ./1pcc --testing-mode --1pcc-port 8080
}
