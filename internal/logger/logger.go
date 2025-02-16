// internal/logger/logger.go
package logger

import (
	"fmt"
	"log"
	"os"
	"runtime"
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

func (l *Logger) log(level LogLevel, format string, v ...interface{}) {
	if level < l.level {
		return
	}

	// Get caller information
	_, file, line, ok := runtime.Caller(2)
	if !ok {
		file = "unknown"
		line = 0
	}

	// Format message
	msg := fmt.Sprintf(format, v...)
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

// Convenience methods using the default logger
func Debug(format string, v ...interface{}) {
	defaultLogger.log(DEBUG, format, v...)
}

func Info(format string, v ...interface{}) {
	defaultLogger.log(INFO, format, v...)
}

func Warn(format string, v ...interface{}) {
	defaultLogger.log(WARN, format, v...)
}

func Error(format string, v ...interface{}) {
	defaultLogger.log(ERROR, format, v...)
}
