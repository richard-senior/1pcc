// internal/config/config.go
package config

import (
	"encoding/json"
	"fmt"
	"os"
)

type Config struct {
	ServerPort   int    `json:"SERVER_PORT"`
	HostUsername string `json:"HOST_USERNAME"`
}

var configuration *Config

func Load() error {
	file, err := os.Open("config.json")
	if err != nil {
		return err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	configuration = &Config{}
	err = decoder.Decode(configuration)
	if err != nil {
		return err
	}

	return nil
}

func Get() *Config {
	if configuration == nil {
		if err := Load(); err != nil {
			// You might want to handle this error differently
			panic("Failed to load configuration: " + err.Error())
		}
	}
	return configuration
}

func GetHostUsername() string {
	return Get().HostUsername
}

// Helper method to get port as string
func GetPortString() string {
	return fmt.Sprintf("%d", Get().ServerPort)
}
