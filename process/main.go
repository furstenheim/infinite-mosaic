package main

import (
	"encoding/json"
	"fmt"
	"github.com/kyroy/kdtree/points"
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
	"github.com/kyroy/kdtree"
)

const IMAGES_PATH = "../scrape/downloaded"
const OUTPUT_PATH = "output.json"
var idRegex = regexp.MustCompile(`iif_2_(.*)_full`)
const CANVAS_SIZE = 1280
var sizes = []int{5, 10, 20, 40, 80, 160, 320}
var sprites = make([]draw.Image, len(sizes))
var side int
func main () {
	var i int
	var j int
	var k int
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

	indexPoints := []kdtree.Point{}

	walkError := filepath.Walk(IMAGES_PATH, func(path string, info os.FileInfo, err error) error {
/*		if i > 10 {
			return nil
		}*/


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
			// use len(exportedImages) instead of len(exportedImages) - 1 becaus we'll later unshift the array in the browser
			indexPoints = append(indexPoints, points.NewPoint([]float64{float64(jpg.Avg.R), float64(jpg.Avg.G), float64(jpg.Avg.B)}, len(exportedImages)))
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

	tree := kdtree.New(indexPoints)

	walkErrorCompute := filepath.Walk(IMAGES_PATH, func(path string, info os.FileInfo, err error) error {
/*		if k > 10 {
			return nil
		}*/

		if k % 100 == 0 {
			log.Println(i, "th file Compute")
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
			k++
			// closerPointsSmall := computeCloserPoints(tree, path, i, sizes[0])
			closerPointsMedium := computeCloserPoints(tree, path, i, sizes[1])
			// log.Println("closer points", closerPointsSmall)
			/*closerPointsFile, outputPointsErr := os.Create("../closest-points/" + closerPointsSmall.Id + ".json")
			if outputPointsErr != nil {
				log.Fatal(outputPointsErr)
			}
			defer closerPointsFile.Close()
			encoder := json.NewEncoder(closerPointsFile)
			encoder.Encode(closerPointsSmall)
*/
			closerPointsMediumFile, outputPointsMediumErr := os.Create("../closest-points-medium/" + closerPointsMedium.Id + ".json")
			if outputPointsMediumErr != nil {
				log.Fatal(outputPointsMediumErr)
			}
			defer closerPointsMediumFile.Close()
			encoderMedium := json.NewEncoder(closerPointsMediumFile)
			encoderMedium.Encode(closerPointsMedium)

		}
		return nil
	})
	if walkErrorCompute != nil {
		log.Fatal(walkErrorCompute)
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
type ProcessedPixels struct {
    ClosestPoints []int
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

func computeCloserPoints (tree *kdtree.KDTree, path string, i int, size int) ProcessedPixels {
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


	reducedImage := image.NewRGBA(image.Rect(0, 0, CANVAS_SIZE / size, CANVAS_SIZE / size))

	draw.CatmullRom.Scale(reducedImage, reducedImage.Bounds(), subImage, subImage.Bounds(), draw.Over, nil)
	// writeImage(reducedImage, "closest-points/" + imgId + ".jpeg")
	computedPoints := []int{}

	for y := reducedImage.Bounds().Min.Y; y < reducedImage.Bounds().Max.Y; y++{
		for x := reducedImage.Bounds().Min.X; x < reducedImage.Bounds().Max.X; x++{
			pixel := reducedImage.At(x, y)
			r1, g1, b1, _ := pixel.RGBA()
			closestPoints := tree.KNN(points.NewPoint([]float64{float64(r1 / 257), float64(g1 / 257), float64(b1 / 257)}, nil), 1)
			id := closestPoints[0].(*points.Point).Data.(int)
			computedPoints = append(computedPoints, id)
		}
	}

	return ProcessedPixels{
		ClosestPoints: computedPoints,
		Id:            imgId,
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
