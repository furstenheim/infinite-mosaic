package main

import (
	"encoding/json"
	"image"
	"image/color"
	_ "image/jpeg"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const IMAGES_PATH = "../scrape/downloaded"
const OUTPUT_PATH = "output.json"

func main () {
	var i int
	exportedImages := []ExportedImage{}
	walkError := filepath.Walk(IMAGES_PATH, func(path string, info os.FileInfo, err error) error {
		i++
		if i % 100 == 0 {
			log.Println(i, "th file")
			log.Println("Name ", info.Name(), i)
		}
		if err != nil {
			return err
		}

		matched, regexErr := regexp.MatchString(`.jpg$`, path)
		if regexErr != nil {
			return regexErr
		}
		if matched {
			jpg := processJPG(path)
			exportedImage := ExportedImage{
				Avg:   jpg.Avg,
				Frame: jpg.Frame,
				Name:  strings.ReplaceAll(info.Name(), "_", "/"),
			}
			exportedImages = append(exportedImages, exportedImage)
		}
		return nil
	})
	if walkError != nil {
		log.Fatal(walkError)
	}
	outputFile, errOutput := os.Create(OUTPUT_PATH)
	if errOutput != nil {
		log.Fatal(errOutput)
	}
	defer outputFile.Close()
	encoder := json.NewEncoder(outputFile)
	encoder.Encode(exportedImages)

}

type ProcessedImage struct {
    Avg color.RGBA
    Frame Frame
}

type ExportedImage struct {
	Avg   color.RGBA `json:"avg"`
	Frame Frame `json:"frame"`
	Name  string `json:"name"`
}

func processJPG (path string) ProcessedImage {
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
	MinX int `json:"minX"`
	MinY int `json:"minY"`
	MaxX int `json:"maxX"`
	MaxY int `json:"maxY"`
}
