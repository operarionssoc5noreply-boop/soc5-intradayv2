package server

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

	"soc5-intraday/internal/config"
	"soc5-intraday/internal/report"
	"soc5-intraday/internal/seatalk"
)

type Server struct {
	cfg      config.Config
	reporter *report.Reporter
	seatalk  *seatalk.Client
}

func New(cfg config.Config, reporter *report.Reporter, seatalkClient *seatalk.Client) *Server {
	return &Server{cfg: cfg, reporter: reporter, seatalk: seatalkClient}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.health)
	mux.HandleFunc("POST /reports/send-now", s.sendNow)
	mux.HandleFunc("POST "+s.cfg.SeaTalk.CallbackPath, s.callback)
	return mux
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"ok":true}`))
}

func (s *Server) sendNow(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Minute)
	defer cancel()
	if err := s.reporter.RunOnce(ctx); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"sent":true}`))
}

func (s *Server) callback(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil {
		http.Error(w, "read body", http.StatusBadRequest)
		return
	}
	signature := r.Header.Get("Signature")
	if signature == "" {
		signature = r.Header.Get("signature")
	}
	if !seatalk.ValidSignature(s.cfg.SeaTalk.SigningSecret, body, signature) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	var event callbackEnvelope
	if err := json.Unmarshal(body, &event); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	switch event.EventType {
	case seatalk.EventVerification:
		challenge, _ := event.Event["seatalk_challenge"].(string)
		_ = json.NewEncoder(w).Encode(map[string]string{"seatalk_challenge": challenge})
	case seatalk.EventBotAddedToGroupChat:
		s.handleBotAdded(r.Context(), event)
		_, _ = w.Write([]byte(`{}`))
	case seatalk.EventNewBotSubscriber,
		seatalk.EventMessageFromBotSubscriber,
		seatalk.EventInteractiveMessageClick,
		seatalk.EventBotRemovedFromGroupChat,
		seatalk.EventNewMentionedGroupMessage:
		log.Printf("received seatalk event %s", event.EventType)
		_, _ = w.Write([]byte(`{}`))
	default:
		log.Printf("received unknown seatalk event %s", event.EventType)
		_, _ = w.Write([]byte(`{}`))
	}
}

type callbackEnvelope struct {
	EventID   string         `json:"event_id"`
	EventType string         `json:"event_type"`
	Timestamp int64          `json:"timestamp"`
	AppID     string         `json:"app_id"`
	Event     map[string]any `json:"event"`
}

func (s *Server) handleBotAdded(ctx context.Context, event callbackEnvelope) {
	groupID := nestedString(event.Event, "group", "group_id")
	groupName := nestedString(event.Event, "group", "group_name")
	log.Printf("bot added to group %s (%s)", groupName, groupID)
	if !s.cfg.SeaTalk.WelcomeOnAdd || groupID == "" {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_ = s.seatalk.SetGroupTyping(ctx, groupID, "")
		_, err := s.seatalk.SendText(ctx, groupID, "SOC5 intraday report bot is connected.")
		if err != nil {
			log.Printf("send welcome failed: %v", err)
		}
	}()
}

func nestedString(root map[string]any, keys ...string) string {
	var current any = root
	for _, key := range keys {
		m, ok := current.(map[string]any)
		if !ok {
			return ""
		}
		current = m[key]
	}
	value, _ := current.(string)
	return value
}
