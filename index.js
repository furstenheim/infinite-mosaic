import './main.scss'
import _ from 'lodash'
import LRU from 'lru-cache'
/**
 * @type {{ExportedImages: Array<ProcessedImage>}}
 */
import processed from './process/output.json'
import 'regenerator-runtime/runtime'
const LOADING_CONTENT = 'loading-content'
const d3 = require('d3')
const MAP_SIZE = 1280
// const TILE_SIZE = 10
const TILE_SIZE = 5
const MIN_TILE_SIZE = 5
const CANVAS_SIZE = MAP_SIZE / TILE_SIZE
console.log = () => {}
main()
let sprites = []
const SIDE = processed.Side
const SPRITE = 'sprite'
const DIRECT = 'direct'
const tile2Sprite = [
  { type: SPRITE, index: 0, size: 5 },
  { type: SPRITE, index: 1, size: 10 },
  { type: SPRITE, index: 2, size: 20 },
  { type: SPRITE, index: 3, size: 40 },
  { type: DIRECT, size: 80 },
  { type: DIRECT, size: 160 },
  { type: DIRECT, size: 320 },
  { type: DIRECT, size: 640 }
]
const imagesCache = new LRU(200)
const tilesCache = new LRU(200)

const cachedBestImages = {}
let currentExecution = 0
/**
 * @typedef {
 * {avg: {R: number, G: number, B: number, A: number},
 * frame: {"minX":number,"minY":number,"maxX":number,"maxY":number},
 * name: string, id: string}} ProcessedImage
 */
async function main () {
  processed.ExportedImages.unshift(null)

  sprites = await Promise.all(_.times(4, function (i) {
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
  var w = MAP_SIZE
  var h = MAP_SIZE

  canvas.property('width', w)
  canvas.property('height', h)
  const displayedContext = canvas.node().getContext('2d')
  const hiddenCanvas = document.createElement('canvas')
  // Make hidden canvas bigger since we might need to get a subportion
  hiddenCanvas.width = w * 2
  hiddenCanvas.height = h * 2
  const context = hiddenCanvas.getContext('2d')
  const width = canvas.property('width')
  const height = canvas.property('height')
  const zoomBehaviour = d3.zoom().scaleExtent([1, Infinity]).on('zoom', render)
  canvas
    .call(zoomBehaviour)

  function getVisibleArea (t) {
    var l = t.invert([0, 0])
    var r = t.invert([width, height])

    return { w: l[0], n: l[1], e: r[0], s: r[1] }
  }
  function render (event) {
    const transform = d3.zoomTransform(this)
    console.log('render', event, transform)
    console.log('Visible area', getVisibleArea(event.transform))
    console.log(width, height)
    const drawZoom = parseInt(Math.log2(transform.k))
    console.log('drawZoom', drawZoom, 'k', transform.k)
    const depth = (drawZoom - drawZoom % tile2Sprite.length) / tile2Sprite.length
    const boundCoordinates = getVisibleArea(event.transform)
    currentExecution++
    d3Mosaic(depth, drawZoom, Math.log2(transform.k) - drawZoom + 1, boundCoordinates)
  }

  const initialDepth = 0
  const initialZoom = 0
  const initialCoordinates = {
    w: 0, n: 0, s: h, e: w
  }

  d3Mosaic(initialDepth, initialZoom, 1, initialCoordinates)

  async function d3Mosaic (depth, drawZoom, scaleFactor, boundCoordinates) {
    const spriteConfig = tile2Sprite[drawZoom % (tile2Sprite.length)]
    const tileSize = spriteConfig.size

    /*
     * The absolute grid would be if the indexes of all the images for our depth where laid together in the same
     * grid
     */
    const floatXCoordinateInAbsoluteGrid = (boundCoordinates.w / MIN_TILE_SIZE) * getSide(depth - 1)
    const floatYCoordinateInAbsoluteGrid = (boundCoordinates.n / MIN_TILE_SIZE) * getSide(depth - 1)
    const xInAbsoluteGrid = parseInt(floatXCoordinateInAbsoluteGrid)
    const yInAbsoluteGrid = parseInt(floatYCoordinateInAbsoluteGrid)

    // Prevent errors on the negative coordinates
    let xInRelativeGrid = (xInAbsoluteGrid + CANVAS_SIZE) % CANVAS_SIZE
    let yInRelativeGrid = (yInAbsoluteGrid + CANVAS_SIZE) % CANVAS_SIZE

    let xInParentGrid = (xInAbsoluteGrid - xInRelativeGrid) / CANVAS_SIZE
    let yInParentGrid = (yInAbsoluteGrid - yInRelativeGrid) / CANVAS_SIZE

    let currentGrid = null
    let changeGrid = true
    let toAvoidPaiting = false

    const maxXInGrid = parseInt((width / MIN_TILE_SIZE) * getSide(depth - 1))
    const maxYInGrid = parseInt((height / MIN_TILE_SIZE) * getSide(depth - 1))

    console.log('depth', depth)
    console.log('xInGrid', xInAbsoluteGrid, 'yInGrid', yInAbsoluteGrid)

    // const deltaY = deltaYBase - deltaYBase % 4
    // let canvasIndex = 0
    // const context = canvas.getContext('2d')
    let remainingImages = 0
    let renderingDone
    const finishedRenderingPromise = new Promise(function (resolve) {
      renderingDone = resolve
    })
    const thisExecution = currentExecution
    for (let j = 0; j < height / tileSize + 1; j++, yInRelativeGrid++) {
      for (let i = 0; i < width / tileSize + 1; i++, xInRelativeGrid++) {
        const currentXInGrid = xInAbsoluteGrid + i
        const currentYInGrid = yInAbsoluteGrid + j

        if (currentXInGrid >= maxXInGrid || currentYInGrid >= maxYInGrid || currentXInGrid < 0 || currentYInGrid < 0) {
          context.fillStyle = 'black'
          context.fillRect(i * tileSize, j * tileSize, tileSize, tileSize)
          toAvoidPaiting = true
        }

        if (yInRelativeGrid >= CANVAS_SIZE) {
          changeGrid = true
          yInRelativeGrid = yInRelativeGrid % CANVAS_SIZE
          yInParentGrid++
        }

        if (xInRelativeGrid < 0) {
          changeGrid = true
          xInRelativeGrid += CANVAS_SIZE
          xInParentGrid--
        }

        if (xInRelativeGrid >= CANVAS_SIZE) {
          changeGrid = true
          xInRelativeGrid = xInRelativeGrid % CANVAS_SIZE
          xInParentGrid++
        }

        if (toAvoidPaiting) {
          toAvoidPaiting = false
          changeGrid = false
          continue
        }

        if (changeGrid) {
          const candidateGrid = cachedBestImages[getCacheKey(depth - 1, xInParentGrid, yInParentGrid)]
          if (candidateGrid) {
            currentGrid = candidateGrid
          } else {
            console.log('accessing', xInParentGrid, yInParentGrid, depth - 1)
            currentGrid = await computeAndMemoize(xInParentGrid, yInParentGrid, depth - 1)
          }
          changeGrid = false
          if (drawZoom % (tile2Sprite.length) === tile2Sprite.length - 1) {
            console.log('preocomputing', currentXInGrid, currentYInGrid)
            computeAndMemoize(currentXInGrid, currentYInGrid, depth)
            computeAndMemoize(currentXInGrid + 1, currentYInGrid, depth)
            computeAndMemoize(currentXInGrid, currentYInGrid + 1, depth)
            computeAndMemoize(currentXInGrid + 1, currentYInGrid + 1, depth)
          }
        }

        const imageIndex = currentGrid[xInRelativeGrid + yInRelativeGrid * CANVAS_SIZE]
        const adaptedIndex = imageIndex - 1
        const minImage = processed.ExportedImages[imageIndex]
        if (spriteConfig.type === SPRITE) {
          const sprite = sprites[spriteConfig.index]
          context.drawImage(sprite, (adaptedIndex % SIDE) * spriteConfig.size, parseInt(adaptedIndex / SIDE) * spriteConfig.size, spriteConfig.size, spriteConfig.size, i * tileSize, j * tileSize, tileSize, tileSize)
        } else {
          const cachedImage = imagesCache.get(minImage.id)
          if (cachedImage) {
            context.drawImage(cachedImage, 0, 0, cachedImage.width, cachedImage.height, i * tileSize, j * tileSize, tileSize, tileSize)
          } else {
            const tileImage = new window.Image()
            // baseImage.src = `scrape/downloaded/${img.name.replace(/\//g, '_')}`
            tileImage.src = `squared-images/${minImage.id}.jpeg`
            remainingImages++
            tileImage.onload = function () {
              remainingImages--

              if (thisExecution === currentExecution) {
                // Prevent drawing after double zoom
                context.drawImage(tileImage, 0, 0, tileImage.width, tileImage.height, i * tileSize, j * tileSize, tileSize, tileSize)
                imagesCache.set(minImage.id, tileImage)
              }
              if (remainingImages === 0) {
                renderingDone()
              }
            }
          }
        }
      }
      xInRelativeGrid -= width / tileSize + 1
    }
    if (remainingImages !== 0) {
      await finishedRenderingPromise
    }
    if (thisExecution === currentExecution) {
      displayedContext.drawImage(context.canvas, (floatXCoordinateInAbsoluteGrid - xInAbsoluteGrid) * tileSize, (floatYCoordinateInAbsoluteGrid - yInAbsoluteGrid) * tileSize, width / scaleFactor, height / scaleFactor, 0, 0, width, height)
    }
  }
}

function getRandomNumber (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function computeAndMemoize (x, y, d) {
  const key = getCacheKey(d, x, y)
  // TODO should compute the grid
  if (cachedBestImages[key]) {
    return cachedBestImages[key]
  }
  if (d === -1) {
    // const id = '0b0e79d8-b6f0-0235-2486-3464dc73d695'
    const id = processed.ExportedImages[getRandomNumber(1, processed.ExportedImages.length)].id
    const grid = await computeImageGrid(id)
    cachedBestImages[key] = grid
    return grid
  }

  const clippedX = x - x % CANVAS_SIZE
  const x0 = (clippedX) / CANVAS_SIZE
  const clippedY = (y - y % CANVAS_SIZE)
  const y0 = clippedY / CANVAS_SIZE
  const parentGrid = await computeAndMemoize(x0, y0, d - 1)
  const grid = await computeImageGrid(processed.ExportedImages[parentGrid[x % CANVAS_SIZE + CANVAS_SIZE * (y % CANVAS_SIZE)]].id)
  cachedBestImages[key] = grid
  return grid
}

async function computeImageGrid (id) {
  const cachedGrid = tilesCache.get(id)
  if (cachedGrid) {
    return cachedGrid
  }
  const resp = await window.fetch(`closest-points/${id}.json`)
  const data = await resp.json()
  tilesCache.set(id, data.ClosestPoints)
  return data.ClosestPoints
}

function getCacheKey (d, x, y) {
  return `${d},${x},${y}`
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
