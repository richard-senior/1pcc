// internal/logger/logger.go
package logger

import (
	"fmt"
	"log"
	"os"
	"runtime"
	"strings"
)

type LogLevel int

const (
	DEBUG LogLevel = iota
	INFO
	WARN
	ERROR
)

type Logger struct {
	infoLogger  *log.Logger
	errorLogger *log.Logger
	level       LogLevel
}

var defaultLogger *Logger

func init() {
	defaultLogger = NewLogger(INFO)
}

func NewLogger(level LogLevel) *Logger {
	return &Logger{
		infoLogger:  log.New(os.Stdout, "", log.Ldate|log.Ltime),
		errorLogger: log.New(os.Stderr, "", log.Ldate|log.Ltime),
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

	// Format message with any additional arguments
	var msg string
	if len(v) > 0 {
		msg = fmt.Sprintf(format+" %s", formatArgs(v...))
	} else {
		msg = format
	}

	logMsg := fmt.Sprintf("[%s] %s:%d: %s", level.String(), file, line, msg)

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
	case WARN:
		return "WARN"
	case ERROR:
		return "ERROR"
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

func Warn(format string, v ...any) {
	defaultLogger.log(WARN, format, v...)
}

func Error(format string, v ...any) {
	defaultLogger.log(ERROR, format, v...)
}
