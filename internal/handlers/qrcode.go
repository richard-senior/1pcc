package handlers

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/richard-senior/1pcc/internal/config"
	"github.com/skip2/go-qrcode"
)

// Cache structure
type qrCache struct {
	image  image.Image
	lastIP string
	mu     sync.RWMutex
}

var qrCodeCache = &qrCache{}

func QRCodeHandler(w http.ResponseWriter, r *http.Request) {
	// Check current IP right at the start of the request
	currentIP, err := getLanIP()
	if err != nil {
		http.Error(w, "Failed to get LAN IP", http.StatusInternalServerError)
		return
	}

	// Generate ETag based on IP address
	etag := fmt.Sprintf(`"qr-%s"`, currentIP)

	// Check If-None-Match header right away
	if match := r.Header.Get("If-None-Match"); match == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	// Get or generate QR code based on current IP
	qrCodeCache.mu.RLock()
	if qrCodeCache.image == nil || qrCodeCache.lastIP != currentIP {
		qrCodeCache.mu.RUnlock()
		// Need new QR code - acquire write lock
		qrCodeCache.mu.Lock()
		// Double check after write lock acquired
		if qrCodeCache.image == nil || qrCodeCache.lastIP != currentIP {
			img, err := generateQRCode(currentIP)
			if err != nil {
				qrCodeCache.mu.Unlock()
				http.Error(w, "Failed to generate QR code", http.StatusInternalServerError)
				return
			}
			qrCodeCache.image = img
			qrCodeCache.lastIP = currentIP
		}
		qrCodeCache.mu.Unlock()
		// Reacquire read lock for serving
		qrCodeCache.mu.RLock()
	}

	// Serve the cached image
	img := qrCodeCache.image
	qrCodeCache.mu.RUnlock()

	// Set headers before writing the response
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("ETag", etag)

	if err := png.Encode(w, img); err != nil {
		http.Error(w, "Failed to encode image", http.StatusInternalServerError)
		return
	}
}

func generateQRCode(ip string) (image.Image, error) {
	port := config.GetPortString()
	url := fmt.Sprintf("http://%s:%s", ip, port)

	qr, err := qrcode.New(url, qrcode.Medium)
	if err != nil {
		return nil, err
	}

	//qr.BackgroundColor = color.Transparent
	qr.BackgroundColor = hexToRGBA("#24354F")
	qr.ForegroundColor = hexToRGBA("#FFFFFF")
	return qr.Image(256), nil
}

func getLanIP() (string, error) {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "", err
	}

	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok {
			if ipnet.IP.To4() != nil && !ipnet.IP.IsLoopback() {
				return ipnet.IP.String(), nil
			}
		}
	}
	return "", fmt.Errorf("no LAN IP address found")
}

func hexToRGBA(hex string) color.RGBA {
	// Remove '#' if present
	hex = strings.TrimPrefix(hex, "#")

	// Parse hex to integer
	val, _ := strconv.ParseUint(hex, 16, 32)

	return color.RGBA{
		R: uint8(val >> 16),
		G: uint8((val >> 8) & 0xFF),
		B: uint8(val & 0xFF),
		A: 255,
	}
}
