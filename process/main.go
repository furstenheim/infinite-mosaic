package main

import (
	"image"
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
		if i > 3 {
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
			processJPG(path, info)
		}

		return nil
	})
	if err != nil {
		log.Fatal(err)
	}
}

func processJPG (path string, info os.FileInfo) {
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
	log.Println(img.Bounds().Dy())
}

func fromRect (rectangle image.Rectangle) Frame {
	size := minInt(rectangle.Dx(), rectangle.Dy())
	minX := rectangle.Min.X + (rectangle.Dx() - size) / 2
	maxX := rectangle.Max.X - (rectangle.Dx() - size) / 2
	minY := rectangle.Min.Y + (rectangle.Dy() - size) / 2
	maxY := rectangle.Max.Y - (rectangle.Dy() - size) / 2
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
