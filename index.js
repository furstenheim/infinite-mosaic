import './main.scss'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * @type Array<ProcessedImage>
 */
import processed from './process/output.json'
import 'regenerator-runtime/runtime'

const MOSAIC_ID = 'mosaic-holder'
const LOADING_CONTENT = 'loading-content'
const MAP_SIZE = 1000
// const TILE_SIZE = 10
const TILE_SIZE = 10
const CANVAS_SIZE = MAP_SIZE / TILE_SIZE
const DOWNLOADED_IMAGE_SIZE = 400
main()

/**
 * @typedef {
 * {avg: {R: number, G: number, B: number, A: number},
 * frame: {"minX":number,"minY":number,"maxX":number,"maxY":number},
 * name: string}} ProcessedImage
 */
async function main () {
  // const img = processed[0]
  const img = {"avg":{"R":90,"G":85,"B":70,"A":0},"frame":{"minX":0,"minY":40,"maxX":400,"maxY":440},"name":"https://www.artic.edu/iiif/2/0c8fb799-31bb-fb44-b863-080a614966f1/full/400,/0/default.jpg"}
  const placeholderCanvas = document.createElement('canvas')
  const context = placeholderCanvas.getContext('2d')

  placeholderCanvas.height = CANVAS_SIZE
  placeholderCanvas.width = CANVAS_SIZE
  await new Promise(function (resolve, reject) {
    const baseImage = new window.Image()
    // baseImage.src = `scrape/downloaded/${img.name.replace(/\//g, '_')}`
    baseImage.src = 'a.jpg'
    baseImage.crossOrigin = 'Anonymous'
    baseImage.onload = function () {
      context.drawImage(baseImage, img.frame.minX, img.frame.minY, img.frame.maxX - img.frame.minX, img.frame.maxY - img.frame.minY, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
      resolve()
    }
  })

  document.body.appendChild(placeholderCanvas)
  document.getElementById(LOADING_CONTENT).remove()
  const map = L.map(MOSAIC_ID, {
    minZoom: -2,
    maxZoom: 20,
    zoomControl: false,
    crs: L.CRS.Simple
  })
  map.setView([0, 0], 4)
  const i = 0
  const imageData = context.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  const xMin = map.getCenter().lng - CANVAS_SIZE / 2
  const yMin = map.getCenter().lat - CANVAS_SIZE / 2
  const BaseContextLayer = L.GridLayer.extend({
    createTile: function (coords) {
      // return debugCoords(coords)
      const tile = L.DomUtil.create('img', `leaflet-tile tile-${coords.x}-${coords.y}`)
      const baseCoord = (coords.x - xMin + (coords.y - yMin) * CANVAS_SIZE) * 4
      const r = imageData.data[baseCoord]
      const g = imageData.data[baseCoord + 1]
      const b = imageData.data[baseCoord + 2]
      const minImage = findMin(r, g, b)
      tile.src = minImage.name.replace('full/400', `full/${TILE_SIZE}`)
/*
      const size = this.getTileSize()
      // console.log(i++, coords.x, coords.y)
      tile.width = size.x
      tile.height = size.y
      const ctx = tile.getContext('2d')
      ctx.fillStyle = getRandomColor()
      ctx.fillRect(0, 0, size.x, size.y)
*/
      return tile
    }
  })
  const BaseUrlLayer = L.TileLayer.extend({
    getTileUrl: function (coords) {
    }
  })
  const layer = new (BaseContextLayer)({
    tileSize: TILE_SIZE,
    zoom: 0
  })
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
 * @returns ProcessedImage
 */
function findMin (r, g, b) {
  let minDistance = Infinity
  let minPicture
  for (const processedImage of processed) {
    const distance = (processedImage.avg.R - r) ** 2 + (processedImage.avg.G - g) ** 2 + (processedImage.avg.B - b) ** 2
    if (distance < minDistance) {
      minPicture = processedImage
      minDistance = distance
    }
  }
  return minPicture
}

function debugCoords (coords) {
  var tile = document.createElement('div')
  tile.innerHTML = [coords.x, coords.y, coords.z].join(', ')
  tile.style.outline = '1px solid red'
  return tile
}
