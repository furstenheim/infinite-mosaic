import './main.scss'
import L, {bounds} from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './CanvasLayer'
import _ from 'lodash'
/**
 * @type {{ExportedImages: Array<ProcessedImage>}}
 */
import processed from './process/output.json'
import 'regenerator-runtime/runtime'
const MOSAIC_ID = 'mosaic-holder'
const LOADING_CONTENT = 'loading-content'
const MAP_SIZE = 1000
// const TILE_SIZE = 10
const TILE_SIZE = 10
const MIN_TILE_SIZE = 10
const CANVAS_SIZE = MAP_SIZE / TILE_SIZE
const DOWNLOADED_IMAGE_SIZE = 400
main()
let sprites = []
const SIDE = processed.Side
const tile2Sprite = {
  10: {index: 0, size: 10},
  20: {index: 1, size: 20},
  40: {index: 2, size: 40}
}
/**
 * @typedef {
 * {avg: {R: number, G: number, B: number, A: number},
 * frame: {"minX":number,"minY":number,"maxX":number,"maxY":number},
 * name: string, id: string}} ProcessedImage
 */
async function main () {
  // const img = processed.ExportedImages[0]
  const img = {"avg":{"R":90,"G":85,"B":70,"A":0},"frame":{"minX":0,"minY":40,"maxX":400,"maxY":440},"name":"https://www.artic.edu/iiif/2/0c8fb799-31bb-fb44-b863-080a614966f1/full/400,/0/default.jpg","id":"0b0e79d8-b6f0-0235-2486-3464dc73d695"}
  const placeholderCanvas = document.createElement('canvas')
  const context = placeholderCanvas.getContext('2d')

  placeholderCanvas.height = CANVAS_SIZE
  placeholderCanvas.width = CANVAS_SIZE
  await new Promise(function (resolve, reject) {
    const baseImage = new window.Image()
    // baseImage.src = `scrape/downloaded/${img.name.replace(/\//g, '_')}`
    baseImage.src = `squared-images/${img.id}.jpeg`
    baseImage.crossOrigin = 'Anonymous'
    baseImage.onload = function () {
      context.drawImage(baseImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
      resolve()
    }
  })
  sprites = await Promise.all(_.times(3, function (i) {
    return new Promise(function (resolve) {
      const sprite = new window.Image()
      sprite.src = `squared-images/sprite${i}.jpeg`
      sprite.onload = function () {
        resolve(sprite)
      }
    })
  }))

  document.body.appendChild(placeholderCanvas)
  document.getElementById(LOADING_CONTENT).remove()
  const map = L.map(MOSAIC_ID, {
    minZoom: -2,
    maxZoom: 20,
    zoomControl: false,
    crs: L.CRS.Simple
  })
  map.setView([0, 0], 0)
  const imageData = context.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  const layer = new (L.CanvasLayer.extend({
    /**
     *
     * @param {{bounds: LatLngBounds, canvas: canvas, center: {x: number, y: number},
     * corner: {x: number, y: number}
     *   layer: Layer,
     *   size: Point,
     *   zoom: number}} canvasOverlay
     */
    onDrawLayer (canvasOverlay) {
      const tileSize = getTileSize(canvasOverlay.zoom)
      const spriteConfig = tile2Sprite[tileSize]
      const width = canvasOverlay.size.x
      const height = canvasOverlay.size.y
      const northWest = canvasOverlay.bounds.getNorthWest()
      const southEast = canvasOverlay.bounds.getSouthEast()
      // const baseCoord = (coords.x - xMin + (coords.y - yMin) * CANVAS_SIZE) * 4
      let canvasIndex = parseInt(((northWest.lng / MIN_TILE_SIZE + CANVAS_SIZE / 2) + (CANVAS_SIZE / 2 - northWest.lat / MIN_TILE_SIZE ) * CANVAS_SIZE) * 4)
      canvasIndex -= canvasIndex % 4
      const deltaYBase = parseInt((CANVAS_SIZE - (southEast.lng - northWest.lng) / MIN_TILE_SIZE) * 4)
      const deltaY = deltaYBase - deltaYBase % 4
      // let canvasIndex = 0
      const context = canvasOverlay.canvas.getContext('2d')
      for (let j = 0; j < height / tileSize; j++) {
        for (let i = 0; i < width / tileSize; i++) {
          const r = imageData.data[canvasIndex]
          const g = imageData.data[canvasIndex + 1]
          const b = imageData.data[canvasIndex + 2]
          canvasIndex += 4
          const { image: minImage, index: imageIndex} = findMin(r, g, b)
          const sprite = sprites[spriteConfig.index]
          context.drawImage(sprite, (imageIndex % SIDE) * spriteConfig.size, parseInt(imageIndex / SIDE) * spriteConfig.size, spriteConfig.size, spriteConfig.size, i * tileSize, j * tileSize, tileSize, tileSize)
        }
        canvasIndex += deltaY
      }
    }
  }))()
  layer.addTo(map)
  window.layer = layer
  window.map = map
}

function getRandomColor () {
  var letters = '0123456789ABCDEF'
  var color = '#'
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}

/**
 *
 * @param r
 * @param g
 * @param b
 * @returns {{index: number, image: ProcessedImage}}
 */
function findMin (r, g, b) {
  let minDistance = Infinity
  let minPicture
  let processedImage
  let minIndex = -1
  for (let i = 0; i < processed.ExportedImages.length; i++) {
    processedImage = processed.ExportedImages[i]
    const distance = (processedImage.avg.R - r) ** 2 + (processedImage.avg.G - g) ** 2 + (processedImage.avg.B - b) ** 2
    if (distance < minDistance) {
      minPicture = processedImage
      minDistance = distance
      minIndex = i
    }
  }
  return { index: minIndex, image: minPicture }
}

function debugCoords (coords) {
  var tile = document.createElement('div')
  tile.innerHTML = [coords.x, coords.y, coords.z].join(', ')
  tile.style.outline = '1px solid red'
  return tile
}

function getTileSize (zoom) {
  const sizes = [10, 20, 40]
  return sizes[zoom % 3]
}
