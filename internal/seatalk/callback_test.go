package seatalk

import "testing"

func TestValidSignature(t *testing.T) {
	body := []byte(`{"event_id":"1098780","event_type":"event_verification","timestamp":1611220944,"app_id":"NDYyMDU1MTY3NzQ1","event":{"seatalk_challenge":"23j98gjbearh023hg"}}`)
	signature := "48918b59a7a5976781578b78136c816592b2b5834d4348a272253f221e68377c"
	if !ValidSignature("1234567812345678", body, signature) {
		t.Fatal("expected valid signature")
	}
	if ValidSignature("wrong", body, signature) {
		t.Fatal("expected invalid signature")
	}
}
