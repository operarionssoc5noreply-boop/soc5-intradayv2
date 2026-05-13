package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

const defaultReportSheetURL = "https://docs.google.com/spreadsheets/d/1NY4LFE-TmuIVjgW8vb0-j7piQemxxQm7pkN67DJFNhI/edit?gid=1394317266#gid=1394317266"

type Config struct {
	Port        string
	WorkDir     string
	HTTPTimeout time.Duration
	TimeZone    *time.Location
	SeaTalk     SeaTalkConfig
	Google      GoogleConfig
	Report      ReportConfig
}

type SeaTalkConfig struct {
	AppID         string
	AppSecret     string
	SigningSecret string
	GroupID       string
	APIBase       string
	CallbackPath  string
	WelcomeOnAdd  bool
}

type GoogleConfig struct {
	ServiceAccountFile string
	ServiceAccountJSON string
	SpreadsheetID      string
	CaptureRange       string
	FMSUpdateRange     string
	GroupIDsRange      string
	SheetGID           string
	ExportLandscape    bool
}

type ReportConfig struct {
	TitlePrefix        string
	Interval           time.Duration
	StartImmediately   bool
	SendImage          bool
	InlineCardImage    bool
	RequireInlineImage bool
	SendPDFFile        bool
	SheetURL           string
	ImageDPI           int
	ImageMaxWidth      int
	ImageMarginInches  float64
	MaxBase64Bytes     int
}

func Load() (Config, error) {
	tzName := getEnv("TIME_ZONE", "Asia/Manila")
	tz, err := time.LoadLocation(tzName)
	if err != nil {
		return Config{}, fmt.Errorf("load TIME_ZONE %q: %w", tzName, err)
	}

	cfg := Config{
		Port:        getEnv("PORT", "8080"),
		WorkDir:     getEnv("WORK_DIR", "/tmp/seatalk-bot"),
		HTTPTimeout: getDuration("HTTP_TIMEOUT", 30*time.Second),
		TimeZone:    tz,
		SeaTalk: SeaTalkConfig{
			AppID:         os.Getenv("SEATALK_APP_ID"),
			AppSecret:     os.Getenv("SEATALK_APP_SECRET"),
			SigningSecret: os.Getenv("SEATALK_SIGNING_SECRET"),
			GroupID:       os.Getenv("SEATALK_GROUP_ID"),
			APIBase:       strings.TrimRight(getEnv("SEATALK_API_BASE", "https://openapi.seatalk.io"), "/"),
			CallbackPath:  getEnv("SEATALK_CALLBACK_PATH", "/bot-callback"),
			WelcomeOnAdd:  getBool("SEATALK_WELCOME_ON_ADD", false),
		},
		Google: GoogleConfig{
			ServiceAccountFile: os.Getenv("GOOGLE_SERVICE_ACCOUNT_FILE"),
			ServiceAccountJSON: os.Getenv("GOOGLE_SERVICE_ACCOUNT_JSON"),
			SpreadsheetID:      getEnv("GOOGLE_SPREADSHEET_ID", "1pLN46ZKWJIsidswMeoxhZwoacuFMR08sCaTFG6mLytc"),
			CaptureRange:       getEnv("GOOGLE_CAPTURE_RANGE", getEnv("GOOGLE_SHEET_RANGE", "intraday!C1:AD37")),
			FMSUpdateRange:     getEnv("GOOGLE_FMS_UPDATE_RANGE", "intraday!AE2"),
			GroupIDsRange:      getEnv("GOOGLE_GROUP_IDS_RANGE", "bot_config!A2:A"),
			SheetGID:           os.Getenv("GOOGLE_SHEET_GID"),
			ExportLandscape:    getBool("GOOGLE_EXPORT_LANDSCAPE", true),
		},
		Report: ReportConfig{
			TitlePrefix:        getEnv("REPORT_TITLE_PREFIX", "SOC 5 IntraDay Update as of"),
			Interval:           getDuration("REPORT_INTERVAL", time.Hour),
			StartImmediately:   getBool("REPORT_START_IMMEDIATELY", true),
			SendImage:          getBool("REPORT_SEND_IMAGE", true),
			InlineCardImage:    getBool("REPORT_INLINE_CARD_IMAGE", true),
			RequireInlineImage: getBool("REPORT_REQUIRE_INLINE_CARD_IMAGE", true),
			SendPDFFile:        getBool("REPORT_SEND_PDF_FILE", false),
			SheetURL:           getEnv("REPORT_SHEET_URL", defaultReportSheetURL),
			ImageDPI:           getInt("REPORT_IMAGE_DPI", 160),
			ImageMaxWidth:      getInt("REPORT_IMAGE_MAX_WIDTH", 1800),
			ImageMarginInches:  getFloat("REPORT_IMAGE_MARGIN_INCHES", 1),
			MaxBase64Bytes:     getInt("SEATALK_MAX_BASE64_BYTES", 5*1024*1024),
		},
	}

	if cfg.SeaTalk.CallbackPath == "" || cfg.SeaTalk.CallbackPath[0] != '/' {
		return Config{}, errors.New("SEATALK_CALLBACK_PATH must start with /")
	}
	if cfg.Report.Interval <= 0 {
		return Config{}, errors.New("REPORT_INTERVAL must be positive")
	}

	return cfg, validate(cfg)
}

func validate(cfg Config) error {
	missing := make([]string, 0)
	required := map[string]string{
		"SEATALK_APP_ID":          cfg.SeaTalk.AppID,
		"SEATALK_APP_SECRET":      cfg.SeaTalk.AppSecret,
		"GOOGLE_SPREADSHEET_ID":   cfg.Google.SpreadsheetID,
		"GOOGLE_CAPTURE_RANGE":    cfg.Google.CaptureRange,
		"GOOGLE_FMS_UPDATE_RANGE": cfg.Google.FMSUpdateRange,
		"GOOGLE_GROUP_IDS_RANGE":  cfg.Google.GroupIDsRange,
	}
	for key, value := range required {
		if strings.TrimSpace(value) == "" {
			missing = append(missing, key)
		}
	}
	if cfg.Google.ServiceAccountFile == "" && cfg.Google.ServiceAccountJSON == "" {
		missing = append(missing, "GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_SERVICE_ACCOUNT_JSON")
	}
	if len(missing) > 0 {
		return fmt.Errorf("missing required config: %s", strings.Join(missing, ", "))
	}
	return nil
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getFloat(key string, fallback float64) float64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func getDuration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	if parsed, err := time.ParseDuration(value); err == nil {
		return parsed
	}
	if seconds, err := strconv.Atoi(value); err == nil {
		return time.Duration(seconds) * time.Second
	}
	return fallback
}

func (g GoogleConfig) ServiceAccountBytes() ([]byte, error) {
	if g.ServiceAccountJSON != "" {
		if !json.Valid([]byte(g.ServiceAccountJSON)) {
			return nil, errors.New("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON")
		}
		return []byte(g.ServiceAccountJSON), nil
	}
	return os.ReadFile(g.ServiceAccountFile)
}
