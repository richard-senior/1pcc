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
