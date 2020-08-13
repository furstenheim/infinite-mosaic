const puppeteer = require('puppeteer')
const scrollPageToBottom = require('puppeteer-autoscroll-down')
const path = require('path')
const { promises: fs } = require('fs')
const urls = []
main()
  .then(async function (s) {
    console.log(s)
    await fs.writeFile('imgs.json', JSON.stringify(urls, null, 2))
    process.exit(0)
  }, async function (e) {
    console.error(e)
    await fs.writeFile('imgs.json', JSON.stringify(urls, null, 2))
    process.exit(1)
  })

async function main () {
  for (let i = 40; i < 80; i++) {
    await download(i)
    wait(400)
  }
}
async function download (i) {
  console.log('Starting', i)
  const browser = await puppeteer.launch({headless: false})
  const page = await browser.newPage()
  await page.setRequestInterception(true)
  await page.on('request', function (request) {
    if (request.url().match('(https://hello.myfonts.net/count/3545d5)|hotjar|facebook')) {
      request.abort()
    } else {
      request.continue()
    }
  })
  await page.on('response', async function (response) {
    try {
      const status = response.status()
      if ((status >= 300) && (status <= 399)) {
        return
      }
      const url = response.url()
      if (url.match(/defaut.jpg$/)) {
        urls.push(url)
      }

      // Filter those responses that are interesting
      if (url.match(/400.*default.jpg$/)) {
        console.log('Matching image', url)
        const data = await response.buffer()
        await fs.writeFile(path.join('downloaded', url.replace(/\/| |\\/g, '_')), data)
      }
      // data contains the img information
    } catch (e) {
      console.log(response)
      console.error('Could not fetch response', e)
    }
  })

  await page.goto(getURL(i))
  await scrollPageToBottom(page)

  wait(40000)
  browser.close()
  console.log('....')
}

function getURL (i) {
  return `https://www.artic.edu/collection?is_public_domain=1&page=${i}`
}
const wait = (amount = 0) => new Promise(resolve => setTimeout(resolve, amount));

