# 1PCC - The 1% Club Game Implementation

A Go and JavaScript web application that implements the British TV game show 'The 1% Club'.

## Project Overview

This web-based application allows users to host and participate in a game similar to the TV show 'The 1% Club'. Players answer increasingly difficult logic questions that test their lateral thinking rather than general knowledge.
It is important to note that main.js is produced at build-time by concatenating the other files in ./static/js
This means that javascript console messages referencing main.js will need further examination to determine which
.js should be modified to fix the actual error.

### Key Features

- **Multi-user Role System**:
  - **Host**: Controls game flow, question progression, and scoreboard
  - **Player**: Joins games, answers questions, and competes with others
  - **Observer**: Watches game progress without participating

- **Real-time Game Mechanics**:
  - Question progression from easy (90%) to extremely difficult (1%)
  - Timer-based rounds with configurable durations
  - Live scoreboard and player statistics

- **Technical Features**:
  - QR code generation for easy game joining
  - Session-based authentication and user management
  - Static file serving with ETag support for caching
  - CORS-enabled RESTful API endpoints
  - Graceful server shutdown and error handling

## Architecture

### Backend (Go)

- **Server**: Built with Go's standard `net/http` package
- **Project Structure**:
  - `/cmd`: Application entry points
  - `/internal`: Core application code
    - `/config`: Configuration management
    - `/game`: Game logic and state management
    - `/handlers`: HTTP request handlers
    - `/logger`: Custom logging implementation
    - `/session`: Session management and authentication

### Frontend (JavaScript)

- **Client-side**: Vanilla JavaScript with no framework dependencies
- **Project Structure**:
  - `/static/js`: Frontend JavaScript modules
    - `GameAPI.js`: Client-side API for game interactions
    - `PageElement.js`: DOM manipulation utilities
  - `/static/css`: Styling and layout
  - `/static/images`: Game assets and UI elements

## API Endpoints

- **Game Management**:
  - `/api/game/start`: Start a new game session
  - `/api/game/next`: Progress to next question
  - `/api/game/end`: End current game

- **Player Interactions**:
  - `/api/player/join`: Join an existing game
  - `/api/player/answer`: Submit answer to current question
  - `/api/player/leave`: Leave current game

- **Game State**:
  - `/api/state`: Get current game state
  - `/api/scoreboard`: Get current player rankings

## User Interfaces

- **Host Interface** (`/host`): Game administration dashboard
- **Player Interface** (`/play`): Question answering interface
- **Observer Mode** (`/observe`): Read-only game view
- **QR Code Access** (`/qr`): Generate shareable game access codes

## Technical Implementation Details

- **Session Management**: Secure cookie-based sessions
- **Concurrency**: Go routines for handling multiple simultaneous players
- **Caching**: ETag implementation for static resources
- **Security**: CORS headers, input validation, and XSS protection
- **Configuration**: Environment-based configuration system

## Deployment Options

- **Standard**: Run directly with Go
- **Containerized**: Docker support via `/docker` directory
- **Reverse Proxy**: Compatible with Nginx/Apache configurations

## Getting Started

1. Ensure you have Go 1.16+ installed
2. Clone the repository
3. Configure the application:
   ```bash
   cp config.example.json config.json
   # Edit config.json with your settings
   ```
4. Run the server:
   ```bash
   go run cmd/main.go
   ```
5. Access the host interface at `http://localhost:8080/host`
6. Players can join at `http://localhost:8080/join`

## Development

- **Building**: `go build -o 1pcc cmd/main.go`
- **Testing**: `go test ./...`
- **Frontend Development**: Edit files in `/static` directory
