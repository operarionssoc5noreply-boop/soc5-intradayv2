package seatalk

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"soc5-intraday/internal/config"
)

type Client struct {
	cfg        config.SeaTalkConfig
	httpClient *http.Client
	mu         sync.Mutex
	token      string
	expiresAt  time.Time
}

func NewClient(cfg config.SeaTalkConfig, httpClient *http.Client) *Client {
	return &Client{cfg: cfg, httpClient: httpClient}
}

type apiResponse struct {
	Code      int    `json:"code"`
	MessageID string `json:"message_id"`
}

func (c *Client) SendText(ctx context.Context, groupID, content string) (string, error) {
	body := map[string]any{
		"group_id": groupID,
		"message": map[string]any{
			"tag": "text",
			"text": map[string]any{
				"format":  1,
				"content": content,
			},
		},
	}
	return c.postGroupMessage(ctx, body)
}

func (c *Client) SendImage(ctx context.Context, groupID string, png []byte, maxBase64Bytes int) (string, error) {
	encoded := base64.StdEncoding.EncodeToString(png)
	if len(encoded) > maxBase64Bytes {
		return "", fmt.Errorf("encoded image is %d bytes, over limit %d", len(encoded), maxBase64Bytes)
	}
	body := map[string]any{
		"group_id": groupID,
		"message": map[string]any{
			"tag": "image",
			"image": map[string]any{
				"content": encoded,
			},
		},
	}
	return c.postGroupMessage(ctx, body)
}

func (c *Client) SendFile(ctx context.Context, groupID, filename string, content []byte, maxBase64Bytes int) (string, error) {
	encoded := base64.StdEncoding.EncodeToString(content)
	if len(encoded) > maxBase64Bytes {
		return "", fmt.Errorf("encoded file is %d bytes, over limit %d", len(encoded), maxBase64Bytes)
	}
	body := map[string]any{
		"group_id": groupID,
		"message": map[string]any{
			"tag": "file",
			"file": map[string]any{
				"filename": filename,
				"content":  encoded,
			},
		},
	}
	return c.postGroupMessage(ctx, body)
}

type CardElement map[string]any

func Title(text string) CardElement {
	return CardElement{"element_type": "title", "title": map[string]any{"text": text}}
}

func Description(markdown string) CardElement {
	return CardElement{"element_type": "description", "description": map[string]any{"format": 1, "text": markdown}}
}

func Image(contentBase64 string) CardElement {
	return CardElement{"element_type": "image", "image": map[string]any{"content": contentBase64}}
}

func RedirectButton(text, link string) CardElement {
	return CardElement{
		"element_type": "button",
		"button": map[string]any{
			"button_type":  "redirect",
			"text":         text,
			"mobile_link":  map[string]any{"type": "web", "path": link},
			"desktop_link": map[string]any{"type": "web", "path": link},
		},
	}
}

func CallbackButton(text, value string) CardElement {
	return CardElement{
		"element_type": "button",
		"button": map[string]any{
			"button_type": "callback",
			"text":        text,
			"value":       value,
		},
	}
}

func (c *Client) SendInteractive(ctx context.Context, groupID string, elements []CardElement) (string, error) {
	body := map[string]any{
		"group_id": groupID,
		"message": map[string]any{
			"tag": "interactive_message",
			"interactive_message": map[string]any{
				"elements": elements,
			},
		},
	}
	return c.postGroupMessage(ctx, body)
}

func (c *Client) SetGroupTyping(ctx context.Context, groupID, threadID string) error {
	body := map[string]any{"group_id": groupID}
	if threadID != "" {
		body["thread_id"] = threadID
	}
	_, err := c.postJSON(ctx, c.cfg.APIBase+"/messaging/v2/group_chat_typing", body)
	return err
}

func (c *Client) postGroupMessage(ctx context.Context, body any) (string, error) {
	resp, err := c.postJSON(ctx, c.cfg.APIBase+"/messaging/v2/group_chat", body)
	if err != nil {
		return "", err
	}
	return resp.MessageID, nil
}

func (c *Client) postJSON(ctx context.Context, endpoint string, body any) (apiResponse, error) {
	token, err := c.bearerToken(ctx)
	if err != nil {
		return apiResponse{}, err
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return apiResponse{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return apiResponse{}, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return apiResponse{}, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode >= 300 {
		return apiResponse{}, fmt.Errorf("seatalk status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	var decoded apiResponse
	if err := json.Unmarshal(respBody, &decoded); err != nil {
		return apiResponse{}, err
	}
	if decoded.Code != 0 {
		return apiResponse{}, fmt.Errorf("seatalk api code %d: %s", decoded.Code, strings.TrimSpace(string(respBody)))
	}
	return decoded, nil
}

func (c *Client) bearerToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.token != "" && time.Now().Before(c.expiresAt.Add(-2*time.Minute)) {
		return c.token, nil
	}

	payload := map[string]string{"app_id": c.cfg.AppID, "app_secret": c.cfg.AppSecret}
	raw, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.APIBase+"/auth/app_access_token", bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("seatalk token status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var decoded struct {
		Code           int    `json:"code"`
		AppAccessToken string `json:"app_access_token"`
		Expire         int64  `json:"expire"`
	}
	if err := json.Unmarshal(body, &decoded); err != nil {
		return "", err
	}
	if decoded.Code != 0 {
		return "", fmt.Errorf("seatalk token code %d: %s", decoded.Code, strings.TrimSpace(string(body)))
	}
	if decoded.AppAccessToken == "" {
		return "", errors.New("seatalk token response missing app_access_token")
	}
	c.token = decoded.AppAccessToken
	c.expiresAt = time.Unix(decoded.Expire, 0)
	if decoded.Expire == 0 {
		c.expiresAt = time.Now().Add(90 * time.Minute)
	}
	return c.token, nil
}
