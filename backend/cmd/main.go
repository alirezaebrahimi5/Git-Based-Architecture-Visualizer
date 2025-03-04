package main

import (
	"log"
	"net/http"

	"alirezaebrahimi5/Git-Based-Architecture-Visualizer/handlers"
	"alirezaebrahimi5/Git-Based-Architecture-Visualizer/middlewares"

	"github.com/gorilla/mux"
)

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/analyze", handlers.AnalyzeRepoHandler).Methods("GET")

	http.Handle("/", middlewares.CORSMiddleware(r))
	log.Println("Server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
