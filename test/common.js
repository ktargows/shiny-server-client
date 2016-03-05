const util = require("../lib/util");
const WebSocket = require("../lib/websocket");

const message_utils = require("../common/message-utils");

// A mock connection factory. It lets you test connection
// factory decorators by standing in for a connection
// factory and letting you later retrieve the URL that
// the factory was invoked with, or values sent.
exports.createConnFactoryMock = createConnFactoryMock;
function createConnFactoryMock(robust) {
  let conn = null;
  let self = {
    factory: function(url, ctx, callback) {
      conn = new MockConnection(this, url, ctx, true, robust);
      self.onConnCreate(conn);
      setTimeout(function() {
        callback(null, conn);
      }, 0);
    },
    getConn: function() {
      return conn
    },
    // User-overrideable callback
    onConnCreate: function(conn) {}
  };
  return self;
}

function MockConnection(parent, url, ctx, open, robust) {
  this._parent = parent;
  this.url = url;
  this.ctx = ctx;
  this.robust = robust;
  this.sendContinue = false;
  this.log = [];
  this.onopen = this.onclose = this.onmessage = this.onerror = function() {};
  this.readyState = WebSocket.CONNECTING;

  if (open) {
    setTimeout(_ => {
      if (this.readyState === WebSocket.CONNECTING) {
        this.readyState = WebSocket.OPEN;
        this.onopen(util.createEvent("open"));
        if (this.robust && this.sendContinue) {
          this.onmessage({
            data: "CONTINUE " + (this._parent.nextId || 0).toString(16).toUpperCase()
          });
        }
      }
    }, 10);
  }
}

MockConnection.prototype.send = function(data) {
  if (this.robust) {
    let cont = message_utils.parseCONTINUE(data) !== null;
    let ack = message_utils.parseACK(data) !== null;
    let msg = message_utils.parseTag(data);

    if (!cont && !ack && !msg) {
      throw new Error("Message was not robustified: " + data);
    }
    if (msg)
      this._parent.nextId = msg.id + 1;
  }
  this.log.push({type: "send", data: data});
};
MockConnection.prototype.close = function(code, reason, wasClean) {
  this.log.push({type: "close", data: {code: code, reason: reason, wasClean: wasClean}});
  this.readyState = WebSocket.CLOSED;
  this.onclose({
    code: code,
    reason: reason,
    wasClean: wasClean
  });
};
