package seatalk

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
)

const (
	EventVerification             = "event_verification"
	EventInteractiveMessageClick  = "interactive_message_click"
	EventBotAddedToGroupChat      = "bot_added_to_group_chat"
	EventBotRemovedFromGroupChat  = "bot_removed_from_group_chat"
	EventNewBotSubscriber         = "new_bot_subscriber"
	EventMessageFromBotSubscriber = "message_from_bot_subscriber"
	EventNewMentionedGroupMessage = "new_mentioned_message_received_from_group_chat"
)

func ValidSignature(signingSecret string, body []byte, signature string) bool {
	if signingSecret == "" {
		return true
	}
	sum := sha256.Sum256(append(body, []byte(signingSecret)...))
	calculated := hex.EncodeToString(sum[:])
	return subtle.ConstantTimeCompare([]byte(calculated), []byte(signature)) == 1
}
