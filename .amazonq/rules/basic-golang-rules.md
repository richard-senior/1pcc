---
description: Go best practices
globs: **/*.go
---

## Project Creation
- Use the directory structure outlined below
- In the root of the project add the following files:
    - build.sh should contain bash code to compile the project into a binary artifact for the current OS
    - run.sh should execute build.sh and then run the compiled binary
    - .gitignore a gitignore file tailored for go projects
    - README.md a readme file for the project, may be blank initially but should be maintained
- on project creation you should prompt for a package name (ie "github.com/richardsenior/fooproject")

## Directory Structure
- Use the standard Go project layout:
  - `/cmd` - Main applications for this project, contains 'main.go'
  - `/internal` - Private application and library code
  - `/docker` - Files relating to a docker image for hosting the application
  - `/static` - Static content such as images and html etc.
  - `/test` - Additional external test apps and test data
Do not put a main file in the root directory, the main.go file belongs in /cmd

## Coding Standards
- Follow the official Go style guide and common practices:
  - Use `gofmt` or `goimports` to format code
  - Use PascalCase for exported functions, types, and variables
  - Use camelCase for unexported functions, types, and variables
  - Use ALL_CAPS for constants
  - There is no limit to the length of functions or lines
  - Use meaningful variable names that describe their purpose

## logging
We should create an /internal/logger/logger.go file. Use this as an example:

```go
package logger

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// ********************************************************
// ********* LOGGING **************************************
// ********************************************************

var showDateTime bool
var defaultLogger *Logger

type LogLevel int

const (
	colorReset   = "\033[0m"
	colorRed     = "\033[31m"
	colorGreen   = "\033[32m"
	colorYellow  = "\033[33m"
	colorBlue    = "\033[34m"
	colorMagenta = "\033[35m"
	colorCyan    = "\033[36m"
	colorWhite   = "\033[37m"
	colorOrange  = "\033[38;5;208m"
)

const (
	DEBUG LogLevel = iota
	INFO
	INFORM
	HIGHLIGHT
	WARN
	ERROR
	FATAL
)

type Logger struct {
	infoLogger  *log.Logger
	errorLogger *log.Logger
	level       LogLevel
}

func init() {
	defaultLogger = NewLogger(INFO)
	showDateTime = false
}

// Add this helper function
func updateLoggerFlags(l *Logger) {
	var flags int
	if showDateTime {
		flags = log.Ldate | log.Ltime
	} else {
		flags = 0
	}
	l.infoLogger.SetFlags(flags)
	l.errorLogger.SetFlags(flags)
}

func SetShowDateTime(value bool) {
	showDateTime = value
	updateLoggerFlags(defaultLogger)
}

func NewLogger(level LogLevel) *Logger {
	var flags int
	if showDateTime {
		flags = log.Ldate | log.Ltime
	} else {
		flags = 0
	}

	return &Logger{
		infoLogger:  log.New(os.Stdout, "", flags),
		errorLogger: log.New(os.Stderr, "", flags),
		level:       level,
	}
}

func (l *Logger) log(level LogLevel, format string, v ...any) {
	if level < l.level {
		return
	}

	// Get caller information
	_, file, line, ok := runtime.Caller(2)
	if !ok {
		file = "unknown"
		line = 0
	}

	// Get just the base filename instead of full path
	file = filepath.Base(file)

	// Format message with any additional arguments
	var msg string
	if len(v) > 0 {
		msg = fmt.Sprintf(format+" %s", formatArgs(v...))
	} else {
		msg = format
	}

	// Get color based on log level
	var colorCode string
	switch level {
	case DEBUG:
		colorCode = colorBlue
	case INFO:
		colorCode = colorGreen
	case INFORM:
		colorCode = colorMagenta
	case HIGHLIGHT:
		colorCode = colorCyan
	case WARN:
		colorCode = colorYellow
	case ERROR:
		colorCode = colorOrange
	case FATAL:
		colorCode = colorRed
	default:
		colorCode = colorReset
	}

	// Format with metadata in white and message in color
	logMsg := fmt.Sprintf("[%s] %s:%d: %s%s%s",
		level.String(),
		file,
		line,
		colorCode,
		msg,
		colorReset)

	// if the gui is running log to teh
	//gui.GetInstance().AppendLog(msg)

	// Write to appropriate output
	if level >= ERROR {
		l.errorLogger.Println(logMsg)
	} else {
		l.infoLogger.Println(logMsg)
	}
}

func (l LogLevel) String() string {
	switch l {
	case DEBUG:
		return "DEBUG"
	case INFO:
		return "INFO"
	case INFORM:
		return "INFORM"
	case HIGHLIGHT:
		return "HIGHLIGHT"
	case WARN:
		return "WARN"
	case ERROR:
		return "ERROR"
	case FATAL:
		return "FATAL"
	default:
		return "UNKNOWN"
	}
}

// formatArgs converts any number of interface{} arguments into a formatted string
func formatArgs(args ...any) string {
	if len(args) == 0 {
		return ""
	}
	var parts []string
	for _, arg := range args {
		switch v := arg.(type) {
		case float32:
			parts = append(parts, fmt.Sprintf("%.2f", v))
		case float64:
			parts = append(parts, fmt.Sprintf("%.2f", v))
		case int:
			parts = append(parts, fmt.Sprintf("%d", v))
		case bool:
			parts = append(parts, fmt.Sprintf("%v", v))
		case error:
			parts = append(parts, v.Error())
		case nil:
			parts = append(parts, "nil")
		default:
			parts = append(parts, fmt.Sprintf("%v", v))
		}
	}
	return strings.Join(parts, " ")
}

// Convenience methods using the default logger
func Debug(format string, v ...any) {
	defaultLogger.log(DEBUG, format, v...)
}

func Info(format string, v ...any) {
	defaultLogger.log(INFO, format, v...)
}

func Inform(format string, v ...any) {
	defaultLogger.log(INFORM, format, v...)
}

func Highlight(format string, v ...any) {
	defaultLogger.log(HIGHLIGHT, format, v...)
}

func Warn(format string, v ...any) {
	defaultLogger.log(WARN, format, v...)
}

func Error(format string, v ...any) {
	defaultLogger.log(ERROR, format, v...)
}

func Fatal(format string, v ...any) {
	defaultLogger.log(FATAL, format, v...)
	os.Exit(1)
}
```

## Error Handling
- Generally use the standard practice of returning any error as part of the response
  However if an error is fatal use 'logger.Fatal' to exit rather than panic etc.

## Package Organization
- Package names should be short, concise, and lowercase
- You may use more than one package per directory
- At least one package should have a name matching the directory
- Avoid package name collisions with standard library

## Testing
- Write tests for all public functions and methods
- Use table-driven tests when testing multiple inputs
- Place tests in the same package with _test suffix
- Aim for at least 80% code coverage

## Documentation
- Document all exported functions, types, and constants
- Follow godoc conventions for documentation
- Include examples in documentation when appropriate

## Dependencies
- Use Go modules for dependency management
- Minimize external dependencies
- Pin dependency versions in go.mod
- Regularly update dependencies to address security issues

## Concurrency
- Use goroutines and channels appropriately
- Avoid sharing memory; communicate by passing messages
- Use sync package primitives when necessary
- Be careful with goroutine leaks