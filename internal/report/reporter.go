package report

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"soc5-intraday/internal/config"
	"soc5-intraday/internal/google"
	"soc5-intraday/internal/seatalk"
)

type Reporter struct {
	cfg     config.Config
	google  *google.ServiceAccountClient
	seatalk *seatalk.Client
	mu      sync.Mutex
}

func NewReporter(cfg config.Config, googleClient *google.ServiceAccountClient, seatalkClient *seatalk.Client) *Reporter {
	return &Reporter{cfg: cfg, google: googleClient, seatalk: seatalkClient}
}

func (r *Reporter) Start(ctx context.Context) {
	ticker := time.NewTicker(r.cfg.Report.Interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := r.RunOnce(ctx); err != nil {
				log.Printf("scheduled report failed: %v", err)
			}
		}
	}
}

func (r *Reporter) RunOnce(ctx context.Context) error {
	if !r.mu.TryLock() {
		return fmt.Errorf("report already running")
	}
	defer r.mu.Unlock()

	now := time.Now().In(r.cfg.TimeZone)
	stamp := now.Format("20060102-150405")
	runDir := filepath.Join(r.cfg.WorkDir, stamp)
	if err := os.MkdirAll(runDir, 0o755); err != nil {
		return err
	}

	groupIDs, err := r.groupIDs(ctx)
	if err != nil {
		return fmt.Errorf("read seatalk group ids: %w", err)
	}
	if len(groupIDs) == 0 {
		return fmt.Errorf("no seatalk group ids found in %s", r.cfg.Google.GroupIDsRange)
	}

	fmsUpdate, err := r.fmsUpdate(ctx)
	if err != nil {
		return fmt.Errorf("read fms update: %w", err)
	}

	pdfPath := filepath.Join(runDir, "report.pdf")
	if err := r.google.ExportPDF(ctx, r.cfg.Google.CaptureRange, pdfPath, r.cfg.Google.ExportLandscape); err != nil {
		return fmt.Errorf("export pdf: %w", err)
	}

	pngPath := filepath.Join(runDir, "report.png")
	var png []byte
	if r.cfg.Report.SendImage {
		if err := ConvertPDFToPNG(ctx, pdfPath, pngPath, r.cfg.Report.PDFDPI, r.cfg.Report.ImageResizeWidth, r.cfg.Report.ImageBorderPX); err != nil {
			return fmt.Errorf("convert pdf to png: %w", err)
		}
		png, err = os.ReadFile(pngPath)
		if err != nil {
			return err
		}
	}

	cardElements := []seatalk.CardElement{
		seatalk.Title(r.cardTitle(now)),
		seatalk.Description("FMS Update: " + fmsUpdate),
	}
	if r.cfg.Report.SendImage && r.cfg.Report.InlineCardImage {
		encoded := base64.StdEncoding.EncodeToString(png)
		if len(encoded) <= r.cfg.Report.MaxBase64Bytes {
			cardElements = append(cardElements, seatalk.Image(encoded))
		} else if r.cfg.Report.RequireInlineImage {
			return fmt.Errorf("inline card image is %d bytes, over limit %d", len(encoded), r.cfg.Report.MaxBase64Bytes)
		} else {
			log.Printf("inline card image skipped: encoded image is %d bytes, over limit %d", len(encoded), r.cfg.Report.MaxBase64Bytes)
		}
	}
	if r.cfg.Report.SheetURL != "" {
		cardElements = append(cardElements, seatalk.RedirectButton("View Report Link", r.cfg.Report.SheetURL))
	}

	var pdf []byte
	if r.cfg.Report.SendPDFFile {
		pdf, err = os.ReadFile(pdfPath)
		if err != nil {
			return err
		}
	}

	for _, groupID := range groupIDs {
		if err := r.sendToGroup(ctx, groupID, stamp, cardElements, png, pdf); err != nil {
			return err
		}
	}

	log.Printf("report sent for range %s to %d group(s)", r.cfg.Google.CaptureRange, len(groupIDs))
	return nil
}

func (r *Reporter) sendToGroup(ctx context.Context, groupID, stamp string, cardElements []seatalk.CardElement, png, pdf []byte) error {
	cardHasImage := hasImageElement(cardElements)
	if _, err := r.seatalk.SendInteractive(ctx, groupID, cardElements); err != nil {
		if cardHasImage {
			if r.cfg.Report.RequireInlineImage {
				return fmt.Errorf("send inline image card to %s: %w", groupID, err)
			}
			log.Printf("send inline card image failed for group %s, retrying card without image: %v", groupID, err)
			withoutImage := withoutImageElement(cardElements)
			if _, retryErr := r.seatalk.SendInteractive(ctx, groupID, withoutImage); retryErr != nil {
				return fmt.Errorf("send interactive card to %s: %w", groupID, retryErr)
			}
			if _, imageErr := r.seatalk.SendImage(ctx, groupID, png, r.cfg.Report.MaxBase64Bytes); imageErr != nil {
				return fmt.Errorf("send fallback png image to %s: %w", groupID, imageErr)
			}
		} else {
			return fmt.Errorf("send interactive card to %s: %w", groupID, err)
		}
	} else if r.cfg.Report.SendImage && !cardHasImage {
		if _, err := r.seatalk.SendImage(ctx, groupID, png, r.cfg.Report.MaxBase64Bytes); err != nil {
			return fmt.Errorf("send png image to %s: %w", groupID, err)
		}
	}

	if r.cfg.Report.SendPDFFile {
		if _, err := r.seatalk.SendFile(ctx, groupID, "report-"+stamp+".pdf", pdf, r.cfg.Report.MaxBase64Bytes); err != nil {
			return fmt.Errorf("send pdf file to %s: %w", groupID, err)
		}
	}
	return nil
}

func (r *Reporter) cardTitle(now time.Time) string {
	return r.cfg.Report.TitlePrefix + " " + now.Format("3:04 PM Jan-02")
}

func (r *Reporter) fmsUpdate(ctx context.Context) (string, error) {
	values, err := r.google.ReadRange(ctx, r.cfg.Google.FMSUpdateRange)
	if err != nil {
		return "", err
	}
	return firstCell(values), nil
}

func (r *Reporter) groupIDs(ctx context.Context) ([]string, error) {
	values, err := r.google.ReadRange(ctx, r.cfg.Google.GroupIDsRange)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]struct{})
	var groupIDs []string
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, ok := seen[value]; ok {
			return
		}
		seen[value] = struct{}{}
		groupIDs = append(groupIDs, value)
	}
	for _, row := range values.Values {
		if len(row) > 0 {
			add(row[0])
		}
	}
	add(r.cfg.SeaTalk.GroupID)
	return groupIDs, nil
}

func firstCell(values google.Values) string {
	for _, row := range values.Values {
		for _, cell := range row {
			if strings.TrimSpace(cell) != "" {
				return strings.TrimSpace(cell)
			}
		}
	}
	return ""
}

func hasImageElement(elements []seatalk.CardElement) bool {
	for _, element := range elements {
		if element["element_type"] == "image" {
			return true
		}
	}
	return false
}

func withoutImageElement(elements []seatalk.CardElement) []seatalk.CardElement {
	filtered := make([]seatalk.CardElement, 0, len(elements))
	for _, element := range elements {
		if element["element_type"] == "image" {
			continue
		}
		filtered = append(filtered, element)
	}
	return filtered
}

func ConvertPDFToPNG(ctx context.Context, pdfPath, pngPath string, dpi, maxWidth, borderPX int) error {
	if dpi <= 0 {
		dpi = 220
	}
	tmpDir := filepath.Join(filepath.Dir(pngPath), "pages")
	if err := os.MkdirAll(tmpDir, 0o755); err != nil {
		return err
	}
	prefix := filepath.Join(tmpDir, "page")

	pdftoppm := exec.CommandContext(ctx, "pdftoppm", "-png", "-r", fmt.Sprint(dpi), pdfPath, prefix)
	if output, err := pdftoppm.CombinedOutput(); err != nil {
		return fmt.Errorf("pdftoppm: %w: %s", err, strings.TrimSpace(string(output)))
	}

	pages, err := filepath.Glob(prefix + "-*.png")
	if err != nil {
		return err
	}
	if len(pages) == 0 {
		return fmt.Errorf("pdftoppm produced no PNG pages")
	}
	sort.Slice(pages, func(i, j int) bool {
		return pageNumber(pages[i]) < pageNumber(pages[j])
	})

	args := append([]string{}, pages...)
	if maxWidth > 0 {
		args = append(args, "-resize", fmt.Sprintf("%dx>", maxWidth))
	}
	args = append(args, "-background", "white", "-alpha", "remove", "-alpha", "off", "-append", "-fuzz", "1%", "-trim", "+repage")
	if borderPX > 0 {
		margin := fmt.Sprintf("%dx%d", borderPX, borderPX)
		args = append(args, "-bordercolor", "white", "-border", margin)
	}
	args = append(args, "-strip", pngPath)
	binary := "magick"
	if _, err := exec.LookPath(binary); err != nil {
		binary = "convert"
	}
	cmd := exec.CommandContext(ctx, binary, args...)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("%s: %w: %s", binary, err, strings.TrimSpace(string(output)))
	}
	return nil
}

func pageNumber(path string) int {
	base := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	idx := strings.LastIndex(base, "-")
	if idx < 0 {
		return 0
	}
	n, err := strconv.Atoi(base[idx+1:])
	if err != nil {
		return 0
	}
	return n
}
