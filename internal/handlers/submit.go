// internal/handlers/submit.go
package handlers

import (
	"html/template"
	"net/http"

	"github.com/richard-senior/1pcc/internal/game"
	"github.com/richard-senior/1pcc/internal/session"
)

func SubmitHandler(w http.ResponseWriter, r *http.Request) {
	username, ok := session.GetSessionUser(r)
	if !ok {
		http.Redirect(w, r, "/join", http.StatusSeeOther)
		return
	}

	gameInstance := game.GetGame()

	if r.Method == "POST" {
		answer := r.FormValue("answer")

		// Validate the answer based on question type
		if !gameInstance.ValidateAnswer(answer) {
			http.Error(w, "Invalid answer", http.StatusBadRequest)
			return
		}

		gameInstance.SetAnswer(username, answer)
		http.Redirect(w, r, "/play", http.StatusSeeOther)
	} else {
		q := gameInstance.GetCurrentQuestionData()
		if q == nil {
			http.Error(w, "No questions available", http.StatusInternalServerError)
			return
		}

		current, total := gameInstance.GetGameProgress()

		data := struct {
			Question   string
			Choices    []string
			IsMultiple bool
			Username   string
			TimeLimit  int
			Current    int
			Total      int
		}{
			Question:   q.Question,
			Choices:    q.Choices,
			IsMultiple: q.Type == "multiple_choice",
			Username:   username,
			TimeLimit:  q.TimeLimit,
			Current:    current,
			Total:      total,
		}

		tmpl := template.Must(template.ParseFiles("./static/play.html"))
		tmpl.Execute(w, data)
	}
}
