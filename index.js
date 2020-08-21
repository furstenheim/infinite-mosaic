import './main.scss'
import L, {bounds, LatLng, LatLngBounds} from 'leaflet'
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
const MAP_SIZE = 1280
// const TILE_SIZE = 10
const TILE_SIZE = 10
const MIN_TILE_SIZE = 10
const CANVAS_SIZE = MAP_SIZE / TILE_SIZE
main()
let sprites = []
const SIDE = processed.Side
const SPRITE = 'sprite'
const DIRECT = 'direct'
const tile2Sprite = {
  10: {type: SPRITE, index: 0, size: 10},
  20: {type: SPRITE, index: 1, size: 20},
  40: {type: SPRITE, index: 2, size: 40},
  80: {type: DIRECT},
  160: {type: DIRECT},
  320: {type: DIRECT},
  640: {type: DIRECT}
}
let currentZoom = 0
/**
 * @typedef {
 * {avg: {R: number, G: number, B: number, A: number},
 * frame: {"minX":number,"minY":number,"maxX":number,"maxY":number},
 * name: string, id: string}} ProcessedImage
 */
async function main () {
  processed.ExportedImages.unshift(null)
  // const img = processed.ExportedImages[0]
  const img = processed.ExportedImages[getRandomNumber(1, processed.ExportedImages.length)]
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
    minZoom: 0,
    maxZoom: 20,
    zoomControl: false,
    crs: L.CRS.Simple,
    maxBounds: new L.LatLngBounds(new L.LatLng(MAP_SIZE / 2, -MAP_SIZE / 2), new L.LatLng(-MAP_SIZE / 2, MAP_SIZE / 2))
  })
  map.setView([0, 0], currentZoom)
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
      const drawZoom = canvasOverlay.zoom
      currentZoom = drawZoom
      const tileSize = getTileSize(drawZoom)
      const spriteConfig = tile2Sprite[tileSize]
      const width = canvasOverlay.size.x
      const height = canvasOverlay.size.y
      const northWest = canvasOverlay.bounds.getNorthWest()
      // const baseCoord = (coords.x - xMin + (coords.y - yMin) * CANVAS_SIZE) * 4
      let canvasIndex = (parseInt(northWest.lng / MIN_TILE_SIZE + CANVAS_SIZE / 2) + parseInt((CANVAS_SIZE / 2 - northWest.lat / MIN_TILE_SIZE )) * CANVAS_SIZE) * 4
      // canvasIndex -= canvasIndex % 4
      const deltaY = 4 * CANVAS_SIZE - parseInt(CANVAS_SIZE / tileSize * 4 * MIN_TILE_SIZE) // canvas size - width

      // const deltaY = deltaYBase - deltaYBase % 4
      // let canvasIndex = 0
      const context = canvasOverlay.canvas.getContext('2d')
      for (let j = 0; j < height / tileSize; j++) {
        for (let i = 0; i < width / tileSize; i++) {
          const r = imageData.data[canvasIndex]
          const g = imageData.data[canvasIndex + 1]
          const b = imageData.data[canvasIndex + 2]
          canvasIndex += 4
          const { image: minImage, index: imageIndex} = findMin(r, g, b)
          if (spriteConfig.type === SPRITE) {
            const sprite = sprites[spriteConfig.index]
            context.drawImage(sprite, (imageIndex % SIDE) * spriteConfig.size, parseInt(imageIndex / SIDE) * spriteConfig.size, spriteConfig.size, spriteConfig.size, i * tileSize, j * tileSize, tileSize, tileSize)
          } else {
            const tileImage = new window.Image()
            // baseImage.src = `scrape/downloaded/${img.name.replace(/\//g, '_')}`
            tileImage.src = `squared-images/${minImage.id}.jpeg`
            tileImage.onload = function () {
              if (drawZoom === currentZoom) {
                context.drawImage(tileImage, 0, 0, tileImage.width, tileImage.height, i * tileSize, j * tileSize, tileSize, tileSize)
                // Prevent drawing after double zoom
              }
            }
          }
        }
        canvasIndex += deltaY
      }
    }
  }))()
  layer.addTo(map)
  window.layer = layer
  window.map = map
}
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
  for (let i = 1; i < processed.ExportedImages.length; i++) {
    processedImage = processed.ExportedImages[i]
    const distance = (processedImage.avg.R - r) ** 2 + (processedImage.avg.G - g) ** 2 + (processedImage.avg.B - b) ** 2
    if (distance < minDistance) {
      minPicture = processedImage
      minDistance = distance
      minIndex = i
    }
  }
  return { index: minIndex - 1, image: minPicture }
}

function getTileSize (zoom) {
  const sizes = [10, 20, 40, 80, 160, 320, 640]
  return sizes[zoom % 7]
}
