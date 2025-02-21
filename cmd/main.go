package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/richard-senior/1pcc/internal/config"
	"github.com/richard-senior/1pcc/internal/game"
	"github.com/richard-senior/1pcc/internal/handlers"
	"github.com/richard-senior/1pcc/internal/logger"
	"github.com/richard-senior/1pcc/internal/session"
)

// paths that don't need sign in
var publicPaths = map[string]bool{
	"/qr":     true,
	"/join":   true,
	"/static": true,
}

// GracefulShutdown handles the graceful shutdown of the server
func GracefulShutdown(server *http.Server, quit <-chan os.Signal, done chan<- bool) {
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exiting")
	close(done)
}

// this cors/options middleware function
func baseHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers for all responses
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle OPTIONS preflight request
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if isPublicPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		// TODO handle player banning by IP
		// Check to see if the user has a session cookie
		if !session.IsUserLoggedIn(r) {
			// if they do not, then check if it's a public path
			if !publicPaths[r.URL.Path] {
				http.Redirect(w, r, "/join", http.StatusSeeOther)
				return
			}
		}
		// Call the next handler
		next.ServeHTTP(w, r)
	})
}

func main() {
	// Create API handler
	//apiHandler := handlers.NewAPIHandler(game.GetGame())

	// Load configuration
	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}
	// Get server port from config
	serverPort := config.GetPortString()

	mux := http.NewServeMux()
	server := &http.Server{
		Addr:    "0.0.0.0:" + serverPort,
		Handler: baseHandler(mux),
	}

	// Add static file server - this needs to come before other routes
	fs := http.FileServer(http.Dir("static"))
	mux.Handle("/static/", http.StripPrefix("/static/", fs))
	// allow users to join the game at any point
	mux.HandleFunc("/", handlers.PlayHandler)
	mux.HandleFunc("/join", handlers.JoinHandler)
	mux.HandleFunc("/play", handlers.PlayHandler)
	mux.HandleFunc("/host", handlers.HostHandler)
	mux.HandleFunc("/observe", handlers.ObserveHandler)
	mux.HandleFunc("/qr", handlers.QRCodeHandler)
	mux.HandleFunc("/api/", handlers.HandleAPI) // Note the trailing slash

	// add shutdown handler
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	go GracefulShutdown(server, quit, make(chan bool))

	// load the game state and instantiate the singleton
	game.GetGame()

	// Listen and serve
	logger.Info("1pcc Server is ready to handle requests at %s", serverPort)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Could not listen on %s: %v", serverPort, err)
	}
}

// Create a helper function to check if the URL should bypass auth
func isPublicPath(path string) bool {
	publicPaths := []string{
		"/qr",
		"/static",
	}

	for _, publicPath := range publicPaths {
		if strings.HasPrefix(path, publicPath) {
			return true
		}
	}
	return false
}
