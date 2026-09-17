package domain

import (
	"testing"

	"github.com/google/uuid"
)

func TestNewItemCheckRejectsEmptyBody(t *testing.T) {
	if _, err := NewItemCheck(uuid.New(), "  ", 0); err == nil {
		t.Fatal("expected invalid body")
	}
}

func TestNewItemCheckStoresBody(t *testing.T) {
	check, err := NewItemCheck(uuid.New(), " Ship ", 2)
	if err != nil {
		t.Fatal(err)
	}
	if check.Body != "Ship" || check.Done || check.Position != 2 {
		t.Fatalf("%+v", check)
	}
}

func TestItemCheckSetDone(t *testing.T) {
	check, err := NewItemCheck(uuid.New(), "Ship", 0)
	if err != nil {
		t.Fatal(err)
	}
	check.SetDone(true)
	if !check.Done {
		t.Fatal("expected done")
	}
}
