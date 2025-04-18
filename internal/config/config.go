// internal/config/config.go
package config

import (
	"encoding/json"
	"flag" // cmd line params
	"os"
	"reflect"
	"strconv"

	"github.com/richard-senior/1pcc/internal/logger"
)

type Config struct {
	ServerPort  int     `json:"SERVER_PORT" env:"1pcc_port" flag:"1pcc-port"`
	MapScale    float32 `json:"MAP_SCALE" env:"" flag:"map-scale"`
	TestingMode bool    `json:"TESTING_MODE" env:"" flag:"testing-mode"`
}

var configuration *Config

func Load() {
	// First load from JSON file as before
	file, err := os.Open("config.json")
	if err != nil {
		logger.Fatal("Failed to open configuration file: " + err.Error())
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	configuration = &Config{}
	if err := decoder.Decode(configuration); err != nil {
		logger.Fatal("Failed to decode configuration: " + err.Error())
	}

	// Get the type information for our Config struct
	configType := reflect.TypeOf(*configuration)
	configValue := reflect.ValueOf(configuration).Elem()

	// Register all flags first
	for i := 0; i < configType.NumField(); i++ {
		field := configType.Field(i)
		flagName := field.Tag.Get("flag")
		//envName := field.Tag.Get("env")

		if flagName != "" {
			switch field.Type.Kind() {
			case reflect.Int:
				flag.IntVar(configValue.Field(i).Addr().Interface().(*int),
					flagName,
					configValue.Field(i).Interface().(int),
					"")
			case reflect.String:
				flag.StringVar(configValue.Field(i).Addr().Interface().(*string),
					flagName,
					configValue.Field(i).String(),
					"")
			case reflect.Float32:
				flag.Float64Var(new(float64),
					flagName,
					float64(configValue.Field(i).Interface().(float32)),
					"")
			case reflect.Bool:
				flag.BoolVar(configValue.Field(i).Addr().Interface().(*bool),
					flagName,
					configValue.Field(i).Interface().(bool),
					"")
			}
		}
	}

	// Parse flags once
	flag.Parse()

	// Now update values from environment variables if they exist
	for i := 0; i < configType.NumField(); i++ {
		field := configType.Field(i)
		envName := field.Tag.Get("env")

		if envName != "" {
			envValue := os.Getenv(envName)
			if envValue != "" {
				switch field.Type.Kind() {
				case reflect.Int:
					if val, err := strconv.Atoi(envValue); err == nil {
						configValue.Field(i).SetInt(int64(val))
					}
				case reflect.String:
					configValue.Field(i).SetString(envValue)
				case reflect.Float32:
					if val, err := strconv.ParseFloat(envValue, 32); err == nil {
						configValue.Field(i).SetFloat(val)
					}
				case reflect.Bool:
					if val, err := strconv.ParseBool(envValue); err == nil {
						configValue.Field(i).SetBool(val)
					}
				}
			}
		}
	}
}

func Get() *Config {
	if configuration == nil {
		Load()
	}
	return configuration
}

func GetPortString() string {
	return strconv.Itoa(Get().ServerPort)
}

func GetTestingMode() bool {
	return Get().TestingMode
}

func GetMapScale() float32 {
	return Get().MapScale
}
