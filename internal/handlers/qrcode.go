// internal/handlers/qrcode.go
package handlers

import (
	"fmt"
	"image"
	"image/png"
	"net"
	"net/http"

	"github.com/skip2/go-qrcode"
)

func QRCodeHandler(w http.ResponseWriter, r *http.Request) {
	// Generate QR code
	img, err := generateQRCode()
	if err != nil {
		http.Error(w, "Failed to generate QR Code", http.StatusInternalServerError)
		return
	}

	// Set headers
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=3600") // Cache for 1 hour

	// Encode and send
	if err := png.Encode(w, img); err != nil {
		http.Error(w, "Failed to encode image", http.StatusInternalServerError)
		return
	}
}

func generateQRCode() (image.Image, error) {
	// Get LAN IP
	ip, err := getLanIP()
	if err != nil {
		return nil, err
	}

	// Create URL with IP and port
	url := fmt.Sprintf("http://%s:8080", ip) // Replace 8080 with your actual port

	// Generate QR code
	qr, err := qrcode.New(url, qrcode.Medium)
	if err != nil {
		return nil, err
	}

	// Convert to image
	return qr.Image(256), nil // 256x256 pixels
}

func getLanIP() (string, error) {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "", err
	}

	for _, addr := range addrs {
		// Check if it's an IP network address
		if ipnet, ok := addr.(*net.IPNet); ok {
			// Check if IPv4 and not localhost
			if ipnet.IP.To4() != nil && !ipnet.IP.IsLoopback() {
				return ipnet.IP.String(), nil
			}
		}
	}

	return "", fmt.Errorf("no LAN IP address found")
}
