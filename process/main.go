package main

import (
	"encoding/json"
	"fmt"
	"golang.org/x/image/draw"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/jpeg"
	"log"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const IMAGES_PATH = "../scrape/downloaded"
const OUTPUT_PATH = "output.json"
var idRegex = regexp.MustCompile(`iif_2_(.*)_full`)
var sizes = []int{10, 20, 40, 80, 160, 320}
var sprites = make([]draw.Image, len(sizes))
var side int
func main () {
	var i int
	var j int
	exportedImages := []ExportedImage{}
	filepath.Walk(IMAGES_PATH, func(path string, info os.FileInfo, err error) error {
		j++
		if err != nil {
			log.Fatal(err)
		}

		matched, err := regexp.MatchString(`.jpg$`, path)
		if err != nil {
			log.Fatal(err)
		}
		if matched {
			j++
		}
		return nil
	})

	//j = 1000
	side = int(math.Ceil(math.Sqrt(float64(j))))
	for i, size := range(sizes) {
		sprites[i] = image.NewRGBA(image.Rect(0, 0, size* side, size * side))
	}

	walkError := filepath.Walk(IMAGES_PATH, func(path string, info os.FileInfo, err error) error {
		/*if i > 1000 {
			return nil
		}
*/

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
			jpg := processJPG(path, i)
			exportedImage := ExportedImage{
				Avg:   jpg.Avg,
				Frame: jpg.Frame,
				Name:  strings.ReplaceAll(info.Name(), "_", "/"),
				Id: jpg.Id,
			}
			exportedImages = append(exportedImages, exportedImage)
			i++
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
	encoder.Encode(Export{
		ExportedImages: exportedImages,
		Side:           side,
	})

	for i, sprite := range sprites {
		writeImage(sprite, fmt.Sprintf("../squared-images/sprite%d.jpeg", i))
	}
}

type Export struct {
	ExportedImages []ExportedImage
	Side int
}

func writeImage (img image.Image, path string) {
	outputFile1, openOutputErr1 := os.Create(path)
	if openOutputErr1 != nil {
		log.Fatal(openOutputErr1)
	}
	defer outputFile1.Close()
	jpeg.Encode(outputFile1, img, nil)
}


type ProcessedImage struct {
    Avg color.RGBA
    Frame Frame
    Id string
}

type ExportedImage struct {
	Avg   color.RGBA `json:"avg"`
	Frame Frame `json:"frame"`
	Name  string `json:"name"`
	Id string `json:"id"`
}

func processJPG (path string, i int) ProcessedImage {
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
	subImage := img.(interface {
		SubImage(r image.Rectangle) image.Image
	}).SubImage(image.Rect(frame.MinX, frame.MinY, frame.MaxX, frame.MaxY))

	matchString := idRegex.FindSubmatch([]byte(path))
	imgId := string(matchString[1])

	// writeImage(subImage, "../squared-images/" + imgId + ".jpeg")


	for nSize, size := range sizes {
		draw.CatmullRom.Scale(sprites[nSize], image.Rect((i % side) * size, (i / side) * size, (i % side) * size + size, (i / side) * size + size), subImage, subImage.Bounds(), draw.Over, nil)
	}

	avg := computeAvg(frame, img)
	return ProcessedImage{
		Avg:avg,
		Id: imgId,
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
