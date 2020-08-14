package main

import (
	"github.com/stretchr/testify/assert"
	"image"
	"image/color"
	"testing"
)

func TestFrame(t * testing.T) {
	tcs := []struct {
		input image.Rectangle
		expected Frame
	} {
		{
			image.Rect(0, 0, 100, 100),
			Frame{0, 0, 100, 100},
		},
		{
			image.Rect(0, 0, 100, 200),
			Frame{0, 50, 100, 150},
		},
		{
			image.Rect(0, 0, 200, 100),
			Frame{50, 0, 150, 100},
		},
		{
			image.Rect(0, 0, 101, 101),
			Frame{0, 0, 101, 101},
		},
		{
			image.Rect(0, 0, 400, 461),
			Frame{0, 30, 400, 430},
		},
	}
	for _, tc := range tcs {
		res := frameFromRect(tc.input)
		assert.Equal(t, tc.expected, res)
	}
}

func TestProcessImage(t * testing.T) {
	tcs := []struct {
		path string
		expected ProcessedImage
	} {
		{
			"test/black.jpg",
			ProcessedImage{Avg: color.RGBA{0, 0, 0, 0}, Frame: Frame{MaxX: 400, MinY: 39, MaxY: 439}},
		},{
			"test/white.jpg",
			ProcessedImage{Avg: color.RGBA{255, 255, 255, 0}, Frame: Frame{MaxX: 400, MinY: 39, MaxY: 439}},
		},{
			"test/red.jpg",
			ProcessedImage{Avg: color.RGBA{253, 0, 0, 0}, Frame: Frame{MaxX: 400, MinY: 39, MaxY: 439}},
		},{
			"test/bi-color.jpg",
			ProcessedImage{Avg: color.RGBA{254, 127, 127, 0}, Frame: Frame{MaxX: 400, MinY: 39, MaxY: 439}},
		},
	}
	for _, tc := range tcs {
		res := processJPG(tc.path)
		assert.Equal(t, tc.expected, res)
	}
}

