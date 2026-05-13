package google

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

type Values struct {
	Range  string     `json:"range"`
	Values [][]string `json:"values"`
}

func (c *ServiceAccountClient) ReadRange(ctx context.Context, sheetRange string) (Values, error) {
	endpoint := "https://sheets.googleapis.com/v4/spreadsheets/" + url.PathEscape(c.cfg.SpreadsheetID) +
		"/values/" + url.PathEscape(sheetRange) +
		"?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE"
	req, err := c.authedRequest(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return Values{}, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return Values{}, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode >= 300 {
		return Values{}, fmt.Errorf("read sheet range status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var raw struct {
		Range  string          `json:"range"`
		Values [][]interface{} `json:"values"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return Values{}, err
	}
	values := make([][]string, len(raw.Values))
	for r, row := range raw.Values {
		values[r] = make([]string, len(row))
		for c, cell := range row {
			values[r][c] = fmt.Sprint(cell)
		}
	}
	return Values{Range: raw.Range, Values: values}, nil
}

func (c *ServiceAccountClient) ExportPDF(ctx context.Context, sheetRange, outputPath string, landscape bool) error {
	gid := c.cfg.SheetGID
	sheetName, cellRange := splitSheetRange(sheetRange)
	if gid == "" && sheetName != "" {
		derived, err := c.sheetIDForTitle(ctx, sheetName)
		if err != nil {
			return err
		}
		gid = derived
	}
	if gid == "" {
		gid = "0"
	}

	params := url.Values{}
	params.Set("format", "pdf")
	params.Set("gid", gid)
	params.Set("range", cellRange)
	params.Set("size", "7")
	params.Set("fitw", "true")
	params.Set("portrait", fmt.Sprint(!landscape))
	params.Set("sheetnames", "false")
	params.Set("printtitle", "false")
	params.Set("pagenumbers", "false")
	params.Set("gridlines", "false")
	params.Set("fzr", "false")

	endpoint := "https://docs.google.com/spreadsheets/d/" + url.PathEscape(c.cfg.SpreadsheetID) + "/export?" + params.Encode()
	req, err := c.authedRequest(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
		return fmt.Errorf("export sheet PDF status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return err
	}
	out, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, resp.Body)
	return err
}

func (c *ServiceAccountClient) sheetIDForTitle(ctx context.Context, title string) (string, error) {
	endpoint := "https://sheets.googleapis.com/v4/spreadsheets/" + url.PathEscape(c.cfg.SpreadsheetID) +
		"?fields=sheets(properties(sheetId,title))"
	req, err := c.authedRequest(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("read spreadsheet metadata status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var data struct {
		Sheets []struct {
			Properties struct {
				SheetID int64  `json:"sheetId"`
				Title   string `json:"title"`
			} `json:"properties"`
		} `json:"sheets"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return "", err
	}
	for _, sheet := range data.Sheets {
		if sheet.Properties.Title == title {
			return fmt.Sprint(sheet.Properties.SheetID), nil
		}
	}
	return "", fmt.Errorf("sheet title %q not found", title)
}

func splitSheetRange(input string) (sheetName, cellRange string) {
	parts := strings.SplitN(input, "!", 2)
	if len(parts) == 1 {
		return "", strings.Trim(parts[0], "'")
	}
	return strings.Trim(parts[0], "'"), strings.Trim(parts[1], "'")
}
