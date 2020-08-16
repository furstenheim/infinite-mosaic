import './main.scss'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import processed from './process/output.json'
import 'regenerator-runtime/runtime'

const MOSAIC_ID = 'mosaic-holder'
const LOADING_CONTENT = 'loading-content'
const MAP_SIZE = 1000
const TILE_SIZE = 100
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
  /**
   *
   * @type ProcessedImage
   */

  const img = processed[0]
  const placeholderCanvas = document.createElement('canvas')
  const context = placeholderCanvas.getContext('2d')

  placeholderCanvas.height = CANVAS_SIZE
  placeholderCanvas.width = CANVAS_SIZE
  await new Promise(function (resolve, reject) {
    const baseImage = new window.Image()
    baseImage.src = img.name
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
  let i = 0
  const layer = new (L.GridLayer.extend({
    createTile: function (coords) {
      const tile = L.DomUtil.create('canvas', `leaflet-tile tile-${coords.x}-${coords.y}`)
      const size = this.getTileSize()
      console.log(i++, coords.x, coords.y)
      tile.width = size.x
      tile.height = size.y
      const ctx = tile.getContext('2d')
      ctx.fillStyle = getRandomColor()
      ctx.fillRect(0, 0, size.x, size.y)
      return tile
    }
  }))({
    tileSize: TILE_SIZE,
    zoom: 0
  })
  layer.addTo(map)
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
