import './main.scss'
import L, { bounds, LatLng, LatLngBounds } from 'leaflet'
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
const d3 = require('d3')
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
const tile2Sprite = [
  { type: SPRITE, index: 0, size: 10 },
  { type: SPRITE, index: 1, size: 20 },
  { type: SPRITE, index: 2, size: 40 },
  { type: DIRECT, size: 80 },
  { type: DIRECT, size: 160 },
  { type: DIRECT, size: 320 },
  { type: DIRECT, size: 640 }
]

const cachedBestImages = []
let currentExecution = 0
/**
 * @typedef {
 * {avg: {R: number, G: number, B: number, A: number},
 * frame: {"minX":number,"minY":number,"maxX":number,"maxY":number},
 * name: string, id: string}} ProcessedImage
 */
async function main () {
  processed.ExportedImages.unshift(null)

  sprites = await Promise.all(_.times(3, function (i) {
    return new Promise(function (resolve) {
      const sprite = new window.Image()
      sprite.src = `squared-images/sprite${i}.jpeg`
      sprite.onload = function () {
        resolve(sprite)
      }
    })
  }))

  document.getElementById(LOADING_CONTENT).remove()

  const canvas = d3.select('canvas')
  const context = canvas.node().getContext('2d')
  const width = canvas.property('width')
  const height = canvas.property('height')
  const transform = d3.zoomIdentity
  canvas
    .call(d3.zoom().on('zoom', render))
}

function render (event) {
  console.log('render', event, d3.zoomTransform(this))
}
function leafletMosaic () {
  const map = L.map(MOSAIC_ID, {
    minZoom: 0,
    maxZoom: 20,
    zoomControl: false,
    crs: L.CRS.Simple,
    maxBounds: new L.LatLngBounds(new L.LatLng(MAP_SIZE / 2, -MAP_SIZE / 2), new L.LatLng(-MAP_SIZE / 2, MAP_SIZE / 2))
  })
  map.setView([0, 0], 0)

  const layer = new (L.CanvasLayer.extend({
    /**
     *
     * @param {{bounds: LatLngBounds, canvas: canvas, center: {x: number, y: number},
     * corner: {x: number, y: number}
     *   layer: Layer,
     *   size: Point,
     *   zoom: number}} canvasOverlay
     */
    async onDrawLayer (canvasOverlay) {
      const drawZoom = canvasOverlay.zoom
      currentExecution++
      const thisExecution = currentExecution
      const depth = (drawZoom - drawZoom % tile2Sprite.length) / tile2Sprite.length
      if (!cachedBestImages[depth]) {
        cachedBestImages[depth] = new Uint16Array(getSide(depth) * getSide(depth))
      }
      const spriteConfig = tile2Sprite[drawZoom % (tile2Sprite.length)]
      const tileSize = spriteConfig.size
      const width = canvasOverlay.size.x
      const height = canvasOverlay.size.y
      const northWest = canvasOverlay.bounds.getNorthWest()
      // const baseCoord = (coords.x - xMin + (coords.y - yMin) * CANVAS_SIZE) * 4
      const xInGrid = parseInt((northWest.lng / MIN_TILE_SIZE + CANVAS_SIZE / 2) * getSide(depth - 1))
      const yInGrid = parseInt((CANVAS_SIZE / 2 - northWest.lat / MIN_TILE_SIZE) * getSide(depth - 1))
      if (xInGrid < 0 || yInGrid < 0) {
        // We'll be called again
        return
      }
      let canvasIndex = xInGrid + yInGrid * getSide(depth)
      // canvasIndex -= canvasIndex % 4
      const deltaY = getSide(depth) - parseInt(CANVAS_SIZE / tileSize * MIN_TILE_SIZE) // canvas size - width

      // const deltaY = deltaYBase - deltaYBase % 4
      // let canvasIndex = 0
      const context = canvasOverlay.canvas.getContext('2d')
      for (let j = 0; j < height / tileSize; j++) {
        for (let i = 0; i < width / tileSize; i++) {
          let imageIndex
          if (cachedBestImages[depth][canvasIndex]) {
            imageIndex = cachedBestImages[depth][canvasIndex]
          } else {
            imageIndex = await computeAndMemoize(xInGrid + i, yInGrid + j, depth)
          }
          const adaptedIndex = imageIndex - 1
          canvasIndex++
          const minImage = processed.ExportedImages[imageIndex]
          if (spriteConfig.type === SPRITE) {
            const sprite = sprites[spriteConfig.index]
            context.drawImage(sprite, (adaptedIndex % SIDE) * spriteConfig.size, parseInt(adaptedIndex / SIDE) * spriteConfig.size, spriteConfig.size, spriteConfig.size, i * tileSize, j * tileSize, tileSize, tileSize)
          } else {
            const tileImage = new window.Image()
            // baseImage.src = `scrape/downloaded/${img.name.replace(/\//g, '_')}`
            tileImage.src = `squared-images/${minImage.id}.jpeg`
            tileImage.onload = function () {
              if (thisExecution === currentExecution) {
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
function getRandomNumber (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function computeAndMemoize (x, y, d) {
  if (d === -1) {
    return getRandomNumber(1, processed.ExportedImages.length)
  }
  if (cachedBestImages[d][x + getSide(d) * y]) {
    return cachedBestImages[d][x + getSide(d) * y]
  }
  const clippedX = x - x % CANVAS_SIZE
  const x0 = (clippedX) / CANVAS_SIZE
  const clippedY = (y - y % CANVAS_SIZE)
  const y0 = clippedY / CANVAS_SIZE
  const imageIndex = await computeAndMemoize(x0, y0, d - 1)
  const placeholderCanvas = document.createElement('canvas')
  const context = placeholderCanvas.getContext('2d')

  placeholderCanvas.height = CANVAS_SIZE
  placeholderCanvas.width = CANVAS_SIZE
  await new Promise(function (resolve, reject) {
    const baseImage = new window.Image()
    // baseImage.src = `scrape/downloaded/${img.name.replace(/\//g, '_')}`
    baseImage.src = `squared-images/${processed.ExportedImages[imageIndex].id}.jpeg`
    baseImage.crossOrigin = 'Anonymous'
    baseImage.onload = function () {
      context.drawImage(baseImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
      const imageData = context.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      let canvasIndex = 0
      const deltaY = getSide(d) - CANVAS_SIZE
      let runningIndex = clippedX + getSide(d) * clippedY
      for (let i = 0; i < CANVAS_SIZE; i++) {
        for (let j = 0; j < CANVAS_SIZE; j++) {
          const r = imageData.data[canvasIndex]
          const g = imageData.data[canvasIndex + 1]
          const b = imageData.data[canvasIndex + 2]
          canvasIndex += 4
          const { index: imageIndex } = findMin(r, g, b)
          cachedBestImages[d][runningIndex] = imageIndex
          runningIndex++
        }
        runningIndex += deltaY
      }
      resolve()
    }
  })
  return cachedBestImages[d][x + getSide(d) * y]
}

function getSide (depth) {
  if (sideCache[depth]) {
    return sideCache[depth]
  }
  sideCache[depth] = CANVAS_SIZE ** (depth + 1)
  return sideCache[depth]
}
const sideCache = {

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
  return { index: minIndex, image: minPicture }
}

function getTileSize (zoom) {
  const sizes = [10, 20, 40, 80, 160, 320, 640]
  return sizes[zoom % 7]
}
