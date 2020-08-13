import './main.scss'
import L from 'leaflet'
const MOSAIC_ID = 'mosaic-holder'
const LOADING_CONTENT = 'loading-content'
console.log('hello world 2')
main()
function main () {
  document.getElementById(LOADING_CONTENT).remove()
  const map = L.map(MOSAIC_ID, {
    minZoom: -2,
    maxZoom: 20
  })
  map.setView([0, 0], 11)
  const layer = new (L.GridLayer.extend({
    createTile: function (coords, done) {
      const tile = L.DomUtil.create('canvas', 'leaflet-tile')
      const size = this.getTileSize()
      tile.width = size.x
      tile.height = size.y
      const ctx = tile.getContext('2d')
      ctx.fillStyle = getRandomColor()
      ctx.fillRect(0, 0, size.x, size.y)
      return tile
    }
  }))({
    tileSize: 4 **2
  })
  layer.addTo(map)
}

function getRandomColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
