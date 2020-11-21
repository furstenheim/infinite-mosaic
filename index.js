import './main.scss'
import _ from 'lodash'
import LRU from 'lru-cache'
import {Decimal} from 'small-decimal'
/**
 * @type {{ExportedImages: Array<ProcessedImage>}}
 */
import processed from './process/output.slim.json'
import 'regenerator-runtime/runtime'
const LOADING_CONTENT = 'loading-content'
const d3 = require('d3')
require('d3-zoom')
const MAP_SIZE = 1280
// const TILE_SIZE = 10
const TILE_SIZE = 5
const MIN_TILE_SIZE = 5
const MIN_TILE_SIZE_DECIMAL = new Decimal(MIN_TILE_SIZE)
const CANVAS_SIZE = MAP_SIZE / TILE_SIZE
const CANVAS_SIZE_DECIMAL = new Decimal(MAP_SIZE / TILE_SIZE)
// console.log = () => {}
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
const TWO = new Decimal(2)
const ONE = new Decimal(1)
const ZERO = new Decimal(0)
const TILE_2_SPRITE_LENGTH = new Decimal(tile2Sprite.length)
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
  const canvasNode = canvas.node()
  var w = MAP_SIZE
  var h = MAP_SIZE

  canvas.property('width', w)
  canvas.property('height', h)
  const displayedContext = canvasNode.getContext('2d')
  const hiddenCanvas = document.createElement('canvas')
  // Make hidden canvas bigger since we might need to get a subportion
  hiddenCanvas.width = w * 2
  hiddenCanvas.height = h * 2
  const context = hiddenCanvas.getContext('2d')
  const width = canvas.property('width')
  const height = canvas.property('height')
  const zoomBehaviour = d3.zoom().scaleExtent([ONE, new Decimal(2 ** 63)]).constrain((transform) => transform).on('zoom', render)

  canvas
    .call(zoomBehaviour)


  // Returns coordinates of visible area in original pixels
  function getVisibleArea (t) {
    // Zero zero of the canvas to coordinates in the image
    // var l = t.invert([ZERO, ZERO])
    // var l2 = t.invert([new Decimal(width), new Decimal(height)])

    return { w: t.x.neg(), n: t.y.neg() }
  }

  function render (event) {
    const transform = event.transform
//      const transform = d3.zoomTransform(this)

    console.log('transform', transform)

    console.log('render', event, transform)
   // N console.log('Visible area', getVisibleArea(event.transform))
    console.log(width, height)

    const drawZoom = transform.k.floorLog2()

    console.log('drawZoom', drawZoom.toString(), 'k', transform.k)
    const depth = parseInt(drawZoom.divToInt(TILE_2_SPRITE_LENGTH).toNumber())
    const boundCoordinates = getVisibleArea(transform)
    console.log('Visible area new', boundCoordinates)
    currentExecution++
    const scaleFactor = transform.k.div(transform.k.floorToPowOf2())
    d3Mosaic(depth, drawZoom, scaleFactor, transform.k, transform.x, transform.y)
  }

  const initialDepth = ZERO
  const initialZoom = ZERO
  const initialCoordinates = {
    w: ZERO, n: ZERO
  }

  d3Mosaic(initialDepth, initialZoom, ONE, ONE, ZERO, ZERO)

  async function d3Mosaic (depth, drawZoom, scaleFactor, currentZoom, transformX, transformY) {
    const spriteConfig = tile2Sprite[drawZoom.mod(TILE_2_SPRITE_LENGTH).toNumber()]
    const tileSize = spriteConfig.size
    const tileSizeDecimal = new Decimal(spriteConfig.size)

    /*
     * The absolute grid would be if the indexes of all the images for our depth where laid together in the same
     * grid.
     *
     * A) TransformX is in the K coordinates
     * B) Negate the coordinates since this is the offset of the origin
     * D) && E) calculate in which fraction of the initial tiles the coordinate is
     * C) take into account that each of the initial tiles is split into getSide(depth -1)
     *
     * Order (which is commutative) is changed to avoid floating precission errors
     */
    const floatXCoordinateInAbsoluteGrid = transformX // A)
      .neg() // B)
      .mul(getSide(depth - 1)) // C)
      .div(MIN_TILE_SIZE_DECIMAL) // D)
      .div(currentZoom) // E)
    const floatYCoordinateInAbsoluteGrid = transformY
      .neg()
      .mul(getSide(depth - 1))
      .div(MIN_TILE_SIZE_DECIMAL)
      .div(currentZoom)

    const xInAbsoluteGrid = floatXCoordinateInAbsoluteGrid.floor()
    const yInAbsoluteGrid = floatYCoordinateInAbsoluteGrid.floor()

    // Prevent errors on the negative coordinates
    const initialXInRelativeGridDecimal = xInAbsoluteGrid.add(CANVAS_SIZE_DECIMAL).mod(CANVAS_SIZE_DECIMAL)
    let xInRelativeGrid = initialXInRelativeGridDecimal.toNumber()
    const initialYInRelativeGridDecimal = yInAbsoluteGrid.add(CANVAS_SIZE_DECIMAL).mod(CANVAS_SIZE_DECIMAL)
    let yInRelativeGrid = initialYInRelativeGridDecimal.toNumber()

    let xInParentGrid = xInAbsoluteGrid.divToInt(CANVAS_SIZE_DECIMAL)
    let yInParentGrid = yInAbsoluteGrid.divToInt(CANVAS_SIZE_DECIMAL)

    let currentGrid = null
    let changeGrid = true
    let toAvoidPaiting = false

    const maxXInGrid = new Decimal(parseInt((width / MIN_TILE_SIZE))).mul(getSide(depth - 1))
    const maxYInGrid = new Decimal(parseInt((height / MIN_TILE_SIZE))).mul(getSide(depth - 1))

    console.log('depth', depth)
    console.log('xInGrid', xInAbsoluteGrid, 'yInGrid', yInAbsoluteGrid)

    let remainingImages = 0
    let renderingDone
    const finishedRenderingPromise = new Promise(function (resolve) {
      renderingDone = resolve
    })
    const thisExecution = currentExecution
    const heightIterations = height / tileSize + 1
    const widthIterations = width / tileSize + 1
    for (let j = 0; j < heightIterations; j++, yInRelativeGrid++) {
      for (let i = 0; i < widthIterations; i++, xInRelativeGrid++) {
        const currentXInGrid = xInAbsoluteGrid.add(new Decimal(i))
        const currentYInGrid = yInAbsoluteGrid.add(new Decimal(j))

        if (currentXInGrid.greaterThanOrEqualTo(maxXInGrid) || currentYInGrid.greaterThanOrEqualTo(maxYInGrid) || currentXInGrid.lessThan(ZERO) || currentYInGrid.lessThan(ZERO)) {
          context.fillStyle = 'black'
          context.fillRect(i * tileSize, j * tileSize, tileSize, tileSize)
          toAvoidPaiting = true
        }

        if (yInRelativeGrid >= CANVAS_SIZE) {
          changeGrid = true
          yInRelativeGrid = yInRelativeGrid % CANVAS_SIZE
          yInParentGrid = yInParentGrid.add(ONE)
        }

        if (xInRelativeGrid < 0) {
          changeGrid = true
          xInRelativeGrid += CANVAS_SIZE
          xInParentGrid = xInParentGrid.sub(ONE)
        }

        if (xInRelativeGrid >= CANVAS_SIZE) {
          changeGrid = true
          xInRelativeGrid = xInRelativeGrid % CANVAS_SIZE
          xInParentGrid = xInParentGrid.add(ONE)
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
            computeAndMemoize(currentXInGrid.add(ONE), currentYInGrid, depth)
            computeAndMemoize(currentXInGrid, currentYInGrid.add(ONE), depth)
            computeAndMemoize(currentXInGrid.add(ONE), currentYInGrid.add(ONE), depth)
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
      displayedContext.drawImage(context.canvas, floatXCoordinateInAbsoluteGrid.sub(xInAbsoluteGrid).mul(tileSizeDecimal).toNumber(), floatYCoordinateInAbsoluteGrid.sub(yInAbsoluteGrid).mul(tileSizeDecimal).toNumber(), width / scaleFactor.toNumber(), height / scaleFactor.toNumber(), 0, 0, width, height)
      // displayedContext.drawImage(context.canvas, 0, 0, 2 * width, 2 * height, 0, 0, width, height)
    }
  }
}

function getRandomNumber (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 *
 * @param {Decimal} x
 * @param {Decimal} y
 * @param d
 * @returns {Promise<any>}
 */
let baseId = ''
async function computeAndMemoize (x, y, d) {
  const key = getCacheKey(d, x, y)
  // TODO should compute the grid
  if (cachedBestImages[key]) {
    return cachedBestImages[key]
  }
  if (d === -1) {
    // const id = '0b0e79d8-b6f0-0235-2486-3464dc73d695'
    const id = baseId || processed.ExportedImages[getRandomNumber(1, processed.ExportedImages.length)].id
    baseId = id
    const grid = await computeImageGrid(id)
    cachedBestImages[key] = grid
    return grid
  }

  const clippedX = x.sub(x.mod(CANVAS_SIZE_DECIMAL))
  const x0 = clippedX.div(CANVAS_SIZE_DECIMAL)
  const clippedY = y.sub(y.mod(CANVAS_SIZE_DECIMAL))
  const y0 = clippedY.div(CANVAS_SIZE_DECIMAL)
  const parentGrid = await computeAndMemoize(x0, y0, d - 1)
  const grid = await computeImageGrid(processed.ExportedImages[parentGrid[x.mod(CANVAS_SIZE_DECIMAL).add(CANVAS_SIZE_DECIMAL.mul(y.mod(CANVAS_SIZE_DECIMAL)))]].id)
  cachedBestImages[key] = grid
  return grid
}

async function computeImageGrid (id) {
  const cachedGrid = tilesCache.get(id)
  if (cachedGrid) {
    return cachedGrid
  }
  const resp = await window.fetch(`closest-points-uint16/${id}.txt`)
  const data = await resp.arrayBuffer()
  const array = new Uint16Array(data)
  tilesCache.set(id, array)
  return array
}

/**
 *
 * @param d
 * @param {Decimal} x
 * @param {Decimal} y
 * @returns {string}
 */
function getCacheKey (d, x, y) {
  return `${d},${x.toString()},${y.toString()}`
}

/**
 * number of tiles at depth. For depth 0 there are CANVAS_SIZE tiles
 * @param depth
 * @returns {*}
 */
function getSide (depth) {
  if (sideCache[depth]) {
    return sideCache[depth]
  }
  if (depth < 2) {
    sideCache[depth] = new Decimal(CANVAS_SIZE ** (depth + 1))
  } else {
    sideCache[depth] = sideCache[depth - 1].mul(CANVAS_SIZE_DECIMAL)
  }

  return sideCache[depth]
}
const sideCache = {

}
