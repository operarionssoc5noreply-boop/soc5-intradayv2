package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"soc5-intraday/internal/config"
	"soc5-intraday/internal/google"
	"soc5-intraday/internal/report"
	"soc5-intraday/internal/seatalk"
	"soc5-intraday/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	if err := os.MkdirAll(cfg.WorkDir, 0o755); err != nil {
		log.Fatalf("create work dir: %v", err)
	}

	httpClient := &http.Client{Timeout: cfg.HTTPTimeout}
	seatalkClient := seatalk.NewClient(cfg.SeaTalk, httpClient)
	googleClient, err := google.NewServiceAccountClient(cfg.Google, httpClient)
	if err != nil {
		log.Fatalf("create google client: %v", err)
	}

	reporter := report.NewReporter(cfg, googleClient, seatalkClient)
	app := server.New(cfg, reporter, seatalkClient)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if cfg.Report.StartImmediately {
		go func() {
			if err := reporter.RunOnce(ctx); err != nil {
				log.Printf("initial report failed: %v", err)
			}
		}()
	}

	go reporter.Start(ctx)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           app.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("seatalk bot server listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http server: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("http shutdown: %v", err)
	}
}
