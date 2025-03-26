// internal/config/config.go
package config

import (
	"encoding/json"
	"os"
    "strconv"
    "flag"     // cmd line params
	"reflect"
    "github.com/richard-senior/1pcc/internal/logger"
)

type Config struct {
	ServerPort   int     `json:"SERVER_PORT" env:"1pcc_port" flag:"1pcc-port"`
	HostUsername string  `json:"HOST_USERNAME" env:"" flag:""`
	MapScale     float32 `json:"MAP_SCALE" env:"" flag:""`
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

    // Iterate through all fields in the struct
    for i := 0; i < configType.NumField(); i++ {
        field := configType.Field(i)
        flagName := field.Tag.Get("flag")
        envName := field.Tag.Get("env")

        // Check flag first if it exists
        if flagName != "" {
            switch field.Type.Kind() {
            case reflect.Int:
                var flagValue int
                flag.IntVar(&flagValue, flagName, configValue.Field(i).Interface().(int), "")
                flag.Parse()
                if flagValue != configValue.Field(i).Interface().(int) {
                    configValue.Field(i).SetInt(int64(flagValue))
                }
            case reflect.String:
                var flagValue string
                flag.StringVar(&flagValue, flagName, configValue.Field(i).String(), "")
                flag.Parse()
                if flagValue != "" {
                    configValue.Field(i).SetString(flagValue)
                }
            case reflect.Float32:
                var flagValue float64
                flag.Float64Var(&flagValue, flagName, float64(configValue.Field(i).Interface().(float32)), "")
                flag.Parse()
                if flagValue != float64(configValue.Field(i).Interface().(float32)) {
                    configValue.Field(i).SetFloat(flagValue)
                }
            }
        } else if envName != "" { // Check environment variable if flag wasn't set
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

func GetHostUsername() string {
	return Get().HostUsername
}

func GetPortString() string {
    return strconv.Itoa(Get().ServerPort)
}

func GetMapScale() float32 {
	return Get().MapScale
}
