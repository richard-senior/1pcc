# 1pcc

A Go implementation of the British TV game show 'The 1% Club'.

## Overview

This is a web-based application that allows users to host and participate in a game similar to the TV show 'The 1% Club'. The application features:

- Multi-user support with host, player, and observer roles
- Real-time game play
- QR code support for easy joining
- Static file serving with ETag support for caching
- CORS-enabled API endpoints
- Session-based authentication
- Graceful server shutdown

## Features

- **Host Interface** (`/host`): For game administrators to control the game flow
- **Player Interface** (`/play`): Where participants can join and play the game
- **Observer Mode** (`/observe`): Allows users to watch the game without participating
- **QR Code Integration** (`/qr`): Generate QR codes for easy game access
- **API Endpoints** (`/api/`): RESTful API for game interactions

## Technical Details

- Built with Go's standard HTTP server
- Uses secure session management
- Implements proper CORS headers
- Includes caching mechanisms with ETag support
- Configurable server port through configuration system

## Getting Started

1. Ensure you have Go installed on your system
2. Clone the repository
3. Configure the application using the configuration system
4. Run the server:
   ```bash
   go run cmd/main.go
