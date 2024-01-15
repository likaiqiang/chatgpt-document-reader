import EventEmitter from 'events'
import { print } from './utils.js'

const stopActions = ['clearSelection', 'keepSelection', 'activateSelection']
const wcs = Symbol('webContents')
const opts = Symbol('options')
const requestId = Symbol('requestId')
const activeMatch = Symbol('activeMatch')
const matches = Symbol('matches')
const initd = Symbol('initd')
const preText = Symbol('preText')

class Find extends EventEmitter {
  constructor ({findInPage, stopFindInPage, on}, options = {}) {
    super()
    this[opts] = options
    this[wcs] = {
      findInPage,
      stopFindInPage,
      on
    }
    this[requestId] = null
    this[activeMatch] = 0
    this[matches] = 0
    this[initd] = false
    this[preText] = ''
  }
  async initFind () {
    if (this[initd]) return false
    if (isWebContents.call(this)) {
      await bindFound.call(this)
      return this[initd] = true
    } else {
      throw new Error('[Find] In need of a valid webContents !')
    }
  }
  destroyFind () {
    this[wcs] = null
    this[opts]  = null
    this[requestId] = null
    this[activeMatch] = 0
    this[matches] = 0
    this[initd] = false
    this[preText] = ''
  }
  isFinding () {
    return !!this[requestId]
  }
  async startFind (text = '', forward = true, matchCase = false) {
    if (!text) return
    this[activeMatch] = 0
    this[matches] = 0
    this[preText] = text
    this[requestId] = await this[wcs].findInPage({
      text: this[preText],
      options: {
        forward,
        matchCase
      }
    })
    print(`[Find] startFind text=${text} forward=${forward} matchCase=${matchCase}`)
  }
  async findNext (forward, matchCase = false) {
    if (!this.isFinding()) throw new Error('Finding did not start yet !')
    this[requestId] = await this[wcs].findInPage({
      text: this[preText],
      options: {
        forward,
        matchCase,
        findNext: true
      }
    })
    print(`[Find] findNext text=${this[preText]} forward=${forward} matchCase=${matchCase}`)
  }
 async stopFind (action) {
    stopActions.includes(action) ? '' : action = 'clearSelection'
    await this[wcs].stopFindInPage({
      action
    })
    print(`[Find] stopFind action=${action}`)
  }
}
function isWebContents () {
  return (this[wcs] &&
    typeof this[wcs].findInPage === 'function' &&
    typeof this[wcs].stopFindInPage === 'function')
}
async function bindFound () {
  const r =  await this[wcs].on({
    event: 'found-in-page'
  })
  onFoundInPage.call(this, r)
}
function onFoundInPage (result) {
  print('[Find] onFoundInPage, ', result)
  if (this[requestId] !== result.requestId) return
  typeof result.activeMatchOrdinal === 'number' ? this[activeMatch] = result.activeMatchOrdinal : ''
  typeof result.matches === 'number' ? this[matches] = result.matches : ''
  result.finalUpdate ? reportResult.call(this) : ''
}
function reportResult () {
  this.emit('result', this[activeMatch], this[matches])
  typeof this[opts].onResult === 'function' ? this[opts].onResult(this[activeMatch], this[matches]) : ''
}

export default Find
