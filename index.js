#! /usr/bin/env node

const launcher = require('james-browser-launcher')
const argv = require('yargs').argv
const CDP = require('chrome-remote-interface')
const sleep = require('system-sleep')

const ttiPolyfill = require('./tti-polyfill')

let urls, runs, target, chrome, headless, autostart, profile
let Page, Console, Network, client

let times = {}
let i = 0
let j = 0
let currentUrl = ''
let currentProfile = ''

const die = (m, code) => {
  try {
    Page.navigate({ url: 'https://google.se' })
    client.close()
  } catch (e) { }

  if (m.code === 'ECONNREFUSED' && m.port === parseInt(chrome)) {
    console.log('  Chrome is unreachable. Is it started ?\n')
    console.log(m)
    return process.exit(1)
  }

  console.log(m)
  process.exit(m.message ? 1 : code)
}

const log = (m) => (argv.v || argv.debug) && console.log(m)

function hitChrome (c) {
  client = c
  Page = client.Page
  Console = client.Console
  Network = client.Network

  function goToNextPage () {
    Network.setCacheDisabled({ cacheDisabled: true })
    Network.setBypassServiceWorker({ bypass: true })
    Network.emulateNetworkConditions(networkProfiles[currentProfile])
    log(`  + Browsing ${currentUrl}, profile: ${currentProfile}`)
    Page.navigate({ url: currentUrl })
  }

  function done () {
    urls.forEach(url => {
      if (profile === '3gDsl') {
        times[url]['3g'] = times[url]['3g'].reduce((x, y) => x + y) / runs
        times[url].dsl = times[url].dsl.reduce((x, y) => x + y) / runs
      } else {
        times[url][currentProfile] = times[url][currentProfile].reduce((x, y) => x + y) / runs
      }
    })

    console.log('\n----------------#  Average TTI  #----------------')
    console.log(JSON.stringify(times, 0, 2))
    console.log('---------------------------------------------------')

    die('', 0)
  }

  // 3 steps needed: cf https://github.com/GoogleChrome/tti-polyfill
  Page.addScriptToEvaluateOnNewDocument({
    source: ttiPolyfill.longtaskObserver
  })

  Page.addScriptToEvaluateOnNewDocument({
    source: ttiPolyfill.mainPolyfill
  })

  Page.addScriptToEvaluateOnNewDocument({
    source: `ttiPolyfill.getFirstConsistentlyInteractive().then((e) => console.log('TTI: ' + e))`
  })

  Console.messageAdded(m => {
    // console.log(m.message.text)
    if (!m.message.text.includes('TTI: ')) {
      return
    }

    const tti = parseInt(m.message.text.replace('TTI: ', ''))
    log('   > Measured tti: ' + tti)

    if (tti >= parseInt(target)) {
      return die(`\n  ❌ Error: TTI Over target. Measured ${tti}, target tti is ${target}\n`, 1)
    }

    times[currentUrl][currentProfile].push(tti)
    i += 1

    if (i === runs) {
      i = 0
      if (profile === '3gDsl' && currentProfile === '3g') {
        currentProfile = 'dsl'
        return goToNextPage()
      } else if (profile === '3gDsl' && currentProfile === 'dsl') {
        currentProfile = '3g'
      }

      j += 1
      if (urls[j]) {
        currentUrl = urls[j]
        goToNextPage()
      } else {
        done()
      }
    } else {
      goToNextPage()
    }
  })

  Promise.all([Page.enable(), Console.enable(), Network.enable()]).then(() => {
    console.log('  Chrome connected \n')
    goToNextPage()
  }).catch(die)
}

const networkProfiles = {
  '3g': {
    offline: false,
    latency: 100,
    downloadThroughput: 800*1024,
    uploadThroughput: 100*1024,
  },
  dsl: {
    offline: false,
    latency: 30,
    downloadThroughput: 1*1024*1024,
    uploadThroughput: 150*1024,
  },
  uncap: {
    offline: false,
    latency: -1,
    downloadThroughput: -1,
    uploadThroughput: -1,
  }
}

console.log('\n🚀🚀 tti-measure 🚀🚀\n')

const help = `  Automated, headless-able time-to-interactive measurement

  E.g.: tti-measure -u "https://greta.io" -u "http://127.0.0.1:9999/test.html"

  -u, --url       Compulsory arg    Urls to run the script on. Pass multiple -u to test multiple urls
  -r, --runs      Default: 2        Number of runs per page
  -t, --target    Default: 5000     Retuns non-zero if a test fails to load within the target time (ms)
  -a, --autostart Default: true     Autostart chrome
  --headless      Default: false    Should chrome run headless
  -cp,            Default: 9222     Chrome remote debug port
  -v, --debug     Default: false    Log verbosity
  -p, --profile   Default: 3gDsl    Network profile. '3gDsl' runs the tests on 3g and on dsl.

  Valid network profiles ['${Object.keys(networkProfiles).join("', '")}', '3gDsl']\n`

urls = argv.u || argv.url
urls = typeof urls === 'string' ? [urls] : urls
target  = argv.t || argv.target  || 5000
chrome  = argv.c || argv.chrome  || 9222
profile = argv.p || argv.profile || '3gDsl'
runs    = argv.r || argv.runs    || 2
headless = argv.headless === 'true' || !!argv.headless
autostart = (argv.a || argv.autostart) === 'false' ? false : true

if (argv.h || argv.help) {
  die(help, 0)
} else if (!urls) {
  die('  ❌ Error: Need some pages to test\n\n' + help, 1)
} else if (profile && profile !== '3gDsl' && !Object.keys(networkProfiles).includes(profile)) {
  die('  ❌ Error: Invalid profile\n\n' + help, 1)
} else if (urls.find(url => !url.includes('http'))) {
  die('  ❌ Error: Please enter full url (including http(s)://)\n\n' + help, 1)
}

if (profile === '3gDsl') {
  urls.forEach(url => { times[url] = { '3g': [], dsl: [] } })
} else {
  urls.forEach(url => {
    times[url] = {}
    times[url][profile] = []
  })
}

currentProfile = profile === '3gDsl' ? '3g' : profile
currentUrl = urls[0]

if (!autostart) {
  CDP(hitChrome).on('error', die)
}

launcher((err, launch) => {
  if (err) return die(err)

  const opts = {
    browser: 'chrome',
    options: ['--remote-debugging-port=9222']
  }

  if (headless) {
    console.log(`
    Note that network profiles are currently not working in headless
    Cf https://bugs.chromium.org/p/chromium/issues/detail?id=728451
    `)
    opts.options.push('--headless')
    opts.options.push('--disable-gpu')
  }

  launch('https://greta.io', opts, function (err, ps) {
    if (err) die(err)
    sleep(5000)
    CDP(hitChrome).on('error', die)
  })
})
