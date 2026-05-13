package google

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"soc5-intraday/internal/config"
)

const defaultTokenURI = "https://oauth2.googleapis.com/token"

type ServiceAccountClient struct {
	cfg        config.GoogleConfig
	httpClient *http.Client
	email      string
	privateKey *rsa.PrivateKey
	tokenURI   string
	mu         sync.Mutex
	token      string
	expiresAt  time.Time
}

type serviceAccountFile struct {
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

func NewServiceAccountClient(cfg config.GoogleConfig, httpClient *http.Client) (*ServiceAccountClient, error) {
	raw, err := cfg.ServiceAccountBytes()
	if err != nil {
		return nil, err
	}
	var file serviceAccountFile
	if err := json.Unmarshal(raw, &file); err != nil {
		return nil, fmt.Errorf("parse service account JSON: %w", err)
	}
	if file.ClientEmail == "" || file.PrivateKey == "" {
		return nil, errors.New("service account JSON must include client_email and private_key")
	}
	key, err := parsePrivateKey(file.PrivateKey)
	if err != nil {
		return nil, err
	}
	if file.TokenURI == "" {
		file.TokenURI = defaultTokenURI
	}
	return &ServiceAccountClient{
		cfg:        cfg,
		httpClient: httpClient,
		email:      file.ClientEmail,
		privateKey: key,
		tokenURI:   file.TokenURI,
	}, nil
}

func parsePrivateKey(raw string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(raw))
	if block == nil {
		return nil, errors.New("decode PEM private key")
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		if pkcs1, pkcs1Err := x509.ParsePKCS1PrivateKey(block.Bytes); pkcs1Err == nil {
			return pkcs1, nil
		}
		return nil, fmt.Errorf("parse private key: %w", err)
	}
	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("service account private_key is not RSA")
	}
	return rsaKey, nil
}

func (c *ServiceAccountClient) bearerToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.token != "" && time.Now().Before(c.expiresAt.Add(-2*time.Minute)) {
		return c.token, nil
	}

	jwt, err := c.signJWT(time.Now())
	if err != nil {
		return "", err
	}

	form := url.Values{}
	form.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	form.Set("assertion", jwt)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.tokenURI, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("google token status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var decoded struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &decoded); err != nil {
		return "", err
	}
	if decoded.AccessToken == "" {
		return "", errors.New("google token response missing access_token")
	}
	c.token = decoded.AccessToken
	c.expiresAt = time.Now().Add(time.Duration(decoded.ExpiresIn) * time.Second)
	return c.token, nil
}

func (c *ServiceAccountClient) signJWT(now time.Time) (string, error) {
	header := map[string]string{"alg": "RS256", "typ": "JWT"}
	claims := map[string]any{
		"iss":   c.email,
		"scope": "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly",
		"aud":   c.tokenURI,
		"iat":   now.Unix(),
		"exp":   now.Add(time.Hour).Unix(),
	}
	headerJSON, _ := json.Marshal(header)
	claimsJSON, _ := json.Marshal(claims)
	unsigned := base64.RawURLEncoding.EncodeToString(headerJSON) + "." + base64.RawURLEncoding.EncodeToString(claimsJSON)
	digest := sha256.Sum256([]byte(unsigned))
	sig, err := rsa.SignPKCS1v15(rand.Reader, c.privateKey, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return unsigned + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

func (c *ServiceAccountClient) authedRequest(ctx context.Context, method, endpoint string, body []byte) (*http.Request, error) {
	token, err := c.bearerToken(ctx)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	return req, nil
}
