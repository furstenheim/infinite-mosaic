package main

import (
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
}
