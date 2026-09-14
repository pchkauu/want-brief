package domain

import (
	"testing"

	"github.com/google/uuid"
)

func TestQuadrantOf(t *testing.T) {
	cases := []struct {
		urgent    bool
		important bool
		want      Quadrant
	}{
		{true, true, QuadrantDo},
		{false, true, QuadrantSchedule},
		{true, false, QuadrantDelegate},
		{false, false, QuadrantDrop},
	}
	for _, tc := range cases {
		got := QuadrantOf(tc.urgent, tc.important)
		if got != tc.want {
			t.Fatalf("QuadrantOf(%v,%v)=%s want %s", tc.urgent, tc.important, got, tc.want)
		}
	}
}

func TestNewLocalItemRejectsEmptyTitle(t *testing.T) {
	_, err := NewLocalItem(uuid.Nil, "  ", KindTask)
	if err == nil {
		t.Fatal("expected invalid title")
	}
}
