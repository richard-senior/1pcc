package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/richard-senior/1pcc/internal/handlers"
	"github.com/richard-senior/1pcc/internal/session"
)

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

		// Allow static content without session check
		// this will be picked up by the file server mux handler below
		if strings.HasPrefix(r.URL.Path, "/static/") {
			next.ServeHTTP(w, r)
			return
		}

		// Check to see if the user has a session cookie
		if !session.IsUserLoggedIn(r) {
			// if they do not, then forward the user to /join
			if r.URL.Path != "/join" {
				http.Redirect(w, r, "/join", http.StatusSeeOther)
				return
			}
		}
		// Call the next handler
		next.ServeHTTP(w, r)
	})
}

func main() {

	// we have no config to speak of, just the location of a file
	serverPort := "8080"

	mux := http.NewServeMux()
	server := &http.Server{
		Addr:    "0.0.0.0:" + serverPort,
		Handler: baseHandler(mux),
	}

	// Add static file server - this needs to come before other routes
	fs := http.FileServer(http.Dir("static"))
	mux.Handle("/static/", http.StripPrefix("/static/", fs))

	// allow users to join the game at any point
	mux.HandleFunc("/join", handlers.JoinHandler)
	mux.HandleFunc("/play", handlers.PlayHandler)

	// Add API endpoints
	mux.HandleFunc("/api/game-state", handlers.GameAPIHandler)
	mux.HandleFunc("/api/submit-answer", handlers.SubmitAnswerHandler)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	go GracefulShutdown(server, quit, make(chan bool))

	// Listen and serve
	log.Printf("Server is ready to handle requests at %s", serverPort)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Could not listen on %s: %v", serverPort, err)
	}
}
