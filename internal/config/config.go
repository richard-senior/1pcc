// internal/config/config.go
package config

import (
	"encoding/json"
	"os"
	"sync"
)

type Config struct {
	Server struct {
		Port        string `json:"port"`
		TemplateDir string `json:"template_dir"`
		Environment string `json:"environment"`
	} `json:"server"`

	Session struct {
		Secret       string `json:"secret"`
		MaxAge       int    `json:"max_age"`
		SecureCookie bool   `json:"secure_cookie"`
	} `json:"session"`
}

var (
	instance *Config
	once     sync.Once
)

func GetConfig() *Config {
	once.Do(func() {
		instance = &Config{}
		if err := instance.loadConfig(); err != nil {
			panic(err)
		}
	})
	return instance
}

func (c *Config) loadConfig() error {
	// First try environment variables
	c.Server.Port = getEnvOrDefault("SERVER_PORT", "8080")
	c.Session.Secret = getEnvOrDefault("SESSION_SECRET", "change-me-in-production")
	c.Session.MaxAge = 3600
	c.Session.SecureCookie = c.Server.Environment == "production"

	// Then try to load from config file if it exists
	if configFile := getEnvOrDefault("CONFIG_FILE", "config.json"); configFile != "" {
		if err := c.loadFromFile(configFile); err != nil {
			return err
		}
	}

	return nil
}

func (c *Config) loadFromFile(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // File doesn't exist, use defaults
		}
		return err
	}
	defer file.Close()

	return json.NewDecoder(file).Decode(c)
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
