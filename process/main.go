package main

import (
	"image"
	"image/color"
	_ "image/jpeg"
	"log"
	"os"
	"path/filepath"
	"regexp"
)

const IMAGES_PATH = "../scrape/downloaded"

func main () {
	var i int
	err := filepath.Walk(IMAGES_PATH, func(path string, info os.FileInfo, err error) error {
		i++
		if i > 4 {
			return nil
		}
		log.Println(info)
		log.Println("Name ", info.Name(), i)
		if err != nil {
			return err
		}

		matched, regexErr := regexp.MatchString(`.jpg$`, path)
		if regexErr != nil {
			return regexErr
		}

		if matched {
			processJPG(path)
		}

		return nil
	})
	if err != nil {
		log.Fatal(err)
	}
}

type ProcessedImage struct {
    Avg color.RGBA
    Frame Frame
}

func processJPG (path string) ProcessedImage {
	log.Println(path)
	imgfile, openErr := os.Open(path)
	if openErr != nil {
		log.Fatal(openErr)
	}
	defer imgfile.Close()
	img, _, decodeErr := image.Decode(imgfile)
	if decodeErr != nil {
		log.Fatal(decodeErr, " file ", path)
	}
	frame := frameFromRect(img.Bounds())
	avg := computeAvg(frame, img)
	log.Println(avg)
	return ProcessedImage{
		Avg:avg,
		Frame: frame,
	}
}

func computeAvg (frame Frame, img image.Image) color.RGBA {
	var isSet bool
	var r, g, b uint64
	for x := frame.MinX; x < frame.MaxX; x++ {
		for y := frame.MinY; y < frame.MaxY; y++ {
			pixel := img.At(x, y)
			r1, g1, b1, _ := pixel.RGBA()
			if !isSet {
				r = uint64(r1)
				g = uint64(g1)
				b = uint64(b1)
				isSet = true
			} else {
				r += uint64(r1)
				g += uint64(g1)
				b += uint64(b1)
			}
		}
	}


	r /= uint64((frame.MaxY - frame.MinY)*(frame.MaxX - frame.MinX) * 257)
	g /= uint64((frame.MaxY - frame.MinY)*(frame.MaxX - frame.MinX) * 257)
	b /= uint64((frame.MaxY - frame.MinY)*(frame.MaxX - frame.MinX) * 257)
	return color.RGBA{R: uint8(r), G: uint8(g), B: uint8(b)}
}

func frameFromRect(rectangle image.Rectangle) Frame {
	size := minInt(rectangle.Dx(), rectangle.Dy())
	minX := rectangle.Min.X + (rectangle.Dx() - size) / 2
	maxX := rectangle.Min.X + (rectangle.Dx() - size) / 2 + size
	minY := rectangle.Min.Y + (rectangle.Dy() - size) / 2
	maxY := rectangle.Min.Y + (rectangle.Dy() - size) / 2 + size
	return Frame{MinX: minX, MinY: minY, MaxX: maxX, MaxY: maxY}
}

func minInt (a, b int) int {
	if a < b {
		return a
	}
	return b
}

type Frame struct {
	MinX int
	MinY int
	MaxX int
	MaxY int
}
