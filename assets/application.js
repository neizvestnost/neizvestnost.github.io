(()=>{
  var An = Object.defineProperty;
  var fe = (s,e)=>()=>(s && (e = s(s = 0)),
  e);
  var Di = (s,e)=>{
      for (var t in e)
          An(s, t, {
              get: e[t],
              enumerable: !0
          })
  }
  ;
  var Pe, Zt = fe(()=>{
      Pe = {
          logger: typeof console < "u" ? console : void 0,
          WebSocket: typeof WebSocket < "u" ? WebSocket : void 0
      }
  }
  );
  var G, Ze = fe(()=>{
      Zt();
      G = {
          log(...s) {
              this.enabled && (s.push(Date.now()),
              Pe.logger.log("[ActionCable]", ...s))
          }
      }
  }
  );
  var pt, Jt, mt, Qt, Si = fe(()=>{
      Ze();
      pt = ()=>new Date().getTime(),
      Jt = s=>(pt() - s) / 1e3,
      mt = class {
          constructor(e) {
              this.visibilityDidChange = this.visibilityDidChange.bind(this),
              this.connection = e,
              this.reconnectAttempts = 0
          }
          start() {
              this.isRunning() || (this.startedAt = pt(),
              delete this.stoppedAt,
              this.startPolling(),
              addEventListener("visibilitychange", this.visibilityDidChange),
              G.log(`ConnectionMonitor started. stale threshold = ${this.constructor.staleThreshold} s`))
          }
          stop() {
              this.isRunning() && (this.stoppedAt = pt(),
              this.stopPolling(),
              removeEventListener("visibilitychange", this.visibilityDidChange),
              G.log("ConnectionMonitor stopped"))
          }
          isRunning() {
              return this.startedAt && !this.stoppedAt
          }
          recordPing() {
              this.pingedAt = pt()
          }
          recordConnect() {
              this.reconnectAttempts = 0,
              this.recordPing(),
              delete this.disconnectedAt,
              G.log("ConnectionMonitor recorded connect")
          }
          recordDisconnect() {
              this.disconnectedAt = pt(),
              G.log("ConnectionMonitor recorded disconnect")
          }
          startPolling() {
              this.stopPolling(),
              this.poll()
          }
          stopPolling() {
              clearTimeout(this.pollTimeout)
          }
          poll() {
              this.pollTimeout = setTimeout(()=>{
                  this.reconnectIfStale(),
                  this.poll()
              }
              , this.getPollInterval())
          }
          getPollInterval() {
              let {staleThreshold: e, reconnectionBackoffRate: t} = this.constructor
                , i = Math.pow(1 + t, Math.min(this.reconnectAttempts, 10))
                , n = (this.reconnectAttempts === 0 ? 1 : t) * Math.random();
              return e * 1e3 * i * (1 + n)
          }
          reconnectIfStale() {
              this.connectionIsStale() && (G.log(`ConnectionMonitor detected stale connection. reconnectAttempts = ${this.reconnectAttempts}, time stale = ${Jt(this.refreshedAt)} s, stale threshold = ${this.constructor.staleThreshold} s`),
              this.reconnectAttempts++,
              this.disconnectedRecently() ? G.log(`ConnectionMonitor skipping reopening recent disconnect. time disconnected = ${Jt(this.disconnectedAt)} s`) : (G.log("ConnectionMonitor reopening"),
              this.connection.reopen()))
          }
          get refreshedAt() {
              return this.pingedAt ? this.pingedAt : this.startedAt
          }
          connectionIsStale() {
              return Jt(this.refreshedAt) > this.constructor.staleThreshold
          }
          disconnectedRecently() {
              return this.disconnectedAt && Jt(this.disconnectedAt) < this.constructor.staleThreshold
          }
          visibilityDidChange() {
              document.visibilityState === "visible" && setTimeout(()=>{
                  (this.connectionIsStale() || !this.connection.isOpen()) && (G.log(`ConnectionMonitor reopening stale connection on visibilitychange. visibilityState = ${document.visibilityState}`),
                  this.connection.reopen())
              }
              , 200)
          }
      }
      ;
      mt.staleThreshold = 6;
      mt.reconnectionBackoffRate = .15;
      Qt = mt
  }
  );
  var gt, Ei = fe(()=>{
      gt = {
          message_types: {
              welcome: "welcome",
              disconnect: "disconnect",
              ping: "ping",
              confirmation: "confirm_subscription",
              rejection: "reject_subscription"
          },
          disconnect_reasons: {
              unauthorized: "unauthorized",
              invalid_request: "invalid_request",
              server_restart: "server_restart",
              remote: "remote"
          },
          default_mount_path: "/cable",
          protocols: ["actioncable-v1-json", "actioncable-unsupported"]
      }
  }
  );
  var vt, Ti, Kl, bn, bt, es, xi = fe(()=>{
      Zt();
      Si();
      Ei();
      Ze();
      ({message_types: vt, protocols: Ti} = gt),
      Kl = Ti.slice(0, Ti.length - 1),
      bn = [].indexOf,
      bt = class {
          constructor(e) {
              this.open = this.open.bind(this),
              this.consumer = e,
              this.subscriptions = this.consumer.subscriptions,
              this.monitor = new Qt(this),
              this.disconnected = !0
          }
          send(e) {
              return this.isOpen() ? (this.webSocket.send(JSON.stringify(e)),
              !0) : !1
          }
          open() {
              if (this.isActive())
                  return G.log(`Attempted to open WebSocket, but existing socket is ${this.getState()}`),
                  !1;
              {
                  let e = [...Ti, ...this.consumer.subprotocols || []];
                  return G.log(`Opening WebSocket, current state is ${this.getState()}, subprotocols: ${e}`),
                  this.webSocket && this.uninstallEventHandlers(),
                  this.webSocket = new Pe.WebSocket(this.consumer.url,e),
                  this.installEventHandlers(),
                  this.monitor.start(),
                  !0
              }
          }
          close({allowReconnect: e}={
              allowReconnect: !0
          }) {
              if (e || this.monitor.stop(),
              this.isOpen())
                  return this.webSocket.close()
          }
          reopen() {
              if (G.log(`Reopening WebSocket, current state is ${this.getState()}`),
              this.isActive())
                  try {
                      return this.close()
                  } catch (e) {
                      G.log("Failed to reopen WebSocket", e)
                  } finally {
                      G.log(`Reopening WebSocket in ${this.constructor.reopenDelay}ms`),
                      setTimeout(this.open, this.constructor.reopenDelay)
                  }
              else
                  return this.open()
          }
          getProtocol() {
              if (this.webSocket)
                  return this.webSocket.protocol
          }
          isOpen() {
              return this.isState("open")
          }
          isActive() {
              return this.isState("open", "connecting")
          }
          triedToReconnect() {
              return this.monitor.reconnectAttempts > 0
          }
          isProtocolSupported() {
              return bn.call(Kl, this.getProtocol()) >= 0
          }
          isState(...e) {
              return bn.call(e, this.getState()) >= 0
          }
          getState() {
              if (this.webSocket) {
                  for (let e in Pe.WebSocket)
                      if (Pe.WebSocket[e] === this.webSocket.readyState)
                          return e.toLowerCase()
              }
              return null
          }
          installEventHandlers() {
              for (let e in this.events) {
                  let t = this.events[e].bind(this);
                  this.webSocket[`on${e}`] = t
              }
          }
          uninstallEventHandlers() {
              for (let e in this.events)
                  this.webSocket[`on${e}`] = function() {}
          }
      }
      ;
      bt.reopenDelay = 500;
      bt.prototype.events = {
          message(s) {
              if (!this.isProtocolSupported())
                  return;
              let {identifier: e, message: t, reason: i, reconnect: r, type: n} = JSON.parse(s.data);
              switch (n) {
              case vt.welcome:
                  return this.triedToReconnect() && (this.reconnectAttempted = !0),
                  this.monitor.recordConnect(),
                  this.subscriptions.reload();
              case vt.disconnect:
                  return G.log(`Disconnecting. Reason: ${i}`),
                  this.close({
                      allowReconnect: r
                  });
              case vt.ping:
                  return this.monitor.recordPing();
              case vt.confirmation:
                  return this.subscriptions.confirmSubscription(e),
                  this.reconnectAttempted ? (this.reconnectAttempted = !1,
                  this.subscriptions.notify(e, "connected", {
                      reconnected: !0
                  })) : this.subscriptions.notify(e, "connected", {
                      reconnected: !1
                  });
              case vt.rejection:
                  return this.subscriptions.reject(e);
              default:
                  return this.subscriptions.notify(e, "received", t)
              }
          },
          open() {
              if (G.log(`WebSocket onopen event, using '${this.getProtocol()}' subprotocol`),
              this.disconnected = !1,
              !this.isProtocolSupported())
                  return G.log("Protocol is unsupported. Stopping monitor and disconnecting."),
                  this.close({
                      allowReconnect: !1
                  })
          },
          close(s) {
              if (G.log("WebSocket onclose event"),
              !this.disconnected)
                  return this.disconnected = !0,
                  this.monitor.recordDisconnect(),
                  this.subscriptions.notifyAll("disconnected", {
                      willAttemptReconnect: this.monitor.isRunning()
                  })
          },
          error() {
              G.log("WebSocket onerror event")
          }
      };
      es = bt
  }
  );
  var Zl, $e, Mi = fe(()=>{
      Zl = function(s, e) {
          if (e != null)
              for (let t in e) {
                  let i = e[t];
                  s[t] = i
              }
          return s
      }
      ,
      $e = class {
          constructor(e, t={}, i) {
              this.consumer = e,
              this.identifier = JSON.stringify(t),
              Zl(this, i)
          }
          perform(e, t={}) {
              return t.action = e,
              this.send(t)
          }
          send(e) {
              return this.consumer.send({
                  command: "message",
                  identifier: this.identifier,
                  data: JSON.stringify(e)
              })
          }
          unsubscribe() {
              return this.consumer.subscriptions.remove(this)
          }
      }
  }
  );
  var Ci, ts, Ai = fe(()=>{
      Ze();
      Ci = class {
          constructor(e) {
              this.subscriptions = e,
              this.pendingSubscriptions = []
          }
          guarantee(e) {
              this.pendingSubscriptions.indexOf(e) == -1 ? (G.log(`SubscriptionGuarantor guaranteeing ${e.identifier}`),
              this.pendingSubscriptions.push(e)) : G.log(`SubscriptionGuarantor already guaranteeing ${e.identifier}`),
              this.startGuaranteeing()
          }
          forget(e) {
              G.log(`SubscriptionGuarantor forgetting ${e.identifier}`),
              this.pendingSubscriptions = this.pendingSubscriptions.filter(t=>t !== e)
          }
          startGuaranteeing() {
              this.stopGuaranteeing(),
              this.retrySubscribing()
          }
          stopGuaranteeing() {
              clearTimeout(this.retryTimeout)
          }
          retrySubscribing() {
              this.retryTimeout = setTimeout(()=>{
                  this.subscriptions && typeof this.subscriptions.subscribe == "function" && this.pendingSubscriptions.map(e=>{
                      G.log(`SubscriptionGuarantor resubscribing ${e.identifier}`),
                      this.subscriptions.subscribe(e)
                  }
                  )
              }
              , 500)
          }
      }
      ,
      ts = Ci
  }
  );
  var Ve, Li = fe(()=>{
      Mi();
      Ai();
      Ze();
      Ve = class {
          constructor(e) {
              this.consumer = e,
              this.guarantor = new ts(this),
              this.subscriptions = []
          }
          create(e, t) {
              let i = e
                , r = typeof i == "object" ? i : {
                  channel: i
              }
                , n = new $e(this.consumer,r,t);
              return this.add(n)
          }
          add(e) {
              return this.subscriptions.push(e),
              this.consumer.ensureActiveConnection(),
              this.notify(e, "initialized"),
              this.subscribe(e),
              e
          }
          remove(e) {
              return this.forget(e),
              this.findAll(e.identifier).length || this.sendCommand(e, "unsubscribe"),
              e
          }
          reject(e) {
              return this.findAll(e).map(t=>(this.forget(t),
              this.notify(t, "rejected"),
              t))
          }
          forget(e) {
              return this.guarantor.forget(e),
              this.subscriptions = this.subscriptions.filter(t=>t !== e),
              e
          }
          findAll(e) {
              return this.subscriptions.filter(t=>t.identifier === e)
          }
          reload() {
              return this.subscriptions.map(e=>this.subscribe(e))
          }
          notifyAll(e, ...t) {
              return this.subscriptions.map(i=>this.notify(i, e, ...t))
          }
          notify(e, t, ...i) {
              let r;
              return typeof e == "string" ? r = this.findAll(e) : r = [e],
              r.map(n=>typeof n[t] == "function" ? n[t](...i) : void 0)
          }
          subscribe(e) {
              this.sendCommand(e, "subscribe") && this.guarantor.guarantee(e)
          }
          confirmSubscription(e) {
              G.log(`Subscription confirmed ${e}`),
              this.findAll(e).map(t=>this.guarantor.forget(t))
          }
          sendCommand(e, t) {
              let {identifier: i} = e;
              return this.consumer.send({
                  command: t,
                  identifier: i
              })
          }
      }
  }
  );
  function Pi(s) {
      if (typeof s == "function" && (s = s()),
      s && !/^wss?:/i.test(s)) {
          let e = document.createElement("a");
          return e.href = s,
          e.href = e.href,
          e.protocol = e.protocol.replace("http", "ws"),
          e.href
      } else
          return s
  }
  var Je, wn = fe(()=>{
      xi();
      Li();
      Je = class {
          constructor(e) {
              this._url = e,
              this.subscriptions = new Ve(this),
              this.connection = new es(this),
              this.subprotocols = []
          }
          get url() {
              return Pi(this._url)
          }
          send(e) {
              return this.connection.send(e)
          }
          connect() {
              return this.connection.open()
          }
          disconnect() {
              return this.connection.close({
                  allowReconnect: !1
              })
          }
          ensureActiveConnection() {
              if (!this.connection.isActive())
                  return this.connection.open()
          }
          addSubProtocol(e) {
              this.subprotocols = [...this.subprotocols, e]
          }
      }
  }
  );
  var Sn = {};
  Di(Sn, {
      Connection: ()=>es,
      ConnectionMonitor: ()=>Qt,
      Consumer: ()=>Je,
      INTERNAL: ()=>gt,
      Subscription: ()=>$e,
      SubscriptionGuarantor: ()=>ts,
      Subscriptions: ()=>Ve,
      adapters: ()=>Pe,
      createConsumer: ()=>Jl,
      createWebSocketURL: ()=>Pi,
      getConfig: ()=>yn,
      logger: ()=>G
  });
  function Jl(s=yn("url") || gt.default_mount_path) {
      return new Je(s)
  }
  function yn(s) {
      let e = document.head.querySelector(`meta[name='action-cable-${s}']`);
      if (e)
          return e.getAttribute("content")
  }
  var En = fe(()=>{
      xi();
      Si();
      wn();
      Ei();
      Mi();
      Li();
      Ai();
      Zt();
      Ze()
  }
  );
  var as = class {
      constructor(e, t, i) {
          this.eventTarget = e,
          this.eventName = t,
          this.eventOptions = i,
          this.unorderedBindings = new Set
      }
      connect() {
          this.eventTarget.addEventListener(this.eventName, this, this.eventOptions)
      }
      disconnect() {
          this.eventTarget.removeEventListener(this.eventName, this, this.eventOptions)
      }
      bindingConnected(e) {
          this.unorderedBindings.add(e)
      }
      bindingDisconnected(e) {
          this.unorderedBindings.delete(e)
      }
      handleEvent(e) {
          let t = Ln(e);
          for (let i of this.bindings) {
              if (t.immediatePropagationStopped)
                  break;
              i.handleEvent(t)
          }
      }
      hasBindings() {
          return this.unorderedBindings.size > 0
      }
      get bindings() {
          return Array.from(this.unorderedBindings).sort((e,t)=>{
              let i = e.index
                , r = t.index;
              return i < r ? -1 : i > r ? 1 : 0
          }
          )
      }
  }
  ;
  function Ln(s) {
      if ("immediatePropagationStopped"in s)
          return s;
      {
          let {stopImmediatePropagation: e} = s;
          return Object.assign(s, {
              immediatePropagationStopped: !1,
              stopImmediatePropagation() {
                  this.immediatePropagationStopped = !0,
                  e.call(this)
              }
          })
      }
  }
  var os = class {
      constructor(e) {
          this.application = e,
          this.eventListenerMaps = new Map,
          this.started = !1
      }
      start() {
          this.started || (this.started = !0,
          this.eventListeners.forEach(e=>e.connect()))
      }
      stop() {
          this.started && (this.started = !1,
          this.eventListeners.forEach(e=>e.disconnect()))
      }
      get eventListeners() {
          return Array.from(this.eventListenerMaps.values()).reduce((e,t)=>e.concat(Array.from(t.values())), [])
      }
      bindingConnected(e) {
          this.fetchEventListenerForBinding(e).bindingConnected(e)
      }
      bindingDisconnected(e, t=!1) {
          this.fetchEventListenerForBinding(e).bindingDisconnected(e),
          t && this.clearEventListenersForBinding(e)
      }
      handleError(e, t, i={}) {
          this.application.handleError(e, `Error ${t}`, i)
      }
      clearEventListenersForBinding(e) {
          let t = this.fetchEventListenerForBinding(e);
          t.hasBindings() || (t.disconnect(),
          this.removeMappedEventListenerFor(e))
      }
      removeMappedEventListenerFor(e) {
          let {eventTarget: t, eventName: i, eventOptions: r} = e
            , n = this.fetchEventListenerMapForEventTarget(t)
            , o = this.cacheKey(i, r);
          n.delete(o),
          n.size == 0 && this.eventListenerMaps.delete(t)
      }
      fetchEventListenerForBinding(e) {
          let {eventTarget: t, eventName: i, eventOptions: r} = e;
          return this.fetchEventListener(t, i, r)
      }
      fetchEventListener(e, t, i) {
          let r = this.fetchEventListenerMapForEventTarget(e)
            , n = this.cacheKey(t, i)
            , o = r.get(n);
          return o || (o = this.createEventListener(e, t, i),
          r.set(n, o)),
          o
      }
      createEventListener(e, t, i) {
          let r = new as(e,t,i);
          return this.started && r.connect(),
          r
      }
      fetchEventListenerMapForEventTarget(e) {
          let t = this.eventListenerMaps.get(e);
          return t || (t = new Map,
          this.eventListenerMaps.set(e, t)),
          t
      }
      cacheKey(e, t) {
          let i = [e];
          return Object.keys(t).sort().forEach(r=>{
              i.push(`${t[r] ? "" : "!"}${r}`)
          }
          ),
          i.join(":")
      }
  }
    , Pn = {
      stop({event: s, value: e}) {
          return e && s.stopPropagation(),
          !0
      },
      prevent({event: s, value: e}) {
          return e && s.preventDefault(),
          !0
      },
      self({event: s, value: e, element: t}) {
          return e ? t === s.target : !0
      }
  }
    , In = /^(?:(?:([^.]+?)\+)?(.+?)(?:\.(.+?))?(?:@(window|document))?->)?(.+?)(?:#([^:]+?))(?::(.+))?$/;
  function On(s) {
      let t = s.trim().match(In) || []
        , i = t[2]
        , r = t[3];
      return r && !["keydown", "keyup", "keypress"].includes(i) && (i += `.${r}`,
      r = ""),
      {
          eventTarget: kn(t[4]),
          eventName: i,
          eventOptions: t[7] ? Rn(t[7]) : {},
          identifier: t[5],
          methodName: t[6],
          keyFilter: t[1] || r
      }
  }
  function kn(s) {
      if (s == "window")
          return window;
      if (s == "document")
          return document
  }
  function Rn(s) {
      return s.split(":").reduce((e,t)=>Object.assign(e, {
          [t.replace(/^!/, "")]: !/^!/.test(t)
      }), {})
  }
  function Dn(s) {
      if (s == window)
          return "window";
      if (s == document)
          return "document"
  }
  function Ps(s) {
      return s.replace(/(?:[_-])([a-z0-9])/g, (e,t)=>t.toUpperCase())
  }
  function ls(s) {
      return Ps(s.replace(/--/g, "-").replace(/__/g, "_"))
  }
  function st(s) {
      return s.charAt(0).toUpperCase() + s.slice(1)
  }
  function _i(s) {
      return s.replace(/([A-Z])/g, (e,t)=>`-${t.toLowerCase()}`)
  }
  function Fn(s) {
      return s.match(/[^\s]+/g) || []
  }
  function Fi(s) {
      return s != null
  }
  function cs(s, e) {
      return Object.prototype.hasOwnProperty.call(s, e)
  }
  var Bi = ["meta", "ctrl", "alt", "shift"]
    , ds = class {
      constructor(e, t, i, r) {
          this.element = e,
          this.index = t,
          this.eventTarget = i.eventTarget || e,
          this.eventName = i.eventName || Bn(e) || Tt("missing event name"),
          this.eventOptions = i.eventOptions || {},
          this.identifier = i.identifier || Tt("missing identifier"),
          this.methodName = i.methodName || Tt("missing method name"),
          this.keyFilter = i.keyFilter || "",
          this.schema = r
      }
      static forToken(e, t) {
          return new this(e.element,e.index,On(e.content),t)
      }
      toString() {
          let e = this.keyFilter ? `.${this.keyFilter}` : ""
            , t = this.eventTargetName ? `@${this.eventTargetName}` : "";
          return `${this.eventName}${e}${t}->${this.identifier}#${this.methodName}`
      }
      shouldIgnoreKeyboardEvent(e) {
          if (!this.keyFilter)
              return !1;
          let t = this.keyFilter.split("+");
          if (this.keyFilterDissatisfied(e, t))
              return !0;
          let i = t.filter(r=>!Bi.includes(r))[0];
          return i ? (cs(this.keyMappings, i) || Tt(`contains unknown key filter: ${this.keyFilter}`),
          this.keyMappings[i].toLowerCase() !== e.key.toLowerCase()) : !1
      }
      shouldIgnoreMouseEvent(e) {
          if (!this.keyFilter)
              return !1;
          let t = [this.keyFilter];
          return !!this.keyFilterDissatisfied(e, t)
      }
      get params() {
          let e = {}
            , t = new RegExp(`^data-${this.identifier}-(.+)-param$`,"i");
          for (let {name: i, value: r} of Array.from(this.element.attributes)) {
              let n = i.match(t)
                , o = n && n[1];
              o && (e[Ps(o)] = $n(r))
          }
          return e
      }
      get eventTargetName() {
          return Dn(this.eventTarget)
      }
      get keyMappings() {
          return this.schema.keyMappings
      }
      keyFilterDissatisfied(e, t) {
          let[i,r,n,o] = Bi.map(l=>t.includes(l));
          return e.metaKey !== i || e.ctrlKey !== r || e.altKey !== n || e.shiftKey !== o
      }
  }
    , $i = {
      a: ()=>"click",
      button: ()=>"click",
      form: ()=>"submit",
      details: ()=>"toggle",
      input: s=>s.getAttribute("type") == "submit" ? "click" : "input",
      select: ()=>"change",
      textarea: ()=>"input"
  };
  function Bn(s) {
      let e = s.tagName.toLowerCase();
      if (e in $i)
          return $i[e](s)
  }
  function Tt(s) {
      throw new Error(s)
  }
  function $n(s) {
      try {
          return JSON.parse(s)
      } catch {
          return s
      }
  }
  var us = class {
      constructor(e, t) {
          this.context = e,
          this.action = t
      }
      get index() {
          return this.action.index
      }
      get eventTarget() {
          return this.action.eventTarget
      }
      get eventOptions() {
          return this.action.eventOptions
      }
      get identifier() {
          return this.context.identifier
      }
      handleEvent(e) {
          let t = this.prepareActionEvent(e);
          this.willBeInvokedByEvent(e) && this.applyEventModifiers(t) && this.invokeWithEvent(t)
      }
      get eventName() {
          return this.action.eventName
      }
      get method() {
          let e = this.controller[this.methodName];
          if (typeof e == "function")
              return e;
          throw new Error(`Action "${this.action}" references undefined method "${this.methodName}"`)
      }
      applyEventModifiers(e) {
          let {element: t} = this.action
            , {actionDescriptorFilters: i} = this.context.application
            , {controller: r} = this.context
            , n = !0;
          for (let[o,l] of Object.entries(this.eventOptions))
              if (o in i) {
                  let a = i[o];
                  n = n && a({
                      name: o,
                      value: l,
                      event: e,
                      element: t,
                      controller: r
                  })
              } else
                  continue;
          return n
      }
      prepareActionEvent(e) {
          return Object.assign(e, {
              params: this.action.params
          })
      }
      invokeWithEvent(e) {
          let {target: t, currentTarget: i} = e;
          try {
              this.method.call(this.controller, e),
              this.context.logDebugActivity(this.methodName, {
                  event: e,
                  target: t,
                  currentTarget: i,
                  action: this.methodName
              })
          } catch (r) {
              let {identifier: n, controller: o, element: l, index: a} = this
                , h = {
                  identifier: n,
                  controller: o,
                  element: l,
                  index: a,
                  event: e
              };
              this.context.handleError(r, `invoking action "${this.action}"`, h)
          }
      }
      willBeInvokedByEvent(e) {
          let t = e.target;
          return e instanceof KeyboardEvent && this.action.shouldIgnoreKeyboardEvent(e) || e instanceof MouseEvent && this.action.shouldIgnoreMouseEvent(e) ? !1 : this.element === t ? !0 : t instanceof Element && this.element.contains(t) ? this.scope.containsElement(t) : this.scope.containsElement(this.action.element)
      }
      get controller() {
          return this.context.controller
      }
      get methodName() {
          return this.action.methodName
      }
      get element() {
          return this.scope.element
      }
      get scope() {
          return this.context.scope
      }
  }
    , xt = class {
      constructor(e, t) {
          this.mutationObserverInit = {
              attributes: !0,
              childList: !0,
              subtree: !0
          },
          this.element = e,
          this.started = !1,
          this.delegate = t,
          this.elements = new Set,
          this.mutationObserver = new MutationObserver(i=>this.processMutations(i))
      }
      start() {
          this.started || (this.started = !0,
          this.mutationObserver.observe(this.element, this.mutationObserverInit),
          this.refresh())
      }
      pause(e) {
          this.started && (this.mutationObserver.disconnect(),
          this.started = !1),
          e(),
          this.started || (this.mutationObserver.observe(this.element, this.mutationObserverInit),
          this.started = !0)
      }
      stop() {
          this.started && (this.mutationObserver.takeRecords(),
          this.mutationObserver.disconnect(),
          this.started = !1)
      }
      refresh() {
          if (this.started) {
              let e = new Set(this.matchElementsInTree());
              for (let t of Array.from(this.elements))
                  e.has(t) || this.removeElement(t);
              for (let t of Array.from(e))
                  this.addElement(t)
          }
      }
      processMutations(e) {
          if (this.started)
              for (let t of e)
                  this.processMutation(t)
      }
      processMutation(e) {
          e.type == "attributes" ? this.processAttributeChange(e.target, e.attributeName) : e.type == "childList" && (this.processRemovedNodes(e.removedNodes),
          this.processAddedNodes(e.addedNodes))
      }
      processAttributeChange(e, t) {
          this.elements.has(e) ? this.delegate.elementAttributeChanged && this.matchElement(e) ? this.delegate.elementAttributeChanged(e, t) : this.removeElement(e) : this.matchElement(e) && this.addElement(e)
      }
      processRemovedNodes(e) {
          for (let t of Array.from(e)) {
              let i = this.elementFromNode(t);
              i && this.processTree(i, this.removeElement)
          }
      }
      processAddedNodes(e) {
          for (let t of Array.from(e)) {
              let i = this.elementFromNode(t);
              i && this.elementIsActive(i) && this.processTree(i, this.addElement)
          }
      }
      matchElement(e) {
          return this.delegate.matchElement(e)
      }
      matchElementsInTree(e=this.element) {
          return this.delegate.matchElementsInTree(e)
      }
      processTree(e, t) {
          for (let i of this.matchElementsInTree(e))
              t.call(this, i)
      }
      elementFromNode(e) {
          if (e.nodeType == Node.ELEMENT_NODE)
              return e
      }
      elementIsActive(e) {
          return e.isConnected != this.element.isConnected ? !1 : this.element.contains(e)
      }
      addElement(e) {
          this.elements.has(e) || this.elementIsActive(e) && (this.elements.add(e),
          this.delegate.elementMatched && this.delegate.elementMatched(e))
      }
      removeElement(e) {
          this.elements.has(e) && (this.elements.delete(e),
          this.delegate.elementUnmatched && this.delegate.elementUnmatched(e))
      }
  }
    , Mt = class {
      constructor(e, t, i) {
          this.attributeName = t,
          this.delegate = i,
          this.elementObserver = new xt(e,this)
      }
      get element() {
          return this.elementObserver.element
      }
      get selector() {
          return `[${this.attributeName}]`
      }
      start() {
          this.elementObserver.start()
      }
      pause(e) {
          this.elementObserver.pause(e)
      }
      stop() {
          this.elementObserver.stop()
      }
      refresh() {
          this.elementObserver.refresh()
      }
      get started() {
          return this.elementObserver.started
      }
      matchElement(e) {
          return e.hasAttribute(this.attributeName)
      }
      matchElementsInTree(e) {
          let t = this.matchElement(e) ? [e] : []
            , i = Array.from(e.querySelectorAll(this.selector));
          return t.concat(i)
      }
      elementMatched(e) {
          this.delegate.elementMatchedAttribute && this.delegate.elementMatchedAttribute(e, this.attributeName)
      }
      elementUnmatched(e) {
          this.delegate.elementUnmatchedAttribute && this.delegate.elementUnmatchedAttribute(e, this.attributeName)
      }
      elementAttributeChanged(e, t) {
          this.delegate.elementAttributeValueChanged && this.attributeName == t && this.delegate.elementAttributeValueChanged(e, t)
      }
  }
  ;
  function Vn(s, e, t) {
      Gi(s, e).add(t)
  }
  function Nn(s, e, t) {
      Gi(s, e).delete(t),
      zn(s, e)
  }
  function Gi(s, e) {
      let t = s.get(e);
      return t || (t = new Set,
      s.set(e, t)),
      t
  }
  function zn(s, e) {
      let t = s.get(e);
      t != null && t.size == 0 && s.delete(e)
  }
  var ge = class {
      constructor() {
          this.valuesByKey = new Map
      }
      get keys() {
          return Array.from(this.valuesByKey.keys())
      }
      get values() {
          return Array.from(this.valuesByKey.values()).reduce((t,i)=>t.concat(Array.from(i)), [])
      }
      get size() {
          return Array.from(this.valuesByKey.values()).reduce((t,i)=>t + i.size, 0)
      }
      add(e, t) {
          Vn(this.valuesByKey, e, t)
      }
      delete(e, t) {
          Nn(this.valuesByKey, e, t)
      }
      has(e, t) {
          let i = this.valuesByKey.get(e);
          return i != null && i.has(t)
      }
      hasKey(e) {
          return this.valuesByKey.has(e)
      }
      hasValue(e) {
          return Array.from(this.valuesByKey.values()).some(i=>i.has(e))
      }
      getValuesForKey(e) {
          let t = this.valuesByKey.get(e);
          return t ? Array.from(t) : []
      }
      getKeysForValue(e) {
          return Array.from(this.valuesByKey).filter(([t,i])=>i.has(e)).map(([t,i])=>t)
      }
  }
  ;
  var hs = class {
      constructor(e, t, i, r) {
          this._selector = t,
          this.details = r,
          this.elementObserver = new xt(e,this),
          this.delegate = i,
          this.matchesByElement = new ge
      }
      get started() {
          return this.elementObserver.started
      }
      get selector() {
          return this._selector
      }
      set selector(e) {
          this._selector = e,
          this.refresh()
      }
      start() {
          this.elementObserver.start()
      }
      pause(e) {
          this.elementObserver.pause(e)
      }
      stop() {
          this.elementObserver.stop()
      }
      refresh() {
          this.elementObserver.refresh()
      }
      get element() {
          return this.elementObserver.element
      }
      matchElement(e) {
          let {selector: t} = this;
          if (t) {
              let i = e.matches(t);
              return this.delegate.selectorMatchElement ? i && this.delegate.selectorMatchElement(e, this.details) : i
          } else
              return !1
      }
      matchElementsInTree(e) {
          let {selector: t} = this;
          if (t) {
              let i = this.matchElement(e) ? [e] : []
                , r = Array.from(e.querySelectorAll(t)).filter(n=>this.matchElement(n));
              return i.concat(r)
          } else
              return []
      }
      elementMatched(e) {
          let {selector: t} = this;
          t && this.selectorMatched(e, t)
      }
      elementUnmatched(e) {
          let t = this.matchesByElement.getKeysForValue(e);
          for (let i of t)
              this.selectorUnmatched(e, i)
      }
      elementAttributeChanged(e, t) {
          let {selector: i} = this;
          if (i) {
              let r = this.matchElement(e)
                , n = this.matchesByElement.has(i, e);
              r && !n ? this.selectorMatched(e, i) : !r && n && this.selectorUnmatched(e, i)
          }
      }
      selectorMatched(e, t) {
          this.delegate.selectorMatched(e, t, this.details),
          this.matchesByElement.add(t, e)
      }
      selectorUnmatched(e, t) {
          this.delegate.selectorUnmatched(e, t, this.details),
          this.matchesByElement.delete(t, e)
      }
  }
    , fs = class {
      constructor(e, t) {
          this.element = e,
          this.delegate = t,
          this.started = !1,
          this.stringMap = new Map,
          this.mutationObserver = new MutationObserver(i=>this.processMutations(i))
      }
      start() {
          this.started || (this.started = !0,
          this.mutationObserver.observe(this.element, {
              attributes: !0,
              attributeOldValue: !0
          }),
          this.refresh())
      }
      stop() {
          this.started && (this.mutationObserver.takeRecords(),
          this.mutationObserver.disconnect(),
          this.started = !1)
      }
      refresh() {
          if (this.started)
              for (let e of this.knownAttributeNames)
                  this.refreshAttribute(e, null)
      }
      processMutations(e) {
          if (this.started)
              for (let t of e)
                  this.processMutation(t)
      }
      processMutation(e) {
          let t = e.attributeName;
          t && this.refreshAttribute(t, e.oldValue)
      }
      refreshAttribute(e, t) {
          let i = this.delegate.getStringMapKeyForAttribute(e);
          if (i != null) {
              this.stringMap.has(e) || this.stringMapKeyAdded(i, e);
              let r = this.element.getAttribute(e);
              if (this.stringMap.get(e) != r && this.stringMapValueChanged(r, i, t),
              r == null) {
                  let n = this.stringMap.get(e);
                  this.stringMap.delete(e),
                  n && this.stringMapKeyRemoved(i, e, n)
              } else
                  this.stringMap.set(e, r)
          }
      }
      stringMapKeyAdded(e, t) {
          this.delegate.stringMapKeyAdded && this.delegate.stringMapKeyAdded(e, t)
      }
      stringMapValueChanged(e, t, i) {
          this.delegate.stringMapValueChanged && this.delegate.stringMapValueChanged(e, t, i)
      }
      stringMapKeyRemoved(e, t, i) {
          this.delegate.stringMapKeyRemoved && this.delegate.stringMapKeyRemoved(e, t, i)
      }
      get knownAttributeNames() {
          return Array.from(new Set(this.currentAttributeNames.concat(this.recordedAttributeNames)))
      }
      get currentAttributeNames() {
          return Array.from(this.element.attributes).map(e=>e.name)
      }
      get recordedAttributeNames() {
          return Array.from(this.stringMap.keys())
      }
  }
    , Ct = class {
      constructor(e, t, i) {
          this.attributeObserver = new Mt(e,t,this),
          this.delegate = i,
          this.tokensByElement = new ge
      }
      get started() {
          return this.attributeObserver.started
      }
      start() {
          this.attributeObserver.start()
      }
      pause(e) {
          this.attributeObserver.pause(e)
      }
      stop() {
          this.attributeObserver.stop()
      }
      refresh() {
          this.attributeObserver.refresh()
      }
      get element() {
          return this.attributeObserver.element
      }
      get attributeName() {
          return this.attributeObserver.attributeName
      }
      elementMatchedAttribute(e) {
          this.tokensMatched(this.readTokensForElement(e))
      }
      elementAttributeValueChanged(e) {
          let[t,i] = this.refreshTokensForElement(e);
          this.tokensUnmatched(t),
          this.tokensMatched(i)
      }
      elementUnmatchedAttribute(e) {
          this.tokensUnmatched(this.tokensByElement.getValuesForKey(e))
      }
      tokensMatched(e) {
          e.forEach(t=>this.tokenMatched(t))
      }
      tokensUnmatched(e) {
          e.forEach(t=>this.tokenUnmatched(t))
      }
      tokenMatched(e) {
          this.delegate.tokenMatched(e),
          this.tokensByElement.add(e.element, e)
      }
      tokenUnmatched(e) {
          this.delegate.tokenUnmatched(e),
          this.tokensByElement.delete(e.element, e)
      }
      refreshTokensForElement(e) {
          let t = this.tokensByElement.getValuesForKey(e)
            , i = this.readTokensForElement(e)
            , r = qn(t, i).findIndex(([n,o])=>!Wn(n, o));
          return r == -1 ? [[], []] : [t.slice(r), i.slice(r)]
      }
      readTokensForElement(e) {
          let t = this.attributeName
            , i = e.getAttribute(t) || "";
          return Hn(i, e, t)
      }
  }
  ;
  function Hn(s, e, t) {
      return s.trim().split(/\s+/).filter(i=>i.length).map((i,r)=>({
          element: e,
          attributeName: t,
          content: i,
          index: r
      }))
  }
  function qn(s, e) {
      let t = Math.max(s.length, e.length);
      return Array.from({
          length: t
      }, (i,r)=>[s[r], e[r]])
  }
  function Wn(s, e) {
      return s && e && s.index == e.index && s.content == e.content
  }
  var At = class {
      constructor(e, t, i) {
          this.tokenListObserver = new Ct(e,t,this),
          this.delegate = i,
          this.parseResultsByToken = new WeakMap,
          this.valuesByTokenByElement = new WeakMap
      }
      get started() {
          return this.tokenListObserver.started
      }
      start() {
          this.tokenListObserver.start()
      }
      stop() {
          this.tokenListObserver.stop()
      }
      refresh() {
          this.tokenListObserver.refresh()
      }
      get element() {
          return this.tokenListObserver.element
      }
      get attributeName() {
          return this.tokenListObserver.attributeName
      }
      tokenMatched(e) {
          let {element: t} = e
            , {value: i} = this.fetchParseResultForToken(e);
          i && (this.fetchValuesByTokenForElement(t).set(e, i),
          this.delegate.elementMatchedValue(t, i))
      }
      tokenUnmatched(e) {
          let {element: t} = e
            , {value: i} = this.fetchParseResultForToken(e);
          i && (this.fetchValuesByTokenForElement(t).delete(e),
          this.delegate.elementUnmatchedValue(t, i))
      }
      fetchParseResultForToken(e) {
          let t = this.parseResultsByToken.get(e);
          return t || (t = this.parseToken(e),
          this.parseResultsByToken.set(e, t)),
          t
      }
      fetchValuesByTokenForElement(e) {
          let t = this.valuesByTokenByElement.get(e);
          return t || (t = new Map,
          this.valuesByTokenByElement.set(e, t)),
          t
      }
      parseToken(e) {
          try {
              return {
                  value: this.delegate.parseValueForToken(e)
              }
          } catch (t) {
              return {
                  error: t
              }
          }
      }
  }
    , ps = class {
      constructor(e, t) {
          this.context = e,
          this.delegate = t,
          this.bindingsByAction = new Map
      }
      start() {
          this.valueListObserver || (this.valueListObserver = new At(this.element,this.actionAttribute,this),
          this.valueListObserver.start())
      }
      stop() {
          this.valueListObserver && (this.valueListObserver.stop(),
          delete this.valueListObserver,
          this.disconnectAllActions())
      }
      get element() {
          return this.context.element
      }
      get identifier() {
          return this.context.identifier
      }
      get actionAttribute() {
          return this.schema.actionAttribute
      }
      get schema() {
          return this.context.schema
      }
      get bindings() {
          return Array.from(this.bindingsByAction.values())
      }
      connectAction(e) {
          let t = new us(this.context,e);
          this.bindingsByAction.set(e, t),
          this.delegate.bindingConnected(t)
      }
      disconnectAction(e) {
          let t = this.bindingsByAction.get(e);
          t && (this.bindingsByAction.delete(e),
          this.delegate.bindingDisconnected(t))
      }
      disconnectAllActions() {
          this.bindings.forEach(e=>this.delegate.bindingDisconnected(e, !0)),
          this.bindingsByAction.clear()
      }
      parseValueForToken(e) {
          let t = ds.forToken(e, this.schema);
          if (t.identifier == this.identifier)
              return t
      }
      elementMatchedValue(e, t) {
          this.connectAction(t)
      }
      elementUnmatchedValue(e, t) {
          this.disconnectAction(t)
      }
  }
    , ms = class {
      constructor(e, t) {
          this.context = e,
          this.receiver = t,
          this.stringMapObserver = new fs(this.element,this),
          this.valueDescriptorMap = this.controller.valueDescriptorMap
      }
      start() {
          this.stringMapObserver.start(),
          this.invokeChangedCallbacksForDefaultValues()
      }
      stop() {
          this.stringMapObserver.stop()
      }
      get element() {
          return this.context.element
      }
      get controller() {
          return this.context.controller
      }
      getStringMapKeyForAttribute(e) {
          if (e in this.valueDescriptorMap)
              return this.valueDescriptorMap[e].name
      }
      stringMapKeyAdded(e, t) {
          let i = this.valueDescriptorMap[t];
          this.hasValue(e) || this.invokeChangedCallback(e, i.writer(this.receiver[e]), i.writer(i.defaultValue))
      }
      stringMapValueChanged(e, t, i) {
          let r = this.valueDescriptorNameMap[t];
          e !== null && (i === null && (i = r.writer(r.defaultValue)),
          this.invokeChangedCallback(t, e, i))
      }
      stringMapKeyRemoved(e, t, i) {
          let r = this.valueDescriptorNameMap[e];
          this.hasValue(e) ? this.invokeChangedCallback(e, r.writer(this.receiver[e]), i) : this.invokeChangedCallback(e, r.writer(r.defaultValue), i)
      }
      invokeChangedCallbacksForDefaultValues() {
          for (let {key: e, name: t, defaultValue: i, writer: r} of this.valueDescriptors)
              i != null && !this.controller.data.has(e) && this.invokeChangedCallback(t, r(i), void 0)
      }
      invokeChangedCallback(e, t, i) {
          let r = `${e}Changed`
            , n = this.receiver[r];
          if (typeof n == "function") {
              let o = this.valueDescriptorNameMap[e];
              try {
                  let l = o.reader(t)
                    , a = i;
                  i && (a = o.reader(i)),
                  n.call(this.receiver, l, a)
              } catch (l) {
                  throw l instanceof TypeError && (l.message = `Stimulus Value "${this.context.identifier}.${o.name}" - ${l.message}`),
                  l
              }
          }
      }
      get valueDescriptors() {
          let {valueDescriptorMap: e} = this;
          return Object.keys(e).map(t=>e[t])
      }
      get valueDescriptorNameMap() {
          let e = {};
          return Object.keys(this.valueDescriptorMap).forEach(t=>{
              let i = this.valueDescriptorMap[t];
              e[i.name] = i
          }
          ),
          e
      }
      hasValue(e) {
          let t = this.valueDescriptorNameMap[e]
            , i = `has${st(t.name)}`;
          return this.receiver[i]
      }
  }
    , gs = class {
      constructor(e, t) {
          this.context = e,
          this.delegate = t,
          this.targetsByName = new ge
      }
      start() {
          this.tokenListObserver || (this.tokenListObserver = new Ct(this.element,this.attributeName,this),
          this.tokenListObserver.start())
      }
      stop() {
          this.tokenListObserver && (this.disconnectAllTargets(),
          this.tokenListObserver.stop(),
          delete this.tokenListObserver)
      }
      tokenMatched({element: e, content: t}) {
          this.scope.containsElement(e) && this.connectTarget(e, t)
      }
      tokenUnmatched({element: e, content: t}) {
          this.disconnectTarget(e, t)
      }
      connectTarget(e, t) {
          var i;
          this.targetsByName.has(t, e) || (this.targetsByName.add(t, e),
          (i = this.tokenListObserver) === null || i === void 0 || i.pause(()=>this.delegate.targetConnected(e, t)))
      }
      disconnectTarget(e, t) {
          var i;
          this.targetsByName.has(t, e) && (this.targetsByName.delete(t, e),
          (i = this.tokenListObserver) === null || i === void 0 || i.pause(()=>this.delegate.targetDisconnected(e, t)))
      }
      disconnectAllTargets() {
          for (let e of this.targetsByName.keys)
              for (let t of this.targetsByName.getValuesForKey(e))
                  this.disconnectTarget(t, e)
      }
      get attributeName() {
          return `data-${this.context.identifier}-target`
      }
      get element() {
          return this.context.element
      }
      get scope() {
          return this.context.scope
      }
  }
  ;
  function it(s, e) {
      let t = ji(s);
      return Array.from(t.reduce((i,r)=>(Gn(r, e).forEach(n=>i.add(n)),
      i), new Set))
  }
  function _n(s, e) {
      return ji(s).reduce((i,r)=>(i.push(...jn(r, e)),
      i), [])
  }
  function ji(s) {
      let e = [];
      for (; s; )
          e.push(s),
          s = Object.getPrototypeOf(s);
      return e.reverse()
  }
  function Gn(s, e) {
      let t = s[e];
      return Array.isArray(t) ? t : []
  }
  function jn(s, e) {
      let t = s[e];
      return t ? Object.keys(t).map(i=>[i, t[i]]) : []
  }
  var vs = class {
      constructor(e, t) {
          this.started = !1,
          this.context = e,
          this.delegate = t,
          this.outletsByName = new ge,
          this.outletElementsByName = new ge,
          this.selectorObserverMap = new Map,
          this.attributeObserverMap = new Map
      }
      start() {
          this.started || (this.outletDefinitions.forEach(e=>{
              this.setupSelectorObserverForOutlet(e),
              this.setupAttributeObserverForOutlet(e)
          }
          ),
          this.started = !0,
          this.dependentContexts.forEach(e=>e.refresh()))
      }
      refresh() {
          this.selectorObserverMap.forEach(e=>e.refresh()),
          this.attributeObserverMap.forEach(e=>e.refresh())
      }
      stop() {
          this.started && (this.started = !1,
          this.disconnectAllOutlets(),
          this.stopSelectorObservers(),
          this.stopAttributeObservers())
      }
      stopSelectorObservers() {
          this.selectorObserverMap.size > 0 && (this.selectorObserverMap.forEach(e=>e.stop()),
          this.selectorObserverMap.clear())
      }
      stopAttributeObservers() {
          this.attributeObserverMap.size > 0 && (this.attributeObserverMap.forEach(e=>e.stop()),
          this.attributeObserverMap.clear())
      }
      selectorMatched(e, t, {outletName: i}) {
          let r = this.getOutlet(e, i);
          r && this.connectOutlet(r, e, i)
      }
      selectorUnmatched(e, t, {outletName: i}) {
          let r = this.getOutletFromMap(e, i);
          r && this.disconnectOutlet(r, e, i)
      }
      selectorMatchElement(e, {outletName: t}) {
          let i = this.selector(t)
            , r = this.hasOutlet(e, t)
            , n = e.matches(`[${this.schema.controllerAttribute}~=${t}]`);
          return i ? r && n && e.matches(i) : !1
      }
      elementMatchedAttribute(e, t) {
          let i = this.getOutletNameFromOutletAttributeName(t);
          i && this.updateSelectorObserverForOutlet(i)
      }
      elementAttributeValueChanged(e, t) {
          let i = this.getOutletNameFromOutletAttributeName(t);
          i && this.updateSelectorObserverForOutlet(i)
      }
      elementUnmatchedAttribute(e, t) {
          let i = this.getOutletNameFromOutletAttributeName(t);
          i && this.updateSelectorObserverForOutlet(i)
      }
      connectOutlet(e, t, i) {
          var r;
          this.outletElementsByName.has(i, t) || (this.outletsByName.add(i, e),
          this.outletElementsByName.add(i, t),
          (r = this.selectorObserverMap.get(i)) === null || r === void 0 || r.pause(()=>this.delegate.outletConnected(e, t, i)))
      }
      disconnectOutlet(e, t, i) {
          var r;
          this.outletElementsByName.has(i, t) && (this.outletsByName.delete(i, e),
          this.outletElementsByName.delete(i, t),
          (r = this.selectorObserverMap.get(i)) === null || r === void 0 || r.pause(()=>this.delegate.outletDisconnected(e, t, i)))
      }
      disconnectAllOutlets() {
          for (let e of this.outletElementsByName.keys)
              for (let t of this.outletElementsByName.getValuesForKey(e))
                  for (let i of this.outletsByName.getValuesForKey(e))
                      this.disconnectOutlet(i, t, e)
      }
      updateSelectorObserverForOutlet(e) {
          let t = this.selectorObserverMap.get(e);
          t && (t.selector = this.selector(e))
      }
      setupSelectorObserverForOutlet(e) {
          let t = this.selector(e)
            , i = new hs(document.body,t,this,{
              outletName: e
          });
          this.selectorObserverMap.set(e, i),
          i.start()
      }
      setupAttributeObserverForOutlet(e) {
          let t = this.attributeNameForOutletName(e)
            , i = new Mt(this.scope.element,t,this);
          this.attributeObserverMap.set(e, i),
          i.start()
      }
      selector(e) {
          return this.scope.outlets.getSelectorForOutletName(e)
      }
      attributeNameForOutletName(e) {
          return this.scope.schema.outletAttributeForScope(this.identifier, e)
      }
      getOutletNameFromOutletAttributeName(e) {
          return this.outletDefinitions.find(t=>this.attributeNameForOutletName(t) === e)
      }
      get outletDependencies() {
          let e = new ge;
          return this.router.modules.forEach(t=>{
              let i = t.definition.controllerConstructor;
              it(i, "outlets").forEach(n=>e.add(n, t.identifier))
          }
          ),
          e
      }
      get outletDefinitions() {
          return this.outletDependencies.getKeysForValue(this.identifier)
      }
      get dependentControllerIdentifiers() {
          return this.outletDependencies.getValuesForKey(this.identifier)
      }
      get dependentContexts() {
          let e = this.dependentControllerIdentifiers;
          return this.router.contexts.filter(t=>e.includes(t.identifier))
      }
      hasOutlet(e, t) {
          return !!this.getOutlet(e, t) || !!this.getOutletFromMap(e, t)
      }
      getOutlet(e, t) {
          return this.application.getControllerForElementAndIdentifier(e, t)
      }
      getOutletFromMap(e, t) {
          return this.outletsByName.getValuesForKey(t).find(i=>i.element === e)
      }
      get scope() {
          return this.context.scope
      }
      get schema() {
          return this.context.schema
      }
      get identifier() {
          return this.context.identifier
      }
      get application() {
          return this.context.application
      }
      get router() {
          return this.application.router
      }
  }
    , bs = class {
      constructor(e, t) {
          this.logDebugActivity = (i,r={})=>{
              let {identifier: n, controller: o, element: l} = this;
              r = Object.assign({
                  identifier: n,
                  controller: o,
                  element: l
              }, r),
              this.application.logDebugActivity(this.identifier, i, r)
          }
          ,
          this.module = e,
          this.scope = t,
          this.controller = new e.controllerConstructor(this),
          this.bindingObserver = new ps(this,this.dispatcher),
          this.valueObserver = new ms(this,this.controller),
          this.targetObserver = new gs(this,this),
          this.outletObserver = new vs(this,this);
          try {
              this.controller.initialize(),
              this.logDebugActivity("initialize")
          } catch (i) {
              this.handleError(i, "initializing controller")
          }
      }
      connect() {
          this.bindingObserver.start(),
          this.valueObserver.start(),
          this.targetObserver.start(),
          this.outletObserver.start();
          try {
              this.controller.connect(),
              this.logDebugActivity("connect")
          } catch (e) {
              this.handleError(e, "connecting controller")
          }
      }
      refresh() {
          this.outletObserver.refresh()
      }
      disconnect() {
          try {
              this.controller.disconnect(),
              this.logDebugActivity("disconnect")
          } catch (e) {
              this.handleError(e, "disconnecting controller")
          }
          this.outletObserver.stop(),
          this.targetObserver.stop(),
          this.valueObserver.stop(),
          this.bindingObserver.stop()
      }
      get application() {
          return this.module.application
      }
      get identifier() {
          return this.module.identifier
      }
      get schema() {
          return this.application.schema
      }
      get dispatcher() {
          return this.application.dispatcher
      }
      get element() {
          return this.scope.element
      }
      get parentElement() {
          return this.element.parentElement
      }
      handleError(e, t, i={}) {
          let {identifier: r, controller: n, element: o} = this;
          i = Object.assign({
              identifier: r,
              controller: n,
              element: o
          }, i),
          this.application.handleError(e, `Error ${t}`, i)
      }
      targetConnected(e, t) {
          this.invokeControllerMethod(`${t}TargetConnected`, e)
      }
      targetDisconnected(e, t) {
          this.invokeControllerMethod(`${t}TargetDisconnected`, e)
      }
      outletConnected(e, t, i) {
          this.invokeControllerMethod(`${ls(i)}OutletConnected`, e, t)
      }
      outletDisconnected(e, t, i) {
          this.invokeControllerMethod(`${ls(i)}OutletDisconnected`, e, t)
      }
      invokeControllerMethod(e, ...t) {
          let i = this.controller;
          typeof i[e] == "function" && i[e](...t)
      }
  }
  ;
  function Xn(s) {
      return Yn(s, Un(s))
  }
  function Yn(s, e) {
      let t = Qn(s)
        , i = Kn(s.prototype, e);
      return Object.defineProperties(t.prototype, i),
      t
  }
  function Un(s) {
      return it(s, "blessings").reduce((t,i)=>{
          let r = i(s);
          for (let n in r) {
              let o = t[n] || {};
              t[n] = Object.assign(o, r[n])
          }
          return t
      }
      , {})
  }
  function Kn(s, e) {
      return Jn(e).reduce((t,i)=>{
          let r = Zn(s, e, i);
          return r && Object.assign(t, {
              [i]: r
          }),
          t
      }
      , {})
  }
  function Zn(s, e, t) {
      let i = Object.getOwnPropertyDescriptor(s, t);
      if (!(i && "value"in i)) {
          let n = Object.getOwnPropertyDescriptor(e, t).value;
          return i && (n.get = i.get || n.get,
          n.set = i.set || n.set),
          n
      }
  }
  var Jn = typeof Object.getOwnPropertySymbols == "function" ? s=>[...Object.getOwnPropertyNames(s), ...Object.getOwnPropertySymbols(s)] : Object.getOwnPropertyNames
    , Qn = (()=>{
      function s(t) {
          function i() {
              return Reflect.construct(t, arguments, new.target)
          }
          return i.prototype = Object.create(t.prototype, {
              constructor: {
                  value: i
              }
          }),
          Reflect.setPrototypeOf(i, t),
          i
      }
      function e() {
          let i = s(function() {
              this.a.call(this)
          });
          return i.prototype.a = function() {}
          ,
          new i
      }
      try {
          return e(),
          s
      } catch {
          return i=>class extends i {
          }
      }
  }
  )();
  function ea(s) {
      return {
          identifier: s.identifier,
          controllerConstructor: Xn(s.controllerConstructor)
      }
  }
  var ws = class {
      constructor(e, t) {
          this.application = e,
          this.definition = ea(t),
          this.contextsByScope = new WeakMap,
          this.connectedContexts = new Set
      }
      get identifier() {
          return this.definition.identifier
      }
      get controllerConstructor() {
          return this.definition.controllerConstructor
      }
      get contexts() {
          return Array.from(this.connectedContexts)
      }
      connectContextForScope(e) {
          let t = this.fetchContextForScope(e);
          this.connectedContexts.add(t),
          t.connect()
      }
      disconnectContextForScope(e) {
          let t = this.contextsByScope.get(e);
          t && (this.connectedContexts.delete(t),
          t.disconnect())
      }
      fetchContextForScope(e) {
          let t = this.contextsByScope.get(e);
          return t || (t = new bs(this,e),
          this.contextsByScope.set(e, t)),
          t
      }
  }
    , ys = class {
      constructor(e) {
          this.scope = e
      }
      has(e) {
          return this.data.has(this.getDataKey(e))
      }
      get(e) {
          return this.getAll(e)[0]
      }
      getAll(e) {
          let t = this.data.get(this.getDataKey(e)) || "";
          return Fn(t)
      }
      getAttributeName(e) {
          return this.data.getAttributeNameForKey(this.getDataKey(e))
      }
      getDataKey(e) {
          return `${e}-class`
      }
      get data() {
          return this.scope.data
      }
  }
    , Ss = class {
      constructor(e) {
          this.scope = e
      }
      get element() {
          return this.scope.element
      }
      get identifier() {
          return this.scope.identifier
      }
      get(e) {
          let t = this.getAttributeNameForKey(e);
          return this.element.getAttribute(t)
      }
      set(e, t) {
          let i = this.getAttributeNameForKey(e);
          return this.element.setAttribute(i, t),
          this.get(e)
      }
      has(e) {
          let t = this.getAttributeNameForKey(e);
          return this.element.hasAttribute(t)
      }
      delete(e) {
          if (this.has(e)) {
              let t = this.getAttributeNameForKey(e);
              return this.element.removeAttribute(t),
              !0
          } else
              return !1
      }
      getAttributeNameForKey(e) {
          return `data-${this.identifier}-${_i(e)}`
      }
  }
    , Es = class {
      constructor(e) {
          this.warnedKeysByObject = new WeakMap,
          this.logger = e
      }
      warn(e, t, i) {
          let r = this.warnedKeysByObject.get(e);
          r || (r = new Set,
          this.warnedKeysByObject.set(e, r)),
          r.has(t) || (r.add(t),
          this.logger.warn(i, e))
      }
  }
  ;
  function Ts(s, e) {
      return `[${s}~="${e}"]`
  }
  var xs = class {
      constructor(e) {
          this.scope = e
      }
      get element() {
          return this.scope.element
      }
      get identifier() {
          return this.scope.identifier
      }
      get schema() {
          return this.scope.schema
      }
      has(e) {
          return this.find(e) != null
      }
      find(...e) {
          return e.reduce((t,i)=>t || this.findTarget(i) || this.findLegacyTarget(i), void 0)
      }
      findAll(...e) {
          return e.reduce((t,i)=>[...t, ...this.findAllTargets(i), ...this.findAllLegacyTargets(i)], [])
      }
      findTarget(e) {
          let t = this.getSelectorForTargetName(e);
          return this.scope.findElement(t)
      }
      findAllTargets(e) {
          let t = this.getSelectorForTargetName(e);
          return this.scope.findAllElements(t)
      }
      getSelectorForTargetName(e) {
          let t = this.schema.targetAttributeForScope(this.identifier);
          return Ts(t, e)
      }
      findLegacyTarget(e) {
          let t = this.getLegacySelectorForTargetName(e);
          return this.deprecate(this.scope.findElement(t), e)
      }
      findAllLegacyTargets(e) {
          let t = this.getLegacySelectorForTargetName(e);
          return this.scope.findAllElements(t).map(i=>this.deprecate(i, e))
      }
      getLegacySelectorForTargetName(e) {
          let t = `${this.identifier}.${e}`;
          return Ts(this.schema.targetAttribute, t)
      }
      deprecate(e, t) {
          if (e) {
              let {identifier: i} = this
                , r = this.schema.targetAttribute
                , n = this.schema.targetAttributeForScope(i);
              this.guide.warn(e, `target:${t}`, `Please replace ${r}="${i}.${t}" with ${n}="${t}". The ${r} attribute is deprecated and will be removed in a future version of Stimulus.`)
          }
          return e
      }
      get guide() {
          return this.scope.guide
      }
  }
    , Ms = class {
      constructor(e, t) {
          this.scope = e,
          this.controllerElement = t
      }
      get element() {
          return this.scope.element
      }
      get identifier() {
          return this.scope.identifier
      }
      get schema() {
          return this.scope.schema
      }
      has(e) {
          return this.find(e) != null
      }
      find(...e) {
          return e.reduce((t,i)=>t || this.findOutlet(i), void 0)
      }
      findAll(...e) {
          return e.reduce((t,i)=>[...t, ...this.findAllOutlets(i)], [])
      }
      getSelectorForOutletName(e) {
          let t = this.schema.outletAttributeForScope(this.identifier, e);
          return this.controllerElement.getAttribute(t)
      }
      findOutlet(e) {
          let t = this.getSelectorForOutletName(e);
          if (t)
              return this.findElement(t, e)
      }
      findAllOutlets(e) {
          let t = this.getSelectorForOutletName(e);
          return t ? this.findAllElements(t, e) : []
      }
      findElement(e, t) {
          return this.scope.queryElements(e).filter(r=>this.matchesElement(r, e, t))[0]
      }
      findAllElements(e, t) {
          return this.scope.queryElements(e).filter(r=>this.matchesElement(r, e, t))
      }
      matchesElement(e, t, i) {
          let r = e.getAttribute(this.scope.schema.controllerAttribute) || "";
          return e.matches(t) && r.split(" ").includes(i)
      }
  }
    , Cs = class s {
      constructor(e, t, i, r) {
          this.targets = new xs(this),
          this.classes = new ys(this),
          this.data = new Ss(this),
          this.containsElement = n=>n.closest(this.controllerSelector) === this.element,
          this.schema = e,
          this.element = t,
          this.identifier = i,
          this.guide = new Es(r),
          this.outlets = new Ms(this.documentScope,t)
      }
      findElement(e) {
          return this.element.matches(e) ? this.element : this.queryElements(e).find(this.containsElement)
      }
      findAllElements(e) {
          return [...this.element.matches(e) ? [this.element] : [], ...this.queryElements(e).filter(this.containsElement)]
      }
      queryElements(e) {
          return Array.from(this.element.querySelectorAll(e))
      }
      get controllerSelector() {
          return Ts(this.schema.controllerAttribute, this.identifier)
      }
      get isDocumentScope() {
          return this.element === document.documentElement
      }
      get documentScope() {
          return this.isDocumentScope ? this : new s(this.schema,document.documentElement,this.identifier,this.guide.logger)
      }
  }
    , As = class {
      constructor(e, t, i) {
          this.element = e,
          this.schema = t,
          this.delegate = i,
          this.valueListObserver = new At(this.element,this.controllerAttribute,this),
          this.scopesByIdentifierByElement = new WeakMap,
          this.scopeReferenceCounts = new WeakMap
      }
      start() {
          this.valueListObserver.start()
      }
      stop() {
          this.valueListObserver.stop()
      }
      get controllerAttribute() {
          return this.schema.controllerAttribute
      }
      parseValueForToken(e) {
          let {element: t, content: i} = e;
          return this.parseValueForElementAndIdentifier(t, i)
      }
      parseValueForElementAndIdentifier(e, t) {
          let i = this.fetchScopesByIdentifierForElement(e)
            , r = i.get(t);
          return r || (r = this.delegate.createScopeForElementAndIdentifier(e, t),
          i.set(t, r)),
          r
      }
      elementMatchedValue(e, t) {
          let i = (this.scopeReferenceCounts.get(t) || 0) + 1;
          this.scopeReferenceCounts.set(t, i),
          i == 1 && this.delegate.scopeConnected(t)
      }
      elementUnmatchedValue(e, t) {
          let i = this.scopeReferenceCounts.get(t);
          i && (this.scopeReferenceCounts.set(t, i - 1),
          i == 1 && this.delegate.scopeDisconnected(t))
      }
      fetchScopesByIdentifierForElement(e) {
          let t = this.scopesByIdentifierByElement.get(e);
          return t || (t = new Map,
          this.scopesByIdentifierByElement.set(e, t)),
          t
      }
  }
    , Ls = class {
      constructor(e) {
          this.application = e,
          this.scopeObserver = new As(this.element,this.schema,this),
          this.scopesByIdentifier = new ge,
          this.modulesByIdentifier = new Map
      }
      get element() {
          return this.application.element
      }
      get schema() {
          return this.application.schema
      }
      get logger() {
          return this.application.logger
      }
      get controllerAttribute() {
          return this.schema.controllerAttribute
      }
      get modules() {
          return Array.from(this.modulesByIdentifier.values())
      }
      get contexts() {
          return this.modules.reduce((e,t)=>e.concat(t.contexts), [])
      }
      start() {
          this.scopeObserver.start()
      }
      stop() {
          this.scopeObserver.stop()
      }
      loadDefinition(e) {
          this.unloadIdentifier(e.identifier);
          let t = new ws(this.application,e);
          this.connectModule(t);
          let i = e.controllerConstructor.afterLoad;
          i && i.call(e.controllerConstructor, e.identifier, this.application)
      }
      unloadIdentifier(e) {
          let t = this.modulesByIdentifier.get(e);
          t && this.disconnectModule(t)
      }
      getContextForElementAndIdentifier(e, t) {
          let i = this.modulesByIdentifier.get(t);
          if (i)
              return i.contexts.find(r=>r.element == e)
      }
      proposeToConnectScopeForElementAndIdentifier(e, t) {
          let i = this.scopeObserver.parseValueForElementAndIdentifier(e, t);
          i ? this.scopeObserver.elementMatchedValue(i.element, i) : console.error(`Couldn't find or create scope for identifier: "${t}" and element:`, e)
      }
      handleError(e, t, i) {
          this.application.handleError(e, t, i)
      }
      createScopeForElementAndIdentifier(e, t) {
          return new Cs(this.schema,e,t,this.logger)
      }
      scopeConnected(e) {
          this.scopesByIdentifier.add(e.identifier, e);
          let t = this.modulesByIdentifier.get(e.identifier);
          t && t.connectContextForScope(e)
      }
      scopeDisconnected(e) {
          this.scopesByIdentifier.delete(e.identifier, e);
          let t = this.modulesByIdentifier.get(e.identifier);
          t && t.disconnectContextForScope(e)
      }
      connectModule(e) {
          this.modulesByIdentifier.set(e.identifier, e),
          this.scopesByIdentifier.getValuesForKey(e.identifier).forEach(i=>e.connectContextForScope(i))
      }
      disconnectModule(e) {
          this.modulesByIdentifier.delete(e.identifier),
          this.scopesByIdentifier.getValuesForKey(e.identifier).forEach(i=>e.disconnectContextForScope(i))
      }
  }
    , ta = {
      controllerAttribute: "data-controller",
      actionAttribute: "data-action",
      targetAttribute: "data-target",
      targetAttributeForScope: s=>`data-${s}-target`,
      outletAttributeForScope: (s,e)=>`data-${s}-${e}-outlet`,
      keyMappings: Object.assign(Object.assign({
          enter: "Enter",
          tab: "Tab",
          esc: "Escape",
          space: " ",
          up: "ArrowUp",
          down: "ArrowDown",
          left: "ArrowLeft",
          right: "ArrowRight",
          home: "Home",
          end: "End",
          page_up: "PageUp",
          page_down: "PageDown"
      }, Vi("abcdefghijklmnopqrstuvwxyz".split("").map(s=>[s, s]))), Vi("0123456789".split("").map(s=>[s, s])))
  };
  function Vi(s) {
      return s.reduce((e,[t,i])=>Object.assign(Object.assign({}, e), {
          [t]: i
      }), {})
  }
  var Lt = class {
      constructor(e=document.documentElement, t=ta) {
          this.logger = console,
          this.debug = !1,
          this.logDebugActivity = (i,r,n={})=>{
              this.debug && this.logFormattedMessage(i, r, n)
          }
          ,
          this.element = e,
          this.schema = t,
          this.dispatcher = new os(this),
          this.router = new Ls(this),
          this.actionDescriptorFilters = Object.assign({}, Pn)
      }
      static start(e, t) {
          let i = new this(e,t);
          return i.start(),
          i
      }
      async start() {
          await sa(),
          this.logDebugActivity("application", "starting"),
          this.dispatcher.start(),
          this.router.start(),
          this.logDebugActivity("application", "start")
      }
      stop() {
          this.logDebugActivity("application", "stopping"),
          this.dispatcher.stop(),
          this.router.stop(),
          this.logDebugActivity("application", "stop")
      }
      register(e, t) {
          this.load({
              identifier: e,
              controllerConstructor: t
          })
      }
      registerActionOption(e, t) {
          this.actionDescriptorFilters[e] = t
      }
      load(e, ...t) {
          (Array.isArray(e) ? e : [e, ...t]).forEach(r=>{
              r.controllerConstructor.shouldLoad && this.router.loadDefinition(r)
          }
          )
      }
      unload(e, ...t) {
          (Array.isArray(e) ? e : [e, ...t]).forEach(r=>this.router.unloadIdentifier(r))
      }
      get controllers() {
          return this.router.contexts.map(e=>e.controller)
      }
      getControllerForElementAndIdentifier(e, t) {
          let i = this.router.getContextForElementAndIdentifier(e, t);
          return i ? i.controller : null
      }
      handleError(e, t, i) {
          var r;
          this.logger.error(`%s

%o

%o`, t, e, i),
          (r = window.onerror) === null || r === void 0 || r.call(window, t, "", 0, 0, e)
      }
      logFormattedMessage(e, t, i={}) {
          i = Object.assign({
              application: this
          }, i),
          this.logger.groupCollapsed(`${e} #${t}`),
          this.logger.log("details:", Object.assign({}, i)),
          this.logger.groupEnd()
      }
  }
  ;
  function sa() {
      return new Promise(s=>{
          document.readyState == "loading" ? document.addEventListener("DOMContentLoaded", ()=>s()) : s()
      }
      )
  }
  function ia(s) {
      return it(s, "classes").reduce((t,i)=>Object.assign(t, ra(i)), {})
  }
  function ra(s) {
      return {
          [`${s}Class`]: {
              get() {
                  let {classes: e} = this;
                  if (e.has(s))
                      return e.get(s);
                  {
                      let t = e.getAttributeName(s);
                      throw new Error(`Missing attribute "${t}"`)
                  }
              }
          },
          [`${s}Classes`]: {
              get() {
                  return this.classes.getAll(s)
              }
          },
          [`has${st(s)}Class`]: {
              get() {
                  return this.classes.has(s)
              }
          }
      }
  }
  function na(s) {
      return it(s, "outlets").reduce((t,i)=>Object.assign(t, aa(i)), {})
  }
  function Ni(s, e, t) {
      return s.application.getControllerForElementAndIdentifier(e, t)
  }
  function zi(s, e, t) {
      let i = Ni(s, e, t);
      if (i || (s.application.router.proposeToConnectScopeForElementAndIdentifier(e, t),
      i = Ni(s, e, t),
      i))
          return i
  }
  function aa(s) {
      let e = ls(s);
      return {
          [`${e}Outlet`]: {
              get() {
                  let t = this.outlets.find(s)
                    , i = this.outlets.getSelectorForOutletName(s);
                  if (t) {
                      let r = zi(this, t, s);
                      if (r)
                          return r;
                      throw new Error(`The provided outlet element is missing an outlet controller "${s}" instance for host controller "${this.identifier}"`)
                  }
                  throw new Error(`Missing outlet element "${s}" for host controller "${this.identifier}". Stimulus couldn't find a matching outlet element using selector "${i}".`)
              }
          },
          [`${e}Outlets`]: {
              get() {
                  let t = this.outlets.findAll(s);
                  return t.length > 0 ? t.map(i=>{
                      let r = zi(this, i, s);
                      if (r)
                          return r;
                      console.warn(`The provided outlet element is missing an outlet controller "${s}" instance for host controller "${this.identifier}"`, i)
                  }
                  ).filter(i=>i) : []
              }
          },
          [`${e}OutletElement`]: {
              get() {
                  let t = this.outlets.find(s)
                    , i = this.outlets.getSelectorForOutletName(s);
                  if (t)
                      return t;
                  throw new Error(`Missing outlet element "${s}" for host controller "${this.identifier}". Stimulus couldn't find a matching outlet element using selector "${i}".`)
              }
          },
          [`${e}OutletElements`]: {
              get() {
                  return this.outlets.findAll(s)
              }
          },
          [`has${st(e)}Outlet`]: {
              get() {
                  return this.outlets.has(s)
              }
          }
      }
  }
  function oa(s) {
      return it(s, "targets").reduce((t,i)=>Object.assign(t, la(i)), {})
  }
  function la(s) {
      return {
          [`${s}Target`]: {
              get() {
                  let e = this.targets.find(s);
                  if (e)
                      return e;
                  throw new Error(`Missing target element "${s}" for "${this.identifier}" controller`)
              }
          },
          [`${s}Targets`]: {
              get() {
                  return this.targets.findAll(s)
              }
          },
          [`has${st(s)}Target`]: {
              get() {
                  return this.targets.has(s)
              }
          }
      }
  }
  function ca(s) {
      let e = _n(s, "values")
        , t = {
          valueDescriptorMap: {
              get() {
                  return e.reduce((i,r)=>{
                      let n = Xi(r, this.identifier)
                        , o = this.data.getAttributeNameForKey(n.key);
                      return Object.assign(i, {
                          [o]: n
                      })
                  }
                  , {})
              }
          }
      };
      return e.reduce((i,r)=>Object.assign(i, da(r)), t)
  }
  function da(s, e) {
      let t = Xi(s, e)
        , {key: i, name: r, reader: n, writer: o} = t;
      return {
          [r]: {
              get() {
                  let l = this.data.get(i);
                  return l !== null ? n(l) : t.defaultValue
              },
              set(l) {
                  l === void 0 ? this.data.delete(i) : this.data.set(i, o(l))
              }
          },
          [`has${st(r)}`]: {
              get() {
                  return this.data.has(i) || t.hasCustomDefaultValue
              }
          }
      }
  }
  function Xi([s,e], t) {
      return pa({
          controller: t,
          token: s,
          typeDefinition: e
      })
  }
  function Pt(s) {
      switch (s) {
      case Array:
          return "array";
      case Boolean:
          return "boolean";
      case Number:
          return "number";
      case Object:
          return "object";
      case String:
          return "string"
      }
  }
  function tt(s) {
      switch (typeof s) {
      case "boolean":
          return "boolean";
      case "number":
          return "number";
      case "string":
          return "string"
      }
      if (Array.isArray(s))
          return "array";
      if (Object.prototype.toString.call(s) === "[object Object]")
          return "object"
  }
  function ua(s) {
      let {controller: e, token: t, typeObject: i} = s
        , r = Fi(i.type)
        , n = Fi(i.default)
        , o = r && n
        , l = r && !n
        , a = !r && n
        , h = Pt(i.type)
        , d = tt(s.typeObject.default);
      if (l)
          return h;
      if (a)
          return d;
      if (h !== d) {
          let c = e ? `${e}.${t}` : t;
          throw new Error(`The specified default value for the Stimulus Value "${c}" must match the defined type "${h}". The provided default value of "${i.default}" is of type "${d}".`)
      }
      if (o)
          return h
  }
  function ha(s) {
      let {controller: e, token: t, typeDefinition: i} = s
        , n = ua({
          controller: e,
          token: t,
          typeObject: i
      })
        , o = tt(i)
        , l = Pt(i)
        , a = n || o || l;
      if (a)
          return a;
      let h = e ? `${e}.${i}` : t;
      throw new Error(`Unknown value type "${h}" for "${t}" value`)
  }
  function fa(s) {
      let e = Pt(s);
      if (e)
          return Hi[e];
      let t = cs(s, "default")
        , i = cs(s, "type")
        , r = s;
      if (t)
          return r.default;
      if (i) {
          let {type: n} = r
            , o = Pt(n);
          if (o)
              return Hi[o]
      }
      return s
  }
  function pa(s) {
      let {token: e, typeDefinition: t} = s
        , i = `${_i(e)}-value`
        , r = ha(s);
      return {
          type: r,
          key: i,
          name: Ps(i),
          get defaultValue() {
              return fa(t)
          },
          get hasCustomDefaultValue() {
              return tt(t) !== void 0
          },
          reader: ma[r],
          writer: qi[r] || qi.default
      }
  }
  var Hi = {
      get array() {
          return []
      },
      boolean: !1,
      number: 0,
      get object() {
          return {}
      },
      string: ""
  }
    , ma = {
      array(s) {
          let e = JSON.parse(s);
          if (!Array.isArray(e))
              throw new TypeError(`expected value of type "array" but instead got value "${s}" of type "${tt(e)}"`);
          return e
      },
      boolean(s) {
          return !(s == "0" || String(s).toLowerCase() == "false")
      },
      number(s) {
          return Number(s.replace(/_/g, ""))
      },
      object(s) {
          let e = JSON.parse(s);
          if (e === null || typeof e != "object" || Array.isArray(e))
              throw new TypeError(`expected value of type "object" but instead got value "${s}" of type "${tt(e)}"`);
          return e
      },
      string(s) {
          return s
      }
  }
    , qi = {
      default: ga,
      array: Wi,
      object: Wi
  };
  function Wi(s) {
      return JSON.stringify(s)
  }
  function ga(s) {
      return `${s}`
  }
  var q = class {
      constructor(e) {
          this.context = e
      }
      static get shouldLoad() {
          return !0
      }
      static afterLoad(e, t) {}
      get application() {
          return this.context.application
      }
      get scope() {
          return this.context.scope
      }
      get element() {
          return this.scope.element
      }
      get identifier() {
          return this.scope.identifier
      }
      get targets() {
          return this.scope.targets
      }
      get outlets() {
          return this.scope.outlets
      }
      get classes() {
          return this.scope.classes
      }
      get data() {
          return this.scope.data
      }
      initialize() {}
      connect() {}
      disconnect() {}
      dispatch(e, {target: t=this.element, detail: i={}, prefix: r=this.identifier, bubbles: n=!0, cancelable: o=!0}={}) {
          let l = r ? `${r}:${e}` : e
            , a = new CustomEvent(l,{
              detail: i,
              bubbles: n,
              cancelable: o
          });
          return t.dispatchEvent(a),
          a
      }
  }
  ;
  q.blessings = [ia, oa, ca, na];
  q.targets = [];
  q.outlets = [];
  q.values = {};
  var ce = Lt.start();
  ce.debug = !1;
  window.Stimulus = ce;
  var It = class extends q {
      connect() {
          this.element.textContent = "Hello World!"
      }
  }
  ;
  var Ot = class extends q {
      sendData() {
          let s = new FormData(this.element)
            , e = document.getElementById("contact_form--button");
          e.disabled = !1,
          e.children[0].classList.remove("hidden"),
          e.classList.add("opacity-75"),
          fetch("https://script.google.com/macros/s/AKfycbxbmMZEonqo2kjtN4aWXQTj0dfOxKsCJfJX-xMsP1WTU6CilSZl2HWjqWjtp5s8fb_-DQ/exec", {
              method: "POST",
              body: s
          }).then(function() {
              document.getElementById("contact_form_wrapper").classList.add("hidden"),
              document.getElementById("contact_form_thanks").classList.remove("hidden")
          }).catch(function() {
              document.getElementById("contact_form_wrapper").classList.add("hidden"),
              document.getElementById("contact_form_error").classList.remove("hidden")
          })
      }
  }
  ;
  var kt = class extends q {
      connect() {
          let s = {
              threshold: [.5]
          }
            , e = new IntersectionObserver(i=>{
              i.forEach(r=>{
                  r.isIntersecting && (r.target.classList.remove("invisible"),
                  r.target.classList.add("visible"),
                  r.target.classList.add("animate__fadeInUp"))
              }
              )
          }
          ,s)
            , t = document.querySelectorAll(".animate__animated");
          for (let i of t)
              e.observe(i)
      }
  }
  ;
  var Rt = class extends q {
      active(s) {
          Array.from(document.getElementsByClassName("nav-hover")).forEach(e=>{
              e.classList.remove("nav-active")
          }
          ),
          s.target.parentElement.classList.add("nav-active")
      }
  }
  ;
  function Yi(s) {
      return s !== null && typeof s == "object" && "constructor"in s && s.constructor === Object
  }
  function Is(s, e) {
      s === void 0 && (s = {}),
      e === void 0 && (e = {}),
      Object.keys(e).forEach(t=>{
          typeof s[t] > "u" ? s[t] = e[t] : Yi(e[t]) && Yi(s[t]) && Object.keys(e[t]).length > 0 && Is(s[t], e[t])
      }
      )
  }
  var Ui = {
      body: {},
      addEventListener() {},
      removeEventListener() {},
      activeElement: {
          blur() {},
          nodeName: ""
      },
      querySelector() {
          return null
      },
      querySelectorAll() {
          return []
      },
      getElementById() {
          return null
      },
      createEvent() {
          return {
              initEvent() {}
          }
      },
      createElement() {
          return {
              children: [],
              childNodes: [],
              style: {},
              setAttribute() {},
              getElementsByTagName() {
                  return []
              }
          }
      },
      createElementNS() {
          return {}
      },
      importNode() {
          return null
      },
      location: {
          hash: "",
          host: "",
          hostname: "",
          href: "",
          origin: "",
          pathname: "",
          protocol: "",
          search: ""
      }
  };
  function X() {
      let s = typeof document < "u" ? document : {};
      return Is(s, Ui),
      s
  }
  var va = {
      document: Ui,
      navigator: {
          userAgent: ""
      },
      location: {
          hash: "",
          host: "",
          hostname: "",
          href: "",
          origin: "",
          pathname: "",
          protocol: "",
          search: ""
      },
      history: {
          replaceState() {},
          pushState() {},
          go() {},
          back() {}
      },
      CustomEvent: function() {
          return this
      },
      addEventListener() {},
      removeEventListener() {},
      getComputedStyle() {
          return {
              getPropertyValue() {
                  return ""
              }
          }
      },
      Image() {},
      Date() {},
      screen: {},
      setTimeout() {},
      clearTimeout() {},
      matchMedia() {
          return {}
      },
      requestAnimationFrame(s) {
          return typeof setTimeout > "u" ? (s(),
          null) : setTimeout(s, 0)
      },
      cancelAnimationFrame(s) {
          typeof setTimeout > "u" || clearTimeout(s)
      }
  };
  function _() {
      let s = typeof window < "u" ? window : {};
      return Is(s, va),
      s
  }
  function ve(s) {
      return s === void 0 && (s = ""),
      s.trim().split(" ").filter(e=>!!e.trim())
  }
  function Ki(s) {
      let e = s;
      Object.keys(e).forEach(t=>{
          try {
              e[t] = null
          } catch {}
          try {
              delete e[t]
          } catch {}
      }
      )
  }
  function de(s, e) {
      return e === void 0 && (e = 0),
      setTimeout(s, e)
  }
  function te() {
      return Date.now()
  }
  function ba(s) {
      let e = _(), t;
      return e.getComputedStyle && (t = e.getComputedStyle(s, null)),
      !t && s.currentStyle && (t = s.currentStyle),
      t || (t = s.style),
      t
  }
  function rt(s, e) {
      e === void 0 && (e = "x");
      let t = _(), i, r, n, o = ba(s);
      return t.WebKitCSSMatrix ? (r = o.transform || o.webkitTransform,
      r.split(",").length > 6 && (r = r.split(", ").map(l=>l.replace(",", ".")).join(", ")),
      n = new t.WebKitCSSMatrix(r === "none" ? "" : r)) : (n = o.MozTransform || o.OTransform || o.MsTransform || o.msTransform || o.transform || o.getPropertyValue("transform").replace("translate(", "matrix(1, 0, 0, 1,"),
      i = n.toString().split(",")),
      e === "x" && (t.WebKitCSSMatrix ? r = n.m41 : i.length === 16 ? r = parseFloat(i[12]) : r = parseFloat(i[4])),
      e === "y" && (t.WebKitCSSMatrix ? r = n.m42 : i.length === 16 ? r = parseFloat(i[13]) : r = parseFloat(i[5])),
      r || 0
  }
  function ze(s) {
      return typeof s == "object" && s !== null && s.constructor && Object.prototype.toString.call(s).slice(8, -1) === "Object"
  }
  function wa(s) {
      return typeof window < "u" && typeof window.HTMLElement < "u" ? s instanceof HTMLElement : s && (s.nodeType === 1 || s.nodeType === 11)
  }
  function se() {
      let s = Object(arguments.length <= 0 ? void 0 : arguments[0])
        , e = ["__proto__", "constructor", "prototype"];
      for (let t = 1; t < arguments.length; t += 1) {
          let i = t < 0 || arguments.length <= t ? void 0 : arguments[t];
          if (i != null && !wa(i)) {
              let r = Object.keys(Object(i)).filter(n=>e.indexOf(n) < 0);
              for (let n = 0, o = r.length; n < o; n += 1) {
                  let l = r[n]
                    , a = Object.getOwnPropertyDescriptor(i, l);
                  a !== void 0 && a.enumerable && (ze(s[l]) && ze(i[l]) ? i[l].__swiper__ ? s[l] = i[l] : se(s[l], i[l]) : !ze(s[l]) && ze(i[l]) ? (s[l] = {},
                  i[l].__swiper__ ? s[l] = i[l] : se(s[l], i[l])) : s[l] = i[l])
              }
          }
      }
      return s
  }
  function Ie(s, e, t) {
      s.style.setProperty(e, t)
  }
  function Os(s) {
      let {swiper: e, targetPosition: t, side: i} = s, r = _(), n = -e.translate, o = null, l, a = e.params.speed;
      e.wrapperEl.style.scrollSnapType = "none",
      r.cancelAnimationFrame(e.cssModeFrameID);
      let h = t > n ? "next" : "prev"
        , d = (u,m)=>h === "next" && u >= m || h === "prev" && u <= m
        , c = ()=>{
          l = new Date().getTime(),
          o === null && (o = l);
          let u = Math.max(Math.min((l - o) / a, 1), 0)
            , m = .5 - Math.cos(u * Math.PI) / 2
            , g = n + m * (t - n);
          if (d(g, t) && (g = t),
          e.wrapperEl.scrollTo({
              [i]: g
          }),
          d(g, t)) {
              e.wrapperEl.style.overflow = "hidden",
              e.wrapperEl.style.scrollSnapType = "",
              setTimeout(()=>{
                  e.wrapperEl.style.overflow = "",
                  e.wrapperEl.scrollTo({
                      [i]: g
                  })
              }
              ),
              r.cancelAnimationFrame(e.cssModeFrameID);
              return
          }
          e.cssModeFrameID = r.requestAnimationFrame(c)
      }
      ;
      c()
  }
  function ie(s) {
      return s.querySelector(".swiper-slide-transform") || s.shadowRoot && s.shadowRoot.querySelector(".swiper-slide-transform") || s
  }
  function Y(s, e) {
      return e === void 0 && (e = ""),
      [...s.children].filter(t=>t.matches(e))
  }
  function nt(s) {
      try {
          console.warn(s);
          return
      } catch {}
  }
  function Z(s, e) {
      e === void 0 && (e = []);
      let t = document.createElement(s);
      return t.classList.add(...Array.isArray(e) ? e : ve(e)),
      t
  }
  function Oe(s) {
      let e = _()
        , t = X()
        , i = s.getBoundingClientRect()
        , r = t.body
        , n = s.clientTop || r.clientTop || 0
        , o = s.clientLeft || r.clientLeft || 0
        , l = s === e ? e.scrollY : s.scrollTop
        , a = s === e ? e.scrollX : s.scrollLeft;
      return {
          top: i.top + l - n,
          left: i.left + a - o
      }
  }
  function Zi(s, e) {
      let t = [];
      for (; s.previousElementSibling; ) {
          let i = s.previousElementSibling;
          e ? i.matches(e) && t.push(i) : t.push(i),
          s = i
      }
      return t
  }
  function Ji(s, e) {
      let t = [];
      for (; s.nextElementSibling; ) {
          let i = s.nextElementSibling;
          e ? i.matches(e) && t.push(i) : t.push(i),
          s = i
      }
      return t
  }
  function be(s, e) {
      return _().getComputedStyle(s, null).getPropertyValue(e)
  }
  function ye(s) {
      let e = s, t;
      if (e) {
          for (t = 0; (e = e.previousSibling) !== null; )
              e.nodeType === 1 && (t += 1);
          return t
      }
  }
  function ue(s, e) {
      let t = []
        , i = s.parentElement;
      for (; i; )
          e ? i.matches(e) && t.push(i) : t.push(i),
          i = i.parentElement;
      return t
  }
  function Se(s, e) {
      function t(i) {
          i.target === s && (e.call(s, i),
          s.removeEventListener("transitionend", t))
      }
      e && s.addEventListener("transitionend", t)
  }
  function at(s, e, t) {
      let i = _();
      return t ? s[e === "width" ? "offsetWidth" : "offsetHeight"] + parseFloat(i.getComputedStyle(s, null).getPropertyValue(e === "width" ? "margin-right" : "margin-top")) + parseFloat(i.getComputedStyle(s, null).getPropertyValue(e === "width" ? "margin-left" : "margin-bottom")) : s.offsetWidth
  }
  function H(s) {
      return (Array.isArray(s) ? s : [s]).filter(e=>!!e)
  }
  var ks;
  function ya() {
      let s = _()
        , e = X();
      return {
          smoothScroll: e.documentElement && e.documentElement.style && "scrollBehavior"in e.documentElement.style,
          touch: !!("ontouchstart"in s || s.DocumentTouch && e instanceof s.DocumentTouch)
      }
  }
  function ir() {
      return ks || (ks = ya()),
      ks
  }
  var Rs;
  function Sa(s) {
      let {userAgent: e} = s === void 0 ? {} : s
        , t = ir()
        , i = _()
        , r = i.navigator.platform
        , n = e || i.navigator.userAgent
        , o = {
          ios: !1,
          android: !1
      }
        , l = i.screen.width
        , a = i.screen.height
        , h = n.match(/(Android);?[\s\/]+([\d.]+)?/)
        , d = n.match(/(iPad).*OS\s([\d_]+)/)
        , c = n.match(/(iPod)(.*OS\s([\d_]+))?/)
        , u = !d && n.match(/(iPhone\sOS|iOS)\s([\d_]+)/)
        , m = r === "Win32"
        , g = r === "MacIntel"
        , y = ["1024x1366", "1366x1024", "834x1194", "1194x834", "834x1112", "1112x834", "768x1024", "1024x768", "820x1180", "1180x820", "810x1080", "1080x810"];
      return !d && g && t.touch && y.indexOf(`${l}x${a}`) >= 0 && (d = n.match(/(Version)\/([\d.]+)/),
      d || (d = [0, 1, "13_0_0"]),
      g = !1),
      h && !m && (o.os = "android",
      o.android = !0),
      (d || u || c) && (o.os = "ios",
      o.ios = !0),
      o
  }
  function rr(s) {
      return s === void 0 && (s = {}),
      Rs || (Rs = Sa(s)),
      Rs
  }
  var Ds;
  function Ea() {
      let s = _()
        , e = rr()
        , t = !1;
      function i() {
          let l = s.navigator.userAgent.toLowerCase();
          return l.indexOf("safari") >= 0 && l.indexOf("chrome") < 0 && l.indexOf("android") < 0
      }
      if (i()) {
          let l = String(s.navigator.userAgent);
          if (l.includes("Version/")) {
              let[a,h] = l.split("Version/")[1].split(" ")[0].split(".").map(d=>Number(d));
              t = a < 16 || a === 16 && h < 2
          }
      }
      let r = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(s.navigator.userAgent)
        , n = i()
        , o = n || r && e.ios;
      return {
          isSafari: t || n,
          needPerspectiveFix: t,
          need3dFix: o,
          isWebView: r
      }
  }
  function Ta() {
      return Ds || (Ds = Ea()),
      Ds
  }
  function xa(s) {
      let {swiper: e, on: t, emit: i} = s
        , r = _()
        , n = null
        , o = null
        , l = ()=>{
          !e || e.destroyed || !e.initialized || (i("beforeResize"),
          i("resize"))
      }
        , a = ()=>{
          !e || e.destroyed || !e.initialized || (n = new ResizeObserver(c=>{
              o = r.requestAnimationFrame(()=>{
                  let {width: u, height: m} = e
                    , g = u
                    , y = m;
                  c.forEach(w=>{
                      let {contentBoxSize: f, contentRect: S, target: b} = w;
                      b && b !== e.el || (g = S ? S.width : (f[0] || f).inlineSize,
                      y = S ? S.height : (f[0] || f).blockSize)
                  }
                  ),
                  (g !== u || y !== m) && l()
              }
              )
          }
          ),
          n.observe(e.el))
      }
        , h = ()=>{
          o && r.cancelAnimationFrame(o),
          n && n.unobserve && e.el && (n.unobserve(e.el),
          n = null)
      }
        , d = ()=>{
          !e || e.destroyed || !e.initialized || i("orientationchange")
      }
      ;
      t("init", ()=>{
          if (e.params.resizeObserver && typeof r.ResizeObserver < "u") {
              a();
              return
          }
          r.addEventListener("resize", l),
          r.addEventListener("orientationchange", d)
      }
      ),
      t("destroy", ()=>{
          h(),
          r.removeEventListener("resize", l),
          r.removeEventListener("orientationchange", d)
      }
      )
  }
  function Ma(s) {
      let {swiper: e, extendParams: t, on: i, emit: r} = s
        , n = []
        , o = _()
        , l = function(d, c) {
          c === void 0 && (c = {});
          let u = o.MutationObserver || o.WebkitMutationObserver
            , m = new u(g=>{
              if (e.__preventObserver__)
                  return;
              if (g.length === 1) {
                  r("observerUpdate", g[0]);
                  return
              }
              let y = function() {
                  r("observerUpdate", g[0])
              };
              o.requestAnimationFrame ? o.requestAnimationFrame(y) : o.setTimeout(y, 0)
          }
          );
          m.observe(d, {
              attributes: typeof c.attributes > "u" ? !0 : c.attributes,
              childList: typeof c.childList > "u" ? !0 : c.childList,
              characterData: typeof c.characterData > "u" ? !0 : c.characterData
          }),
          n.push(m)
      }
        , a = ()=>{
          if (e.params.observer) {
              if (e.params.observeParents) {
                  let d = ue(e.hostEl);
                  for (let c = 0; c < d.length; c += 1)
                      l(d[c])
              }
              l(e.hostEl, {
                  childList: e.params.observeSlideChildren
              }),
              l(e.wrapperEl, {
                  attributes: !1
              })
          }
      }
        , h = ()=>{
          n.forEach(d=>{
              d.disconnect()
          }
          ),
          n.splice(0, n.length)
      }
      ;
      t({
          observer: !1,
          observeParents: !1,
          observeSlideChildren: !1
      }),
      i("init", a),
      i("destroy", h)
  }
  var Ca = {
      on(s, e, t) {
          let i = this;
          if (!i.eventsListeners || i.destroyed || typeof e != "function")
              return i;
          let r = t ? "unshift" : "push";
          return s.split(" ").forEach(n=>{
              i.eventsListeners[n] || (i.eventsListeners[n] = []),
              i.eventsListeners[n][r](e)
          }
          ),
          i
      },
      once(s, e, t) {
          let i = this;
          if (!i.eventsListeners || i.destroyed || typeof e != "function")
              return i;
          function r() {
              i.off(s, r),
              r.__emitterProxy && delete r.__emitterProxy;
              for (var n = arguments.length, o = new Array(n), l = 0; l < n; l++)
                  o[l] = arguments[l];
              e.apply(i, o)
          }
          return r.__emitterProxy = e,
          i.on(s, r, t)
      },
      onAny(s, e) {
          let t = this;
          if (!t.eventsListeners || t.destroyed || typeof s != "function")
              return t;
          let i = e ? "unshift" : "push";
          return t.eventsAnyListeners.indexOf(s) < 0 && t.eventsAnyListeners[i](s),
          t
      },
      offAny(s) {
          let e = this;
          if (!e.eventsListeners || e.destroyed || !e.eventsAnyListeners)
              return e;
          let t = e.eventsAnyListeners.indexOf(s);
          return t >= 0 && e.eventsAnyListeners.splice(t, 1),
          e
      },
      off(s, e) {
          let t = this;
          return !t.eventsListeners || t.destroyed || !t.eventsListeners || s.split(" ").forEach(i=>{
              typeof e > "u" ? t.eventsListeners[i] = [] : t.eventsListeners[i] && t.eventsListeners[i].forEach((r,n)=>{
                  (r === e || r.__emitterProxy && r.__emitterProxy === e) && t.eventsListeners[i].splice(n, 1)
              }
              )
          }
          ),
          t
      },
      emit() {
          let s = this;
          if (!s.eventsListeners || s.destroyed || !s.eventsListeners)
              return s;
          let e, t, i;
          for (var r = arguments.length, n = new Array(r), o = 0; o < r; o++)
              n[o] = arguments[o];
          return typeof n[0] == "string" || Array.isArray(n[0]) ? (e = n[0],
          t = n.slice(1, n.length),
          i = s) : (e = n[0].events,
          t = n[0].data,
          i = n[0].context || s),
          t.unshift(i),
          (Array.isArray(e) ? e : e.split(" ")).forEach(a=>{
              s.eventsAnyListeners && s.eventsAnyListeners.length && s.eventsAnyListeners.forEach(h=>{
                  h.apply(i, [a, ...t])
              }
              ),
              s.eventsListeners && s.eventsListeners[a] && s.eventsListeners[a].forEach(h=>{
                  h.apply(i, t)
              }
              )
          }
          ),
          s
      }
  };
  function Aa() {
      let s = this, e, t, i = s.el;
      typeof s.params.width < "u" && s.params.width !== null ? e = s.params.width : e = i.clientWidth,
      typeof s.params.height < "u" && s.params.height !== null ? t = s.params.height : t = i.clientHeight,
      !(e === 0 && s.isHorizontal() || t === 0 && s.isVertical()) && (e = e - parseInt(be(i, "padding-left") || 0, 10) - parseInt(be(i, "padding-right") || 0, 10),
      t = t - parseInt(be(i, "padding-top") || 0, 10) - parseInt(be(i, "padding-bottom") || 0, 10),
      Number.isNaN(e) && (e = 0),
      Number.isNaN(t) && (t = 0),
      Object.assign(s, {
          width: e,
          height: t,
          size: s.isHorizontal() ? e : t
      }))
  }
  function La() {
      let s = this;
      function e(L, D) {
          return parseFloat(L.getPropertyValue(s.getDirectionLabel(D)) || 0)
      }
      let t = s.params
        , {wrapperEl: i, slidesEl: r, size: n, rtlTranslate: o, wrongRTL: l} = s
        , a = s.virtual && t.virtual.enabled
        , h = a ? s.virtual.slides.length : s.slides.length
        , d = Y(r, `.${s.params.slideClass}, swiper-slide`)
        , c = a ? s.virtual.slides.length : d.length
        , u = []
        , m = []
        , g = []
        , y = t.slidesOffsetBefore;
      typeof y == "function" && (y = t.slidesOffsetBefore.call(s));
      let w = t.slidesOffsetAfter;
      typeof w == "function" && (w = t.slidesOffsetAfter.call(s));
      let f = s.snapGrid.length
        , S = s.slidesGrid.length
        , b = t.spaceBetween
        , x = -y
        , k = 0
        , R = 0;
      if (typeof n > "u")
          return;
      typeof b == "string" && b.indexOf("%") >= 0 ? b = parseFloat(b.replace("%", "")) / 100 * n : typeof b == "string" && (b = parseFloat(b)),
      s.virtualSize = -b,
      d.forEach(L=>{
          o ? L.style.marginLeft = "" : L.style.marginRight = "",
          L.style.marginBottom = "",
          L.style.marginTop = ""
      }
      ),
      t.centeredSlides && t.cssMode && (Ie(i, "--swiper-centered-offset-before", ""),
      Ie(i, "--swiper-centered-offset-after", ""));
      let $ = t.grid && t.grid.rows > 1 && s.grid;
      $ ? s.grid.initSlides(d) : s.grid && s.grid.unsetSlides();
      let I, O = t.slidesPerView === "auto" && t.breakpoints && Object.keys(t.breakpoints).filter(L=>typeof t.breakpoints[L].slidesPerView < "u").length > 0;
      for (let L = 0; L < c; L += 1) {
          I = 0;
          let D;
          if (d[L] && (D = d[L]),
          $ && s.grid.updateSlide(L, D, d),
          !(d[L] && be(D, "display") === "none")) {
              if (t.slidesPerView === "auto") {
                  O && (d[L].style[s.getDirectionLabel("width")] = "");
                  let C = getComputedStyle(D)
                    , A = D.style.transform
                    , P = D.style.webkitTransform;
                  if (A && (D.style.transform = "none"),
                  P && (D.style.webkitTransform = "none"),
                  t.roundLengths)
                      I = s.isHorizontal() ? at(D, "width", !0) : at(D, "height", !0);
                  else {
                      let B = e(C, "width")
                        , E = e(C, "padding-left")
                        , v = e(C, "padding-right")
                        , p = e(C, "margin-left")
                        , T = e(C, "margin-right")
                        , M = C.getPropertyValue("box-sizing");
                      if (M && M === "border-box")
                          I = B + p + T;
                      else {
                          let {clientWidth: F, offsetWidth: V} = D;
                          I = B + E + v + p + T + (V - F)
                      }
                  }
                  A && (D.style.transform = A),
                  P && (D.style.webkitTransform = P),
                  t.roundLengths && (I = Math.floor(I))
              } else
                  I = (n - (t.slidesPerView - 1) * b) / t.slidesPerView,
                  t.roundLengths && (I = Math.floor(I)),
                  d[L] && (d[L].style[s.getDirectionLabel("width")] = `${I}px`);
              d[L] && (d[L].swiperSlideSize = I),
              g.push(I),
              t.centeredSlides ? (x = x + I / 2 + k / 2 + b,
              k === 0 && L !== 0 && (x = x - n / 2 - b),
              L === 0 && (x = x - n / 2 - b),
              Math.abs(x) < 1 / 1e3 && (x = 0),
              t.roundLengths && (x = Math.floor(x)),
              R % t.slidesPerGroup === 0 && u.push(x),
              m.push(x)) : (t.roundLengths && (x = Math.floor(x)),
              (R - Math.min(s.params.slidesPerGroupSkip, R)) % s.params.slidesPerGroup === 0 && u.push(x),
              m.push(x),
              x = x + I + b),
              s.virtualSize += I + b,
              k = I,
              R += 1
          }
      }
      if (s.virtualSize = Math.max(s.virtualSize, n) + w,
      o && l && (t.effect === "slide" || t.effect === "coverflow") && (i.style.width = `${s.virtualSize + b}px`),
      t.setWrapperSize && (i.style[s.getDirectionLabel("width")] = `${s.virtualSize + b}px`),
      $ && s.grid.updateWrapperSize(I, u),
      !t.centeredSlides) {
          let L = [];
          for (let D = 0; D < u.length; D += 1) {
              let C = u[D];
              t.roundLengths && (C = Math.floor(C)),
              u[D] <= s.virtualSize - n && L.push(C)
          }
          u = L,
          Math.floor(s.virtualSize - n) - Math.floor(u[u.length - 1]) > 1 && u.push(s.virtualSize - n)
      }
      if (a && t.loop) {
          let L = g[0] + b;
          if (t.slidesPerGroup > 1) {
              let D = Math.ceil((s.virtual.slidesBefore + s.virtual.slidesAfter) / t.slidesPerGroup)
                , C = L * t.slidesPerGroup;
              for (let A = 0; A < D; A += 1)
                  u.push(u[u.length - 1] + C)
          }
          for (let D = 0; D < s.virtual.slidesBefore + s.virtual.slidesAfter; D += 1)
              t.slidesPerGroup === 1 && u.push(u[u.length - 1] + L),
              m.push(m[m.length - 1] + L),
              s.virtualSize += L
      }
      if (u.length === 0 && (u = [0]),
      b !== 0) {
          let L = s.isHorizontal() && o ? "marginLeft" : s.getDirectionLabel("marginRight");
          d.filter((D,C)=>!t.cssMode || t.loop ? !0 : C !== d.length - 1).forEach(D=>{
              D.style[L] = `${b}px`
          }
          )
      }
      if (t.centeredSlides && t.centeredSlidesBounds) {
          let L = 0;
          g.forEach(C=>{
              L += C + (b || 0)
          }
          ),
          L -= b;
          let D = L - n;
          u = u.map(C=>C <= 0 ? -y : C > D ? D + w : C)
      }
      if (t.centerInsufficientSlides) {
          let L = 0;
          if (g.forEach(D=>{
              L += D + (b || 0)
          }
          ),
          L -= b,
          L < n) {
              let D = (n - L) / 2;
              u.forEach((C,A)=>{
                  u[A] = C - D
              }
              ),
              m.forEach((C,A)=>{
                  m[A] = C + D
              }
              )
          }
      }
      if (Object.assign(s, {
          slides: d,
          snapGrid: u,
          slidesGrid: m,
          slidesSizesGrid: g
      }),
      t.centeredSlides && t.cssMode && !t.centeredSlidesBounds) {
          Ie(i, "--swiper-centered-offset-before", `${-u[0]}px`),
          Ie(i, "--swiper-centered-offset-after", `${s.size / 2 - g[g.length - 1] / 2}px`);
          let L = -s.snapGrid[0]
            , D = -s.slidesGrid[0];
          s.snapGrid = s.snapGrid.map(C=>C + L),
          s.slidesGrid = s.slidesGrid.map(C=>C + D)
      }
      if (c !== h && s.emit("slidesLengthChange"),
      u.length !== f && (s.params.watchOverflow && s.checkOverflow(),
      s.emit("snapGridLengthChange")),
      m.length !== S && s.emit("slidesGridLengthChange"),
      t.watchSlidesProgress && s.updateSlidesOffset(),
      s.emit("slidesUpdated"),
      !a && !t.cssMode && (t.effect === "slide" || t.effect === "fade")) {
          let L = `${t.containerModifierClass}backface-hidden`
            , D = s.el.classList.contains(L);
          c <= t.maxBackfaceHiddenSlides ? D || s.el.classList.add(L) : D && s.el.classList.remove(L)
      }
  }
  function Pa(s) {
      let e = this, t = [], i = e.virtual && e.params.virtual.enabled, r = 0, n;
      typeof s == "number" ? e.setTransition(s) : s === !0 && e.setTransition(e.params.speed);
      let o = l=>i ? e.slides[e.getSlideIndexByData(l)] : e.slides[l];
      if (e.params.slidesPerView !== "auto" && e.params.slidesPerView > 1)
          if (e.params.centeredSlides)
              (e.visibleSlides || []).forEach(l=>{
                  t.push(l)
              }
              );
          else
              for (n = 0; n < Math.ceil(e.params.slidesPerView); n += 1) {
                  let l = e.activeIndex + n;
                  if (l > e.slides.length && !i)
                      break;
                  t.push(o(l))
              }
      else
          t.push(o(e.activeIndex));
      for (n = 0; n < t.length; n += 1)
          if (typeof t[n] < "u") {
              let l = t[n].offsetHeight;
              r = l > r ? l : r
          }
      (r || r === 0) && (e.wrapperEl.style.height = `${r}px`)
  }
  function Ia() {
      let s = this
        , e = s.slides
        , t = s.isElement ? s.isHorizontal() ? s.wrapperEl.offsetLeft : s.wrapperEl.offsetTop : 0;
      for (let i = 0; i < e.length; i += 1)
          e[i].swiperSlideOffset = (s.isHorizontal() ? e[i].offsetLeft : e[i].offsetTop) - t - s.cssOverflowAdjustment()
  }
  function Oa(s) {
      s === void 0 && (s = this && this.translate || 0);
      let e = this
        , t = e.params
        , {slides: i, rtlTranslate: r, snapGrid: n} = e;
      if (i.length === 0)
          return;
      typeof i[0].swiperSlideOffset > "u" && e.updateSlidesOffset();
      let o = -s;
      r && (o = s),
      i.forEach(a=>{
          a.classList.remove(t.slideVisibleClass, t.slideFullyVisibleClass)
      }
      ),
      e.visibleSlidesIndexes = [],
      e.visibleSlides = [];
      let l = t.spaceBetween;
      typeof l == "string" && l.indexOf("%") >= 0 ? l = parseFloat(l.replace("%", "")) / 100 * e.size : typeof l == "string" && (l = parseFloat(l));
      for (let a = 0; a < i.length; a += 1) {
          let h = i[a]
            , d = h.swiperSlideOffset;
          t.cssMode && t.centeredSlides && (d -= i[0].swiperSlideOffset);
          let c = (o + (t.centeredSlides ? e.minTranslate() : 0) - d) / (h.swiperSlideSize + l)
            , u = (o - n[0] + (t.centeredSlides ? e.minTranslate() : 0) - d) / (h.swiperSlideSize + l)
            , m = -(o - d)
            , g = m + e.slidesSizesGrid[a]
            , y = m >= 0 && m <= e.size - e.slidesSizesGrid[a];
          (m >= 0 && m < e.size - 1 || g > 1 && g <= e.size || m <= 0 && g >= e.size) && (e.visibleSlides.push(h),
          e.visibleSlidesIndexes.push(a),
          i[a].classList.add(t.slideVisibleClass)),
          y && i[a].classList.add(t.slideFullyVisibleClass),
          h.progress = r ? -c : c,
          h.originalProgress = r ? -u : u
      }
  }
  function ka(s) {
      let e = this;
      if (typeof s > "u") {
          let d = e.rtlTranslate ? -1 : 1;
          s = e && e.translate && e.translate * d || 0
      }
      let t = e.params
        , i = e.maxTranslate() - e.minTranslate()
        , {progress: r, isBeginning: n, isEnd: o, progressLoop: l} = e
        , a = n
        , h = o;
      if (i === 0)
          r = 0,
          n = !0,
          o = !0;
      else {
          r = (s - e.minTranslate()) / i;
          let d = Math.abs(s - e.minTranslate()) < 1
            , c = Math.abs(s - e.maxTranslate()) < 1;
          n = d || r <= 0,
          o = c || r >= 1,
          d && (r = 0),
          c && (r = 1)
      }
      if (t.loop) {
          let d = e.getSlideIndexByData(0)
            , c = e.getSlideIndexByData(e.slides.length - 1)
            , u = e.slidesGrid[d]
            , m = e.slidesGrid[c]
            , g = e.slidesGrid[e.slidesGrid.length - 1]
            , y = Math.abs(s);
          y >= u ? l = (y - u) / g : l = (y + g - m) / g,
          l > 1 && (l -= 1)
      }
      Object.assign(e, {
          progress: r,
          progressLoop: l,
          isBeginning: n,
          isEnd: o
      }),
      (t.watchSlidesProgress || t.centeredSlides && t.autoHeight) && e.updateSlidesProgress(s),
      n && !a && e.emit("reachBeginning toEdge"),
      o && !h && e.emit("reachEnd toEdge"),
      (a && !n || h && !o) && e.emit("fromEdge"),
      e.emit("progress", r)
  }
  var Fs = (s,e,t)=>{
      e && !s.classList.contains(t) ? s.classList.add(t) : !e && s.classList.contains(t) && s.classList.remove(t)
  }
  ;
  function Ra() {
      let s = this, {slides: e, params: t, slidesEl: i, activeIndex: r} = s, n = s.virtual && t.virtual.enabled, o = s.grid && t.grid && t.grid.rows > 1, l = c=>Y(i, `.${t.slideClass}${c}, swiper-slide${c}`)[0], a, h, d;
      if (n)
          if (t.loop) {
              let c = r - s.virtual.slidesBefore;
              c < 0 && (c = s.virtual.slides.length + c),
              c >= s.virtual.slides.length && (c -= s.virtual.slides.length),
              a = l(`[data-swiper-slide-index="${c}"]`)
          } else
              a = l(`[data-swiper-slide-index="${r}"]`);
      else
          o ? (a = e.filter(c=>c.column === r)[0],
          d = e.filter(c=>c.column === r + 1)[0],
          h = e.filter(c=>c.column === r - 1)[0]) : a = e[r];
      a && (o || (d = Ji(a, `.${t.slideClass}, swiper-slide`)[0],
      t.loop && !d && (d = e[0]),
      h = Zi(a, `.${t.slideClass}, swiper-slide`)[0],
      t.loop && !h === 0 && (h = e[e.length - 1]))),
      e.forEach(c=>{
          Fs(c, c === a, t.slideActiveClass),
          Fs(c, c === d, t.slideNextClass),
          Fs(c, c === h, t.slidePrevClass)
      }
      ),
      s.emitSlidesClasses()
  }
  var Dt = (s,e)=>{
      if (!s || s.destroyed || !s.params)
          return;
      let t = ()=>s.isElement ? "swiper-slide" : `.${s.params.slideClass}`
        , i = e.closest(t());
      if (i) {
          let r = i.querySelector(`.${s.params.lazyPreloaderClass}`);
          !r && s.isElement && (i.shadowRoot ? r = i.shadowRoot.querySelector(`.${s.params.lazyPreloaderClass}`) : requestAnimationFrame(()=>{
              i.shadowRoot && (r = i.shadowRoot.querySelector(`.${s.params.lazyPreloaderClass}`),
              r && r.remove())
          }
          )),
          r && r.remove()
      }
  }
    , Bs = (s,e)=>{
      if (!s.slides[e])
          return;
      let t = s.slides[e].querySelector('[loading="lazy"]');
      t && t.removeAttribute("loading")
  }
    , Ns = s=>{
      if (!s || s.destroyed || !s.params)
          return;
      let e = s.params.lazyPreloadPrevNext
        , t = s.slides.length;
      if (!t || !e || e < 0)
          return;
      e = Math.min(e, t);
      let i = s.params.slidesPerView === "auto" ? s.slidesPerViewDynamic() : Math.ceil(s.params.slidesPerView)
        , r = s.activeIndex;
      if (s.params.grid && s.params.grid.rows > 1) {
          let o = r
            , l = [o - e];
          l.push(...Array.from({
              length: e
          }).map((a,h)=>o + i + h)),
          s.slides.forEach((a,h)=>{
              l.includes(a.column) && Bs(s, h)
          }
          );
          return
      }
      let n = r + i - 1;
      if (s.params.rewind || s.params.loop)
          for (let o = r - e; o <= n + e; o += 1) {
              let l = (o % t + t) % t;
              (l < r || l > n) && Bs(s, l)
          }
      else
          for (let o = Math.max(r - e, 0); o <= Math.min(n + e, t - 1); o += 1)
              o !== r && (o > n || o < r) && Bs(s, o)
  }
  ;
  function Da(s) {
      let {slidesGrid: e, params: t} = s, i = s.rtlTranslate ? s.translate : -s.translate, r;
      for (let n = 0; n < e.length; n += 1)
          typeof e[n + 1] < "u" ? i >= e[n] && i < e[n + 1] - (e[n + 1] - e[n]) / 2 ? r = n : i >= e[n] && i < e[n + 1] && (r = n + 1) : i >= e[n] && (r = n);
      return t.normalizeSlideIndex && (r < 0 || typeof r > "u") && (r = 0),
      r
  }
  function Fa(s) {
      let e = this, t = e.rtlTranslate ? e.translate : -e.translate, {snapGrid: i, params: r, activeIndex: n, realIndex: o, snapIndex: l} = e, a = s, h, d = m=>{
          let g = m - e.virtual.slidesBefore;
          return g < 0 && (g = e.virtual.slides.length + g),
          g >= e.virtual.slides.length && (g -= e.virtual.slides.length),
          g
      }
      ;
      if (typeof a > "u" && (a = Da(e)),
      i.indexOf(t) >= 0)
          h = i.indexOf(t);
      else {
          let m = Math.min(r.slidesPerGroupSkip, a);
          h = m + Math.floor((a - m) / r.slidesPerGroup)
      }
      if (h >= i.length && (h = i.length - 1),
      a === n && !e.params.loop) {
          h !== l && (e.snapIndex = h,
          e.emit("snapIndexChange"));
          return
      }
      if (a === n && e.params.loop && e.virtual && e.params.virtual.enabled) {
          e.realIndex = d(a);
          return
      }
      let c = e.grid && r.grid && r.grid.rows > 1, u;
      if (e.virtual && r.virtual.enabled && r.loop)
          u = d(a);
      else if (c) {
          let m = e.slides.filter(y=>y.column === a)[0]
            , g = parseInt(m.getAttribute("data-swiper-slide-index"), 10);
          Number.isNaN(g) && (g = Math.max(e.slides.indexOf(m), 0)),
          u = Math.floor(g / r.grid.rows)
      } else if (e.slides[a]) {
          let m = e.slides[a].getAttribute("data-swiper-slide-index");
          m ? u = parseInt(m, 10) : u = a
      } else
          u = a;
      Object.assign(e, {
          previousSnapIndex: l,
          snapIndex: h,
          previousRealIndex: o,
          realIndex: u,
          previousIndex: n,
          activeIndex: a
      }),
      e.initialized && Ns(e),
      e.emit("activeIndexChange"),
      e.emit("snapIndexChange"),
      (e.initialized || e.params.runCallbacksOnInit) && (o !== u && e.emit("realIndexChange"),
      e.emit("slideChange"))
  }
  function Ba(s, e) {
      let t = this
        , i = t.params
        , r = s.closest(`.${i.slideClass}, swiper-slide`);
      !r && t.isElement && e && e.length > 1 && e.includes(s) && [...e.slice(e.indexOf(s) + 1, e.length)].forEach(l=>{
          !r && l.matches && l.matches(`.${i.slideClass}, swiper-slide`) && (r = l)
      }
      );
      let n = !1, o;
      if (r) {
          for (let l = 0; l < t.slides.length; l += 1)
              if (t.slides[l] === r) {
                  n = !0,
                  o = l;
                  break
              }
      }
      if (r && n)
          t.clickedSlide = r,
          t.virtual && t.params.virtual.enabled ? t.clickedIndex = parseInt(r.getAttribute("data-swiper-slide-index"), 10) : t.clickedIndex = o;
      else {
          t.clickedSlide = void 0,
          t.clickedIndex = void 0;
          return
      }
      i.slideToClickedSlide && t.clickedIndex !== void 0 && t.clickedIndex !== t.activeIndex && t.slideToClickedSlide()
  }
  var $a = {
      updateSize: Aa,
      updateSlides: La,
      updateAutoHeight: Pa,
      updateSlidesOffset: Ia,
      updateSlidesProgress: Oa,
      updateProgress: ka,
      updateSlidesClasses: Ra,
      updateActiveIndex: Fa,
      updateClickedSlide: Ba
  };
  function Va(s) {
      s === void 0 && (s = this.isHorizontal() ? "x" : "y");
      let e = this
        , {params: t, rtlTranslate: i, translate: r, wrapperEl: n} = e;
      if (t.virtualTranslate)
          return i ? -r : r;
      if (t.cssMode)
          return r;
      let o = rt(n, s);
      return o += e.cssOverflowAdjustment(),
      i && (o = -o),
      o || 0
  }
  function Na(s, e) {
      let t = this
        , {rtlTranslate: i, params: r, wrapperEl: n, progress: o} = t
        , l = 0
        , a = 0
        , h = 0;
      t.isHorizontal() ? l = i ? -s : s : a = s,
      r.roundLengths && (l = Math.floor(l),
      a = Math.floor(a)),
      t.previousTranslate = t.translate,
      t.translate = t.isHorizontal() ? l : a,
      r.cssMode ? n[t.isHorizontal() ? "scrollLeft" : "scrollTop"] = t.isHorizontal() ? -l : -a : r.virtualTranslate || (t.isHorizontal() ? l -= t.cssOverflowAdjustment() : a -= t.cssOverflowAdjustment(),
      n.style.transform = `translate3d(${l}px, ${a}px, ${h}px)`);
      let d, c = t.maxTranslate() - t.minTranslate();
      c === 0 ? d = 0 : d = (s - t.minTranslate()) / c,
      d !== o && t.updateProgress(s),
      t.emit("setTranslate", t.translate, e)
  }
  function za() {
      return -this.snapGrid[0]
  }
  function Ha() {
      return -this.snapGrid[this.snapGrid.length - 1]
  }
  function qa(s, e, t, i, r) {
      s === void 0 && (s = 0),
      e === void 0 && (e = this.params.speed),
      t === void 0 && (t = !0),
      i === void 0 && (i = !0);
      let n = this
        , {params: o, wrapperEl: l} = n;
      if (n.animating && o.preventInteractionOnTransition)
          return !1;
      let a = n.minTranslate(), h = n.maxTranslate(), d;
      if (i && s > a ? d = a : i && s < h ? d = h : d = s,
      n.updateProgress(d),
      o.cssMode) {
          let c = n.isHorizontal();
          if (e === 0)
              l[c ? "scrollLeft" : "scrollTop"] = -d;
          else {
              if (!n.support.smoothScroll)
                  return Os({
                      swiper: n,
                      targetPosition: -d,
                      side: c ? "left" : "top"
                  }),
                  !0;
              l.scrollTo({
                  [c ? "left" : "top"]: -d,
                  behavior: "smooth"
              })
          }
          return !0
      }
      return e === 0 ? (n.setTransition(0),
      n.setTranslate(d),
      t && (n.emit("beforeTransitionStart", e, r),
      n.emit("transitionEnd"))) : (n.setTransition(e),
      n.setTranslate(d),
      t && (n.emit("beforeTransitionStart", e, r),
      n.emit("transitionStart")),
      n.animating || (n.animating = !0,
      n.onTranslateToWrapperTransitionEnd || (n.onTranslateToWrapperTransitionEnd = function(u) {
          !n || n.destroyed || u.target === this && (n.wrapperEl.removeEventListener("transitionend", n.onTranslateToWrapperTransitionEnd),
          n.onTranslateToWrapperTransitionEnd = null,
          delete n.onTranslateToWrapperTransitionEnd,
          n.animating = !1,
          t && n.emit("transitionEnd"))
      }
      ),
      n.wrapperEl.addEventListener("transitionend", n.onTranslateToWrapperTransitionEnd))),
      !0
  }
  var Wa = {
      getTranslate: Va,
      setTranslate: Na,
      minTranslate: za,
      maxTranslate: Ha,
      translateTo: qa
  };
  function _a(s, e) {
      let t = this;
      t.params.cssMode || (t.wrapperEl.style.transitionDuration = `${s}ms`,
      t.wrapperEl.style.transitionDelay = s === 0 ? "0ms" : ""),
      t.emit("setTransition", s, e)
  }
  function nr(s) {
      let {swiper: e, runCallbacks: t, direction: i, step: r} = s
        , {activeIndex: n, previousIndex: o} = e
        , l = i;
      if (l || (n > o ? l = "next" : n < o ? l = "prev" : l = "reset"),
      e.emit(`transition${r}`),
      t && n !== o) {
          if (l === "reset") {
              e.emit(`slideResetTransition${r}`);
              return
          }
          e.emit(`slideChangeTransition${r}`),
          l === "next" ? e.emit(`slideNextTransition${r}`) : e.emit(`slidePrevTransition${r}`)
      }
  }
  function Ga(s, e) {
      s === void 0 && (s = !0);
      let t = this
        , {params: i} = t;
      i.cssMode || (i.autoHeight && t.updateAutoHeight(),
      nr({
          swiper: t,
          runCallbacks: s,
          direction: e,
          step: "Start"
      }))
  }
  function ja(s, e) {
      s === void 0 && (s = !0);
      let t = this
        , {params: i} = t;
      t.animating = !1,
      !i.cssMode && (t.setTransition(0),
      nr({
          swiper: t,
          runCallbacks: s,
          direction: e,
          step: "End"
      }))
  }
  var Xa = {
      setTransition: _a,
      transitionStart: Ga,
      transitionEnd: ja
  };
  function Ya(s, e, t, i, r) {
      s === void 0 && (s = 0),
      t === void 0 && (t = !0),
      typeof s == "string" && (s = parseInt(s, 10));
      let n = this
        , o = s;
      o < 0 && (o = 0);
      let {params: l, snapGrid: a, slidesGrid: h, previousIndex: d, activeIndex: c, rtlTranslate: u, wrapperEl: m, enabled: g} = n;
      if (!g && !i && !r || n.destroyed || n.animating && l.preventInteractionOnTransition)
          return !1;
      typeof e > "u" && (e = n.params.speed);
      let y = Math.min(n.params.slidesPerGroupSkip, o)
        , w = y + Math.floor((o - y) / n.params.slidesPerGroup);
      w >= a.length && (w = a.length - 1);
      let f = -a[w];
      if (l.normalizeSlideIndex)
          for (let b = 0; b < h.length; b += 1) {
              let x = -Math.floor(f * 100)
                , k = Math.floor(h[b] * 100)
                , R = Math.floor(h[b + 1] * 100);
              typeof h[b + 1] < "u" ? x >= k && x < R - (R - k) / 2 ? o = b : x >= k && x < R && (o = b + 1) : x >= k && (o = b)
          }
      if (n.initialized && o !== c && (!n.allowSlideNext && (u ? f > n.translate && f > n.minTranslate() : f < n.translate && f < n.minTranslate()) || !n.allowSlidePrev && f > n.translate && f > n.maxTranslate() && (c || 0) !== o))
          return !1;
      o !== (d || 0) && t && n.emit("beforeSlideChangeStart"),
      n.updateProgress(f);
      let S;
      if (o > c ? S = "next" : o < c ? S = "prev" : S = "reset",
      u && -f === n.translate || !u && f === n.translate)
          return n.updateActiveIndex(o),
          l.autoHeight && n.updateAutoHeight(),
          n.updateSlidesClasses(),
          l.effect !== "slide" && n.setTranslate(f),
          S !== "reset" && (n.transitionStart(t, S),
          n.transitionEnd(t, S)),
          !1;
      if (l.cssMode) {
          let b = n.isHorizontal()
            , x = u ? f : -f;
          if (e === 0) {
              let k = n.virtual && n.params.virtual.enabled;
              k && (n.wrapperEl.style.scrollSnapType = "none",
              n._immediateVirtual = !0),
              k && !n._cssModeVirtualInitialSet && n.params.initialSlide > 0 ? (n._cssModeVirtualInitialSet = !0,
              requestAnimationFrame(()=>{
                  m[b ? "scrollLeft" : "scrollTop"] = x
              }
              )) : m[b ? "scrollLeft" : "scrollTop"] = x,
              k && requestAnimationFrame(()=>{
                  n.wrapperEl.style.scrollSnapType = "",
                  n._immediateVirtual = !1
              }
              )
          } else {
              if (!n.support.smoothScroll)
                  return Os({
                      swiper: n,
                      targetPosition: x,
                      side: b ? "left" : "top"
                  }),
                  !0;
              m.scrollTo({
                  [b ? "left" : "top"]: x,
                  behavior: "smooth"
              })
          }
          return !0
      }
      return n.setTransition(e),
      n.setTranslate(f),
      n.updateActiveIndex(o),
      n.updateSlidesClasses(),
      n.emit("beforeTransitionStart", e, i),
      n.transitionStart(t, S),
      e === 0 ? n.transitionEnd(t, S) : n.animating || (n.animating = !0,
      n.onSlideToWrapperTransitionEnd || (n.onSlideToWrapperTransitionEnd = function(x) {
          !n || n.destroyed || x.target === this && (n.wrapperEl.removeEventListener("transitionend", n.onSlideToWrapperTransitionEnd),
          n.onSlideToWrapperTransitionEnd = null,
          delete n.onSlideToWrapperTransitionEnd,
          n.transitionEnd(t, S))
      }
      ),
      n.wrapperEl.addEventListener("transitionend", n.onSlideToWrapperTransitionEnd)),
      !0
  }
  function Ua(s, e, t, i) {
      s === void 0 && (s = 0),
      t === void 0 && (t = !0),
      typeof s == "string" && (s = parseInt(s, 10));
      let r = this;
      if (r.destroyed)
          return;
      typeof e > "u" && (e = r.params.speed);
      let n = r.grid && r.params.grid && r.params.grid.rows > 1
        , o = s;
      if (r.params.loop)
          if (r.virtual && r.params.virtual.enabled)
              o = o + r.virtual.slidesBefore;
          else {
              let l;
              if (n) {
                  let u = o * r.params.grid.rows;
                  l = r.slides.filter(m=>m.getAttribute("data-swiper-slide-index") * 1 === u)[0].column
              } else
                  l = r.getSlideIndexByData(o);
              let a = n ? Math.ceil(r.slides.length / r.params.grid.rows) : r.slides.length
                , {centeredSlides: h} = r.params
                , d = r.params.slidesPerView;
              d === "auto" ? d = r.slidesPerViewDynamic() : (d = Math.ceil(parseFloat(r.params.slidesPerView, 10)),
              h && d % 2 === 0 && (d = d + 1));
              let c = a - l < d;
              if (h && (c = c || l < Math.ceil(d / 2)),
              i && h && r.params.slidesPerView !== "auto" && !n && (c = !1),
              c) {
                  let u = h ? l < r.activeIndex ? "prev" : "next" : l - r.activeIndex - 1 < r.params.slidesPerView ? "next" : "prev";
                  r.loopFix({
                      direction: u,
                      slideTo: !0,
                      activeSlideIndex: u === "next" ? l + 1 : l - a + 1,
                      slideRealIndex: u === "next" ? r.realIndex : void 0
                  })
              }
              if (n) {
                  let u = o * r.params.grid.rows;
                  o = r.slides.filter(m=>m.getAttribute("data-swiper-slide-index") * 1 === u)[0].column
              } else
                  o = r.getSlideIndexByData(o)
          }
      return requestAnimationFrame(()=>{
          r.slideTo(o, e, t, i)
      }
      ),
      r
  }
  function Ka(s, e, t) {
      e === void 0 && (e = !0);
      let i = this
        , {enabled: r, params: n, animating: o} = i;
      if (!r || i.destroyed)
          return i;
      typeof s > "u" && (s = i.params.speed);
      let l = n.slidesPerGroup;
      n.slidesPerView === "auto" && n.slidesPerGroup === 1 && n.slidesPerGroupAuto && (l = Math.max(i.slidesPerViewDynamic("current", !0), 1));
      let a = i.activeIndex < n.slidesPerGroupSkip ? 1 : l
        , h = i.virtual && n.virtual.enabled;
      if (n.loop) {
          if (o && !h && n.loopPreventsSliding)
              return !1;
          if (i.loopFix({
              direction: "next"
          }),
          i._clientLeft = i.wrapperEl.clientLeft,
          i.activeIndex === i.slides.length - 1 && n.cssMode)
              return requestAnimationFrame(()=>{
                  i.slideTo(i.activeIndex + a, s, e, t)
              }
              ),
              !0
      }
      return n.rewind && i.isEnd ? i.slideTo(0, s, e, t) : i.slideTo(i.activeIndex + a, s, e, t)
  }
  function Za(s, e, t) {
      e === void 0 && (e = !0);
      let i = this
        , {params: r, snapGrid: n, slidesGrid: o, rtlTranslate: l, enabled: a, animating: h} = i;
      if (!a || i.destroyed)
          return i;
      typeof s > "u" && (s = i.params.speed);
      let d = i.virtual && r.virtual.enabled;
      if (r.loop) {
          if (h && !d && r.loopPreventsSliding)
              return !1;
          i.loopFix({
              direction: "prev"
          }),
          i._clientLeft = i.wrapperEl.clientLeft
      }
      let c = l ? i.translate : -i.translate;
      function u(f) {
          return f < 0 ? -Math.floor(Math.abs(f)) : Math.floor(f)
      }
      let m = u(c)
        , g = n.map(f=>u(f))
        , y = n[g.indexOf(m) - 1];
      if (typeof y > "u" && r.cssMode) {
          let f;
          n.forEach((S,b)=>{
              m >= S && (f = b)
          }
          ),
          typeof f < "u" && (y = n[f > 0 ? f - 1 : f])
      }
      let w = 0;
      if (typeof y < "u" && (w = o.indexOf(y),
      w < 0 && (w = i.activeIndex - 1),
      r.slidesPerView === "auto" && r.slidesPerGroup === 1 && r.slidesPerGroupAuto && (w = w - i.slidesPerViewDynamic("previous", !0) + 1,
      w = Math.max(w, 0))),
      r.rewind && i.isBeginning) {
          let f = i.params.virtual && i.params.virtual.enabled && i.virtual ? i.virtual.slides.length - 1 : i.slides.length - 1;
          return i.slideTo(f, s, e, t)
      } else if (r.loop && i.activeIndex === 0 && r.cssMode)
          return requestAnimationFrame(()=>{
              i.slideTo(w, s, e, t)
          }
          ),
          !0;
      return i.slideTo(w, s, e, t)
  }
  function Ja(s, e, t) {
      e === void 0 && (e = !0);
      let i = this;
      if (!i.destroyed)
          return typeof s > "u" && (s = i.params.speed),
          i.slideTo(i.activeIndex, s, e, t)
  }
  function Qa(s, e, t, i) {
      e === void 0 && (e = !0),
      i === void 0 && (i = .5);
      let r = this;
      if (r.destroyed)
          return;
      typeof s > "u" && (s = r.params.speed);
      let n = r.activeIndex
        , o = Math.min(r.params.slidesPerGroupSkip, n)
        , l = o + Math.floor((n - o) / r.params.slidesPerGroup)
        , a = r.rtlTranslate ? r.translate : -r.translate;
      if (a >= r.snapGrid[l]) {
          let h = r.snapGrid[l]
            , d = r.snapGrid[l + 1];
          a - h > (d - h) * i && (n += r.params.slidesPerGroup)
      } else {
          let h = r.snapGrid[l - 1]
            , d = r.snapGrid[l];
          a - h <= (d - h) * i && (n -= r.params.slidesPerGroup)
      }
      return n = Math.max(n, 0),
      n = Math.min(n, r.slidesGrid.length - 1),
      r.slideTo(n, s, e, t)
  }
  function eo() {
      let s = this;
      if (s.destroyed)
          return;
      let {params: e, slidesEl: t} = s, i = e.slidesPerView === "auto" ? s.slidesPerViewDynamic() : e.slidesPerView, r = s.clickedIndex, n, o = s.isElement ? "swiper-slide" : `.${e.slideClass}`;
      if (e.loop) {
          if (s.animating)
              return;
          n = parseInt(s.clickedSlide.getAttribute("data-swiper-slide-index"), 10),
          e.centeredSlides ? r < s.loopedSlides - i / 2 || r > s.slides.length - s.loopedSlides + i / 2 ? (s.loopFix(),
          r = s.getSlideIndex(Y(t, `${o}[data-swiper-slide-index="${n}"]`)[0]),
          de(()=>{
              s.slideTo(r)
          }
          )) : s.slideTo(r) : r > s.slides.length - i ? (s.loopFix(),
          r = s.getSlideIndex(Y(t, `${o}[data-swiper-slide-index="${n}"]`)[0]),
          de(()=>{
              s.slideTo(r)
          }
          )) : s.slideTo(r)
      } else
          s.slideTo(r)
  }
  var to = {
      slideTo: Ya,
      slideToLoop: Ua,
      slideNext: Ka,
      slidePrev: Za,
      slideReset: Ja,
      slideToClosest: Qa,
      slideToClickedSlide: eo
  };
  function so(s) {
      let e = this
        , {params: t, slidesEl: i} = e;
      if (!t.loop || e.virtual && e.params.virtual.enabled)
          return;
      let r = ()=>{
          Y(i, `.${t.slideClass}, swiper-slide`).forEach((c,u)=>{
              c.setAttribute("data-swiper-slide-index", u)
          }
          )
      }
        , n = e.grid && t.grid && t.grid.rows > 1
        , o = t.slidesPerGroup * (n ? t.grid.rows : 1)
        , l = e.slides.length % o !== 0
        , a = n && e.slides.length % t.grid.rows !== 0
        , h = d=>{
          for (let c = 0; c < d; c += 1) {
              let u = e.isElement ? Z("swiper-slide", [t.slideBlankClass]) : Z("div", [t.slideClass, t.slideBlankClass]);
              e.slidesEl.append(u)
          }
      }
      ;
      if (l) {
          if (t.loopAddBlankSlides) {
              let d = o - e.slides.length % o;
              h(d),
              e.recalcSlides(),
              e.updateSlides()
          } else
              nt("Swiper Loop Warning: The number of slides is not even to slidesPerGroup, loop mode may not function properly. You need to add more slides (or make duplicates, or empty slides)");
          r()
      } else if (a) {
          if (t.loopAddBlankSlides) {
              let d = t.grid.rows - e.slides.length % t.grid.rows;
              h(d),
              e.recalcSlides(),
              e.updateSlides()
          } else
              nt("Swiper Loop Warning: The number of slides is not even to grid.rows, loop mode may not function properly. You need to add more slides (or make duplicates, or empty slides)");
          r()
      } else
          r();
      e.loopFix({
          slideRealIndex: s,
          direction: t.centeredSlides ? void 0 : "next"
      })
  }
  function io(s) {
      let {slideRealIndex: e, slideTo: t=!0, direction: i, setTranslate: r, activeSlideIndex: n, byController: o, byMousewheel: l} = s === void 0 ? {} : s
        , a = this;
      if (!a.params.loop)
          return;
      a.emit("beforeLoopFix");
      let {slides: h, allowSlidePrev: d, allowSlideNext: c, slidesEl: u, params: m} = a
        , {centeredSlides: g} = m;
      if (a.allowSlidePrev = !0,
      a.allowSlideNext = !0,
      a.virtual && m.virtual.enabled) {
          t && (!m.centeredSlides && a.snapIndex === 0 ? a.slideTo(a.virtual.slides.length, 0, !1, !0) : m.centeredSlides && a.snapIndex < m.slidesPerView ? a.slideTo(a.virtual.slides.length + a.snapIndex, 0, !1, !0) : a.snapIndex === a.snapGrid.length - 1 && a.slideTo(a.virtual.slidesBefore, 0, !1, !0)),
          a.allowSlidePrev = d,
          a.allowSlideNext = c,
          a.emit("loopFix");
          return
      }
      let y = m.slidesPerView;
      y === "auto" ? y = a.slidesPerViewDynamic() : (y = Math.ceil(parseFloat(m.slidesPerView, 10)),
      g && y % 2 === 0 && (y = y + 1));
      let w = m.slidesPerGroupAuto ? y : m.slidesPerGroup
        , f = w;
      f % w !== 0 && (f += w - f % w),
      f += m.loopAdditionalSlides,
      a.loopedSlides = f;
      let S = a.grid && m.grid && m.grid.rows > 1;
      h.length < y + f ? nt("Swiper Loop Warning: The number of slides is not enough for loop mode, it will be disabled and not function properly. You need to add more slides (or make duplicates) or lower the values of slidesPerView and slidesPerGroup parameters") : S && m.grid.fill === "row" && nt("Swiper Loop Warning: Loop mode is not compatible with grid.fill = `row`");
      let b = []
        , x = []
        , k = a.activeIndex;
      typeof n > "u" ? n = a.getSlideIndex(h.filter(A=>A.classList.contains(m.slideActiveClass))[0]) : k = n;
      let R = i === "next" || !i
        , $ = i === "prev" || !i
        , I = 0
        , O = 0
        , L = S ? Math.ceil(h.length / m.grid.rows) : h.length
        , C = (S ? h[n].column : n) + (g && typeof r > "u" ? -y / 2 + .5 : 0);
      if (C < f) {
          I = Math.max(f - C, w);
          for (let A = 0; A < f - C; A += 1) {
              let P = A - Math.floor(A / L) * L;
              if (S) {
                  let B = L - P - 1;
                  for (let E = h.length - 1; E >= 0; E -= 1)
                      h[E].column === B && b.push(E)
              } else
                  b.push(L - P - 1)
          }
      } else if (C + y > L - f) {
          O = Math.max(C - (L - f * 2), w);
          for (let A = 0; A < O; A += 1) {
              let P = A - Math.floor(A / L) * L;
              S ? h.forEach((B,E)=>{
                  B.column === P && x.push(E)
              }
              ) : x.push(P)
          }
      }
      if (a.__preventObserver__ = !0,
      requestAnimationFrame(()=>{
          a.__preventObserver__ = !1
      }
      ),
      $ && b.forEach(A=>{
          h[A].swiperLoopMoveDOM = !0,
          u.prepend(h[A]),
          h[A].swiperLoopMoveDOM = !1
      }
      ),
      R && x.forEach(A=>{
          h[A].swiperLoopMoveDOM = !0,
          u.append(h[A]),
          h[A].swiperLoopMoveDOM = !1
      }
      ),
      a.recalcSlides(),
      m.slidesPerView === "auto" ? a.updateSlides() : S && (b.length > 0 && $ || x.length > 0 && R) && a.slides.forEach((A,P)=>{
          a.grid.updateSlide(P, A, a.slides)
      }
      ),
      m.watchSlidesProgress && a.updateSlidesOffset(),
      t) {
          if (b.length > 0 && $) {
              if (typeof e > "u") {
                  let A = a.slidesGrid[k]
                    , B = a.slidesGrid[k + I] - A;
                  l ? a.setTranslate(a.translate - B) : (a.slideTo(k + Math.ceil(I), 0, !1, !0),
                  r && (a.touchEventsData.startTranslate = a.touchEventsData.startTranslate - B,
                  a.touchEventsData.currentTranslate = a.touchEventsData.currentTranslate - B))
              } else if (r) {
                  let A = S ? b.length / m.grid.rows : b.length;
                  a.slideTo(a.activeIndex + A, 0, !1, !0),
                  a.touchEventsData.currentTranslate = a.translate
              }
          } else if (x.length > 0 && R)
              if (typeof e > "u") {
                  let A = a.slidesGrid[k]
                    , B = a.slidesGrid[k - O] - A;
                  l ? a.setTranslate(a.translate - B) : (a.slideTo(k - O, 0, !1, !0),
                  r && (a.touchEventsData.startTranslate = a.touchEventsData.startTranslate - B,
                  a.touchEventsData.currentTranslate = a.touchEventsData.currentTranslate - B))
              } else {
                  let A = S ? x.length / m.grid.rows : x.length;
                  a.slideTo(a.activeIndex - A, 0, !1, !0)
              }
      }
      if (a.allowSlidePrev = d,
      a.allowSlideNext = c,
      a.controller && a.controller.control && !o) {
          let A = {
              slideRealIndex: e,
              direction: i,
              setTranslate: r,
              activeSlideIndex: n,
              byController: !0
          };
          Array.isArray(a.controller.control) ? a.controller.control.forEach(P=>{
              !P.destroyed && P.params.loop && P.loopFix({
                  ...A,
                  slideTo: P.params.slidesPerView === m.slidesPerView ? t : !1
              })
          }
          ) : a.controller.control instanceof a.constructor && a.controller.control.params.loop && a.controller.control.loopFix({
              ...A,
              slideTo: a.controller.control.params.slidesPerView === m.slidesPerView ? t : !1
          })
      }
      a.emit("loopFix")
  }
  function ro() {
      let s = this
        , {params: e, slidesEl: t} = s;
      if (!e.loop || s.virtual && s.params.virtual.enabled)
          return;
      s.recalcSlides();
      let i = [];
      s.slides.forEach(r=>{
          let n = typeof r.swiperSlideIndex > "u" ? r.getAttribute("data-swiper-slide-index") * 1 : r.swiperSlideIndex;
          i[n] = r
      }
      ),
      s.slides.forEach(r=>{
          r.removeAttribute("data-swiper-slide-index")
      }
      ),
      i.forEach(r=>{
          t.append(r)
      }
      ),
      s.recalcSlides(),
      s.slideTo(s.realIndex, 0)
  }
  var no = {
      loopCreate: so,
      loopFix: io,
      loopDestroy: ro
  };
  function ao(s) {
      let e = this;
      if (!e.params.simulateTouch || e.params.watchOverflow && e.isLocked || e.params.cssMode)
          return;
      let t = e.params.touchEventsTarget === "container" ? e.el : e.wrapperEl;
      e.isElement && (e.__preventObserver__ = !0),
      t.style.cursor = "move",
      t.style.cursor = s ? "grabbing" : "grab",
      e.isElement && requestAnimationFrame(()=>{
          e.__preventObserver__ = !1
      }
      )
  }
  function oo() {
      let s = this;
      s.params.watchOverflow && s.isLocked || s.params.cssMode || (s.isElement && (s.__preventObserver__ = !0),
      s[s.params.touchEventsTarget === "container" ? "el" : "wrapperEl"].style.cursor = "",
      s.isElement && requestAnimationFrame(()=>{
          s.__preventObserver__ = !1
      }
      ))
  }
  var lo = {
      setGrabCursor: ao,
      unsetGrabCursor: oo
  };
  function co(s, e) {
      e === void 0 && (e = this);
      function t(i) {
          if (!i || i === X() || i === _())
              return null;
          i.assignedSlot && (i = i.assignedSlot);
          let r = i.closest(s);
          return !r && !i.getRootNode ? null : r || t(i.getRootNode().host)
      }
      return t(e)
  }
  function Qi(s, e, t) {
      let i = _()
        , {params: r} = s
        , n = r.edgeSwipeDetection
        , o = r.edgeSwipeThreshold;
      return n && (t <= o || t >= i.innerWidth - o) ? n === "prevent" ? (e.preventDefault(),
      !0) : !1 : !0
  }
  function uo(s) {
      let e = this
        , t = X()
        , i = s;
      i.originalEvent && (i = i.originalEvent);
      let r = e.touchEventsData;
      if (i.type === "pointerdown") {
          if (r.pointerId !== null && r.pointerId !== i.pointerId)
              return;
          r.pointerId = i.pointerId
      } else
          i.type === "touchstart" && i.targetTouches.length === 1 && (r.touchId = i.targetTouches[0].identifier);
      if (i.type === "touchstart") {
          Qi(e, i, i.targetTouches[0].pageX);
          return
      }
      let {params: n, touches: o, enabled: l} = e;
      if (!l || !n.simulateTouch && i.pointerType === "mouse" || e.animating && n.preventInteractionOnTransition)
          return;
      !e.animating && n.cssMode && n.loop && e.loopFix();
      let a = i.target;
      if (n.touchEventsTarget === "wrapper" && !e.wrapperEl.contains(a) || "which"in i && i.which === 3 || "button"in i && i.button > 0 || r.isTouched && r.isMoved)
          return;
      let h = !!n.noSwipingClass && n.noSwipingClass !== ""
        , d = i.composedPath ? i.composedPath() : i.path;
      h && i.target && i.target.shadowRoot && d && (a = d[0]);
      let c = n.noSwipingSelector ? n.noSwipingSelector : `.${n.noSwipingClass}`
        , u = !!(i.target && i.target.shadowRoot);
      if (n.noSwiping && (u ? co(c, a) : a.closest(c))) {
          e.allowClick = !0;
          return
      }
      if (n.swipeHandler && !a.closest(n.swipeHandler))
          return;
      o.currentX = i.pageX,
      o.currentY = i.pageY;
      let m = o.currentX
        , g = o.currentY;
      if (!Qi(e, i, m))
          return;
      Object.assign(r, {
          isTouched: !0,
          isMoved: !1,
          allowTouchCallbacks: !0,
          isScrolling: void 0,
          startMoving: void 0
      }),
      o.startX = m,
      o.startY = g,
      r.touchStartTime = te(),
      e.allowClick = !0,
      e.updateSize(),
      e.swipeDirection = void 0,
      n.threshold > 0 && (r.allowThresholdMove = !1);
      let y = !0;
      a.matches(r.focusableElements) && (y = !1,
      a.nodeName === "SELECT" && (r.isTouched = !1)),
      t.activeElement && t.activeElement.matches(r.focusableElements) && t.activeElement !== a && t.activeElement.blur();
      let w = y && e.allowTouchMove && n.touchStartPreventDefault;
      (n.touchStartForcePreventDefault || w) && !a.isContentEditable && i.preventDefault(),
      n.freeMode && n.freeMode.enabled && e.freeMode && e.animating && !n.cssMode && e.freeMode.onTouchStart(),
      e.emit("touchStart", i)
  }
  function ho(s) {
      let e = X()
        , t = this
        , i = t.touchEventsData
        , {params: r, touches: n, rtlTranslate: o, enabled: l} = t;
      if (!l || !r.simulateTouch && s.pointerType === "mouse")
          return;
      let a = s;
      if (a.originalEvent && (a = a.originalEvent),
      a.type === "pointermove" && (i.touchId !== null || a.pointerId !== i.pointerId))
          return;
      let h;
      if (a.type === "touchmove") {
          if (h = [...a.changedTouches].filter(R=>R.identifier === i.touchId)[0],
          !h || h.identifier !== i.touchId)
              return
      } else
          h = a;
      if (!i.isTouched) {
          i.startMoving && i.isScrolling && t.emit("touchMoveOpposite", a);
          return
      }
      let d = h.pageX
        , c = h.pageY;
      if (a.preventedByNestedSwiper) {
          n.startX = d,
          n.startY = c;
          return
      }
      if (!t.allowTouchMove) {
          a.target.matches(i.focusableElements) || (t.allowClick = !1),
          i.isTouched && (Object.assign(n, {
              startX: d,
              startY: c,
              currentX: d,
              currentY: c
          }),
          i.touchStartTime = te());
          return
      }
      if (r.touchReleaseOnEdges && !r.loop) {
          if (t.isVertical()) {
              if (c < n.startY && t.translate <= t.maxTranslate() || c > n.startY && t.translate >= t.minTranslate()) {
                  i.isTouched = !1,
                  i.isMoved = !1;
                  return
              }
          } else if (d < n.startX && t.translate <= t.maxTranslate() || d > n.startX && t.translate >= t.minTranslate())
              return
      }
      if (e.activeElement && a.target === e.activeElement && a.target.matches(i.focusableElements)) {
          i.isMoved = !0,
          t.allowClick = !1;
          return
      }
      i.allowTouchCallbacks && t.emit("touchMove", a),
      n.previousX = n.currentX,
      n.previousY = n.currentY,
      n.currentX = d,
      n.currentY = c;
      let u = n.currentX - n.startX
        , m = n.currentY - n.startY;
      if (t.params.threshold && Math.sqrt(u ** 2 + m ** 2) < t.params.threshold)
          return;
      if (typeof i.isScrolling > "u") {
          let R;
          t.isHorizontal() && n.currentY === n.startY || t.isVertical() && n.currentX === n.startX ? i.isScrolling = !1 : u * u + m * m >= 25 && (R = Math.atan2(Math.abs(m), Math.abs(u)) * 180 / Math.PI,
          i.isScrolling = t.isHorizontal() ? R > r.touchAngle : 90 - R > r.touchAngle)
      }
      if (i.isScrolling && t.emit("touchMoveOpposite", a),
      typeof i.startMoving > "u" && (n.currentX !== n.startX || n.currentY !== n.startY) && (i.startMoving = !0),
      i.isScrolling) {
          i.isTouched = !1;
          return
      }
      if (!i.startMoving)
          return;
      t.allowClick = !1,
      !r.cssMode && a.cancelable && a.preventDefault(),
      r.touchMoveStopPropagation && !r.nested && a.stopPropagation();
      let g = t.isHorizontal() ? u : m
        , y = t.isHorizontal() ? n.currentX - n.previousX : n.currentY - n.previousY;
      r.oneWayMovement && (g = Math.abs(g) * (o ? 1 : -1),
      y = Math.abs(y) * (o ? 1 : -1)),
      n.diff = g,
      g *= r.touchRatio,
      o && (g = -g,
      y = -y);
      let w = t.touchesDirection;
      t.swipeDirection = g > 0 ? "prev" : "next",
      t.touchesDirection = y > 0 ? "prev" : "next";
      let f = t.params.loop && !r.cssMode
        , S = t.touchesDirection === "next" && t.allowSlideNext || t.touchesDirection === "prev" && t.allowSlidePrev;
      if (!i.isMoved) {
          if (f && S && t.loopFix({
              direction: t.swipeDirection
          }),
          i.startTranslate = t.getTranslate(),
          t.setTransition(0),
          t.animating) {
              let R = new window.CustomEvent("transitionend",{
                  bubbles: !0,
                  cancelable: !0
              });
              t.wrapperEl.dispatchEvent(R)
          }
          i.allowMomentumBounce = !1,
          r.grabCursor && (t.allowSlideNext === !0 || t.allowSlidePrev === !0) && t.setGrabCursor(!0),
          t.emit("sliderFirstMove", a)
      }
      let b;
      if (new Date().getTime(),
      i.isMoved && i.allowThresholdMove && w !== t.touchesDirection && f && S && Math.abs(g) >= 1) {
          Object.assign(n, {
              startX: d,
              startY: c,
              currentX: d,
              currentY: c,
              startTranslate: i.currentTranslate
          }),
          i.loopSwapReset = !0,
          i.startTranslate = i.currentTranslate;
          return
      }
      t.emit("sliderMove", a),
      i.isMoved = !0,
      i.currentTranslate = g + i.startTranslate;
      let x = !0
        , k = r.resistanceRatio;
      if (r.touchReleaseOnEdges && (k = 0),
      g > 0 ? (f && S && !b && i.allowThresholdMove && i.currentTranslate > (r.centeredSlides ? t.minTranslate() - t.slidesSizesGrid[t.activeIndex + 1] : t.minTranslate()) && t.loopFix({
          direction: "prev",
          setTranslate: !0,
          activeSlideIndex: 0
      }),
      i.currentTranslate > t.minTranslate() && (x = !1,
      r.resistance && (i.currentTranslate = t.minTranslate() - 1 + (-t.minTranslate() + i.startTranslate + g) ** k))) : g < 0 && (f && S && !b && i.allowThresholdMove && i.currentTranslate < (r.centeredSlides ? t.maxTranslate() + t.slidesSizesGrid[t.slidesSizesGrid.length - 1] : t.maxTranslate()) && t.loopFix({
          direction: "next",
          setTranslate: !0,
          activeSlideIndex: t.slides.length - (r.slidesPerView === "auto" ? t.slidesPerViewDynamic() : Math.ceil(parseFloat(r.slidesPerView, 10)))
      }),
      i.currentTranslate < t.maxTranslate() && (x = !1,
      r.resistance && (i.currentTranslate = t.maxTranslate() + 1 - (t.maxTranslate() - i.startTranslate - g) ** k))),
      x && (a.preventedByNestedSwiper = !0),
      !t.allowSlideNext && t.swipeDirection === "next" && i.currentTranslate < i.startTranslate && (i.currentTranslate = i.startTranslate),
      !t.allowSlidePrev && t.swipeDirection === "prev" && i.currentTranslate > i.startTranslate && (i.currentTranslate = i.startTranslate),
      !t.allowSlidePrev && !t.allowSlideNext && (i.currentTranslate = i.startTranslate),
      r.threshold > 0)
          if (Math.abs(g) > r.threshold || i.allowThresholdMove) {
              if (!i.allowThresholdMove) {
                  i.allowThresholdMove = !0,
                  n.startX = n.currentX,
                  n.startY = n.currentY,
                  i.currentTranslate = i.startTranslate,
                  n.diff = t.isHorizontal() ? n.currentX - n.startX : n.currentY - n.startY;
                  return
              }
          } else {
              i.currentTranslate = i.startTranslate;
              return
          }
      !r.followFinger || r.cssMode || ((r.freeMode && r.freeMode.enabled && t.freeMode || r.watchSlidesProgress) && (t.updateActiveIndex(),
      t.updateSlidesClasses()),
      r.freeMode && r.freeMode.enabled && t.freeMode && t.freeMode.onTouchMove(),
      t.updateProgress(i.currentTranslate),
      t.setTranslate(i.currentTranslate))
  }
  function fo(s) {
      let e = this
        , t = e.touchEventsData
        , i = s;
      i.originalEvent && (i = i.originalEvent);
      let r;
      if (i.type === "touchend" || i.type === "touchcancel") {
          if (r = [...i.changedTouches].filter(k=>k.identifier === t.touchId)[0],
          !r || r.identifier !== t.touchId)
              return
      } else {
          if (t.touchId !== null || i.pointerId !== t.pointerId)
              return;
          r = i
      }
      if (["pointercancel", "pointerout", "pointerleave", "contextmenu"].includes(i.type) && !(["pointercancel", "contextmenu"].includes(i.type) && (e.browser.isSafari || e.browser.isWebView)))
          return;
      t.pointerId = null,
      t.touchId = null;
      let {params: o, touches: l, rtlTranslate: a, slidesGrid: h, enabled: d} = e;
      if (!d || !o.simulateTouch && i.pointerType === "mouse")
          return;
      if (t.allowTouchCallbacks && e.emit("touchEnd", i),
      t.allowTouchCallbacks = !1,
      !t.isTouched) {
          t.isMoved && o.grabCursor && e.setGrabCursor(!1),
          t.isMoved = !1,
          t.startMoving = !1;
          return
      }
      o.grabCursor && t.isMoved && t.isTouched && (e.allowSlideNext === !0 || e.allowSlidePrev === !0) && e.setGrabCursor(!1);
      let c = te()
        , u = c - t.touchStartTime;
      if (e.allowClick) {
          let k = i.path || i.composedPath && i.composedPath();
          e.updateClickedSlide(k && k[0] || i.target, k),
          e.emit("tap click", i),
          u < 300 && c - t.lastClickTime < 300 && e.emit("doubleTap doubleClick", i)
      }
      if (t.lastClickTime = te(),
      de(()=>{
          e.destroyed || (e.allowClick = !0)
      }
      ),
      !t.isTouched || !t.isMoved || !e.swipeDirection || l.diff === 0 && !t.loopSwapReset || t.currentTranslate === t.startTranslate && !t.loopSwapReset) {
          t.isTouched = !1,
          t.isMoved = !1,
          t.startMoving = !1;
          return
      }
      t.isTouched = !1,
      t.isMoved = !1,
      t.startMoving = !1;
      let m;
      if (o.followFinger ? m = a ? e.translate : -e.translate : m = -t.currentTranslate,
      o.cssMode)
          return;
      if (o.freeMode && o.freeMode.enabled) {
          e.freeMode.onTouchEnd({
              currentPos: m
          });
          return
      }
      let g = m >= -e.maxTranslate() && !e.params.loop
        , y = 0
        , w = e.slidesSizesGrid[0];
      for (let k = 0; k < h.length; k += k < o.slidesPerGroupSkip ? 1 : o.slidesPerGroup) {
          let R = k < o.slidesPerGroupSkip - 1 ? 1 : o.slidesPerGroup;
          typeof h[k + R] < "u" ? (g || m >= h[k] && m < h[k + R]) && (y = k,
          w = h[k + R] - h[k]) : (g || m >= h[k]) && (y = k,
          w = h[h.length - 1] - h[h.length - 2])
      }
      let f = null
        , S = null;
      o.rewind && (e.isBeginning ? S = o.virtual && o.virtual.enabled && e.virtual ? e.virtual.slides.length - 1 : e.slides.length - 1 : e.isEnd && (f = 0));
      let b = (m - h[y]) / w
        , x = y < o.slidesPerGroupSkip - 1 ? 1 : o.slidesPerGroup;
      if (u > o.longSwipesMs) {
          if (!o.longSwipes) {
              e.slideTo(e.activeIndex);
              return
          }
          e.swipeDirection === "next" && (b >= o.longSwipesRatio ? e.slideTo(o.rewind && e.isEnd ? f : y + x) : e.slideTo(y)),
          e.swipeDirection === "prev" && (b > 1 - o.longSwipesRatio ? e.slideTo(y + x) : S !== null && b < 0 && Math.abs(b) > o.longSwipesRatio ? e.slideTo(S) : e.slideTo(y))
      } else {
          if (!o.shortSwipes) {
              e.slideTo(e.activeIndex);
              return
          }
          e.navigation && (i.target === e.navigation.nextEl || i.target === e.navigation.prevEl) ? i.target === e.navigation.nextEl ? e.slideTo(y + x) : e.slideTo(y) : (e.swipeDirection === "next" && e.slideTo(f !== null ? f : y + x),
          e.swipeDirection === "prev" && e.slideTo(S !== null ? S : y))
      }
  }
  function er() {
      let s = this
        , {params: e, el: t} = s;
      if (t && t.offsetWidth === 0)
          return;
      e.breakpoints && s.setBreakpoint();
      let {allowSlideNext: i, allowSlidePrev: r, snapGrid: n} = s
        , o = s.virtual && s.params.virtual.enabled;
      s.allowSlideNext = !0,
      s.allowSlidePrev = !0,
      s.updateSize(),
      s.updateSlides(),
      s.updateSlidesClasses();
      let l = o && e.loop;
      (e.slidesPerView === "auto" || e.slidesPerView > 1) && s.isEnd && !s.isBeginning && !s.params.centeredSlides && !l ? s.slideTo(s.slides.length - 1, 0, !1, !0) : s.params.loop && !o ? s.slideToLoop(s.realIndex, 0, !1, !0) : s.slideTo(s.activeIndex, 0, !1, !0),
      s.autoplay && s.autoplay.running && s.autoplay.paused && (clearTimeout(s.autoplay.resizeTimeout),
      s.autoplay.resizeTimeout = setTimeout(()=>{
          s.autoplay && s.autoplay.running && s.autoplay.paused && s.autoplay.resume()
      }
      , 500)),
      s.allowSlidePrev = r,
      s.allowSlideNext = i,
      s.params.watchOverflow && n !== s.snapGrid && s.checkOverflow()
  }
  function po(s) {
      let e = this;
      e.enabled && (e.allowClick || (e.params.preventClicks && s.preventDefault(),
      e.params.preventClicksPropagation && e.animating && (s.stopPropagation(),
      s.stopImmediatePropagation())))
  }
  function mo() {
      let s = this
        , {wrapperEl: e, rtlTranslate: t, enabled: i} = s;
      if (!i)
          return;
      s.previousTranslate = s.translate,
      s.isHorizontal() ? s.translate = -e.scrollLeft : s.translate = -e.scrollTop,
      s.translate === 0 && (s.translate = 0),
      s.updateActiveIndex(),
      s.updateSlidesClasses();
      let r, n = s.maxTranslate() - s.minTranslate();
      n === 0 ? r = 0 : r = (s.translate - s.minTranslate()) / n,
      r !== s.progress && s.updateProgress(t ? -s.translate : s.translate),
      s.emit("setTranslate", s.translate, !1)
  }
  function go(s) {
      let e = this;
      Dt(e, s.target),
      !(e.params.cssMode || e.params.slidesPerView !== "auto" && !e.params.autoHeight) && e.update()
  }
  function vo() {
      let s = this;
      s.documentTouchHandlerProceeded || (s.documentTouchHandlerProceeded = !0,
      s.params.touchReleaseOnEdges && (s.el.style.touchAction = "auto"))
  }
  var ar = (s,e)=>{
      let t = X()
        , {params: i, el: r, wrapperEl: n, device: o} = s
        , l = !!i.nested
        , a = e === "on" ? "addEventListener" : "removeEventListener"
        , h = e;
      t[a]("touchstart", s.onDocumentTouchStart, {
          passive: !1,
          capture: l
      }),
      r[a]("touchstart", s.onTouchStart, {
          passive: !1
      }),
      r[a]("pointerdown", s.onTouchStart, {
          passive: !1
      }),
      t[a]("touchmove", s.onTouchMove, {
          passive: !1,
          capture: l
      }),
      t[a]("pointermove", s.onTouchMove, {
          passive: !1,
          capture: l
      }),
      t[a]("touchend", s.onTouchEnd, {
          passive: !0
      }),
      t[a]("pointerup", s.onTouchEnd, {
          passive: !0
      }),
      t[a]("pointercancel", s.onTouchEnd, {
          passive: !0
      }),
      t[a]("touchcancel", s.onTouchEnd, {
          passive: !0
      }),
      t[a]("pointerout", s.onTouchEnd, {
          passive: !0
      }),
      t[a]("pointerleave", s.onTouchEnd, {
          passive: !0
      }),
      t[a]("contextmenu", s.onTouchEnd, {
          passive: !0
      }),
      (i.preventClicks || i.preventClicksPropagation) && r[a]("click", s.onClick, !0),
      i.cssMode && n[a]("scroll", s.onScroll),
      i.updateOnWindowResize ? s[h](o.ios || o.android ? "resize orientationchange observerUpdate" : "resize observerUpdate", er, !0) : s[h]("observerUpdate", er, !0),
      r[a]("load", s.onLoad, {
          capture: !0
      })
  }
  ;
  function bo() {
      let s = this
        , {params: e} = s;
      s.onTouchStart = uo.bind(s),
      s.onTouchMove = ho.bind(s),
      s.onTouchEnd = fo.bind(s),
      s.onDocumentTouchStart = vo.bind(s),
      e.cssMode && (s.onScroll = mo.bind(s)),
      s.onClick = po.bind(s),
      s.onLoad = go.bind(s),
      ar(s, "on")
  }
  function wo() {
      ar(this, "off")
  }
  var yo = {
      attachEvents: bo,
      detachEvents: wo
  }
    , tr = (s,e)=>s.grid && e.grid && e.grid.rows > 1;
  function So() {
      let s = this
        , {realIndex: e, initialized: t, params: i, el: r} = s
        , n = i.breakpoints;
      if (!n || n && Object.keys(n).length === 0)
          return;
      let o = s.getBreakpoint(n, s.params.breakpointsBase, s.el);
      if (!o || s.currentBreakpoint === o)
          return;
      let a = (o in n ? n[o] : void 0) || s.originalParams
        , h = tr(s, i)
        , d = tr(s, a)
        , c = s.params.grabCursor
        , u = a.grabCursor
        , m = i.enabled;
      h && !d ? (r.classList.remove(`${i.containerModifierClass}grid`, `${i.containerModifierClass}grid-column`),
      s.emitContainerClasses()) : !h && d && (r.classList.add(`${i.containerModifierClass}grid`),
      (a.grid.fill && a.grid.fill === "column" || !a.grid.fill && i.grid.fill === "column") && r.classList.add(`${i.containerModifierClass}grid-column`),
      s.emitContainerClasses()),
      c && !u ? s.unsetGrabCursor() : !c && u && s.setGrabCursor(),
      ["navigation", "pagination", "scrollbar"].forEach(b=>{
          if (typeof a[b] > "u")
              return;
          let x = i[b] && i[b].enabled
            , k = a[b] && a[b].enabled;
          x && !k && s[b].disable(),
          !x && k && s[b].enable()
      }
      );
      let g = a.direction && a.direction !== i.direction
        , y = i.loop && (a.slidesPerView !== i.slidesPerView || g)
        , w = i.loop;
      g && t && s.changeDirection(),
      se(s.params, a);
      let f = s.params.enabled
        , S = s.params.loop;
      Object.assign(s, {
          allowTouchMove: s.params.allowTouchMove,
          allowSlideNext: s.params.allowSlideNext,
          allowSlidePrev: s.params.allowSlidePrev
      }),
      m && !f ? s.disable() : !m && f && s.enable(),
      s.currentBreakpoint = o,
      s.emit("_beforeBreakpoint", a),
      t && (y ? (s.loopDestroy(),
      s.loopCreate(e),
      s.updateSlides()) : !w && S ? (s.loopCreate(e),
      s.updateSlides()) : w && !S && s.loopDestroy()),
      s.emit("breakpoint", a)
  }
  function Eo(s, e, t) {
      if (e === void 0 && (e = "window"),
      !s || e === "container" && !t)
          return;
      let i = !1
        , r = _()
        , n = e === "window" ? r.innerHeight : t.clientHeight
        , o = Object.keys(s).map(l=>{
          if (typeof l == "string" && l.indexOf("@") === 0) {
              let a = parseFloat(l.substr(1));
              return {
                  value: n * a,
                  point: l
              }
          }
          return {
              value: l,
              point: l
          }
      }
      );
      o.sort((l,a)=>parseInt(l.value, 10) - parseInt(a.value, 10));
      for (let l = 0; l < o.length; l += 1) {
          let {point: a, value: h} = o[l];
          e === "window" ? r.matchMedia(`(min-width: ${h}px)`).matches && (i = a) : h <= t.clientWidth && (i = a)
      }
      return i || "max"
  }
  var To = {
      setBreakpoint: So,
      getBreakpoint: Eo
  };
  function xo(s, e) {
      let t = [];
      return s.forEach(i=>{
          typeof i == "object" ? Object.keys(i).forEach(r=>{
              i[r] && t.push(e + r)
          }
          ) : typeof i == "string" && t.push(e + i)
      }
      ),
      t
  }
  function Mo() {
      let s = this
        , {classNames: e, params: t, rtl: i, el: r, device: n} = s
        , o = xo(["initialized", t.direction, {
          "free-mode": s.params.freeMode && t.freeMode.enabled
      }, {
          autoheight: t.autoHeight
      }, {
          rtl: i
      }, {
          grid: t.grid && t.grid.rows > 1
      }, {
          "grid-column": t.grid && t.grid.rows > 1 && t.grid.fill === "column"
      }, {
          android: n.android
      }, {
          ios: n.ios
      }, {
          "css-mode": t.cssMode
      }, {
          centered: t.cssMode && t.centeredSlides
      }, {
          "watch-progress": t.watchSlidesProgress
      }], t.containerModifierClass);
      e.push(...o),
      r.classList.add(...e),
      s.emitContainerClasses()
  }
  function Co() {
      let s = this
        , {el: e, classNames: t} = s;
      e.classList.remove(...t),
      s.emitContainerClasses()
  }
  var Ao = {
      addClasses: Mo,
      removeClasses: Co
  };
  function Lo() {
      let s = this
        , {isLocked: e, params: t} = s
        , {slidesOffsetBefore: i} = t;
      if (i) {
          let r = s.slides.length - 1
            , n = s.slidesGrid[r] + s.slidesSizesGrid[r] + i * 2;
          s.isLocked = s.size > n
      } else
          s.isLocked = s.snapGrid.length === 1;
      t.allowSlideNext === !0 && (s.allowSlideNext = !s.isLocked),
      t.allowSlidePrev === !0 && (s.allowSlidePrev = !s.isLocked),
      e && e !== s.isLocked && (s.isEnd = !1),
      e !== s.isLocked && s.emit(s.isLocked ? "lock" : "unlock")
  }
  var Po = {
      checkOverflow: Lo
  }
    , sr = {
      init: !0,
      direction: "horizontal",
      oneWayMovement: !1,
      swiperElementNodeName: "SWIPER-CONTAINER",
      touchEventsTarget: "wrapper",
      initialSlide: 0,
      speed: 300,
      cssMode: !1,
      updateOnWindowResize: !0,
      resizeObserver: !0,
      nested: !1,
      createElements: !1,
      eventsPrefix: "swiper",
      enabled: !0,
      focusableElements: "input, select, option, textarea, button, video, label",
      width: null,
      height: null,
      preventInteractionOnTransition: !1,
      userAgent: null,
      url: null,
      edgeSwipeDetection: !1,
      edgeSwipeThreshold: 20,
      autoHeight: !1,
      setWrapperSize: !1,
      virtualTranslate: !1,
      effect: "slide",
      breakpoints: void 0,
      breakpointsBase: "window",
      spaceBetween: 0,
      slidesPerView: 1,
      slidesPerGroup: 1,
      slidesPerGroupSkip: 0,
      slidesPerGroupAuto: !1,
      centeredSlides: !1,
      centeredSlidesBounds: !1,
      slidesOffsetBefore: 0,
      slidesOffsetAfter: 0,
      normalizeSlideIndex: !0,
      centerInsufficientSlides: !1,
      watchOverflow: !0,
      roundLengths: !1,
      touchRatio: 1,
      touchAngle: 45,
      simulateTouch: !0,
      shortSwipes: !0,
      longSwipes: !0,
      longSwipesRatio: .5,
      longSwipesMs: 300,
      followFinger: !0,
      allowTouchMove: !0,
      threshold: 5,
      touchMoveStopPropagation: !1,
      touchStartPreventDefault: !0,
      touchStartForcePreventDefault: !1,
      touchReleaseOnEdges: !1,
      uniqueNavElements: !0,
      resistance: !0,
      resistanceRatio: .85,
      watchSlidesProgress: !1,
      grabCursor: !1,
      preventClicks: !0,
      preventClicksPropagation: !0,
      slideToClickedSlide: !1,
      loop: !1,
      loopAddBlankSlides: !0,
      loopAdditionalSlides: 0,
      loopPreventsSliding: !0,
      rewind: !1,
      allowSlidePrev: !0,
      allowSlideNext: !0,
      swipeHandler: null,
      noSwiping: !0,
      noSwipingClass: "swiper-no-swiping",
      noSwipingSelector: null,
      passiveListeners: !0,
      maxBackfaceHiddenSlides: 10,
      containerModifierClass: "swiper-",
      slideClass: "swiper-slide",
      slideBlankClass: "swiper-slide-blank",
      slideActiveClass: "swiper-slide-active",
      slideVisibleClass: "swiper-slide-visible",
      slideFullyVisibleClass: "swiper-slide-fully-visible",
      slideNextClass: "swiper-slide-next",
      slidePrevClass: "swiper-slide-prev",
      wrapperClass: "swiper-wrapper",
      lazyPreloaderClass: "swiper-lazy-preloader",
      lazyPreloadPrevNext: 0,
      runCallbacksOnInit: !0,
      _emitClasses: !1
  };
  function Io(s, e) {
      return function(i) {
          i === void 0 && (i = {});
          let r = Object.keys(i)[0]
            , n = i[r];
          if (typeof n != "object" || n === null) {
              se(e, i);
              return
          }
          if (s[r] === !0 && (s[r] = {
              enabled: !0
          }),
          r === "navigation" && s[r] && s[r].enabled && !s[r].prevEl && !s[r].nextEl && (s[r].auto = !0),
          ["pagination", "scrollbar"].indexOf(r) >= 0 && s[r] && s[r].enabled && !s[r].el && (s[r].auto = !0),
          !(r in s && "enabled"in n)) {
              se(e, i);
              return
          }
          typeof s[r] == "object" && !("enabled"in s[r]) && (s[r].enabled = !0),
          s[r] || (s[r] = {
              enabled: !1
          }),
          se(e, i)
      }
  }
  var $s = {
      eventsEmitter: Ca,
      update: $a,
      translate: Wa,
      transition: Xa,
      slide: to,
      loop: no,
      grabCursor: lo,
      events: yo,
      breakpoints: To,
      checkOverflow: Po,
      classes: Ao
  }
    , Vs = {}
    , Ee = class s {
      constructor() {
          let e, t;
          for (var i = arguments.length, r = new Array(i), n = 0; n < i; n++)
              r[n] = arguments[n];
          r.length === 1 && r[0].constructor && Object.prototype.toString.call(r[0]).slice(8, -1) === "Object" ? t = r[0] : [e,t] = r,
          t || (t = {}),
          t = se({}, t),
          e && !t.el && (t.el = e);
          let o = X();
          if (t.el && typeof t.el == "string" && o.querySelectorAll(t.el).length > 1) {
              let d = [];
              return o.querySelectorAll(t.el).forEach(c=>{
                  let u = se({}, t, {
                      el: c
                  });
                  d.push(new s(u))
              }
              ),
              d
          }
          let l = this;
          l.__swiper__ = !0,
          l.support = ir(),
          l.device = rr({
              userAgent: t.userAgent
          }),
          l.browser = Ta(),
          l.eventsListeners = {},
          l.eventsAnyListeners = [],
          l.modules = [...l.__modules__],
          t.modules && Array.isArray(t.modules) && l.modules.push(...t.modules);
          let a = {};
          l.modules.forEach(d=>{
              d({
                  params: t,
                  swiper: l,
                  extendParams: Io(t, a),
                  on: l.on.bind(l),
                  once: l.once.bind(l),
                  off: l.off.bind(l),
                  emit: l.emit.bind(l)
              })
          }
          );
          let h = se({}, sr, a);
          return l.params = se({}, h, Vs, t),
          l.originalParams = se({}, l.params),
          l.passedParams = se({}, t),
          l.params && l.params.on && Object.keys(l.params.on).forEach(d=>{
              l.on(d, l.params.on[d])
          }
          ),
          l.params && l.params.onAny && l.onAny(l.params.onAny),
          Object.assign(l, {
              enabled: l.params.enabled,
              el: e,
              classNames: [],
              slides: [],
              slidesGrid: [],
              snapGrid: [],
              slidesSizesGrid: [],
              isHorizontal() {
                  return l.params.direction === "horizontal"
              },
              isVertical() {
                  return l.params.direction === "vertical"
              },
              activeIndex: 0,
              realIndex: 0,
              isBeginning: !0,
              isEnd: !1,
              translate: 0,
              previousTranslate: 0,
              progress: 0,
              velocity: 0,
              animating: !1,
              cssOverflowAdjustment() {
                  return Math.trunc(this.translate / 2 ** 23) * 2 ** 23
              },
              allowSlideNext: l.params.allowSlideNext,
              allowSlidePrev: l.params.allowSlidePrev,
              touchEventsData: {
                  isTouched: void 0,
                  isMoved: void 0,
                  allowTouchCallbacks: void 0,
                  touchStartTime: void 0,
                  isScrolling: void 0,
                  currentTranslate: void 0,
                  startTranslate: void 0,
                  allowThresholdMove: void 0,
                  focusableElements: l.params.focusableElements,
                  lastClickTime: 0,
                  clickTimeout: void 0,
                  velocities: [],
                  allowMomentumBounce: void 0,
                  startMoving: void 0,
                  pointerId: null,
                  touchId: null
              },
              allowClick: !0,
              allowTouchMove: l.params.allowTouchMove,
              touches: {
                  startX: 0,
                  startY: 0,
                  currentX: 0,
                  currentY: 0,
                  diff: 0
              },
              imagesToLoad: [],
              imagesLoaded: 0
          }),
          l.emit("_swiper"),
          l.params.init && l.init(),
          l
      }
      getDirectionLabel(e) {
          return this.isHorizontal() ? e : {
              width: "height",
              "margin-top": "margin-left",
              "margin-bottom ": "margin-right",
              "margin-left": "margin-top",
              "margin-right": "margin-bottom",
              "padding-left": "padding-top",
              "padding-right": "padding-bottom",
              marginRight: "marginBottom"
          }[e]
      }
      getSlideIndex(e) {
          let {slidesEl: t, params: i} = this
            , r = Y(t, `.${i.slideClass}, swiper-slide`)
            , n = ye(r[0]);
          return ye(e) - n
      }
      getSlideIndexByData(e) {
          return this.getSlideIndex(this.slides.filter(t=>t.getAttribute("data-swiper-slide-index") * 1 === e)[0])
      }
      recalcSlides() {
          let e = this
            , {slidesEl: t, params: i} = e;
          e.slides = Y(t, `.${i.slideClass}, swiper-slide`)
      }
      enable() {
          let e = this;
          e.enabled || (e.enabled = !0,
          e.params.grabCursor && e.setGrabCursor(),
          e.emit("enable"))
      }
      disable() {
          let e = this;
          e.enabled && (e.enabled = !1,
          e.params.grabCursor && e.unsetGrabCursor(),
          e.emit("disable"))
      }
      setProgress(e, t) {
          let i = this;
          e = Math.min(Math.max(e, 0), 1);
          let r = i.minTranslate()
            , o = (i.maxTranslate() - r) * e + r;
          i.translateTo(o, typeof t > "u" ? 0 : t),
          i.updateActiveIndex(),
          i.updateSlidesClasses()
      }
      emitContainerClasses() {
          let e = this;
          if (!e.params._emitClasses || !e.el)
              return;
          let t = e.el.className.split(" ").filter(i=>i.indexOf("swiper") === 0 || i.indexOf(e.params.containerModifierClass) === 0);
          e.emit("_containerClasses", t.join(" "))
      }
      getSlideClasses(e) {
          let t = this;
          return t.destroyed ? "" : e.className.split(" ").filter(i=>i.indexOf("swiper-slide") === 0 || i.indexOf(t.params.slideClass) === 0).join(" ")
      }
      emitSlidesClasses() {
          let e = this;
          if (!e.params._emitClasses || !e.el)
              return;
          let t = [];
          e.slides.forEach(i=>{
              let r = e.getSlideClasses(i);
              t.push({
                  slideEl: i,
                  classNames: r
              }),
              e.emit("_slideClass", i, r)
          }
          ),
          e.emit("_slideClasses", t)
      }
      slidesPerViewDynamic(e, t) {
          e === void 0 && (e = "current"),
          t === void 0 && (t = !1);
          let i = this
            , {params: r, slides: n, slidesGrid: o, slidesSizesGrid: l, size: a, activeIndex: h} = i
            , d = 1;
          if (typeof r.slidesPerView == "number")
              return r.slidesPerView;
          if (r.centeredSlides) {
              let c = n[h] ? Math.ceil(n[h].swiperSlideSize) : 0, u;
              for (let m = h + 1; m < n.length; m += 1)
                  n[m] && !u && (c += Math.ceil(n[m].swiperSlideSize),
                  d += 1,
                  c > a && (u = !0));
              for (let m = h - 1; m >= 0; m -= 1)
                  n[m] && !u && (c += n[m].swiperSlideSize,
                  d += 1,
                  c > a && (u = !0))
          } else if (e === "current")
              for (let c = h + 1; c < n.length; c += 1)
                  (t ? o[c] + l[c] - o[h] < a : o[c] - o[h] < a) && (d += 1);
          else
              for (let c = h - 1; c >= 0; c -= 1)
                  o[h] - o[c] < a && (d += 1);
          return d
      }
      update() {
          let e = this;
          if (!e || e.destroyed)
              return;
          let {snapGrid: t, params: i} = e;
          i.breakpoints && e.setBreakpoint(),
          [...e.el.querySelectorAll('[loading="lazy"]')].forEach(o=>{
              o.complete && Dt(e, o)
          }
          ),
          e.updateSize(),
          e.updateSlides(),
          e.updateProgress(),
          e.updateSlidesClasses();
          function r() {
              let o = e.rtlTranslate ? e.translate * -1 : e.translate
                , l = Math.min(Math.max(o, e.maxTranslate()), e.minTranslate());
              e.setTranslate(l),
              e.updateActiveIndex(),
              e.updateSlidesClasses()
          }
          let n;
          if (i.freeMode && i.freeMode.enabled && !i.cssMode)
              r(),
              i.autoHeight && e.updateAutoHeight();
          else {
              if ((i.slidesPerView === "auto" || i.slidesPerView > 1) && e.isEnd && !i.centeredSlides) {
                  let o = e.virtual && i.virtual.enabled ? e.virtual.slides : e.slides;
                  n = e.slideTo(o.length - 1, 0, !1, !0)
              } else
                  n = e.slideTo(e.activeIndex, 0, !1, !0);
              n || r()
          }
          i.watchOverflow && t !== e.snapGrid && e.checkOverflow(),
          e.emit("update")
      }
      changeDirection(e, t) {
          t === void 0 && (t = !0);
          let i = this
            , r = i.params.direction;
          return e || (e = r === "horizontal" ? "vertical" : "horizontal"),
          e === r || e !== "horizontal" && e !== "vertical" || (i.el.classList.remove(`${i.params.containerModifierClass}${r}`),
          i.el.classList.add(`${i.params.containerModifierClass}${e}`),
          i.emitContainerClasses(),
          i.params.direction = e,
          i.slides.forEach(n=>{
              e === "vertical" ? n.style.width = "" : n.style.height = ""
          }
          ),
          i.emit("changeDirection"),
          t && i.update()),
          i
      }
      changeLanguageDirection(e) {
          let t = this;
          t.rtl && e === "rtl" || !t.rtl && e === "ltr" || (t.rtl = e === "rtl",
          t.rtlTranslate = t.params.direction === "horizontal" && t.rtl,
          t.rtl ? (t.el.classList.add(`${t.params.containerModifierClass}rtl`),
          t.el.dir = "rtl") : (t.el.classList.remove(`${t.params.containerModifierClass}rtl`),
          t.el.dir = "ltr"),
          t.update())
      }
      mount(e) {
          let t = this;
          if (t.mounted)
              return !0;
          let i = e || t.params.el;
          if (typeof i == "string" && (i = document.querySelector(i)),
          !i)
              return !1;
          i.swiper = t,
          i.parentNode && i.parentNode.host && i.parentNode.host.nodeName === t.params.swiperElementNodeName.toUpperCase() && (t.isElement = !0);
          let r = ()=>`.${(t.params.wrapperClass || "").trim().split(" ").join(".")}`
            , o = i && i.shadowRoot && i.shadowRoot.querySelector ? i.shadowRoot.querySelector(r()) : Y(i, r())[0];
          return !o && t.params.createElements && (o = Z("div", t.params.wrapperClass),
          i.append(o),
          Y(i, `.${t.params.slideClass}`).forEach(l=>{
              o.append(l)
          }
          )),
          Object.assign(t, {
              el: i,
              wrapperEl: o,
              slidesEl: t.isElement && !i.parentNode.host.slideSlots ? i.parentNode.host : o,
              hostEl: t.isElement ? i.parentNode.host : i,
              mounted: !0,
              rtl: i.dir.toLowerCase() === "rtl" || be(i, "direction") === "rtl",
              rtlTranslate: t.params.direction === "horizontal" && (i.dir.toLowerCase() === "rtl" || be(i, "direction") === "rtl"),
              wrongRTL: be(o, "display") === "-webkit-box"
          }),
          !0
      }
      init(e) {
          let t = this;
          if (t.initialized || t.mount(e) === !1)
              return t;
          t.emit("beforeInit"),
          t.params.breakpoints && t.setBreakpoint(),
          t.addClasses(),
          t.updateSize(),
          t.updateSlides(),
          t.params.watchOverflow && t.checkOverflow(),
          t.params.grabCursor && t.enabled && t.setGrabCursor(),
          t.params.loop && t.virtual && t.params.virtual.enabled ? t.slideTo(t.params.initialSlide + t.virtual.slidesBefore, 0, t.params.runCallbacksOnInit, !1, !0) : t.slideTo(t.params.initialSlide, 0, t.params.runCallbacksOnInit, !1, !0),
          t.params.loop && t.loopCreate(),
          t.attachEvents();
          let r = [...t.el.querySelectorAll('[loading="lazy"]')];
          return t.isElement && r.push(...t.hostEl.querySelectorAll('[loading="lazy"]')),
          r.forEach(n=>{
              n.complete ? Dt(t, n) : n.addEventListener("load", o=>{
                  Dt(t, o.target)
              }
              )
          }
          ),
          Ns(t),
          t.initialized = !0,
          Ns(t),
          t.emit("init"),
          t.emit("afterInit"),
          t
      }
      destroy(e, t) {
          e === void 0 && (e = !0),
          t === void 0 && (t = !0);
          let i = this
            , {params: r, el: n, wrapperEl: o, slides: l} = i;
          return typeof i.params > "u" || i.destroyed || (i.emit("beforeDestroy"),
          i.initialized = !1,
          i.detachEvents(),
          r.loop && i.loopDestroy(),
          t && (i.removeClasses(),
          n.removeAttribute("style"),
          o.removeAttribute("style"),
          l && l.length && l.forEach(a=>{
              a.classList.remove(r.slideVisibleClass, r.slideFullyVisibleClass, r.slideActiveClass, r.slideNextClass, r.slidePrevClass),
              a.removeAttribute("style"),
              a.removeAttribute("data-swiper-slide-index")
          }
          )),
          i.emit("destroy"),
          Object.keys(i.eventsListeners).forEach(a=>{
              i.off(a)
          }
          ),
          e !== !1 && (i.el.swiper = null,
          Ki(i)),
          i.destroyed = !0),
          null
      }
      static extendDefaults(e) {
          se(Vs, e)
      }
      static get extendedDefaults() {
          return Vs
      }
      static get defaults() {
          return sr
      }
      static installModule(e) {
          s.prototype.__modules__ || (s.prototype.__modules__ = []);
          let t = s.prototype.__modules__;
          typeof e == "function" && t.indexOf(e) < 0 && t.push(e)
      }
      static use(e) {
          return Array.isArray(e) ? (e.forEach(t=>s.installModule(t)),
          s) : (s.installModule(e),
          s)
      }
  }
  ;
  Object.keys($s).forEach(s=>{
      Object.keys($s[s]).forEach(e=>{
          Ee.prototype[e] = $s[s][e]
      }
      )
  }
  );
  Ee.use([xa, Ma]);
  function or(s) {
      let {swiper: e, extendParams: t, on: i, emit: r} = s;
      t({
          virtual: {
              enabled: !1,
              slides: [],
              cache: !0,
              renderSlide: null,
              renderExternal: null,
              renderExternalUpdate: !0,
              addSlidesBefore: 0,
              addSlidesAfter: 0
          }
      });
      let n, o = X();
      e.virtual = {
          cache: {},
          from: void 0,
          to: void 0,
          slides: [],
          offset: 0,
          slidesGrid: []
      };
      let l = o.createElement("div");
      function a(g, y) {
          let w = e.params.virtual;
          if (w.cache && e.virtual.cache[y])
              return e.virtual.cache[y];
          let f;
          return w.renderSlide ? (f = w.renderSlide.call(e, g, y),
          typeof f == "string" && (l.innerHTML = f,
          f = l.children[0])) : e.isElement ? f = Z("swiper-slide") : f = Z("div", e.params.slideClass),
          f.setAttribute("data-swiper-slide-index", y),
          w.renderSlide || (f.innerHTML = g),
          w.cache && (e.virtual.cache[y] = f),
          f
      }
      function h(g, y) {
          let {slidesPerView: w, slidesPerGroup: f, centeredSlides: S, loop: b, initialSlide: x} = e.params;
          if (y && !b && x > 0)
              return;
          let {addSlidesBefore: k, addSlidesAfter: R} = e.params.virtual
            , {from: $, to: I, slides: O, slidesGrid: L, offset: D} = e.virtual;
          e.params.cssMode || e.updateActiveIndex();
          let C = e.activeIndex || 0, A;
          e.rtlTranslate ? A = "right" : A = e.isHorizontal() ? "left" : "top";
          let P, B;
          S ? (P = Math.floor(w / 2) + f + R,
          B = Math.floor(w / 2) + f + k) : (P = w + (f - 1) + R,
          B = (b ? w : f) + k);
          let E = C - B
            , v = C + P;
          b || (E = Math.max(E, 0),
          v = Math.min(v, O.length - 1));
          let p = (e.slidesGrid[E] || 0) - (e.slidesGrid[0] || 0);
          b && C >= B ? (E -= B,
          S || (p += e.slidesGrid[0])) : b && C < B && (E = -B,
          S && (p += e.slidesGrid[0])),
          Object.assign(e.virtual, {
              from: E,
              to: v,
              offset: p,
              slidesGrid: e.slidesGrid,
              slidesBefore: B,
              slidesAfter: P
          });
          function T() {
              e.updateSlides(),
              e.updateProgress(),
              e.updateSlidesClasses(),
              r("virtualUpdate")
          }
          if ($ === E && I === v && !g) {
              e.slidesGrid !== L && p !== D && e.slides.forEach(N=>{
                  N.style[A] = `${p - Math.abs(e.cssOverflowAdjustment())}px`
              }
              ),
              e.updateProgress(),
              r("virtualUpdate");
              return
          }
          if (e.params.virtual.renderExternal) {
              e.params.virtual.renderExternal.call(e, {
                  offset: p,
                  from: E,
                  to: v,
                  slides: function() {
                      let z = [];
                      for (let j = E; j <= v; j += 1)
                          z.push(O[j]);
                      return z
                  }()
              }),
              e.params.virtual.renderExternalUpdate ? T() : r("virtualUpdate");
              return
          }
          let M = []
            , F = []
            , V = N=>{
              let z = N;
              return N < 0 ? z = O.length + N : z >= O.length && (z = z - O.length),
              z
          }
          ;
          if (g)
              e.slides.filter(N=>N.matches(`.${e.params.slideClass}, swiper-slide`)).forEach(N=>{
                  N.remove()
              }
              );
          else
              for (let N = $; N <= I; N += 1)
                  if (N < E || N > v) {
                      let z = V(N);
                      e.slides.filter(j=>j.matches(`.${e.params.slideClass}[data-swiper-slide-index="${z}"], swiper-slide[data-swiper-slide-index="${z}"]`)).forEach(j=>{
                          j.remove()
                      }
                      )
                  }
          let W = b ? -O.length : 0
            , Q = b ? O.length * 2 : O.length;
          for (let N = W; N < Q; N += 1)
              if (N >= E && N <= v) {
                  let z = V(N);
                  typeof I > "u" || g ? F.push(z) : (N > I && F.push(z),
                  N < $ && M.push(z))
              }
          if (F.forEach(N=>{
              e.slidesEl.append(a(O[N], N))
          }
          ),
          b)
              for (let N = M.length - 1; N >= 0; N -= 1) {
                  let z = M[N];
                  e.slidesEl.prepend(a(O[z], z))
              }
          else
              M.sort((N,z)=>z - N),
              M.forEach(N=>{
                  e.slidesEl.prepend(a(O[N], N))
              }
              );
          Y(e.slidesEl, ".swiper-slide, swiper-slide").forEach(N=>{
              N.style[A] = `${p - Math.abs(e.cssOverflowAdjustment())}px`
          }
          ),
          T()
      }
      function d(g) {
          if (typeof g == "object" && "length"in g)
              for (let y = 0; y < g.length; y += 1)
                  g[y] && e.virtual.slides.push(g[y]);
          else
              e.virtual.slides.push(g);
          h(!0)
      }
      function c(g) {
          let y = e.activeIndex
            , w = y + 1
            , f = 1;
          if (Array.isArray(g)) {
              for (let S = 0; S < g.length; S += 1)
                  g[S] && e.virtual.slides.unshift(g[S]);
              w = y + g.length,
              f = g.length
          } else
              e.virtual.slides.unshift(g);
          if (e.params.virtual.cache) {
              let S = e.virtual.cache
                , b = {};
              Object.keys(S).forEach(x=>{
                  let k = S[x]
                    , R = k.getAttribute("data-swiper-slide-index");
                  R && k.setAttribute("data-swiper-slide-index", parseInt(R, 10) + f),
                  b[parseInt(x, 10) + f] = k
              }
              ),
              e.virtual.cache = b
          }
          h(!0),
          e.slideTo(w, 0)
      }
      function u(g) {
          if (typeof g > "u" || g === null)
              return;
          let y = e.activeIndex;
          if (Array.isArray(g))
              for (let w = g.length - 1; w >= 0; w -= 1)
                  e.params.virtual.cache && (delete e.virtual.cache[g[w]],
                  Object.keys(e.virtual.cache).forEach(f=>{
                      f > g && (e.virtual.cache[f - 1] = e.virtual.cache[f],
                      e.virtual.cache[f - 1].setAttribute("data-swiper-slide-index", f - 1),
                      delete e.virtual.cache[f])
                  }
                  )),
                  e.virtual.slides.splice(g[w], 1),
                  g[w] < y && (y -= 1),
                  y = Math.max(y, 0);
          else
              e.params.virtual.cache && (delete e.virtual.cache[g],
              Object.keys(e.virtual.cache).forEach(w=>{
                  w > g && (e.virtual.cache[w - 1] = e.virtual.cache[w],
                  e.virtual.cache[w - 1].setAttribute("data-swiper-slide-index", w - 1),
                  delete e.virtual.cache[w])
              }
              )),
              e.virtual.slides.splice(g, 1),
              g < y && (y -= 1),
              y = Math.max(y, 0);
          h(!0),
          e.slideTo(y, 0)
      }
      function m() {
          e.virtual.slides = [],
          e.params.virtual.cache && (e.virtual.cache = {}),
          h(!0),
          e.slideTo(0, 0)
      }
      i("beforeInit", ()=>{
          if (!e.params.virtual.enabled)
              return;
          let g;
          if (typeof e.passedParams.virtual.slides > "u") {
              let y = [...e.slidesEl.children].filter(w=>w.matches(`.${e.params.slideClass}, swiper-slide`));
              y && y.length && (e.virtual.slides = [...y],
              g = !0,
              y.forEach((w,f)=>{
                  w.setAttribute("data-swiper-slide-index", f),
                  e.virtual.cache[f] = w,
                  w.remove()
              }
              ))
          }
          g || (e.virtual.slides = e.params.virtual.slides),
          e.classNames.push(`${e.params.containerModifierClass}virtual`),
          e.params.watchSlidesProgress = !0,
          e.originalParams.watchSlidesProgress = !0,
          h(!1, !0)
      }
      ),
      i("setTranslate", ()=>{
          e.params.virtual.enabled && (e.params.cssMode && !e._immediateVirtual ? (clearTimeout(n),
          n = setTimeout(()=>{
              h()
          }
          , 100)) : h())
      }
      ),
      i("init update resize", ()=>{
          e.params.virtual.enabled && e.params.cssMode && Ie(e.wrapperEl, "--swiper-virtual-size", `${e.virtualSize}px`)
      }
      ),
      Object.assign(e.virtual, {
          appendSlide: d,
          prependSlide: c,
          removeSlide: u,
          removeAllSlides: m,
          update: h
      })
  }
  function lr(s) {
      let {swiper: e, extendParams: t, on: i, emit: r} = s
        , n = X()
        , o = _();
      e.keyboard = {
          enabled: !1
      },
      t({
          keyboard: {
              enabled: !1,
              onlyInViewport: !0,
              pageUpDown: !0
          }
      });
      function l(d) {
          if (!e.enabled)
              return;
          let {rtlTranslate: c} = e
            , u = d;
          u.originalEvent && (u = u.originalEvent);
          let m = u.keyCode || u.charCode
            , g = e.params.keyboard.pageUpDown
            , y = g && m === 33
            , w = g && m === 34
            , f = m === 37
            , S = m === 39
            , b = m === 38
            , x = m === 40;
          if (!e.allowSlideNext && (e.isHorizontal() && S || e.isVertical() && x || w) || !e.allowSlidePrev && (e.isHorizontal() && f || e.isVertical() && b || y))
              return !1;
          if (!(u.shiftKey || u.altKey || u.ctrlKey || u.metaKey) && !(n.activeElement && n.activeElement.nodeName && (n.activeElement.nodeName.toLowerCase() === "input" || n.activeElement.nodeName.toLowerCase() === "textarea"))) {
              if (e.params.keyboard.onlyInViewport && (y || w || f || S || b || x)) {
                  let k = !1;
                  if (ue(e.el, `.${e.params.slideClass}, swiper-slide`).length > 0 && ue(e.el, `.${e.params.slideActiveClass}`).length === 0)
                      return;
                  let R = e.el
                    , $ = R.clientWidth
                    , I = R.clientHeight
                    , O = o.innerWidth
                    , L = o.innerHeight
                    , D = Oe(R);
                  c && (D.left -= R.scrollLeft);
                  let C = [[D.left, D.top], [D.left + $, D.top], [D.left, D.top + I], [D.left + $, D.top + I]];
                  for (let A = 0; A < C.length; A += 1) {
                      let P = C[A];
                      if (P[0] >= 0 && P[0] <= O && P[1] >= 0 && P[1] <= L) {
                          if (P[0] === 0 && P[1] === 0)
                              continue;
                          k = !0
                      }
                  }
                  if (!k)
                      return
              }
              e.isHorizontal() ? ((y || w || f || S) && (u.preventDefault ? u.preventDefault() : u.returnValue = !1),
              ((w || S) && !c || (y || f) && c) && e.slideNext(),
              ((y || f) && !c || (w || S) && c) && e.slidePrev()) : ((y || w || b || x) && (u.preventDefault ? u.preventDefault() : u.returnValue = !1),
              (w || x) && e.slideNext(),
              (y || b) && e.slidePrev()),
              r("keyPress", m)
          }
      }
      function a() {
          e.keyboard.enabled || (n.addEventListener("keydown", l),
          e.keyboard.enabled = !0)
      }
      function h() {
          e.keyboard.enabled && (n.removeEventListener("keydown", l),
          e.keyboard.enabled = !1)
      }
      i("init", ()=>{
          e.params.keyboard.enabled && a()
      }
      ),
      i("destroy", ()=>{
          e.keyboard.enabled && h()
      }
      ),
      Object.assign(e.keyboard, {
          enable: a,
          disable: h
      })
  }
  function cr(s) {
      let {swiper: e, extendParams: t, on: i, emit: r} = s
        , n = _();
      t({
          mousewheel: {
              enabled: !1,
              releaseOnEdges: !1,
              invert: !1,
              forceToAxis: !1,
              sensitivity: 1,
              eventsTarget: "container",
              thresholdDelta: null,
              thresholdTime: null,
              noMousewheelClass: "swiper-no-mousewheel"
          }
      }),
      e.mousewheel = {
          enabled: !1
      };
      let o, l = te(), a, h = [];
      function d(b) {
          let $ = 0
            , I = 0
            , O = 0
            , L = 0;
          return "detail"in b && (I = b.detail),
          "wheelDelta"in b && (I = -b.wheelDelta / 120),
          "wheelDeltaY"in b && (I = -b.wheelDeltaY / 120),
          "wheelDeltaX"in b && ($ = -b.wheelDeltaX / 120),
          "axis"in b && b.axis === b.HORIZONTAL_AXIS && ($ = I,
          I = 0),
          O = $ * 10,
          L = I * 10,
          "deltaY"in b && (L = b.deltaY),
          "deltaX"in b && (O = b.deltaX),
          b.shiftKey && !O && (O = L,
          L = 0),
          (O || L) && b.deltaMode && (b.deltaMode === 1 ? (O *= 40,
          L *= 40) : (O *= 800,
          L *= 800)),
          O && !$ && ($ = O < 1 ? -1 : 1),
          L && !I && (I = L < 1 ? -1 : 1),
          {
              spinX: $,
              spinY: I,
              pixelX: O,
              pixelY: L
          }
      }
      function c() {
          e.enabled && (e.mouseEntered = !0)
      }
      function u() {
          e.enabled && (e.mouseEntered = !1)
      }
      function m(b) {
          return e.params.mousewheel.thresholdDelta && b.delta < e.params.mousewheel.thresholdDelta || e.params.mousewheel.thresholdTime && te() - l < e.params.mousewheel.thresholdTime ? !1 : b.delta >= 6 && te() - l < 60 ? !0 : (b.direction < 0 ? (!e.isEnd || e.params.loop) && !e.animating && (e.slideNext(),
          r("scroll", b.raw)) : (!e.isBeginning || e.params.loop) && !e.animating && (e.slidePrev(),
          r("scroll", b.raw)),
          l = new n.Date().getTime(),
          !1)
      }
      function g(b) {
          let x = e.params.mousewheel;
          if (b.direction < 0) {
              if (e.isEnd && !e.params.loop && x.releaseOnEdges)
                  return !0
          } else if (e.isBeginning && !e.params.loop && x.releaseOnEdges)
              return !0;
          return !1
      }
      function y(b) {
          let x = b
            , k = !0;
          if (!e.enabled || b.target.closest(`.${e.params.mousewheel.noMousewheelClass}`))
              return;
          let R = e.params.mousewheel;
          e.params.cssMode && x.preventDefault();
          let $ = e.el;
          e.params.mousewheel.eventsTarget !== "container" && ($ = document.querySelector(e.params.mousewheel.eventsTarget));
          let I = $ && $.contains(x.target);
          if (!e.mouseEntered && !I && !R.releaseOnEdges)
              return !0;
          x.originalEvent && (x = x.originalEvent);
          let O = 0
            , L = e.rtlTranslate ? -1 : 1
            , D = d(x);
          if (R.forceToAxis)
              if (e.isHorizontal())
                  if (Math.abs(D.pixelX) > Math.abs(D.pixelY))
                      O = -D.pixelX * L;
                  else
                      return !0;
              else if (Math.abs(D.pixelY) > Math.abs(D.pixelX))
                  O = -D.pixelY;
              else
                  return !0;
          else
              O = Math.abs(D.pixelX) > Math.abs(D.pixelY) ? -D.pixelX * L : -D.pixelY;
          if (O === 0)
              return !0;
          R.invert && (O = -O);
          let C = e.getTranslate() + O * R.sensitivity;
          if (C >= e.minTranslate() && (C = e.minTranslate()),
          C <= e.maxTranslate() && (C = e.maxTranslate()),
          k = e.params.loop ? !0 : !(C === e.minTranslate() || C === e.maxTranslate()),
          k && e.params.nested && x.stopPropagation(),
          !e.params.freeMode || !e.params.freeMode.enabled) {
              let A = {
                  time: te(),
                  delta: Math.abs(O),
                  direction: Math.sign(O),
                  raw: b
              };
              h.length >= 2 && h.shift();
              let P = h.length ? h[h.length - 1] : void 0;
              if (h.push(A),
              P ? (A.direction !== P.direction || A.delta > P.delta || A.time > P.time + 150) && m(A) : m(A),
              g(A))
                  return !0
          } else {
              let A = {
                  time: te(),
                  delta: Math.abs(O),
                  direction: Math.sign(O)
              }
                , P = a && A.time < a.time + 500 && A.delta <= a.delta && A.direction === a.direction;
              if (!P) {
                  a = void 0;
                  let B = e.getTranslate() + O * R.sensitivity
                    , E = e.isBeginning
                    , v = e.isEnd;
                  if (B >= e.minTranslate() && (B = e.minTranslate()),
                  B <= e.maxTranslate() && (B = e.maxTranslate()),
                  e.setTransition(0),
                  e.setTranslate(B),
                  e.updateProgress(),
                  e.updateActiveIndex(),
                  e.updateSlidesClasses(),
                  (!E && e.isBeginning || !v && e.isEnd) && e.updateSlidesClasses(),
                  e.params.loop && e.loopFix({
                      direction: A.direction < 0 ? "next" : "prev",
                      byMousewheel: !0
                  }),
                  e.params.freeMode.sticky) {
                      clearTimeout(o),
                      o = void 0,
                      h.length >= 15 && h.shift();
                      let p = h.length ? h[h.length - 1] : void 0
                        , T = h[0];
                      if (h.push(A),
                      p && (A.delta > p.delta || A.direction !== p.direction))
                          h.splice(0);
                      else if (h.length >= 15 && A.time - T.time < 500 && T.delta - A.delta >= 1 && A.delta <= 6) {
                          let M = O > 0 ? .8 : .2;
                          a = A,
                          h.splice(0),
                          o = de(()=>{
                              e.slideToClosest(e.params.speed, !0, void 0, M)
                          }
                          , 0)
                      }
                      o || (o = de(()=>{
                          a = A,
                          h.splice(0),
                          e.slideToClosest(e.params.speed, !0, void 0, .5)
                      }
                      , 500))
                  }
                  if (P || r("scroll", x),
                  e.params.autoplay && e.params.autoplayDisableOnInteraction && e.autoplay.stop(),
                  R.releaseOnEdges && (B === e.minTranslate() || B === e.maxTranslate()))
                      return !0
              }
          }
          return x.preventDefault ? x.preventDefault() : x.returnValue = !1,
          !1
      }
      function w(b) {
          let x = e.el;
          e.params.mousewheel.eventsTarget !== "container" && (x = document.querySelector(e.params.mousewheel.eventsTarget)),
          x[b]("mouseenter", c),
          x[b]("mouseleave", u),
          x[b]("wheel", y)
      }
      function f() {
          return e.params.cssMode ? (e.wrapperEl.removeEventListener("wheel", y),
          !0) : e.mousewheel.enabled ? !1 : (w("addEventListener"),
          e.mousewheel.enabled = !0,
          !0)
      }
      function S() {
          return e.params.cssMode ? (e.wrapperEl.addEventListener(event, y),
          !0) : e.mousewheel.enabled ? (w("removeEventListener"),
          e.mousewheel.enabled = !1,
          !0) : !1
      }
      i("init", ()=>{
          !e.params.mousewheel.enabled && e.params.cssMode && S(),
          e.params.mousewheel.enabled && f()
      }
      ),
      i("destroy", ()=>{
          e.params.cssMode && f(),
          e.mousewheel.enabled && S()
      }
      ),
      Object.assign(e.mousewheel, {
          enable: f,
          disable: S
      })
  }
  function He(s, e, t, i) {
      return s.params.createElements && Object.keys(i).forEach(r=>{
          if (!t[r] && t.auto === !0) {
              let n = Y(s.el, `.${i[r]}`)[0];
              n || (n = Z("div", i[r]),
              n.className = i[r],
              s.el.append(n)),
              t[r] = n,
              e[r] = n
          }
      }
      ),
      t
  }
  function dr(s) {
      let {swiper: e, extendParams: t, on: i, emit: r} = s;
      t({
          navigation: {
              nextEl: null,
              prevEl: null,
              hideOnClick: !1,
              disabledClass: "swiper-button-disabled",
              hiddenClass: "swiper-button-hidden",
              lockClass: "swiper-button-lock",
              navigationDisabledClass: "swiper-navigation-disabled"
          }
      }),
      e.navigation = {
          nextEl: null,
          prevEl: null
      };
      function n(g) {
          let y;
          return g && typeof g == "string" && e.isElement && (y = e.el.querySelector(g),
          y) ? y : (g && (typeof g == "string" && (y = [...document.querySelectorAll(g)]),
          e.params.uniqueNavElements && typeof g == "string" && y && y.length > 1 && e.el.querySelectorAll(g).length === 1 ? y = e.el.querySelector(g) : y && y.length === 1 && (y = y[0])),
          g && !y ? g : y)
      }
      function o(g, y) {
          let w = e.params.navigation;
          g = H(g),
          g.forEach(f=>{
              f && (f.classList[y ? "add" : "remove"](...w.disabledClass.split(" ")),
              f.tagName === "BUTTON" && (f.disabled = y),
              e.params.watchOverflow && e.enabled && f.classList[e.isLocked ? "add" : "remove"](w.lockClass))
          }
          )
      }
      function l() {
          let {nextEl: g, prevEl: y} = e.navigation;
          if (e.params.loop) {
              o(y, !1),
              o(g, !1);
              return
          }
          o(y, e.isBeginning && !e.params.rewind),
          o(g, e.isEnd && !e.params.rewind)
      }
      function a(g) {
          g.preventDefault(),
          !(e.isBeginning && !e.params.loop && !e.params.rewind) && (e.slidePrev(),
          r("navigationPrev"))
      }
      function h(g) {
          g.preventDefault(),
          !(e.isEnd && !e.params.loop && !e.params.rewind) && (e.slideNext(),
          r("navigationNext"))
      }
      function d() {
          let g = e.params.navigation;
          if (e.params.navigation = He(e, e.originalParams.navigation, e.params.navigation, {
              nextEl: "swiper-button-next",
              prevEl: "swiper-button-prev"
          }),
          !(g.nextEl || g.prevEl))
              return;
          let y = n(g.nextEl)
            , w = n(g.prevEl);
          Object.assign(e.navigation, {
              nextEl: y,
              prevEl: w
          }),
          y = H(y),
          w = H(w);
          let f = (S,b)=>{
              S && S.addEventListener("click", b === "next" ? h : a),
              !e.enabled && S && S.classList.add(...g.lockClass.split(" "))
          }
          ;
          y.forEach(S=>f(S, "next")),
          w.forEach(S=>f(S, "prev"))
      }
      function c() {
          let {nextEl: g, prevEl: y} = e.navigation;
          g = H(g),
          y = H(y);
          let w = (f,S)=>{
              f.removeEventListener("click", S === "next" ? h : a),
              f.classList.remove(...e.params.navigation.disabledClass.split(" "))
          }
          ;
          g.forEach(f=>w(f, "next")),
          y.forEach(f=>w(f, "prev"))
      }
      i("init", ()=>{
          e.params.navigation.enabled === !1 ? m() : (d(),
          l())
      }
      ),
      i("toEdge fromEdge lock unlock", ()=>{
          l()
      }
      ),
      i("destroy", ()=>{
          c()
      }
      ),
      i("enable disable", ()=>{
          let {nextEl: g, prevEl: y} = e.navigation;
          if (g = H(g),
          y = H(y),
          e.enabled) {
              l();
              return
          }
          [...g, ...y].filter(w=>!!w).forEach(w=>w.classList.add(e.params.navigation.lockClass))
      }
      ),
      i("click", (g,y)=>{
          let {nextEl: w, prevEl: f} = e.navigation;
          w = H(w),
          f = H(f);
          let S = y.target;
          if (e.params.navigation.hideOnClick && !f.includes(S) && !w.includes(S)) {
              if (e.pagination && e.params.pagination && e.params.pagination.clickable && (e.pagination.el === S || e.pagination.el.contains(S)))
                  return;
              let b;
              w.length ? b = w[0].classList.contains(e.params.navigation.hiddenClass) : f.length && (b = f[0].classList.contains(e.params.navigation.hiddenClass)),
              r(b === !0 ? "navigationShow" : "navigationHide"),
              [...w, ...f].filter(x=>!!x).forEach(x=>x.classList.toggle(e.params.navigation.hiddenClass))
          }
      }
      );
      let u = ()=>{
          e.el.classList.remove(...e.params.navigation.navigationDisabledClass.split(" ")),
          d(),
          l()
      }
        , m = ()=>{
          e.el.classList.add(...e.params.navigation.navigationDisabledClass.split(" ")),
          c()
      }
      ;
      Object.assign(e.navigation, {
          enable: u,
          disable: m,
          update: l,
          init: d,
          destroy: c
      })
  }
  function ae(s) {
      return s === void 0 && (s = ""),
      `.${s.trim().replace(/([\.:!+\/])/g, "\\$1").replace(/ /g, ".")}`
  }
  function ur(s) {
      let {swiper: e, extendParams: t, on: i, emit: r} = s
        , n = "swiper-pagination";
      t({
          pagination: {
              el: null,
              bulletElement: "span",
              clickable: !1,
              hideOnClick: !1,
              renderBullet: null,
              renderProgressbar: null,
              renderFraction: null,
              renderCustom: null,
              progressbarOpposite: !1,
              type: "bullets",
              dynamicBullets: !1,
              dynamicMainBullets: 1,
              formatFractionCurrent: f=>f,
              formatFractionTotal: f=>f,
              bulletClass: `${n}-bullet`,
              bulletActiveClass: `${n}-bullet-active`,
              modifierClass: `${n}-`,
              currentClass: `${n}-current`,
              totalClass: `${n}-total`,
              hiddenClass: `${n}-hidden`,
              progressbarFillClass: `${n}-progressbar-fill`,
              progressbarOppositeClass: `${n}-progressbar-opposite`,
              clickableClass: `${n}-clickable`,
              lockClass: `${n}-lock`,
              horizontalClass: `${n}-horizontal`,
              verticalClass: `${n}-vertical`,
              paginationDisabledClass: `${n}-disabled`
          }
      }),
      e.pagination = {
          el: null,
          bullets: []
      };
      let o, l = 0;
      function a() {
          return !e.params.pagination.el || !e.pagination.el || Array.isArray(e.pagination.el) && e.pagination.el.length === 0
      }
      function h(f, S) {
          let {bulletActiveClass: b} = e.params.pagination;
          f && (f = f[`${S === "prev" ? "previous" : "next"}ElementSibling`],
          f && (f.classList.add(`${b}-${S}`),
          f = f[`${S === "prev" ? "previous" : "next"}ElementSibling`],
          f && f.classList.add(`${b}-${S}-${S}`)))
      }
      function d(f) {
          let S = f.target.closest(ae(e.params.pagination.bulletClass));
          if (!S)
              return;
          f.preventDefault();
          let b = ye(S) * e.params.slidesPerGroup;
          if (e.params.loop) {
              if (e.realIndex === b)
                  return;
              e.slideToLoop(b)
          } else
              e.slideTo(b)
      }
      function c() {
          let f = e.rtl
            , S = e.params.pagination;
          if (a())
              return;
          let b = e.pagination.el;
          b = H(b);
          let x, k, R = e.virtual && e.params.virtual.enabled ? e.virtual.slides.length : e.slides.length, $ = e.params.loop ? Math.ceil(R / e.params.slidesPerGroup) : e.snapGrid.length;
          if (e.params.loop ? (k = e.previousRealIndex || 0,
          x = e.params.slidesPerGroup > 1 ? Math.floor(e.realIndex / e.params.slidesPerGroup) : e.realIndex) : typeof e.snapIndex < "u" ? (x = e.snapIndex,
          k = e.previousSnapIndex) : (k = e.previousIndex || 0,
          x = e.activeIndex || 0),
          S.type === "bullets" && e.pagination.bullets && e.pagination.bullets.length > 0) {
              let I = e.pagination.bullets, O, L, D;
              if (S.dynamicBullets && (o = at(I[0], e.isHorizontal() ? "width" : "height", !0),
              b.forEach(C=>{
                  C.style[e.isHorizontal() ? "width" : "height"] = `${o * (S.dynamicMainBullets + 4)}px`
              }
              ),
              S.dynamicMainBullets > 1 && k !== void 0 && (l += x - (k || 0),
              l > S.dynamicMainBullets - 1 ? l = S.dynamicMainBullets - 1 : l < 0 && (l = 0)),
              O = Math.max(x - l, 0),
              L = O + (Math.min(I.length, S.dynamicMainBullets) - 1),
              D = (L + O) / 2),
              I.forEach(C=>{
                  let A = [...["", "-next", "-next-next", "-prev", "-prev-prev", "-main"].map(P=>`${S.bulletActiveClass}${P}`)].map(P=>typeof P == "string" && P.includes(" ") ? P.split(" ") : P).flat();
                  C.classList.remove(...A)
              }
              ),
              b.length > 1)
                  I.forEach(C=>{
                      let A = ye(C);
                      A === x ? C.classList.add(...S.bulletActiveClass.split(" ")) : e.isElement && C.setAttribute("part", "bullet"),
                      S.dynamicBullets && (A >= O && A <= L && C.classList.add(...`${S.bulletActiveClass}-main`.split(" ")),
                      A === O && h(C, "prev"),
                      A === L && h(C, "next"))
                  }
                  );
              else {
                  let C = I[x];
                  if (C && C.classList.add(...S.bulletActiveClass.split(" ")),
                  e.isElement && I.forEach((A,P)=>{
                      A.setAttribute("part", P === x ? "bullet-active" : "bullet")
                  }
                  ),
                  S.dynamicBullets) {
                      let A = I[O]
                        , P = I[L];
                      for (let B = O; B <= L; B += 1)
                          I[B] && I[B].classList.add(...`${S.bulletActiveClass}-main`.split(" "));
                      h(A, "prev"),
                      h(P, "next")
                  }
              }
              if (S.dynamicBullets) {
                  let C = Math.min(I.length, S.dynamicMainBullets + 4)
                    , A = (o * C - o) / 2 - D * o
                    , P = f ? "right" : "left";
                  I.forEach(B=>{
                      B.style[e.isHorizontal() ? P : "top"] = `${A}px`
                  }
                  )
              }
          }
          b.forEach((I,O)=>{
              if (S.type === "fraction" && (I.querySelectorAll(ae(S.currentClass)).forEach(L=>{
                  L.textContent = S.formatFractionCurrent(x + 1)
              }
              ),
              I.querySelectorAll(ae(S.totalClass)).forEach(L=>{
                  L.textContent = S.formatFractionTotal($)
              }
              )),
              S.type === "progressbar") {
                  let L;
                  S.progressbarOpposite ? L = e.isHorizontal() ? "vertical" : "horizontal" : L = e.isHorizontal() ? "horizontal" : "vertical";
                  let D = (x + 1) / $
                    , C = 1
                    , A = 1;
                  L === "horizontal" ? C = D : A = D,
                  I.querySelectorAll(ae(S.progressbarFillClass)).forEach(P=>{
                      P.style.transform = `translate3d(0,0,0) scaleX(${C}) scaleY(${A})`,
                      P.style.transitionDuration = `${e.params.speed}ms`
                  }
                  )
              }
              S.type === "custom" && S.renderCustom ? (I.innerHTML = S.renderCustom(e, x + 1, $),
              O === 0 && r("paginationRender", I)) : (O === 0 && r("paginationRender", I),
              r("paginationUpdate", I)),
              e.params.watchOverflow && e.enabled && I.classList[e.isLocked ? "add" : "remove"](S.lockClass)
          }
          )
      }
      function u() {
          let f = e.params.pagination;
          if (a())
              return;
          let S = e.virtual && e.params.virtual.enabled ? e.virtual.slides.length : e.grid && e.params.grid.rows > 1 ? e.slides.length / Math.ceil(e.params.grid.rows) : e.slides.length
            , b = e.pagination.el;
          b = H(b);
          let x = "";
          if (f.type === "bullets") {
              let k = e.params.loop ? Math.ceil(S / e.params.slidesPerGroup) : e.snapGrid.length;
              e.params.freeMode && e.params.freeMode.enabled && k > S && (k = S);
              for (let R = 0; R < k; R += 1)
                  f.renderBullet ? x += f.renderBullet.call(e, R, f.bulletClass) : x += `<${f.bulletElement} ${e.isElement ? 'part="bullet"' : ""} class="${f.bulletClass}"></${f.bulletElement}>`
          }
          f.type === "fraction" && (f.renderFraction ? x = f.renderFraction.call(e, f.currentClass, f.totalClass) : x = `<span class="${f.currentClass}"></span> / <span class="${f.totalClass}"></span>`),
          f.type === "progressbar" && (f.renderProgressbar ? x = f.renderProgressbar.call(e, f.progressbarFillClass) : x = `<span class="${f.progressbarFillClass}"></span>`),
          e.pagination.bullets = [],
          b.forEach(k=>{
              f.type !== "custom" && (k.innerHTML = x || ""),
              f.type === "bullets" && e.pagination.bullets.push(...k.querySelectorAll(ae(f.bulletClass)))
          }
          ),
          f.type !== "custom" && r("paginationRender", b[0])
      }
      function m() {
          e.params.pagination = He(e, e.originalParams.pagination, e.params.pagination, {
              el: "swiper-pagination"
          });
          let f = e.params.pagination;
          if (!f.el)
              return;
          let S;
          typeof f.el == "string" && e.isElement && (S = e.el.querySelector(f.el)),
          !S && typeof f.el == "string" && (S = [...document.querySelectorAll(f.el)]),
          S || (S = f.el),
          !(!S || S.length === 0) && (e.params.uniqueNavElements && typeof f.el == "string" && Array.isArray(S) && S.length > 1 && (S = [...e.el.querySelectorAll(f.el)],
          S.length > 1 && (S = S.filter(b=>ue(b, ".swiper")[0] === e.el)[0])),
          Array.isArray(S) && S.length === 1 && (S = S[0]),
          Object.assign(e.pagination, {
              el: S
          }),
          S = H(S),
          S.forEach(b=>{
              f.type === "bullets" && f.clickable && b.classList.add(...(f.clickableClass || "").split(" ")),
              b.classList.add(f.modifierClass + f.type),
              b.classList.add(e.isHorizontal() ? f.horizontalClass : f.verticalClass),
              f.type === "bullets" && f.dynamicBullets && (b.classList.add(`${f.modifierClass}${f.type}-dynamic`),
              l = 0,
              f.dynamicMainBullets < 1 && (f.dynamicMainBullets = 1)),
              f.type === "progressbar" && f.progressbarOpposite && b.classList.add(f.progressbarOppositeClass),
              f.clickable && b.addEventListener("click", d),
              e.enabled || b.classList.add(f.lockClass)
          }
          ))
      }
      function g() {
          let f = e.params.pagination;
          if (a())
              return;
          let S = e.pagination.el;
          S && (S = H(S),
          S.forEach(b=>{
              b.classList.remove(f.hiddenClass),
              b.classList.remove(f.modifierClass + f.type),
              b.classList.remove(e.isHorizontal() ? f.horizontalClass : f.verticalClass),
              f.clickable && (b.classList.remove(...(f.clickableClass || "").split(" ")),
              b.removeEventListener("click", d))
          }
          )),
          e.pagination.bullets && e.pagination.bullets.forEach(b=>b.classList.remove(...f.bulletActiveClass.split(" ")))
      }
      i("changeDirection", ()=>{
          if (!e.pagination || !e.pagination.el)
              return;
          let f = e.params.pagination
            , {el: S} = e.pagination;
          S = H(S),
          S.forEach(b=>{
              b.classList.remove(f.horizontalClass, f.verticalClass),
              b.classList.add(e.isHorizontal() ? f.horizontalClass : f.verticalClass)
          }
          )
      }
      ),
      i("init", ()=>{
          e.params.pagination.enabled === !1 ? w() : (m(),
          u(),
          c())
      }
      ),
      i("activeIndexChange", ()=>{
          typeof e.snapIndex > "u" && c()
      }
      ),
      i("snapIndexChange", ()=>{
          c()
      }
      ),
      i("snapGridLengthChange", ()=>{
          u(),
          c()
      }
      ),
      i("destroy", ()=>{
          g()
      }
      ),
      i("enable disable", ()=>{
          let {el: f} = e.pagination;
          f && (f = H(f),
          f.forEach(S=>S.classList[e.enabled ? "remove" : "add"](e.params.pagination.lockClass)))
      }
      ),
      i("lock unlock", ()=>{
          c()
      }
      ),
      i("click", (f,S)=>{
          let b = S.target
            , x = H(e.pagination.el);
          if (e.params.pagination.el && e.params.pagination.hideOnClick && x && x.length > 0 && !b.classList.contains(e.params.pagination.bulletClass)) {
              if (e.navigation && (e.navigation.nextEl && b === e.navigation.nextEl || e.navigation.prevEl && b === e.navigation.prevEl))
                  return;
              let k = x[0].classList.contains(e.params.pagination.hiddenClass);
              r(k === !0 ? "paginationShow" : "paginationHide"),
              x.forEach(R=>R.classList.toggle(e.params.pagination.hiddenClass))
          }
      }
      );
      let y = ()=>{
          e.el.classList.remove(e.params.pagination.paginationDisabledClass);
          let {el: f} = e.pagination;
          f && (f = H(f),
          f.forEach(S=>S.classList.remove(e.params.pagination.paginationDisabledClass))),
          m(),
          u(),
          c()
      }
        , w = ()=>{
          e.el.classList.add(e.params.pagination.paginationDisabledClass);
          let {el: f} = e.pagination;
          f && (f = H(f),
          f.forEach(S=>S.classList.add(e.params.pagination.paginationDisabledClass))),
          g()
      }
      ;
      Object.assign(e.pagination, {
          enable: y,
          disable: w,
          render: u,
          update: c,
          init: m,
          destroy: g
      })
  }
  function hr(s) {
      let {swiper: e, extendParams: t, on: i, emit: r} = s, n = X(), o = !1, l = null, a = null, h, d, c, u;
      t({
          scrollbar: {
              el: null,
              dragSize: "auto",
              hide: !1,
              draggable: !1,
              snapOnRelease: !0,
              lockClass: "swiper-scrollbar-lock",
              dragClass: "swiper-scrollbar-drag",
              scrollbarDisabledClass: "swiper-scrollbar-disabled",
              horizontalClass: "swiper-scrollbar-horizontal",
              verticalClass: "swiper-scrollbar-vertical"
          }
      }),
      e.scrollbar = {
          el: null,
          dragEl: null
      };
      function m() {
          if (!e.params.scrollbar.el || !e.scrollbar.el)
              return;
          let {scrollbar: C, rtlTranslate: A} = e
            , {dragEl: P, el: B} = C
            , E = e.params.scrollbar
            , v = e.params.loop ? e.progressLoop : e.progress
            , p = d
            , T = (c - d) * v;
          A ? (T = -T,
          T > 0 ? (p = d - T,
          T = 0) : -T + d > c && (p = c + T)) : T < 0 ? (p = d + T,
          T = 0) : T + d > c && (p = c - T),
          e.isHorizontal() ? (P.style.transform = `translate3d(${T}px, 0, 0)`,
          P.style.width = `${p}px`) : (P.style.transform = `translate3d(0px, ${T}px, 0)`,
          P.style.height = `${p}px`),
          E.hide && (clearTimeout(l),
          B.style.opacity = 1,
          l = setTimeout(()=>{
              B.style.opacity = 0,
              B.style.transitionDuration = "400ms"
          }
          , 1e3))
      }
      function g(C) {
          !e.params.scrollbar.el || !e.scrollbar.el || (e.scrollbar.dragEl.style.transitionDuration = `${C}ms`)
      }
      function y() {
          if (!e.params.scrollbar.el || !e.scrollbar.el)
              return;
          let {scrollbar: C} = e
            , {dragEl: A, el: P} = C;
          A.style.width = "",
          A.style.height = "",
          c = e.isHorizontal() ? P.offsetWidth : P.offsetHeight,
          u = e.size / (e.virtualSize + e.params.slidesOffsetBefore - (e.params.centeredSlides ? e.snapGrid[0] : 0)),
          e.params.scrollbar.dragSize === "auto" ? d = c * u : d = parseInt(e.params.scrollbar.dragSize, 10),
          e.isHorizontal() ? A.style.width = `${d}px` : A.style.height = `${d}px`,
          u >= 1 ? P.style.display = "none" : P.style.display = "",
          e.params.scrollbar.hide && (P.style.opacity = 0),
          e.params.watchOverflow && e.enabled && C.el.classList[e.isLocked ? "add" : "remove"](e.params.scrollbar.lockClass)
      }
      function w(C) {
          return e.isHorizontal() ? C.clientX : C.clientY
      }
      function f(C) {
          let {scrollbar: A, rtlTranslate: P} = e, {el: B} = A, E;
          E = (w(C) - Oe(B)[e.isHorizontal() ? "left" : "top"] - (h !== null ? h : d / 2)) / (c - d),
          E = Math.max(Math.min(E, 1), 0),
          P && (E = 1 - E);
          let v = e.minTranslate() + (e.maxTranslate() - e.minTranslate()) * E;
          e.updateProgress(v),
          e.setTranslate(v),
          e.updateActiveIndex(),
          e.updateSlidesClasses()
      }
      function S(C) {
          let A = e.params.scrollbar
            , {scrollbar: P, wrapperEl: B} = e
            , {el: E, dragEl: v} = P;
          o = !0,
          h = C.target === v ? w(C) - C.target.getBoundingClientRect()[e.isHorizontal() ? "left" : "top"] : null,
          C.preventDefault(),
          C.stopPropagation(),
          B.style.transitionDuration = "100ms",
          v.style.transitionDuration = "100ms",
          f(C),
          clearTimeout(a),
          E.style.transitionDuration = "0ms",
          A.hide && (E.style.opacity = 1),
          e.params.cssMode && (e.wrapperEl.style["scroll-snap-type"] = "none"),
          r("scrollbarDragStart", C)
      }
      function b(C) {
          let {scrollbar: A, wrapperEl: P} = e
            , {el: B, dragEl: E} = A;
          o && (C.preventDefault && C.cancelable ? C.preventDefault() : C.returnValue = !1,
          f(C),
          P.style.transitionDuration = "0ms",
          B.style.transitionDuration = "0ms",
          E.style.transitionDuration = "0ms",
          r("scrollbarDragMove", C))
      }
      function x(C) {
          let A = e.params.scrollbar
            , {scrollbar: P, wrapperEl: B} = e
            , {el: E} = P;
          o && (o = !1,
          e.params.cssMode && (e.wrapperEl.style["scroll-snap-type"] = "",
          B.style.transitionDuration = ""),
          A.hide && (clearTimeout(a),
          a = de(()=>{
              E.style.opacity = 0,
              E.style.transitionDuration = "400ms"
          }
          , 1e3)),
          r("scrollbarDragEnd", C),
          A.snapOnRelease && e.slideToClosest())
      }
      function k(C) {
          let {scrollbar: A, params: P} = e
            , B = A.el;
          if (!B)
              return;
          let E = B
            , v = P.passiveListeners ? {
              passive: !1,
              capture: !1
          } : !1
            , p = P.passiveListeners ? {
              passive: !0,
              capture: !1
          } : !1;
          if (!E)
              return;
          let T = C === "on" ? "addEventListener" : "removeEventListener";
          E[T]("pointerdown", S, v),
          n[T]("pointermove", b, v),
          n[T]("pointerup", x, p)
      }
      function R() {
          !e.params.scrollbar.el || !e.scrollbar.el || k("on")
      }
      function $() {
          !e.params.scrollbar.el || !e.scrollbar.el || k("off")
      }
      function I() {
          let {scrollbar: C, el: A} = e;
          e.params.scrollbar = He(e, e.originalParams.scrollbar, e.params.scrollbar, {
              el: "swiper-scrollbar"
          });
          let P = e.params.scrollbar;
          if (!P.el)
              return;
          let B;
          if (typeof P.el == "string" && e.isElement && (B = e.el.querySelector(P.el)),
          !B && typeof P.el == "string") {
              if (B = n.querySelectorAll(P.el),
              !B.length)
                  return
          } else
              B || (B = P.el);
          e.params.uniqueNavElements && typeof P.el == "string" && B.length > 1 && A.querySelectorAll(P.el).length === 1 && (B = A.querySelector(P.el)),
          B.length > 0 && (B = B[0]),
          B.classList.add(e.isHorizontal() ? P.horizontalClass : P.verticalClass);
          let E;
          B && (E = B.querySelector(ae(e.params.scrollbar.dragClass)),
          E || (E = Z("div", e.params.scrollbar.dragClass),
          B.append(E))),
          Object.assign(C, {
              el: B,
              dragEl: E
          }),
          P.draggable && R(),
          B && B.classList[e.enabled ? "remove" : "add"](...ve(e.params.scrollbar.lockClass))
      }
      function O() {
          let C = e.params.scrollbar
            , A = e.scrollbar.el;
          A && A.classList.remove(...ve(e.isHorizontal() ? C.horizontalClass : C.verticalClass)),
          $()
      }
      i("changeDirection", ()=>{
          if (!e.scrollbar || !e.scrollbar.el)
              return;
          let C = e.params.scrollbar
            , {el: A} = e.scrollbar;
          A = H(A),
          A.forEach(P=>{
              P.classList.remove(C.horizontalClass, C.verticalClass),
              P.classList.add(e.isHorizontal() ? C.horizontalClass : C.verticalClass)
          }
          )
      }
      ),
      i("init", ()=>{
          e.params.scrollbar.enabled === !1 ? D() : (I(),
          y(),
          m())
      }
      ),
      i("update resize observerUpdate lock unlock changeDirection", ()=>{
          y()
      }
      ),
      i("setTranslate", ()=>{
          m()
      }
      ),
      i("setTransition", (C,A)=>{
          g(A)
      }
      ),
      i("enable disable", ()=>{
          let {el: C} = e.scrollbar;
          C && C.classList[e.enabled ? "remove" : "add"](...ve(e.params.scrollbar.lockClass))
      }
      ),
      i("destroy", ()=>{
          O()
      }
      );
      let L = ()=>{
          e.el.classList.remove(...ve(e.params.scrollbar.scrollbarDisabledClass)),
          e.scrollbar.el && e.scrollbar.el.classList.remove(...ve(e.params.scrollbar.scrollbarDisabledClass)),
          I(),
          y(),
          m()
      }
        , D = ()=>{
          e.el.classList.add(...ve(e.params.scrollbar.scrollbarDisabledClass)),
          e.scrollbar.el && e.scrollbar.el.classList.add(...ve(e.params.scrollbar.scrollbarDisabledClass)),
          O()
      }
      ;
      Object.assign(e.scrollbar, {
          enable: L,
          disable: D,
          updateSize: y,
          setTranslate: m,
          init: I,
          destroy: O
      })
  }
  function fr(s) {
      let {swiper: e, extendParams: t, on: i} = s;
      t({
          parallax: {
              enabled: !1
          }
      });
      let r = "[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y], [data-swiper-parallax-opacity], [data-swiper-parallax-scale]"
        , n = (a,h)=>{
          let {rtl: d} = e
            , c = d ? -1 : 1
            , u = a.getAttribute("data-swiper-parallax") || "0"
            , m = a.getAttribute("data-swiper-parallax-x")
            , g = a.getAttribute("data-swiper-parallax-y")
            , y = a.getAttribute("data-swiper-parallax-scale")
            , w = a.getAttribute("data-swiper-parallax-opacity")
            , f = a.getAttribute("data-swiper-parallax-rotate");
          if (m || g ? (m = m || "0",
          g = g || "0") : e.isHorizontal() ? (m = u,
          g = "0") : (g = u,
          m = "0"),
          m.indexOf("%") >= 0 ? m = `${parseInt(m, 10) * h * c}%` : m = `${m * h * c}px`,
          g.indexOf("%") >= 0 ? g = `${parseInt(g, 10) * h}%` : g = `${g * h}px`,
          typeof w < "u" && w !== null) {
              let b = w - (w - 1) * (1 - Math.abs(h));
              a.style.opacity = b
          }
          let S = `translate3d(${m}, ${g}, 0px)`;
          if (typeof y < "u" && y !== null) {
              let b = y - (y - 1) * (1 - Math.abs(h));
              S += ` scale(${b})`
          }
          if (f && typeof f < "u" && f !== null) {
              let b = f * h * -1;
              S += ` rotate(${b}deg)`
          }
          a.style.transform = S
      }
        , o = ()=>{
          let {el: a, slides: h, progress: d, snapGrid: c, isElement: u} = e
            , m = Y(a, r);
          e.isElement && m.push(...Y(e.hostEl, r)),
          m.forEach(g=>{
              n(g, d)
          }
          ),
          h.forEach((g,y)=>{
              let w = g.progress;
              e.params.slidesPerGroup > 1 && e.params.slidesPerView !== "auto" && (w += Math.ceil(y / 2) - d * (c.length - 1)),
              w = Math.min(Math.max(w, -1), 1),
              g.querySelectorAll(`${r}, [data-swiper-parallax-rotate]`).forEach(f=>{
                  n(f, w)
              }
              )
          }
          )
      }
        , l = function(a) {
          a === void 0 && (a = e.params.speed);
          let {el: h, hostEl: d} = e
            , c = [...h.querySelectorAll(r)];
          e.isElement && c.push(...d.querySelectorAll(r)),
          c.forEach(u=>{
              let m = parseInt(u.getAttribute("data-swiper-parallax-duration"), 10) || a;
              a === 0 && (m = 0),
              u.style.transitionDuration = `${m}ms`
          }
          )
      };
      i("beforeInit", ()=>{
          e.params.parallax.enabled && (e.params.watchSlidesProgress = !0,
          e.originalParams.watchSlidesProgress = !0)
      }
      ),
      i("init", ()=>{
          e.params.parallax.enabled && o()
      }
      ),
      i("setTranslate", ()=>{
          e.params.parallax.enabled && o()
      }
      ),
      i("setTransition", (a,h)=>{
          e.params.parallax.enabled && l(h)
      }
      )
  }
  function pr(s) {
      let {swiper: e, extendParams: t, on: i, emit: r} = s
        , n = _();
      t({
          zoom: {
              enabled: !1,
              limitToOriginalSize: !1,
              maxRatio: 3,
              minRatio: 1,
              toggle: !0,
              containerClass: "swiper-zoom-container",
              zoomedSlideClass: "swiper-slide-zoomed"
          }
      }),
      e.zoom = {
          enabled: !1
      };
      let o = 1, l = !1, a, h, d = [], c = {
          originX: 0,
          originY: 0,
          slideEl: void 0,
          slideWidth: void 0,
          slideHeight: void 0,
          imageEl: void 0,
          imageWrapEl: void 0,
          maxRatio: 3
      }, u = {
          isTouched: void 0,
          isMoved: void 0,
          currentX: void 0,
          currentY: void 0,
          minX: void 0,
          minY: void 0,
          maxX: void 0,
          maxY: void 0,
          width: void 0,
          height: void 0,
          startX: void 0,
          startY: void 0,
          touchesStart: {},
          touchesCurrent: {}
      }, m = {
          x: void 0,
          y: void 0,
          prevPositionX: void 0,
          prevPositionY: void 0,
          prevTime: void 0
      }, g = 1;
      Object.defineProperty(e.zoom, "scale", {
          get() {
              return g
          },
          set(p) {
              if (g !== p) {
                  let T = c.imageEl
                    , M = c.slideEl;
                  r("zoomChange", p, T, M)
              }
              g = p
          }
      });
      function y() {
          if (d.length < 2)
              return 1;
          let p = d[0].pageX
            , T = d[0].pageY
            , M = d[1].pageX
            , F = d[1].pageY;
          return Math.sqrt((M - p) ** 2 + (F - T) ** 2)
      }
      function w() {
          let p = e.params.zoom
            , T = c.imageWrapEl.getAttribute("data-swiper-zoom") || p.maxRatio;
          if (p.limitToOriginalSize && c.imageEl && c.imageEl.naturalWidth) {
              let M = c.imageEl.naturalWidth / c.imageEl.offsetWidth;
              return Math.min(M, T)
          }
          return T
      }
      function f() {
          if (d.length < 2)
              return {
                  x: null,
                  y: null
              };
          let p = c.imageEl.getBoundingClientRect();
          return [(d[0].pageX + (d[1].pageX - d[0].pageX) / 2 - p.x - n.scrollX) / o, (d[0].pageY + (d[1].pageY - d[0].pageY) / 2 - p.y - n.scrollY) / o]
      }
      function S() {
          return e.isElement ? "swiper-slide" : `.${e.params.slideClass}`
      }
      function b(p) {
          let T = S();
          return !!(p.target.matches(T) || e.slides.filter(M=>M.contains(p.target)).length > 0)
      }
      function x(p) {
          let T = `.${e.params.zoom.containerClass}`;
          return !!(p.target.matches(T) || [...e.hostEl.querySelectorAll(T)].filter(M=>M.contains(p.target)).length > 0)
      }
      function k(p) {
          if (p.pointerType === "mouse" && d.splice(0, d.length),
          !b(p))
              return;
          let T = e.params.zoom;
          if (a = !1,
          h = !1,
          d.push(p),
          !(d.length < 2)) {
              if (a = !0,
              c.scaleStart = y(),
              !c.slideEl) {
                  c.slideEl = p.target.closest(`.${e.params.slideClass}, swiper-slide`),
                  c.slideEl || (c.slideEl = e.slides[e.activeIndex]);
                  let M = c.slideEl.querySelector(`.${T.containerClass}`);
                  if (M && (M = M.querySelectorAll("picture, img, svg, canvas, .swiper-zoom-target")[0]),
                  c.imageEl = M,
                  M ? c.imageWrapEl = ue(c.imageEl, `.${T.containerClass}`)[0] : c.imageWrapEl = void 0,
                  !c.imageWrapEl) {
                      c.imageEl = void 0;
                      return
                  }
                  c.maxRatio = w()
              }
              if (c.imageEl) {
                  let[M,F] = f();
                  c.originX = M,
                  c.originY = F,
                  c.imageEl.style.transitionDuration = "0ms"
              }
              l = !0
          }
      }
      function R(p) {
          if (!b(p))
              return;
          let T = e.params.zoom
            , M = e.zoom
            , F = d.findIndex(V=>V.pointerId === p.pointerId);
          F >= 0 && (d[F] = p),
          !(d.length < 2) && (h = !0,
          c.scaleMove = y(),
          c.imageEl && (M.scale = c.scaleMove / c.scaleStart * o,
          M.scale > c.maxRatio && (M.scale = c.maxRatio - 1 + (M.scale - c.maxRatio + 1) ** .5),
          M.scale < T.minRatio && (M.scale = T.minRatio + 1 - (T.minRatio - M.scale + 1) ** .5),
          c.imageEl.style.transform = `translate3d(0,0,0) scale(${M.scale})`))
      }
      function $(p) {
          if (!b(p) || p.pointerType === "mouse" && p.type === "pointerout")
              return;
          let T = e.params.zoom
            , M = e.zoom
            , F = d.findIndex(V=>V.pointerId === p.pointerId);
          F >= 0 && d.splice(F, 1),
          !(!a || !h) && (a = !1,
          h = !1,
          c.imageEl && (M.scale = Math.max(Math.min(M.scale, c.maxRatio), T.minRatio),
          c.imageEl.style.transitionDuration = `${e.params.speed}ms`,
          c.imageEl.style.transform = `translate3d(0,0,0) scale(${M.scale})`,
          o = M.scale,
          l = !1,
          M.scale > 1 && c.slideEl ? c.slideEl.classList.add(`${T.zoomedSlideClass}`) : M.scale <= 1 && c.slideEl && c.slideEl.classList.remove(`${T.zoomedSlideClass}`),
          M.scale === 1 && (c.originX = 0,
          c.originY = 0,
          c.slideEl = void 0)))
      }
      function I(p) {
          let T = e.device;
          if (!c.imageEl || u.isTouched)
              return;
          T.android && p.cancelable && p.preventDefault(),
          u.isTouched = !0;
          let M = d.length > 0 ? d[0] : p;
          u.touchesStart.x = M.pageX,
          u.touchesStart.y = M.pageY
      }
      function O(p) {
          if (!b(p) || !x(p))
              return;
          let T = e.zoom;
          if (!c.imageEl || !u.isTouched || !c.slideEl)
              return;
          u.isMoved || (u.width = c.imageEl.offsetWidth || c.imageEl.clientWidth,
          u.height = c.imageEl.offsetHeight || c.imageEl.clientHeight,
          u.startX = rt(c.imageWrapEl, "x") || 0,
          u.startY = rt(c.imageWrapEl, "y") || 0,
          c.slideWidth = c.slideEl.offsetWidth,
          c.slideHeight = c.slideEl.offsetHeight,
          c.imageWrapEl.style.transitionDuration = "0ms");
          let M = u.width * T.scale
            , F = u.height * T.scale;
          if (M < c.slideWidth && F < c.slideHeight)
              return;
          if (u.minX = Math.min(c.slideWidth / 2 - M / 2, 0),
          u.maxX = -u.minX,
          u.minY = Math.min(c.slideHeight / 2 - F / 2, 0),
          u.maxY = -u.minY,
          u.touchesCurrent.x = d.length > 0 ? d[0].pageX : p.pageX,
          u.touchesCurrent.y = d.length > 0 ? d[0].pageY : p.pageY,
          Math.max(Math.abs(u.touchesCurrent.x - u.touchesStart.x), Math.abs(u.touchesCurrent.y - u.touchesStart.y)) > 5 && (e.allowClick = !1),
          !u.isMoved && !l) {
              if (e.isHorizontal() && (Math.floor(u.minX) === Math.floor(u.startX) && u.touchesCurrent.x < u.touchesStart.x || Math.floor(u.maxX) === Math.floor(u.startX) && u.touchesCurrent.x > u.touchesStart.x)) {
                  u.isTouched = !1;
                  return
              }
              if (!e.isHorizontal() && (Math.floor(u.minY) === Math.floor(u.startY) && u.touchesCurrent.y < u.touchesStart.y || Math.floor(u.maxY) === Math.floor(u.startY) && u.touchesCurrent.y > u.touchesStart.y)) {
                  u.isTouched = !1;
                  return
              }
          }
          p.cancelable && p.preventDefault(),
          p.stopPropagation(),
          u.isMoved = !0;
          let W = (T.scale - o) / (c.maxRatio - e.params.zoom.minRatio)
            , {originX: Q, originY: N} = c;
          u.currentX = u.touchesCurrent.x - u.touchesStart.x + u.startX + W * (u.width - Q * 2),
          u.currentY = u.touchesCurrent.y - u.touchesStart.y + u.startY + W * (u.height - N * 2),
          u.currentX < u.minX && (u.currentX = u.minX + 1 - (u.minX - u.currentX + 1) ** .8),
          u.currentX > u.maxX && (u.currentX = u.maxX - 1 + (u.currentX - u.maxX + 1) ** .8),
          u.currentY < u.minY && (u.currentY = u.minY + 1 - (u.minY - u.currentY + 1) ** .8),
          u.currentY > u.maxY && (u.currentY = u.maxY - 1 + (u.currentY - u.maxY + 1) ** .8),
          m.prevPositionX || (m.prevPositionX = u.touchesCurrent.x),
          m.prevPositionY || (m.prevPositionY = u.touchesCurrent.y),
          m.prevTime || (m.prevTime = Date.now()),
          m.x = (u.touchesCurrent.x - m.prevPositionX) / (Date.now() - m.prevTime) / 2,
          m.y = (u.touchesCurrent.y - m.prevPositionY) / (Date.now() - m.prevTime) / 2,
          Math.abs(u.touchesCurrent.x - m.prevPositionX) < 2 && (m.x = 0),
          Math.abs(u.touchesCurrent.y - m.prevPositionY) < 2 && (m.y = 0),
          m.prevPositionX = u.touchesCurrent.x,
          m.prevPositionY = u.touchesCurrent.y,
          m.prevTime = Date.now(),
          c.imageWrapEl.style.transform = `translate3d(${u.currentX}px, ${u.currentY}px,0)`
      }
      function L() {
          let p = e.zoom;
          if (!c.imageEl)
              return;
          if (!u.isTouched || !u.isMoved) {
              u.isTouched = !1,
              u.isMoved = !1;
              return
          }
          u.isTouched = !1,
          u.isMoved = !1;
          let T = 300
            , M = 300
            , F = m.x * T
            , V = u.currentX + F
            , W = m.y * M
            , Q = u.currentY + W;
          m.x !== 0 && (T = Math.abs((V - u.currentX) / m.x)),
          m.y !== 0 && (M = Math.abs((Q - u.currentY) / m.y));
          let N = Math.max(T, M);
          u.currentX = V,
          u.currentY = Q;
          let z = u.width * p.scale
            , j = u.height * p.scale;
          u.minX = Math.min(c.slideWidth / 2 - z / 2, 0),
          u.maxX = -u.minX,
          u.minY = Math.min(c.slideHeight / 2 - j / 2, 0),
          u.maxY = -u.minY,
          u.currentX = Math.max(Math.min(u.currentX, u.maxX), u.minX),
          u.currentY = Math.max(Math.min(u.currentY, u.maxY), u.minY),
          c.imageWrapEl.style.transitionDuration = `${N}ms`,
          c.imageWrapEl.style.transform = `translate3d(${u.currentX}px, ${u.currentY}px,0)`
      }
      function D() {
          let p = e.zoom;
          c.slideEl && e.activeIndex !== e.slides.indexOf(c.slideEl) && (c.imageEl && (c.imageEl.style.transform = "translate3d(0,0,0) scale(1)"),
          c.imageWrapEl && (c.imageWrapEl.style.transform = "translate3d(0,0,0)"),
          c.slideEl.classList.remove(`${e.params.zoom.zoomedSlideClass}`),
          p.scale = 1,
          o = 1,
          c.slideEl = void 0,
          c.imageEl = void 0,
          c.imageWrapEl = void 0,
          c.originX = 0,
          c.originY = 0)
      }
      function C(p) {
          let T = e.zoom
            , M = e.params.zoom;
          if (!c.slideEl) {
              p && p.target && (c.slideEl = p.target.closest(`.${e.params.slideClass}, swiper-slide`)),
              c.slideEl || (e.params.virtual && e.params.virtual.enabled && e.virtual ? c.slideEl = Y(e.slidesEl, `.${e.params.slideActiveClass}`)[0] : c.slideEl = e.slides[e.activeIndex]);
              let et = c.slideEl.querySelector(`.${M.containerClass}`);
              et && (et = et.querySelectorAll("picture, img, svg, canvas, .swiper-zoom-target")[0]),
              c.imageEl = et,
              et ? c.imageWrapEl = ue(c.imageEl, `.${M.containerClass}`)[0] : c.imageWrapEl = void 0
          }
          if (!c.imageEl || !c.imageWrapEl)
              return;
          e.params.cssMode && (e.wrapperEl.style.overflow = "hidden",
          e.wrapperEl.style.touchAction = "none"),
          c.slideEl.classList.add(`${M.zoomedSlideClass}`);
          let F, V, W, Q, N, z, j, re, Ne, yt, Oi, ki, St, Et, ss, is, rs, ns;
          typeof u.touchesStart.x > "u" && p ? (F = p.pageX,
          V = p.pageY) : (F = u.touchesStart.x,
          V = u.touchesStart.y);
          let Qe = typeof p == "number" ? p : null;
          o === 1 && Qe && (F = void 0,
          V = void 0);
          let Ri = w();
          T.scale = Qe || Ri,
          o = Qe || Ri,
          p && !(o === 1 && Qe) ? (rs = c.slideEl.offsetWidth,
          ns = c.slideEl.offsetHeight,
          W = Oe(c.slideEl).left + n.scrollX,
          Q = Oe(c.slideEl).top + n.scrollY,
          N = W + rs / 2 - F,
          z = Q + ns / 2 - V,
          Ne = c.imageEl.offsetWidth || c.imageEl.clientWidth,
          yt = c.imageEl.offsetHeight || c.imageEl.clientHeight,
          Oi = Ne * T.scale,
          ki = yt * T.scale,
          St = Math.min(rs / 2 - Oi / 2, 0),
          Et = Math.min(ns / 2 - ki / 2, 0),
          ss = -St,
          is = -Et,
          j = N * T.scale,
          re = z * T.scale,
          j < St && (j = St),
          j > ss && (j = ss),
          re < Et && (re = Et),
          re > is && (re = is)) : (j = 0,
          re = 0),
          Qe && T.scale === 1 && (c.originX = 0,
          c.originY = 0),
          c.imageWrapEl.style.transitionDuration = "300ms",
          c.imageWrapEl.style.transform = `translate3d(${j}px, ${re}px,0)`,
          c.imageEl.style.transitionDuration = "300ms",
          c.imageEl.style.transform = `translate3d(0,0,0) scale(${T.scale})`
      }
      function A() {
          let p = e.zoom
            , T = e.params.zoom;
          if (!c.slideEl) {
              e.params.virtual && e.params.virtual.enabled && e.virtual ? c.slideEl = Y(e.slidesEl, `.${e.params.slideActiveClass}`)[0] : c.slideEl = e.slides[e.activeIndex];
              let M = c.slideEl.querySelector(`.${T.containerClass}`);
              M && (M = M.querySelectorAll("picture, img, svg, canvas, .swiper-zoom-target")[0]),
              c.imageEl = M,
              M ? c.imageWrapEl = ue(c.imageEl, `.${T.containerClass}`)[0] : c.imageWrapEl = void 0
          }
          !c.imageEl || !c.imageWrapEl || (e.params.cssMode && (e.wrapperEl.style.overflow = "",
          e.wrapperEl.style.touchAction = ""),
          p.scale = 1,
          o = 1,
          c.imageWrapEl.style.transitionDuration = "300ms",
          c.imageWrapEl.style.transform = "translate3d(0,0,0)",
          c.imageEl.style.transitionDuration = "300ms",
          c.imageEl.style.transform = "translate3d(0,0,0) scale(1)",
          c.slideEl.classList.remove(`${T.zoomedSlideClass}`),
          c.slideEl = void 0,
          c.originX = 0,
          c.originY = 0)
      }
      function P(p) {
          let T = e.zoom;
          T.scale && T.scale !== 1 ? A() : C(p)
      }
      function B() {
          let p = e.params.passiveListeners ? {
              passive: !0,
              capture: !1
          } : !1
            , T = e.params.passiveListeners ? {
              passive: !1,
              capture: !0
          } : !0;
          return {
              passiveListener: p,
              activeListenerWithCapture: T
          }
      }
      function E() {
          let p = e.zoom;
          if (p.enabled)
              return;
          p.enabled = !0;
          let {passiveListener: T, activeListenerWithCapture: M} = B();
          e.wrapperEl.addEventListener("pointerdown", k, T),
          e.wrapperEl.addEventListener("pointermove", R, M),
          ["pointerup", "pointercancel", "pointerout"].forEach(F=>{
              e.wrapperEl.addEventListener(F, $, T)
          }
          ),
          e.wrapperEl.addEventListener("pointermove", O, M)
      }
      function v() {
          let p = e.zoom;
          if (!p.enabled)
              return;
          p.enabled = !1;
          let {passiveListener: T, activeListenerWithCapture: M} = B();
          e.wrapperEl.removeEventListener("pointerdown", k, T),
          e.wrapperEl.removeEventListener("pointermove", R, M),
          ["pointerup", "pointercancel", "pointerout"].forEach(F=>{
              e.wrapperEl.removeEventListener(F, $, T)
          }
          ),
          e.wrapperEl.removeEventListener("pointermove", O, M)
      }
      i("init", ()=>{
          e.params.zoom.enabled && E()
      }
      ),
      i("destroy", ()=>{
          v()
      }
      ),
      i("touchStart", (p,T)=>{
          e.zoom.enabled && I(T)
      }
      ),
      i("touchEnd", (p,T)=>{
          e.zoom.enabled && L()
      }
      ),
      i("doubleTap", (p,T)=>{
          !e.animating && e.params.zoom.enabled && e.zoom.enabled && e.params.zoom.toggle && P(T)
      }
      ),
      i("transitionEnd", ()=>{
          e.zoom.enabled && e.params.zoom.enabled && D()
      }
      ),
      i("slideChange", ()=>{
          e.zoom.enabled && e.params.zoom.enabled && e.params.cssMode && D()
      }
      ),
      Object.assign(e.zoom, {
          enable: E,
          disable: v,
          in: C,
          out: A,
          toggle: P
      })
  }
  function mr(s) {
      let {swiper: e, extendParams: t, on: i} = s;
      t({
          controller: {
              control: void 0,
              inverse: !1,
              by: "slide"
          }
      }),
      e.controller = {
          control: void 0
      };
      function r(h, d) {
          let c = function() {
              let y, w, f;
              return (S,b)=>{
                  for (w = -1,
                  y = S.length; y - w > 1; )
                      f = y + w >> 1,
                      S[f] <= b ? w = f : y = f;
                  return y
              }
          }();
          this.x = h,
          this.y = d,
          this.lastIndex = h.length - 1;
          let u, m;
          return this.interpolate = function(y) {
              return y ? (m = c(this.x, y),
              u = m - 1,
              (y - this.x[u]) * (this.y[m] - this.y[u]) / (this.x[m] - this.x[u]) + this.y[u]) : 0
          }
          ,
          this
      }
      function n(h) {
          e.controller.spline = e.params.loop ? new r(e.slidesGrid,h.slidesGrid) : new r(e.snapGrid,h.snapGrid)
      }
      function o(h, d) {
          let c = e.controller.control, u, m, g = e.constructor;
          function y(w) {
              if (w.destroyed)
                  return;
              let f = e.rtlTranslate ? -e.translate : e.translate;
              e.params.controller.by === "slide" && (n(w),
              m = -e.controller.spline.interpolate(-f)),
              (!m || e.params.controller.by === "container") && (u = (w.maxTranslate() - w.minTranslate()) / (e.maxTranslate() - e.minTranslate()),
              (Number.isNaN(u) || !Number.isFinite(u)) && (u = 1),
              m = (f - e.minTranslate()) * u + w.minTranslate()),
              e.params.controller.inverse && (m = w.maxTranslate() - m),
              w.updateProgress(m),
              w.setTranslate(m, e),
              w.updateActiveIndex(),
              w.updateSlidesClasses()
          }
          if (Array.isArray(c))
              for (let w = 0; w < c.length; w += 1)
                  c[w] !== d && c[w]instanceof g && y(c[w]);
          else
              c instanceof g && d !== c && y(c)
      }
      function l(h, d) {
          let c = e.constructor, u = e.controller.control, m;
          function g(y) {
              y.destroyed || (y.setTransition(h, e),
              h !== 0 && (y.transitionStart(),
              y.params.autoHeight && de(()=>{
                  y.updateAutoHeight()
              }
              ),
              Se(y.wrapperEl, ()=>{
                  u && y.transitionEnd()
              }
              )))
          }
          if (Array.isArray(u))
              for (m = 0; m < u.length; m += 1)
                  u[m] !== d && u[m]instanceof c && g(u[m]);
          else
              u instanceof c && d !== u && g(u)
      }
      function a() {
          e.controller.control && e.controller.spline && (e.controller.spline = void 0,
          delete e.controller.spline)
      }
      i("beforeInit", ()=>{
          if (typeof window < "u" && (typeof e.params.controller.control == "string" || e.params.controller.control instanceof HTMLElement)) {
              let h = document.querySelector(e.params.controller.control);
              if (h && h.swiper)
                  e.controller.control = h.swiper;
              else if (h) {
                  let d = c=>{
                      e.controller.control = c.detail[0],
                      e.update(),
                      h.removeEventListener("init", d)
                  }
                  ;
                  h.addEventListener("init", d)
              }
              return
          }
          e.controller.control = e.params.controller.control
      }
      ),
      i("update", ()=>{
          a()
      }
      ),
      i("resize", ()=>{
          a()
      }
      ),
      i("observerUpdate", ()=>{
          a()
      }
      ),
      i("setTranslate", (h,d,c)=>{
          !e.controller.control || e.controller.control.destroyed || e.controller.setTranslate(d, c)
      }
      ),
      i("setTransition", (h,d,c)=>{
          !e.controller.control || e.controller.control.destroyed || e.controller.setTransition(d, c)
      }
      ),
      Object.assign(e.controller, {
          setTranslate: o,
          setTransition: l
      })
  }
  function gr(s) {
      let {swiper: e, extendParams: t, on: i} = s;
      t({
          a11y: {
              enabled: !0,
              notificationClass: "swiper-notification",
              prevSlideMessage: "Previous slide",
              nextSlideMessage: "Next slide",
              firstSlideMessage: "This is the first slide",
              lastSlideMessage: "This is the last slide",
              paginationBulletMessage: "Go to slide {{index}}",
              slideLabelMessage: "{{index}} / {{slidesLength}}",
              containerMessage: null,
              containerRoleDescriptionMessage: null,
              itemRoleDescriptionMessage: null,
              slideRole: "group",
              id: null
          }
      }),
      e.a11y = {
          clicked: !1
      };
      let r = null, n, o, l = new Date().getTime();
      function a(v) {
          let p = r;
          p.length !== 0 && (p.innerHTML = "",
          p.innerHTML = v)
      }
      function h(v) {
          v === void 0 && (v = 16);
          let p = ()=>Math.round(16 * Math.random()).toString(16);
          return "x".repeat(v).replace(/x/g, p)
      }
      function d(v) {
          v = H(v),
          v.forEach(p=>{
              p.setAttribute("tabIndex", "0")
          }
          )
      }
      function c(v) {
          v = H(v),
          v.forEach(p=>{
              p.setAttribute("tabIndex", "-1")
          }
          )
      }
      function u(v, p) {
          v = H(v),
          v.forEach(T=>{
              T.setAttribute("role", p)
          }
          )
      }
      function m(v, p) {
          v = H(v),
          v.forEach(T=>{
              T.setAttribute("aria-roledescription", p)
          }
          )
      }
      function g(v, p) {
          v = H(v),
          v.forEach(T=>{
              T.setAttribute("aria-controls", p)
          }
          )
      }
      function y(v, p) {
          v = H(v),
          v.forEach(T=>{
              T.setAttribute("aria-label", p)
          }
          )
      }
      function w(v, p) {
          v = H(v),
          v.forEach(T=>{
              T.setAttribute("id", p)
          }
          )
      }
      function f(v, p) {
          v = H(v),
          v.forEach(T=>{
              T.setAttribute("aria-live", p)
          }
          )
      }
      function S(v) {
          v = H(v),
          v.forEach(p=>{
              p.setAttribute("aria-disabled", !0)
          }
          )
      }
      function b(v) {
          v = H(v),
          v.forEach(p=>{
              p.setAttribute("aria-disabled", !1)
          }
          )
      }
      function x(v) {
          if (v.keyCode !== 13 && v.keyCode !== 32)
              return;
          let p = e.params.a11y
            , T = v.target;
          if (!(e.pagination && e.pagination.el && (T === e.pagination.el || e.pagination.el.contains(v.target)) && !v.target.matches(ae(e.params.pagination.bulletClass)))) {
              if (e.navigation && e.navigation.prevEl && e.navigation.nextEl) {
                  let M = H(e.navigation.prevEl);
                  H(e.navigation.nextEl).includes(T) && (e.isEnd && !e.params.loop || e.slideNext(),
                  e.isEnd ? a(p.lastSlideMessage) : a(p.nextSlideMessage)),
                  M.includes(T) && (e.isBeginning && !e.params.loop || e.slidePrev(),
                  e.isBeginning ? a(p.firstSlideMessage) : a(p.prevSlideMessage))
              }
              e.pagination && T.matches(ae(e.params.pagination.bulletClass)) && T.click()
          }
      }
      function k() {
          if (e.params.loop || e.params.rewind || !e.navigation)
              return;
          let {nextEl: v, prevEl: p} = e.navigation;
          p && (e.isBeginning ? (S(p),
          c(p)) : (b(p),
          d(p))),
          v && (e.isEnd ? (S(v),
          c(v)) : (b(v),
          d(v)))
      }
      function R() {
          return e.pagination && e.pagination.bullets && e.pagination.bullets.length
      }
      function $() {
          return R() && e.params.pagination.clickable
      }
      function I() {
          let v = e.params.a11y;
          R() && e.pagination.bullets.forEach(p=>{
              e.params.pagination.clickable && (d(p),
              e.params.pagination.renderBullet || (u(p, "button"),
              y(p, v.paginationBulletMessage.replace(/\{\{index\}\}/, ye(p) + 1)))),
              p.matches(ae(e.params.pagination.bulletActiveClass)) ? p.setAttribute("aria-current", "true") : p.removeAttribute("aria-current")
          }
          )
      }
      let O = (v,p,T)=>{
          d(v),
          v.tagName !== "BUTTON" && (u(v, "button"),
          v.addEventListener("keydown", x)),
          y(v, T),
          g(v, p)
      }
        , L = v=>{
          o && o !== v.target && !o.contains(v.target) && (n = !0),
          e.a11y.clicked = !0
      }
        , D = ()=>{
          n = !1,
          requestAnimationFrame(()=>{
              requestAnimationFrame(()=>{
                  e.destroyed || (e.a11y.clicked = !1)
              }
              )
          }
          )
      }
        , C = v=>{
          l = new Date().getTime()
      }
        , A = v=>{
          if (e.a11y.clicked || new Date().getTime() - l < 100)
              return;
          let p = v.target.closest(`.${e.params.slideClass}, swiper-slide`);
          if (!p || !e.slides.includes(p))
              return;
          o = p;
          let T = e.slides.indexOf(p) === e.activeIndex
            , M = e.params.watchSlidesProgress && e.visibleSlides && e.visibleSlides.includes(p);
          T || M || v.sourceCapabilities && v.sourceCapabilities.firesTouchEvents || (e.isHorizontal() ? e.el.scrollLeft = 0 : e.el.scrollTop = 0,
          requestAnimationFrame(()=>{
              n || (e.slideTo(e.slides.indexOf(p), 0),
              n = !1)
          }
          ))
      }
        , P = ()=>{
          let v = e.params.a11y;
          v.itemRoleDescriptionMessage && m(e.slides, v.itemRoleDescriptionMessage),
          v.slideRole && u(e.slides, v.slideRole);
          let p = e.slides.length;
          v.slideLabelMessage && e.slides.forEach((T,M)=>{
              let F = e.params.loop ? parseInt(T.getAttribute("data-swiper-slide-index"), 10) : M
                , V = v.slideLabelMessage.replace(/\{\{index\}\}/, F + 1).replace(/\{\{slidesLength\}\}/, p);
              y(T, V)
          }
          )
      }
        , B = ()=>{
          let v = e.params.a11y;
          e.el.append(r);
          let p = e.el;
          v.containerRoleDescriptionMessage && m(p, v.containerRoleDescriptionMessage),
          v.containerMessage && y(p, v.containerMessage);
          let T = e.wrapperEl
            , M = v.id || T.getAttribute("id") || `swiper-wrapper-${h(16)}`
            , F = e.params.autoplay && e.params.autoplay.enabled ? "off" : "polite";
          w(T, M),
          f(T, F),
          P();
          let {nextEl: V, prevEl: W} = e.navigation ? e.navigation : {};
          V = H(V),
          W = H(W),
          V && V.forEach(N=>O(N, M, v.nextSlideMessage)),
          W && W.forEach(N=>O(N, M, v.prevSlideMessage)),
          $() && H(e.pagination.el).forEach(z=>{
              z.addEventListener("keydown", x)
          }
          ),
          X().addEventListener("visibilitychange", C),
          e.el.addEventListener("focus", A, !0),
          e.el.addEventListener("focus", A, !0),
          e.el.addEventListener("pointerdown", L, !0),
          e.el.addEventListener("pointerup", D, !0)
      }
      ;
      function E() {
          r && r.remove();
          let {nextEl: v, prevEl: p} = e.navigation ? e.navigation : {};
          v = H(v),
          p = H(p),
          v && v.forEach(M=>M.removeEventListener("keydown", x)),
          p && p.forEach(M=>M.removeEventListener("keydown", x)),
          $() && H(e.pagination.el).forEach(F=>{
              F.removeEventListener("keydown", x)
          }
          ),
          X().removeEventListener("visibilitychange", C),
          e.el.removeEventListener("focus", A, !0),
          e.el.removeEventListener("pointerdown", L, !0),
          e.el.removeEventListener("pointerup", D, !0)
      }
      i("beforeInit", ()=>{
          r = Z("span", e.params.a11y.notificationClass),
          r.setAttribute("aria-live", "assertive"),
          r.setAttribute("aria-atomic", "true")
      }
      ),
      i("afterInit", ()=>{
          e.params.a11y.enabled && B()
      }
      ),
      i("slidesLengthChange snapGridLengthChange slidesGridLengthChange", ()=>{
          e.params.a11y.enabled && P()
      }
      ),
      i("fromEdge toEdge afterInit lock unlock", ()=>{
          e.params.a11y.enabled && k()
      }
      ),
      i("paginationUpdate", ()=>{
          e.params.a11y.enabled && I()
      }
      ),
      i("destroy", ()=>{
          e.params.a11y.enabled && E()
      }
      )
  }
  function vr(s) {
      let {swiper: e, extendParams: t, on: i} = s;
      t({
          history: {
              enabled: !1,
              root: "",
              replaceState: !1,
              key: "slides",
              keepQuery: !1
          }
      });
      let r = !1
        , n = {}
        , o = m=>m.toString().replace(/\s+/g, "-").replace(/[^\w-]+/g, "").replace(/--+/g, "-").replace(/^-+/, "").replace(/-+$/, "")
        , l = m=>{
          let g = _(), y;
          m ? y = new URL(m) : y = g.location;
          let w = y.pathname.slice(1).split("/").filter(x=>x !== "")
            , f = w.length
            , S = w[f - 2]
            , b = w[f - 1];
          return {
              key: S,
              value: b
          }
      }
        , a = (m,g)=>{
          let y = _();
          if (!r || !e.params.history.enabled)
              return;
          let w;
          e.params.url ? w = new URL(e.params.url) : w = y.location;
          let f = e.virtual && e.params.virtual.enabled ? e.slidesEl.querySelector(`[data-swiper-slide-index="${g}"]`) : e.slides[g]
            , S = o(f.getAttribute("data-history"));
          if (e.params.history.root.length > 0) {
              let x = e.params.history.root;
              x[x.length - 1] === "/" && (x = x.slice(0, x.length - 1)),
              S = `${x}/${m ? `${m}/` : ""}${S}`
          } else
              w.pathname.includes(m) || (S = `${m ? `${m}/` : ""}${S}`);
          e.params.history.keepQuery && (S += w.search);
          let b = y.history.state;
          b && b.value === S || (e.params.history.replaceState ? y.history.replaceState({
              value: S
          }, null, S) : y.history.pushState({
              value: S
          }, null, S))
      }
        , h = (m,g,y)=>{
          if (g)
              for (let w = 0, f = e.slides.length; w < f; w += 1) {
                  let S = e.slides[w];
                  if (o(S.getAttribute("data-history")) === g) {
                      let x = e.getSlideIndex(S);
                      e.slideTo(x, m, y)
                  }
              }
          else
              e.slideTo(0, m, y)
      }
        , d = ()=>{
          n = l(e.params.url),
          h(e.params.speed, n.value, !1)
      }
        , c = ()=>{
          let m = _();
          if (e.params.history) {
              if (!m.history || !m.history.pushState) {
                  e.params.history.enabled = !1,
                  e.params.hashNavigation.enabled = !0;
                  return
              }
              if (r = !0,
              n = l(e.params.url),
              !n.key && !n.value) {
                  e.params.history.replaceState || m.addEventListener("popstate", d);
                  return
              }
              h(0, n.value, e.params.runCallbacksOnInit),
              e.params.history.replaceState || m.addEventListener("popstate", d)
          }
      }
        , u = ()=>{
          let m = _();
          e.params.history.replaceState || m.removeEventListener("popstate", d)
      }
      ;
      i("init", ()=>{
          e.params.history.enabled && c()
      }
      ),
      i("destroy", ()=>{
          e.params.history.enabled && u()
      }
      ),
      i("transitionEnd _freeModeNoMomentumRelease", ()=>{
          r && a(e.params.history.key, e.activeIndex)
      }
      ),
      i("slideChange", ()=>{
          r && e.params.cssMode && a(e.params.history.key, e.activeIndex)
      }
      )
  }
  function br(s) {
      let {swiper: e, extendParams: t, emit: i, on: r} = s
        , n = !1
        , o = X()
        , l = _();
      t({
          hashNavigation: {
              enabled: !1,
              replaceState: !1,
              watchState: !1,
              getSlideIndex(u, m) {
                  if (e.virtual && e.params.virtual.enabled) {
                      let g = e.slides.filter(w=>w.getAttribute("data-hash") === m)[0];
                      return g ? parseInt(g.getAttribute("data-swiper-slide-index"), 10) : 0
                  }
                  return e.getSlideIndex(Y(e.slidesEl, `.${e.params.slideClass}[data-hash="${m}"], swiper-slide[data-hash="${m}"]`)[0])
              }
          }
      });
      let a = ()=>{
          i("hashChange");
          let u = o.location.hash.replace("#", "")
            , m = e.virtual && e.params.virtual.enabled ? e.slidesEl.querySelector(`[data-swiper-slide-index="${e.activeIndex}"]`) : e.slides[e.activeIndex]
            , g = m ? m.getAttribute("data-hash") : "";
          if (u !== g) {
              let y = e.params.hashNavigation.getSlideIndex(e, u);
              if (typeof y > "u" || Number.isNaN(y))
                  return;
              e.slideTo(y)
          }
      }
        , h = ()=>{
          if (!n || !e.params.hashNavigation.enabled)
              return;
          let u = e.virtual && e.params.virtual.enabled ? e.slidesEl.querySelector(`[data-swiper-slide-index="${e.activeIndex}"]`) : e.slides[e.activeIndex]
            , m = u ? u.getAttribute("data-hash") || u.getAttribute("data-history") : "";
          e.params.hashNavigation.replaceState && l.history && l.history.replaceState ? (l.history.replaceState(null, null, `#${m}` || ""),
          i("hashSet")) : (o.location.hash = m || "",
          i("hashSet"))
      }
        , d = ()=>{
          if (!e.params.hashNavigation.enabled || e.params.history && e.params.history.enabled)
              return;
          n = !0;
          let u = o.location.hash.replace("#", "");
          if (u) {
              let g = e.params.hashNavigation.getSlideIndex(e, u);
              e.slideTo(g || 0, 0, e.params.runCallbacksOnInit, !0)
          }
          e.params.hashNavigation.watchState && l.addEventListener("hashchange", a)
      }
        , c = ()=>{
          e.params.hashNavigation.watchState && l.removeEventListener("hashchange", a)
      }
      ;
      r("init", ()=>{
          e.params.hashNavigation.enabled && d()
      }
      ),
      r("destroy", ()=>{
          e.params.hashNavigation.enabled && c()
      }
      ),
      r("transitionEnd _freeModeNoMomentumRelease", ()=>{
          n && h()
      }
      ),
      r("slideChange", ()=>{
          n && e.params.cssMode && h()
      }
      )
  }
  function wr(s) {
      let {swiper: e, extendParams: t, on: i, emit: r, params: n} = s;
      e.autoplay = {
          running: !1,
          paused: !1,
          timeLeft: 0
      },
      t({
          autoplay: {
              enabled: !1,
              delay: 3e3,
              waitForTransition: !0,
              disableOnInteraction: !1,
              stopOnLastSlide: !1,
              reverseDirection: !1,
              pauseOnMouseEnter: !1
          }
      });
      let o, l, a = n && n.autoplay ? n.autoplay.delay : 3e3, h = n && n.autoplay ? n.autoplay.delay : 3e3, d, c = new Date().getTime(), u, m, g, y, w, f, S;
      function b(p) {
          !e || e.destroyed || !e.wrapperEl || p.target === e.wrapperEl && (e.wrapperEl.removeEventListener("transitionend", b),
          !S && L())
      }
      let x = ()=>{
          if (e.destroyed || !e.autoplay.running)
              return;
          e.autoplay.paused ? u = !0 : u && (h = d,
          u = !1);
          let p = e.autoplay.paused ? d : c + h - new Date().getTime();
          e.autoplay.timeLeft = p,
          r("autoplayTimeLeft", p, p / a),
          l = requestAnimationFrame(()=>{
              x()
          }
          )
      }
        , k = ()=>{
          let p;
          return e.virtual && e.params.virtual.enabled ? p = e.slides.filter(M=>M.classList.contains("swiper-slide-active"))[0] : p = e.slides[e.activeIndex],
          p ? parseInt(p.getAttribute("data-swiper-autoplay"), 10) : void 0
      }
        , R = p=>{
          if (e.destroyed || !e.autoplay.running)
              return;
          cancelAnimationFrame(l),
          x();
          let T = typeof p > "u" ? e.params.autoplay.delay : p;
          a = e.params.autoplay.delay,
          h = e.params.autoplay.delay;
          let M = k();
          !Number.isNaN(M) && M > 0 && typeof p > "u" && (T = M,
          a = M,
          h = M),
          d = T;
          let F = e.params.speed
            , V = ()=>{
              !e || e.destroyed || (e.params.autoplay.reverseDirection ? !e.isBeginning || e.params.loop || e.params.rewind ? (e.slidePrev(F, !0, !0),
              r("autoplay")) : e.params.autoplay.stopOnLastSlide || (e.slideTo(e.slides.length - 1, F, !0, !0),
              r("autoplay")) : !e.isEnd || e.params.loop || e.params.rewind ? (e.slideNext(F, !0, !0),
              r("autoplay")) : e.params.autoplay.stopOnLastSlide || (e.slideTo(0, F, !0, !0),
              r("autoplay")),
              e.params.cssMode && (c = new Date().getTime(),
              requestAnimationFrame(()=>{
                  R()
              }
              )))
          }
          ;
          return T > 0 ? (clearTimeout(o),
          o = setTimeout(()=>{
              V()
          }
          , T)) : requestAnimationFrame(()=>{
              V()
          }
          ),
          T
      }
        , $ = ()=>{
          c = new Date().getTime(),
          e.autoplay.running = !0,
          R(),
          r("autoplayStart")
      }
        , I = ()=>{
          e.autoplay.running = !1,
          clearTimeout(o),
          cancelAnimationFrame(l),
          r("autoplayStop")
      }
        , O = (p,T)=>{
          if (e.destroyed || !e.autoplay.running)
              return;
          clearTimeout(o),
          p || (f = !0);
          let M = ()=>{
              r("autoplayPause"),
              e.params.autoplay.waitForTransition ? e.wrapperEl.addEventListener("transitionend", b) : L()
          }
          ;
          if (e.autoplay.paused = !0,
          T) {
              w && (d = e.params.autoplay.delay),
              w = !1,
              M();
              return
          }
          d = (d || e.params.autoplay.delay) - (new Date().getTime() - c),
          !(e.isEnd && d < 0 && !e.params.loop) && (d < 0 && (d = 0),
          M())
      }
        , L = ()=>{
          e.isEnd && d < 0 && !e.params.loop || e.destroyed || !e.autoplay.running || (c = new Date().getTime(),
          f ? (f = !1,
          R(d)) : R(),
          e.autoplay.paused = !1,
          r("autoplayResume"))
      }
        , D = ()=>{
          if (e.destroyed || !e.autoplay.running)
              return;
          let p = X();
          p.visibilityState === "hidden" && (f = !0,
          O(!0)),
          p.visibilityState === "visible" && L()
      }
        , C = p=>{
          p.pointerType === "mouse" && (f = !0,
          S = !0,
          !(e.animating || e.autoplay.paused) && O(!0))
      }
        , A = p=>{
          p.pointerType === "mouse" && (S = !1,
          e.autoplay.paused && L())
      }
        , P = ()=>{
          e.params.autoplay.pauseOnMouseEnter && (e.el.addEventListener("pointerenter", C),
          e.el.addEventListener("pointerleave", A))
      }
        , B = ()=>{
          e.el.removeEventListener("pointerenter", C),
          e.el.removeEventListener("pointerleave", A)
      }
        , E = ()=>{
          X().addEventListener("visibilitychange", D)
      }
        , v = ()=>{
          X().removeEventListener("visibilitychange", D)
      }
      ;
      i("init", ()=>{
          e.params.autoplay.enabled && (P(),
          E(),
          $())
      }
      ),
      i("destroy", ()=>{
          B(),
          v(),
          e.autoplay.running && I()
      }
      ),
      i("_freeModeStaticRelease", ()=>{
          (g || f) && L()
      }
      ),
      i("_freeModeNoMomentumRelease", ()=>{
          e.params.autoplay.disableOnInteraction ? I() : O(!0, !0)
      }
      ),
      i("beforeTransitionStart", (p,T,M)=>{
          e.destroyed || !e.autoplay.running || (M || !e.params.autoplay.disableOnInteraction ? O(!0, !0) : I())
      }
      ),
      i("sliderFirstMove", ()=>{
          if (!(e.destroyed || !e.autoplay.running)) {
              if (e.params.autoplay.disableOnInteraction) {
                  I();
                  return
              }
              m = !0,
              g = !1,
              f = !1,
              y = setTimeout(()=>{
                  f = !0,
                  g = !0,
                  O(!0)
              }
              , 200)
          }
      }
      ),
      i("touchEnd", ()=>{
          if (!(e.destroyed || !e.autoplay.running || !m)) {
              if (clearTimeout(y),
              clearTimeout(o),
              e.params.autoplay.disableOnInteraction) {
                  g = !1,
                  m = !1;
                  return
              }
              g && e.params.cssMode && L(),
              g = !1,
              m = !1
          }
      }
      ),
      i("slideChange", ()=>{
          e.destroyed || !e.autoplay.running || (w = !0)
      }
      ),
      Object.assign(e.autoplay, {
          start: $,
          stop: I,
          pause: O,
          resume: L
      })
  }
  function yr(s) {
      let {swiper: e, extendParams: t, on: i} = s;
      t({
          thumbs: {
              swiper: null,
              multipleActiveThumbs: !0,
              autoScrollOffset: 0,
              slideThumbActiveClass: "swiper-slide-thumb-active",
              thumbsContainerClass: "swiper-thumbs"
          }
      });
      let r = !1
        , n = !1;
      e.thumbs = {
          swiper: null
      };
      function o() {
          let h = e.thumbs.swiper;
          if (!h || h.destroyed)
              return;
          let d = h.clickedIndex
            , c = h.clickedSlide;
          if (c && c.classList.contains(e.params.thumbs.slideThumbActiveClass) || typeof d > "u" || d === null)
              return;
          let u;
          h.params.loop ? u = parseInt(h.clickedSlide.getAttribute("data-swiper-slide-index"), 10) : u = d,
          e.params.loop ? e.slideToLoop(u) : e.slideTo(u)
      }
      function l() {
          let {thumbs: h} = e.params;
          if (r)
              return !1;
          r = !0;
          let d = e.constructor;
          if (h.swiper instanceof d)
              e.thumbs.swiper = h.swiper,
              Object.assign(e.thumbs.swiper.originalParams, {
                  watchSlidesProgress: !0,
                  slideToClickedSlide: !1
              }),
              Object.assign(e.thumbs.swiper.params, {
                  watchSlidesProgress: !0,
                  slideToClickedSlide: !1
              }),
              e.thumbs.swiper.update();
          else if (ze(h.swiper)) {
              let c = Object.assign({}, h.swiper);
              Object.assign(c, {
                  watchSlidesProgress: !0,
                  slideToClickedSlide: !1
              }),
              e.thumbs.swiper = new d(c),
              n = !0
          }
          return e.thumbs.swiper.el.classList.add(e.params.thumbs.thumbsContainerClass),
          e.thumbs.swiper.on("tap", o),
          !0
      }
      function a(h) {
          let d = e.thumbs.swiper;
          if (!d || d.destroyed)
              return;
          let c = d.params.slidesPerView === "auto" ? d.slidesPerViewDynamic() : d.params.slidesPerView
            , u = 1
            , m = e.params.thumbs.slideThumbActiveClass;
          if (e.params.slidesPerView > 1 && !e.params.centeredSlides && (u = e.params.slidesPerView),
          e.params.thumbs.multipleActiveThumbs || (u = 1),
          u = Math.floor(u),
          d.slides.forEach(w=>w.classList.remove(m)),
          d.params.loop || d.params.virtual && d.params.virtual.enabled)
              for (let w = 0; w < u; w += 1)
                  Y(d.slidesEl, `[data-swiper-slide-index="${e.realIndex + w}"]`).forEach(f=>{
                      f.classList.add(m)
                  }
                  );
          else
              for (let w = 0; w < u; w += 1)
                  d.slides[e.realIndex + w] && d.slides[e.realIndex + w].classList.add(m);
          let g = e.params.thumbs.autoScrollOffset
            , y = g && !d.params.loop;
          if (e.realIndex !== d.realIndex || y) {
              let w = d.activeIndex, f, S;
              if (d.params.loop) {
                  let b = d.slides.filter(x=>x.getAttribute("data-swiper-slide-index") === `${e.realIndex}`)[0];
                  f = d.slides.indexOf(b),
                  S = e.activeIndex > e.previousIndex ? "next" : "prev"
              } else
                  f = e.realIndex,
                  S = f > e.previousIndex ? "next" : "prev";
              y && (f += S === "next" ? g : -1 * g),
              d.visibleSlidesIndexes && d.visibleSlidesIndexes.indexOf(f) < 0 && (d.params.centeredSlides ? f > w ? f = f - Math.floor(c / 2) + 1 : f = f + Math.floor(c / 2) - 1 : f > w && d.params.slidesPerGroup,
              d.slideTo(f, h ? 0 : void 0))
          }
      }
      i("beforeInit", ()=>{
          let {thumbs: h} = e.params;
          if (!(!h || !h.swiper))
              if (typeof h.swiper == "string" || h.swiper instanceof HTMLElement) {
                  let d = X()
                    , c = ()=>{
                      let m = typeof h.swiper == "string" ? d.querySelector(h.swiper) : h.swiper;
                      if (m && m.swiper)
                          h.swiper = m.swiper,
                          l(),
                          a(!0);
                      else if (m) {
                          let g = y=>{
                              h.swiper = y.detail[0],
                              m.removeEventListener("init", g),
                              l(),
                              a(!0),
                              h.swiper.update(),
                              e.update()
                          }
                          ;
                          m.addEventListener("init", g)
                      }
                      return m
                  }
                    , u = ()=>{
                      if (e.destroyed)
                          return;
                      c() || requestAnimationFrame(u)
                  }
                  ;
                  requestAnimationFrame(u)
              } else
                  l(),
                  a(!0)
      }
      ),
      i("slideChange update resize observerUpdate", ()=>{
          a()
      }
      ),
      i("setTransition", (h,d)=>{
          let c = e.thumbs.swiper;
          !c || c.destroyed || c.setTransition(d)
      }
      ),
      i("beforeDestroy", ()=>{
          let h = e.thumbs.swiper;
          !h || h.destroyed || n && h.destroy()
      }
      ),
      Object.assign(e.thumbs, {
          init: l,
          update: a
      })
  }
  function Sr(s) {
      let {swiper: e, extendParams: t, emit: i, once: r} = s;
      t({
          freeMode: {
              enabled: !1,
              momentum: !0,
              momentumRatio: 1,
              momentumBounce: !0,
              momentumBounceRatio: 1,
              momentumVelocityRatio: 1,
              sticky: !1,
              minimumVelocity: .02
          }
      });
      function n() {
          if (e.params.cssMode)
              return;
          let a = e.getTranslate();
          e.setTranslate(a),
          e.setTransition(0),
          e.touchEventsData.velocities.length = 0,
          e.freeMode.onTouchEnd({
              currentPos: e.rtl ? e.translate : -e.translate
          })
      }
      function o() {
          if (e.params.cssMode)
              return;
          let {touchEventsData: a, touches: h} = e;
          a.velocities.length === 0 && a.velocities.push({
              position: h[e.isHorizontal() ? "startX" : "startY"],
              time: a.touchStartTime
          }),
          a.velocities.push({
              position: h[e.isHorizontal() ? "currentX" : "currentY"],
              time: te()
          })
      }
      function l(a) {
          let {currentPos: h} = a;
          if (e.params.cssMode)
              return;
          let {params: d, wrapperEl: c, rtlTranslate: u, snapGrid: m, touchEventsData: g} = e
            , w = te() - g.touchStartTime;
          if (h < -e.minTranslate()) {
              e.slideTo(e.activeIndex);
              return
          }
          if (h > -e.maxTranslate()) {
              e.slides.length < m.length ? e.slideTo(m.length - 1) : e.slideTo(e.slides.length - 1);
              return
          }
          if (d.freeMode.momentum) {
              if (g.velocities.length > 1) {
                  let I = g.velocities.pop()
                    , O = g.velocities.pop()
                    , L = I.position - O.position
                    , D = I.time - O.time;
                  e.velocity = L / D,
                  e.velocity /= 2,
                  Math.abs(e.velocity) < d.freeMode.minimumVelocity && (e.velocity = 0),
                  (D > 150 || te() - I.time > 300) && (e.velocity = 0)
              } else
                  e.velocity = 0;
              e.velocity *= d.freeMode.momentumVelocityRatio,
              g.velocities.length = 0;
              let f = 1e3 * d.freeMode.momentumRatio
                , S = e.velocity * f
                , b = e.translate + S;
              u && (b = -b);
              let x = !1, k, R = Math.abs(e.velocity) * 20 * d.freeMode.momentumBounceRatio, $;
              if (b < e.maxTranslate())
                  d.freeMode.momentumBounce ? (b + e.maxTranslate() < -R && (b = e.maxTranslate() - R),
                  k = e.maxTranslate(),
                  x = !0,
                  g.allowMomentumBounce = !0) : b = e.maxTranslate(),
                  d.loop && d.centeredSlides && ($ = !0);
              else if (b > e.minTranslate())
                  d.freeMode.momentumBounce ? (b - e.minTranslate() > R && (b = e.minTranslate() + R),
                  k = e.minTranslate(),
                  x = !0,
                  g.allowMomentumBounce = !0) : b = e.minTranslate(),
                  d.loop && d.centeredSlides && ($ = !0);
              else if (d.freeMode.sticky) {
                  let I;
                  for (let O = 0; O < m.length; O += 1)
                      if (m[O] > -b) {
                          I = O;
                          break
                      }
                  Math.abs(m[I] - b) < Math.abs(m[I - 1] - b) || e.swipeDirection === "next" ? b = m[I] : b = m[I - 1],
                  b = -b
              }
              if ($ && r("transitionEnd", ()=>{
                  e.loopFix()
              }
              ),
              e.velocity !== 0) {
                  if (u ? f = Math.abs((-b - e.translate) / e.velocity) : f = Math.abs((b - e.translate) / e.velocity),
                  d.freeMode.sticky) {
                      let I = Math.abs((u ? -b : b) - e.translate)
                        , O = e.slidesSizesGrid[e.activeIndex];
                      I < O ? f = d.speed : I < 2 * O ? f = d.speed * 1.5 : f = d.speed * 2.5
                  }
              } else if (d.freeMode.sticky) {
                  e.slideToClosest();
                  return
              }
              d.freeMode.momentumBounce && x ? (e.updateProgress(k),
              e.setTransition(f),
              e.setTranslate(b),
              e.transitionStart(!0, e.swipeDirection),
              e.animating = !0,
              Se(c, ()=>{
                  !e || e.destroyed || !g.allowMomentumBounce || (i("momentumBounce"),
                  e.setTransition(d.speed),
                  setTimeout(()=>{
                      e.setTranslate(k),
                      Se(c, ()=>{
                          !e || e.destroyed || e.transitionEnd()
                      }
                      )
                  }
                  , 0))
              }
              )) : e.velocity ? (i("_freeModeNoMomentumRelease"),
              e.updateProgress(b),
              e.setTransition(f),
              e.setTranslate(b),
              e.transitionStart(!0, e.swipeDirection),
              e.animating || (e.animating = !0,
              Se(c, ()=>{
                  !e || e.destroyed || e.transitionEnd()
              }
              ))) : e.updateProgress(b),
              e.updateActiveIndex(),
              e.updateSlidesClasses()
          } else if (d.freeMode.sticky) {
              e.slideToClosest();
              return
          } else
              d.freeMode && i("_freeModeNoMomentumRelease");
          (!d.freeMode.momentum || w >= d.longSwipesMs) && (i("_freeModeStaticRelease"),
          e.updateProgress(),
          e.updateActiveIndex(),
          e.updateSlidesClasses())
      }
      Object.assign(e, {
          freeMode: {
              onTouchStart: n,
              onTouchMove: o,
              onTouchEnd: l
          }
      })
  }
  function Er(s) {
      let {swiper: e, extendParams: t, on: i} = s;
      t({
          grid: {
              rows: 1,
              fill: "column"
          }
      });
      let r, n, o, l, a = ()=>{
          let y = e.params.spaceBetween;
          return typeof y == "string" && y.indexOf("%") >= 0 ? y = parseFloat(y.replace("%", "")) / 100 * e.size : typeof y == "string" && (y = parseFloat(y)),
          y
      }
      , h = y=>{
          let {slidesPerView: w} = e.params
            , {rows: f, fill: S} = e.params.grid
            , b = e.virtual && e.params.virtual.enabled ? e.virtual.slides.length : y.length;
          o = Math.floor(b / f),
          Math.floor(b / f) === b / f ? r = b : r = Math.ceil(b / f) * f,
          w !== "auto" && S === "row" && (r = Math.max(r, w * f)),
          n = r / f
      }
      , d = ()=>{
          e.slides && e.slides.forEach(y=>{
              y.swiperSlideGridSet && (y.style.height = "",
              y.style[e.getDirectionLabel("margin-top")] = "")
          }
          )
      }
      , c = (y,w,f)=>{
          let {slidesPerGroup: S} = e.params, b = a(), {rows: x, fill: k} = e.params.grid, R = e.virtual && e.params.virtual.enabled ? e.virtual.slides.length : f.length, $, I, O;
          if (k === "row" && S > 1) {
              let L = Math.floor(y / (S * x))
                , D = y - x * S * L
                , C = L === 0 ? S : Math.min(Math.ceil((R - L * x * S) / x), S);
              O = Math.floor(D / C),
              I = D - O * C + L * S,
              $ = I + O * r / x,
              w.style.order = $
          } else
              k === "column" ? (I = Math.floor(y / x),
              O = y - I * x,
              (I > o || I === o && O === x - 1) && (O += 1,
              O >= x && (O = 0,
              I += 1))) : (O = Math.floor(y / n),
              I = y - O * n);
          w.row = O,
          w.column = I,
          w.style.height = `calc((100% - ${(x - 1) * b}px) / ${x})`,
          w.style[e.getDirectionLabel("margin-top")] = O !== 0 ? b && `${b}px` : "",
          w.swiperSlideGridSet = !0
      }
      , u = (y,w)=>{
          let {centeredSlides: f, roundLengths: S} = e.params
            , b = a()
            , {rows: x} = e.params.grid;
          if (e.virtualSize = (y + b) * r,
          e.virtualSize = Math.ceil(e.virtualSize / x) - b,
          e.params.cssMode || (e.wrapperEl.style[e.getDirectionLabel("width")] = `${e.virtualSize + b}px`),
          f) {
              let k = [];
              for (let R = 0; R < w.length; R += 1) {
                  let $ = w[R];
                  S && ($ = Math.floor($)),
                  w[R] < e.virtualSize + w[0] && k.push($)
              }
              w.splice(0, w.length),
              w.push(...k)
          }
      }
      , m = ()=>{
          l = e.params.grid && e.params.grid.rows > 1
      }
      , g = ()=>{
          let {params: y, el: w} = e
            , f = y.grid && y.grid.rows > 1;
          l && !f ? (w.classList.remove(`${y.containerModifierClass}grid`, `${y.containerModifierClass}grid-column`),
          o = 1,
          e.emitContainerClasses()) : !l && f && (w.classList.add(`${y.containerModifierClass}grid`),
          y.grid.fill === "column" && w.classList.add(`${y.containerModifierClass}grid-column`),
          e.emitContainerClasses()),
          l = f
      }
      ;
      i("init", m),
      i("update", g),
      e.grid = {
          initSlides: h,
          unsetSlides: d,
          updateSlide: c,
          updateWrapperSize: u
      }
  }
  function Oo(s) {
      let e = this
        , {params: t, slidesEl: i} = e;
      t.loop && e.loopDestroy();
      let r = n=>{
          if (typeof n == "string") {
              let o = document.createElement("div");
              o.innerHTML = n,
              i.append(o.children[0]),
              o.innerHTML = ""
          } else
              i.append(n)
      }
      ;
      if (typeof s == "object" && "length"in s)
          for (let n = 0; n < s.length; n += 1)
              s[n] && r(s[n]);
      else
          r(s);
      e.recalcSlides(),
      t.loop && e.loopCreate(),
      (!t.observer || e.isElement) && e.update()
  }
  function ko(s) {
      let e = this
        , {params: t, activeIndex: i, slidesEl: r} = e;
      t.loop && e.loopDestroy();
      let n = i + 1
        , o = l=>{
          if (typeof l == "string") {
              let a = document.createElement("div");
              a.innerHTML = l,
              r.prepend(a.children[0]),
              a.innerHTML = ""
          } else
              r.prepend(l)
      }
      ;
      if (typeof s == "object" && "length"in s) {
          for (let l = 0; l < s.length; l += 1)
              s[l] && o(s[l]);
          n = i + s.length
      } else
          o(s);
      e.recalcSlides(),
      t.loop && e.loopCreate(),
      (!t.observer || e.isElement) && e.update(),
      e.slideTo(n, 0, !1)
  }
  function Ro(s, e) {
      let t = this
        , {params: i, activeIndex: r, slidesEl: n} = t
        , o = r;
      i.loop && (o -= t.loopedSlides,
      t.loopDestroy(),
      t.recalcSlides());
      let l = t.slides.length;
      if (s <= 0) {
          t.prependSlide(e);
          return
      }
      if (s >= l) {
          t.appendSlide(e);
          return
      }
      let a = o > s ? o + 1 : o
        , h = [];
      for (let d = l - 1; d >= s; d -= 1) {
          let c = t.slides[d];
          c.remove(),
          h.unshift(c)
      }
      if (typeof e == "object" && "length"in e) {
          for (let d = 0; d < e.length; d += 1)
              e[d] && n.append(e[d]);
          a = o > s ? o + e.length : o
      } else
          n.append(e);
      for (let d = 0; d < h.length; d += 1)
          n.append(h[d]);
      t.recalcSlides(),
      i.loop && t.loopCreate(),
      (!i.observer || t.isElement) && t.update(),
      i.loop ? t.slideTo(a + t.loopedSlides, 0, !1) : t.slideTo(a, 0, !1)
  }
  function Do(s) {
      let e = this
        , {params: t, activeIndex: i} = e
        , r = i;
      t.loop && (r -= e.loopedSlides,
      e.loopDestroy());
      let n = r, o;
      if (typeof s == "object" && "length"in s) {
          for (let l = 0; l < s.length; l += 1)
              o = s[l],
              e.slides[o] && e.slides[o].remove(),
              o < n && (n -= 1);
          n = Math.max(n, 0)
      } else
          o = s,
          e.slides[o] && e.slides[o].remove(),
          o < n && (n -= 1),
          n = Math.max(n, 0);
      e.recalcSlides(),
      t.loop && e.loopCreate(),
      (!t.observer || e.isElement) && e.update(),
      t.loop ? e.slideTo(n + e.loopedSlides, 0, !1) : e.slideTo(n, 0, !1)
  }
  function Fo() {
      let s = this
        , e = [];
      for (let t = 0; t < s.slides.length; t += 1)
          e.push(t);
      s.removeSlide(e)
  }
  function Tr(s) {
      let {swiper: e} = s;
      Object.assign(e, {
          appendSlide: Oo.bind(e),
          prependSlide: ko.bind(e),
          addSlide: Ro.bind(e),
          removeSlide: Do.bind(e),
          removeAllSlides: Fo.bind(e)
      })
  }
  function oe(s) {
      let {effect: e, swiper: t, on: i, setTranslate: r, setTransition: n, overwriteParams: o, perspective: l, recreateShadows: a, getEffectParams: h} = s;
      i("beforeInit", ()=>{
          if (t.params.effect !== e)
              return;
          t.classNames.push(`${t.params.containerModifierClass}${e}`),
          l && l() && t.classNames.push(`${t.params.containerModifierClass}3d`);
          let c = o ? o() : {};
          Object.assign(t.params, c),
          Object.assign(t.originalParams, c)
      }
      ),
      i("setTranslate", ()=>{
          t.params.effect === e && r()
      }
      ),
      i("setTransition", (c,u)=>{
          t.params.effect === e && n(u)
      }
      ),
      i("transitionEnd", ()=>{
          if (t.params.effect === e && a) {
              if (!h || !h().slideShadows)
                  return;
              t.slides.forEach(c=>{
                  c.querySelectorAll(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").forEach(u=>u.remove())
              }
              ),
              a()
          }
      }
      );
      let d;
      i("virtualUpdate", ()=>{
          t.params.effect === e && (t.slides.length || (d = !0),
          requestAnimationFrame(()=>{
              d && t.slides && t.slides.length && (r(),
              d = !1)
          }
          ))
      }
      )
  }
  function pe(s, e) {
      let t = ie(e);
      return t !== e && (t.style.backfaceVisibility = "hidden",
      t.style["-webkit-backface-visibility"] = "hidden"),
      t
  }
  function Te(s) {
      let {swiper: e, duration: t, transformElements: i, allSlides: r} = s
        , {activeIndex: n} = e
        , o = l=>l.parentElement ? l.parentElement : e.slides.filter(h=>h.shadowRoot && h.shadowRoot === l.parentNode)[0];
      if (e.params.virtualTranslate && t !== 0) {
          let l = !1, a;
          r ? a = i : a = i.filter(h=>{
              let d = h.classList.contains("swiper-slide-transform") ? o(h) : h;
              return e.getSlideIndex(d) === n
          }
          ),
          a.forEach(h=>{
              Se(h, ()=>{
                  if (l || !e || e.destroyed)
                      return;
                  l = !0,
                  e.animating = !1;
                  let d = new window.CustomEvent("transitionend",{
                      bubbles: !0,
                      cancelable: !0
                  });
                  e.wrapperEl.dispatchEvent(d)
              }
              )
          }
          )
      }
  }
  function xr(s) {
      let {swiper: e, extendParams: t, on: i} = s;
      t({
          fadeEffect: {
              crossFade: !1
          }
      }),
      oe({
          effect: "fade",
          swiper: e,
          on: i,
          setTranslate: ()=>{
              let {slides: o} = e
                , l = e.params.fadeEffect;
              for (let a = 0; a < o.length; a += 1) {
                  let h = e.slides[a]
                    , c = -h.swiperSlideOffset;
                  e.params.virtualTranslate || (c -= e.translate);
                  let u = 0;
                  e.isHorizontal() || (u = c,
                  c = 0);
                  let m = e.params.fadeEffect.crossFade ? Math.max(1 - Math.abs(h.progress), 0) : 1 + Math.min(Math.max(h.progress, -1), 0)
                    , g = pe(l, h);
                  g.style.opacity = m,
                  g.style.transform = `translate3d(${c}px, ${u}px, 0px)`
              }
          }
          ,
          setTransition: o=>{
              let l = e.slides.map(a=>ie(a));
              l.forEach(a=>{
                  a.style.transitionDuration = `${o}ms`
              }
              ),
              Te({
                  swiper: e,
                  duration: o,
                  transformElements: l,
                  allSlides: !0
              })
          }
          ,
          overwriteParams: ()=>({
              slidesPerView: 1,
              slidesPerGroup: 1,
              watchSlidesProgress: !0,
              spaceBetween: 0,
              virtualTranslate: !e.params.cssMode
          })
      })
  }
  function Mr(s) {
      let {swiper: e, extendParams: t, on: i} = s;
      t({
          cubeEffect: {
              slideShadows: !0,
              shadow: !0,
              shadowOffset: 20,
              shadowScale: .94
          }
      });
      let r = (a,h,d)=>{
          let c = d ? a.querySelector(".swiper-slide-shadow-left") : a.querySelector(".swiper-slide-shadow-top")
            , u = d ? a.querySelector(".swiper-slide-shadow-right") : a.querySelector(".swiper-slide-shadow-bottom");
          c || (c = Z("div", `swiper-slide-shadow-cube swiper-slide-shadow-${d ? "left" : "top"}`.split(" ")),
          a.append(c)),
          u || (u = Z("div", `swiper-slide-shadow-cube swiper-slide-shadow-${d ? "right" : "bottom"}`.split(" ")),
          a.append(u)),
          c && (c.style.opacity = Math.max(-h, 0)),
          u && (u.style.opacity = Math.max(h, 0))
      }
      ;
      oe({
          effect: "cube",
          swiper: e,
          on: i,
          setTranslate: ()=>{
              let {el: a, wrapperEl: h, slides: d, width: c, height: u, rtlTranslate: m, size: g, browser: y} = e, w = e.params.cubeEffect, f = e.isHorizontal(), S = e.virtual && e.params.virtual.enabled, b = 0, x;
              w.shadow && (f ? (x = e.wrapperEl.querySelector(".swiper-cube-shadow"),
              x || (x = Z("div", "swiper-cube-shadow"),
              e.wrapperEl.append(x)),
              x.style.height = `${c}px`) : (x = a.querySelector(".swiper-cube-shadow"),
              x || (x = Z("div", "swiper-cube-shadow"),
              a.append(x))));
              for (let R = 0; R < d.length; R += 1) {
                  let $ = d[R]
                    , I = R;
                  S && (I = parseInt($.getAttribute("data-swiper-slide-index"), 10));
                  let O = I * 90
                    , L = Math.floor(O / 360);
                  m && (O = -O,
                  L = Math.floor(-O / 360));
                  let D = Math.max(Math.min($.progress, 1), -1)
                    , C = 0
                    , A = 0
                    , P = 0;
                  I % 4 === 0 ? (C = -L * 4 * g,
                  P = 0) : (I - 1) % 4 === 0 ? (C = 0,
                  P = -L * 4 * g) : (I - 2) % 4 === 0 ? (C = g + L * 4 * g,
                  P = g) : (I - 3) % 4 === 0 && (C = -g,
                  P = 3 * g + g * 4 * L),
                  m && (C = -C),
                  f || (A = C,
                  C = 0);
                  let B = `rotateX(${f ? 0 : -O}deg) rotateY(${f ? O : 0}deg) translate3d(${C}px, ${A}px, ${P}px)`;
                  D <= 1 && D > -1 && (b = I * 90 + D * 90,
                  m && (b = -I * 90 - D * 90),
                  e.browser && e.browser.need3dFix && Math.abs(b) / 90 % 2 === 1 && (b += .001)),
                  $.style.transform = B,
                  w.slideShadows && r($, D, f)
              }
              if (h.style.transformOrigin = `50% 50% -${g / 2}px`,
              h.style["-webkit-transform-origin"] = `50% 50% -${g / 2}px`,
              w.shadow)
                  if (f)
                      x.style.transform = `translate3d(0px, ${c / 2 + w.shadowOffset}px, ${-c / 2}px) rotateX(89.99deg) rotateZ(0deg) scale(${w.shadowScale})`;
                  else {
                      let R = Math.abs(b) - Math.floor(Math.abs(b) / 90) * 90
                        , $ = 1.5 - (Math.sin(R * 2 * Math.PI / 360) / 2 + Math.cos(R * 2 * Math.PI / 360) / 2)
                        , I = w.shadowScale
                        , O = w.shadowScale / $
                        , L = w.shadowOffset;
                      x.style.transform = `scale3d(${I}, 1, ${O}) translate3d(0px, ${u / 2 + L}px, ${-u / 2 / O}px) rotateX(-89.99deg)`
                  }
              let k = (y.isSafari || y.isWebView) && y.needPerspectiveFix ? -g / 2 : 0;
              h.style.transform = `translate3d(0px,0,${k}px) rotateX(${e.isHorizontal() ? 0 : b}deg) rotateY(${e.isHorizontal() ? -b : 0}deg)`,
              h.style.setProperty("--swiper-cube-translate-z", `${k}px`)
          }
          ,
          setTransition: a=>{
              let {el: h, slides: d} = e;
              if (d.forEach(c=>{
                  c.style.transitionDuration = `${a}ms`,
                  c.querySelectorAll(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").forEach(u=>{
                      u.style.transitionDuration = `${a}ms`
                  }
                  )
              }
              ),
              e.params.cubeEffect.shadow && !e.isHorizontal()) {
                  let c = h.querySelector(".swiper-cube-shadow");
                  c && (c.style.transitionDuration = `${a}ms`)
              }
          }
          ,
          recreateShadows: ()=>{
              let a = e.isHorizontal();
              e.slides.forEach(h=>{
                  let d = Math.max(Math.min(h.progress, 1), -1);
                  r(h, d, a)
              }
              )
          }
          ,
          getEffectParams: ()=>e.params.cubeEffect,
          perspective: ()=>!0,
          overwriteParams: ()=>({
              slidesPerView: 1,
              slidesPerGroup: 1,
              watchSlidesProgress: !0,
              resistanceRatio: 0,
              spaceBetween: 0,
              centeredSlides: !1,
              virtualTranslate: !0
          })
      })
  }
  function me(s, e, t) {
      let i = `swiper-slide-shadow${t ? `-${t}` : ""}${s ? ` swiper-slide-shadow-${s}` : ""}`
        , r = ie(e)
        , n = r.querySelector(`.${i.split(" ").join(".")}`);
      return n || (n = Z("div", i.split(" ")),
      r.append(n)),
      n
  }
  function Cr(s) {
      let {swiper: e, extendParams: t, on: i} = s;
      t({
          flipEffect: {
              slideShadows: !0,
              limitRotation: !0
          }
      });
      let r = (a,h)=>{
          let d = e.isHorizontal() ? a.querySelector(".swiper-slide-shadow-left") : a.querySelector(".swiper-slide-shadow-top")
            , c = e.isHorizontal() ? a.querySelector(".swiper-slide-shadow-right") : a.querySelector(".swiper-slide-shadow-bottom");
          d || (d = me("flip", a, e.isHorizontal() ? "left" : "top")),
          c || (c = me("flip", a, e.isHorizontal() ? "right" : "bottom")),
          d && (d.style.opacity = Math.max(-h, 0)),
          c && (c.style.opacity = Math.max(h, 0))
      }
      ;
      oe({
          effect: "flip",
          swiper: e,
          on: i,
          setTranslate: ()=>{
              let {slides: a, rtlTranslate: h} = e
                , d = e.params.flipEffect;
              for (let c = 0; c < a.length; c += 1) {
                  let u = a[c]
                    , m = u.progress;
                  e.params.flipEffect.limitRotation && (m = Math.max(Math.min(u.progress, 1), -1));
                  let g = u.swiperSlideOffset
                    , w = -180 * m
                    , f = 0
                    , S = e.params.cssMode ? -g - e.translate : -g
                    , b = 0;
                  e.isHorizontal() ? h && (w = -w) : (b = S,
                  S = 0,
                  f = -w,
                  w = 0),
                  e.browser && e.browser.need3dFix && (Math.abs(w) / 90 % 2 === 1 && (w += .001),
                  Math.abs(f) / 90 % 2 === 1 && (f += .001)),
                  u.style.zIndex = -Math.abs(Math.round(m)) + a.length,
                  d.slideShadows && r(u, m);
                  let x = `translate3d(${S}px, ${b}px, 0px) rotateX(${f}deg) rotateY(${w}deg)`
                    , k = pe(d, u);
                  k.style.transform = x
              }
          }
          ,
          setTransition: a=>{
              let h = e.slides.map(d=>ie(d));
              h.forEach(d=>{
                  d.style.transitionDuration = `${a}ms`,
                  d.querySelectorAll(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").forEach(c=>{
                      c.style.transitionDuration = `${a}ms`
                  }
                  )
              }
              ),
              Te({
                  swiper: e,
                  duration: a,
                  transformElements: h
              })
          }
          ,
          recreateShadows: ()=>{
              e.params.flipEffect,
              e.slides.forEach(a=>{
                  let h = a.progress;
                  e.params.flipEffect.limitRotation && (h = Math.max(Math.min(a.progress, 1), -1)),
                  r(a, h)
              }
              )
          }
          ,
          getEffectParams: ()=>e.params.flipEffect,
          perspective: ()=>!0,
          overwriteParams: ()=>({
              slidesPerView: 1,
              slidesPerGroup: 1,
              watchSlidesProgress: !0,
              spaceBetween: 0,
              virtualTranslate: !e.params.cssMode
          })
      })
  }
  function Ar(s) {
      let {swiper: e, extendParams: t, on: i} = s;
      t({
          coverflowEffect: {
              rotate: 50,
              stretch: 0,
              depth: 100,
              scale: 1,
              modifier: 1,
              slideShadows: !0
          }
      }),
      oe({
          effect: "coverflow",
          swiper: e,
          on: i,
          setTranslate: ()=>{
              let {width: o, height: l, slides: a, slidesSizesGrid: h} = e
                , d = e.params.coverflowEffect
                , c = e.isHorizontal()
                , u = e.translate
                , m = c ? -u + o / 2 : -u + l / 2
                , g = c ? d.rotate : -d.rotate
                , y = d.depth;
              for (let w = 0, f = a.length; w < f; w += 1) {
                  let S = a[w]
                    , b = h[w]
                    , x = S.swiperSlideOffset
                    , k = (m - x - b / 2) / b
                    , R = typeof d.modifier == "function" ? d.modifier(k) : k * d.modifier
                    , $ = c ? g * R : 0
                    , I = c ? 0 : g * R
                    , O = -y * Math.abs(R)
                    , L = d.stretch;
                  typeof L == "string" && L.indexOf("%") !== -1 && (L = parseFloat(d.stretch) / 100 * b);
                  let D = c ? 0 : L * R
                    , C = c ? L * R : 0
                    , A = 1 - (1 - d.scale) * Math.abs(R);
                  Math.abs(C) < .001 && (C = 0),
                  Math.abs(D) < .001 && (D = 0),
                  Math.abs(O) < .001 && (O = 0),
                  Math.abs($) < .001 && ($ = 0),
                  Math.abs(I) < .001 && (I = 0),
                  Math.abs(A) < .001 && (A = 0),
                  e.browser && e.browser.need3dFix && (Math.abs($) / 90 % 2 === 1 && ($ += .001),
                  Math.abs(I) / 90 % 2 === 1 && (I += .001));
                  let P = `translate3d(${C}px,${D}px,${O}px)  rotateX(${I}deg) rotateY(${$}deg) scale(${A})`
                    , B = pe(d, S);
                  if (B.style.transform = P,
                  S.style.zIndex = -Math.abs(Math.round(R)) + 1,
                  d.slideShadows) {
                      let E = c ? S.querySelector(".swiper-slide-shadow-left") : S.querySelector(".swiper-slide-shadow-top")
                        , v = c ? S.querySelector(".swiper-slide-shadow-right") : S.querySelector(".swiper-slide-shadow-bottom");
                      E || (E = me("coverflow", S, c ? "left" : "top")),
                      v || (v = me("coverflow", S, c ? "right" : "bottom")),
                      E && (E.style.opacity = R > 0 ? R : 0),
                      v && (v.style.opacity = -R > 0 ? -R : 0)
                  }
              }
          }
          ,
          setTransition: o=>{
              e.slides.map(a=>ie(a)).forEach(a=>{
                  a.style.transitionDuration = `${o}ms`,
                  a.querySelectorAll(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").forEach(h=>{
                      h.style.transitionDuration = `${o}ms`
                  }
                  )
              }
              )
          }
          ,
          perspective: ()=>!0,
          overwriteParams: ()=>({
              watchSlidesProgress: !0
          })
      })
  }
  function Lr(s) {
      let {swiper: e, extendParams: t, on: i} = s;
      t({
          creativeEffect: {
              limitProgress: 1,
              shadowPerProgress: !1,
              progressMultiplier: 1,
              perspective: !0,
              prev: {
                  translate: [0, 0, 0],
                  rotate: [0, 0, 0],
                  opacity: 1,
                  scale: 1
              },
              next: {
                  translate: [0, 0, 0],
                  rotate: [0, 0, 0],
                  opacity: 1,
                  scale: 1
              }
          }
      });
      let r = l=>typeof l == "string" ? l : `${l}px`;
      oe({
          effect: "creative",
          swiper: e,
          on: i,
          setTranslate: ()=>{
              let {slides: l, wrapperEl: a, slidesSizesGrid: h} = e
                , d = e.params.creativeEffect
                , {progressMultiplier: c} = d
                , u = e.params.centeredSlides;
              if (u) {
                  let m = h[0] / 2 - e.params.slidesOffsetBefore || 0;
                  a.style.transform = `translateX(calc(50% - ${m}px))`
              }
              for (let m = 0; m < l.length; m += 1) {
                  let g = l[m]
                    , y = g.progress
                    , w = Math.min(Math.max(g.progress, -d.limitProgress), d.limitProgress)
                    , f = w;
                  u || (f = Math.min(Math.max(g.originalProgress, -d.limitProgress), d.limitProgress));
                  let S = g.swiperSlideOffset
                    , b = [e.params.cssMode ? -S - e.translate : -S, 0, 0]
                    , x = [0, 0, 0]
                    , k = !1;
                  e.isHorizontal() || (b[1] = b[0],
                  b[0] = 0);
                  let R = {
                      translate: [0, 0, 0],
                      rotate: [0, 0, 0],
                      scale: 1,
                      opacity: 1
                  };
                  w < 0 ? (R = d.next,
                  k = !0) : w > 0 && (R = d.prev,
                  k = !0),
                  b.forEach((A,P)=>{
                      b[P] = `calc(${A}px + (${r(R.translate[P])} * ${Math.abs(w * c)}))`
                  }
                  ),
                  x.forEach((A,P)=>{
                      let B = R.rotate[P] * Math.abs(w * c);
                      e.browser && e.browser.need3dFix && Math.abs(B) / 90 % 2 === 1 && (B += .001),
                      x[P] = B
                  }
                  ),
                  g.style.zIndex = -Math.abs(Math.round(y)) + l.length;
                  let $ = b.join(", ")
                    , I = `rotateX(${x[0]}deg) rotateY(${x[1]}deg) rotateZ(${x[2]}deg)`
                    , O = f < 0 ? `scale(${1 + (1 - R.scale) * f * c})` : `scale(${1 - (1 - R.scale) * f * c})`
                    , L = f < 0 ? 1 + (1 - R.opacity) * f * c : 1 - (1 - R.opacity) * f * c
                    , D = `translate3d(${$}) ${I} ${O}`;
                  if (k && R.shadow || !k) {
                      let A = g.querySelector(".swiper-slide-shadow");
                      if (!A && R.shadow && (A = me("creative", g)),
                      A) {
                          let P = d.shadowPerProgress ? w * (1 / d.limitProgress) : w;
                          A.style.opacity = Math.min(Math.max(Math.abs(P), 0), 1)
                      }
                  }
                  let C = pe(d, g);
                  C.style.transform = D,
                  C.style.opacity = L,
                  R.origin && (C.style.transformOrigin = R.origin)
              }
          }
          ,
          setTransition: l=>{
              let a = e.slides.map(h=>ie(h));
              a.forEach(h=>{
                  h.style.transitionDuration = `${l}ms`,
                  h.querySelectorAll(".swiper-slide-shadow").forEach(d=>{
                      d.style.transitionDuration = `${l}ms`
                  }
                  )
              }
              ),
              Te({
                  swiper: e,
                  duration: l,
                  transformElements: a,
                  allSlides: !0
              })
          }
          ,
          perspective: ()=>e.params.creativeEffect.perspective,
          overwriteParams: ()=>({
              watchSlidesProgress: !0,
              virtualTranslate: !e.params.cssMode
          })
      })
  }
  function Pr(s) {
      let {swiper: e, extendParams: t, on: i} = s;
      t({
          cardsEffect: {
              slideShadows: !0,
              rotate: !0,
              perSlideRotate: 2,
              perSlideOffset: 8
          }
      }),
      oe({
          effect: "cards",
          swiper: e,
          on: i,
          setTranslate: ()=>{
              let {slides: o, activeIndex: l, rtlTranslate: a} = e
                , h = e.params.cardsEffect
                , {startTranslate: d, isTouched: c} = e.touchEventsData
                , u = a ? -e.translate : e.translate;
              for (let m = 0; m < o.length; m += 1) {
                  let g = o[m]
                    , y = g.progress
                    , w = Math.min(Math.max(y, -4), 4)
                    , f = g.swiperSlideOffset;
                  e.params.centeredSlides && !e.params.cssMode && (e.wrapperEl.style.transform = `translateX(${e.minTranslate()}px)`),
                  e.params.centeredSlides && e.params.cssMode && (f -= o[0].swiperSlideOffset);
                  let S = e.params.cssMode ? -f - e.translate : -f
                    , b = 0
                    , x = -100 * Math.abs(w)
                    , k = 1
                    , R = -h.perSlideRotate * w
                    , $ = h.perSlideOffset - Math.abs(w) * .75
                    , I = e.virtual && e.params.virtual.enabled ? e.virtual.from + m : m
                    , O = (I === l || I === l - 1) && w > 0 && w < 1 && (c || e.params.cssMode) && u < d
                    , L = (I === l || I === l + 1) && w < 0 && w > -1 && (c || e.params.cssMode) && u > d;
                  if (O || L) {
                      let P = (1 - Math.abs((Math.abs(w) - .5) / .5)) ** .5;
                      R += -28 * w * P,
                      k += -.5 * P,
                      $ += 96 * P,
                      b = `${-25 * P * Math.abs(w)}%`
                  }
                  if (w < 0 ? S = `calc(${S}px ${a ? "-" : "+"} (${$ * Math.abs(w)}%))` : w > 0 ? S = `calc(${S}px ${a ? "-" : "+"} (-${$ * Math.abs(w)}%))` : S = `${S}px`,
                  !e.isHorizontal()) {
                      let P = b;
                      b = S,
                      S = P
                  }
                  let D = w < 0 ? `${1 + (1 - k) * w}` : `${1 - (1 - k) * w}`
                    , C = `
      translate3d(${S}, ${b}, ${x}px)
      rotateZ(${h.rotate ? a ? -R : R : 0}deg)
      scale(${D})
    `;
                  if (h.slideShadows) {
                      let P = g.querySelector(".swiper-slide-shadow");
                      P || (P = me("cards", g)),
                      P && (P.style.opacity = Math.min(Math.max((Math.abs(w) - .5) / .5, 0), 1))
                  }
                  g.style.zIndex = -Math.abs(Math.round(y)) + o.length;
                  let A = pe(h, g);
                  A.style.transform = C
              }
          }
          ,
          setTransition: o=>{
              let l = e.slides.map(a=>ie(a));
              l.forEach(a=>{
                  a.style.transitionDuration = `${o}ms`,
                  a.querySelectorAll(".swiper-slide-shadow").forEach(h=>{
                      h.style.transitionDuration = `${o}ms`
                  }
                  )
              }
              ),
              Te({
                  swiper: e,
                  duration: o,
                  transformElements: l
              })
          }
          ,
          perspective: ()=>!0,
          overwriteParams: ()=>({
              watchSlidesProgress: !0,
              virtualTranslate: !e.params.cssMode
          })
      })
  }
  var Bo = [or, lr, cr, dr, ur, hr, fr, pr, mr, gr, vr, br, wr, yr, Sr, Er, Tr, xr, Mr, Cr, Ar, Lr, Pr];
  Ee.use(Bo);
  var Ir = class extends q {
      connect() {
          this.swiper = new Ee(this.element,{
              ...this.defaultOptions,
              ...this.optionsValue
          })
      }
      disconnect() {
          this.swiper.destroy(),
          this.swiper = void 0
      }
      get defaultOptions() {
          return {}
      }
  }
  ;
  Ir.values = {
      options: Object
  };
  var Or = Ir;
  var kr = class extends q {
      initialize() {
          this.scroll = this.scroll.bind(this)
      }
      connect() {
          this.element.addEventListener("click", this.scroll)
      }
      disconnect() {
          this.element.removeEventListener("click", this.scroll)
      }
      scroll(e) {
          e.preventDefault();
          let t = this.element.hash.replace(/^#/, "")
            , i = document.getElementById(t);
          if (!i) {
              console.warn(`[stimulus-scroll-to] The element with the id: "${t}" does not exist on the page.`);
              return
          }
          let r = i.getBoundingClientRect().top + window.pageYOffset - this.offset;
          window.scrollTo({
              top: r,
              behavior: this.behavior
          })
      }
      get offset() {
          return this.hasOffsetValue ? this.offsetValue : this.defaultOptions.offset !== void 0 ? this.defaultOptions.offset : 10
      }
      get behavior() {
          return this.behaviorValue || this.defaultOptions.behavior || "smooth"
      }
      get defaultOptions() {
          return {}
      }
  }
  ;
  kr.values = {
      offset: Number,
      behavior: String
  };
  var Rr = kr;
  var $o = Object.defineProperty
    , Vo = (s,e,t)=>e in s ? $o(s, e, {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: t
  }) : s[e] = t
    , J = (s,e,t)=>(Vo(s, typeof e != "symbol" ? e + "" : e, t),
  t);
  async function Hs(s, e, t={}) {
      e ? Nr(s, t) : zr(s, t)
  }
  async function Nr(s, e={}) {
      let t = s.dataset.transitionEnter || e.enter || "enter"
        , i = s.dataset.transitionEnterFrom || e.enterFrom || "enter-from"
        , r = s.dataset.transitionEnterTo || e.enterTo || "enter-to"
        , n = s.dataset.toggleClass || e.toggleClass || "hidden";
      s.classList.add(...t.split(" ")),
      s.classList.add(...i.split(" ")),
      s.classList.remove(...r.split(" ")),
      s.classList.remove(...n.split(" ")),
      await Hr(),
      s.classList.remove(...i.split(" ")),
      s.classList.add(...r.split(" "));
      try {
          await qr(s)
      } finally {
          s.classList.remove(...t.split(" "))
      }
  }
  async function zr(s, e={}) {
      let t = s.dataset.transitionLeave || e.leave || "leave"
        , i = s.dataset.transitionLeaveFrom || e.leaveFrom || "leave-from"
        , r = s.dataset.transitionLeaveTo || e.leaveTo || "leave-to"
        , n = s.dataset.toggleClass || e.toggle || "hidden";
      s.classList.add(...t.split(" ")),
      s.classList.add(...i.split(" ")),
      s.classList.remove(...r.split(" ")),
      await Hr(),
      s.classList.remove(...i.split(" ")),
      s.classList.add(...r.split(" "));
      try {
          await qr(s)
      } finally {
          s.classList.remove(...t.split(" ")),
          s.classList.add(...n.split(" "))
      }
  }
  function Hr() {
      return new Promise(s=>{
          requestAnimationFrame(()=>{
              requestAnimationFrame(s)
          }
          )
      }
      )
  }
  function qr(s) {
      return Promise.all(s.getAnimations().map(e=>e.finished))
  }
  var No = class extends q {
      connect() {
          setTimeout(()=>{
              Nr(this.element)
          }
          , this.showDelayValue),
          this.hasDismissAfterValue && setTimeout(()=>{
              this.close()
          }
          , this.dismissAfterValue)
      }
      close() {
          zr(this.element).then(()=>{
              this.element.remove()
          }
          )
      }
  }
  ;
  J(No, "values", {
      dismissAfter: Number,
      showDelay: {
          type: Number,
          default: 0
      }
  });
  var Dr = class extends q {
      connect() {
          this.timeout = null
      }
      save() {
          clearTimeout(this.timeout),
          this.timeout = setTimeout(()=>{
              this.statusTarget.textContent = this.submittingTextValue,
              this.formTarget.requestSubmit()
          }
          , this.submitDurationValue)
      }
      success() {
          this.setStatus(this.successTextValue)
      }
      error() {
          this.setStatus(this.errorTextValue)
      }
      setStatus(s) {
          this.statusTarget.textContent = s,
          this.timeout = setTimeout(()=>{
              this.statusTarget.textContent = ""
          }
          , this.statusDurationValue)
      }
  }
  ;
  J(Dr, "targets", ["form", "status"]),
  J(Dr, "values", {
      submitDuration: {
          type: Number,
          default: 1e3
      },
      statusDuration: {
          type: Number,
          default: 2e3
      },
      submittingText: {
          type: String,
          default: "Saving..."
      },
      successText: {
          type: String,
          default: "Saved!"
      },
      errorText: {
          type: String,
          default: "Unable to save."
      }
  });
  var Fr = class extends q {
      update() {
          this.preview = this.colorTarget.value
      }
      set preview(s) {
          this.previewTarget.style[this.styleValue] = s;
          let e = this._getContrastYIQ(s);
          this.styleValue === "color" ? this.previewTarget.style.backgroundColor = e : this.previewTarget.style.color = e
      }
      _getContrastYIQ(s) {
          s = s.replace("#", "");
          let e = 128
            , t = parseInt(s.substr(0, 2), 16)
            , i = parseInt(s.substr(2, 2), 16)
            , r = parseInt(s.substr(4, 2), 16);
          return (t * 299 + i * 587 + r * 114) / 1e3 >= e ? "#000" : "#fff"
      }
  }
  ;
  J(Fr, "targets", ["preview", "color"]),
  J(Fr, "values", {
      style: {
          type: String,
          default: "backgroundColor"
      }
  });
  var ot = class extends q {
      connect() {
          document.addEventListener("turbo:before-cache", this.beforeCache.bind(this))
      }
      disconnect() {
          document.removeEventListener("turbo:before-cache", this.beforeCache.bind(this))
      }
      openValueChanged() {
          Hs(this.menuTarget, this.openValue, this.transitionOptions),
          this.openValue === !0 && this.hasMenuItemTarget && this.menuItemTargets[0].focus()
      }
      show() {
          this.openValue = !0
      }
      close() {
          this.openValue = !1
      }
      hide(s) {
          this.closeOnClickOutsideValue && s.target.nodeType && this.element.contains(s.target) === !1 && this.openValue && (this.openValue = !1),
          this.closeOnEscapeValue && s.key === "Escape" && this.openValue && (this.openValue = !1)
      }
      toggle() {
          this.openValue = !this.openValue
      }
      nextItem(s) {
          s.preventDefault(),
          this.menuItemTargets[this.nextIndex].focus()
      }
      previousItem(s) {
          s.preventDefault(),
          this.menuItemTargets[this.previousIndex].focus()
      }
      get currentItemIndex() {
          return this.menuItemTargets.indexOf(document.activeElement)
      }
      get nextIndex() {
          return Math.min(this.currentItemIndex + 1, this.menuItemTargets.length - 1)
      }
      get previousIndex() {
          return Math.max(this.currentItemIndex - 1, 0)
      }
      get transitionOptions() {
          return {
              enter: this.hasEnterClass ? this.enterClass : "transition ease-out duration-100",
              enterFrom: this.hasEnterFromClass ? this.enterFromClass : "transform opacity-0 scale-95",
              enterTo: this.hasEnterToClass ? this.enterToClass : "transform opacity-100 scale-100",
              leave: this.hasLeaveClass ? this.leaveClass : "transition ease-in duration-75",
              leaveFrom: this.hasLeaveFromClass ? this.leaveFromClass : "transform opacity-100 scale-100",
              leaveTo: this.hasLeaveToClass ? this.leaveToClass : "transform opacity-0 scale-95",
              toggleClass: this.hasToggleClass ? this.toggleClass : "hidden"
          }
      }
      beforeCache() {
          this.openValue = !1,
          this.menuTarget.classList.add("hidden")
      }
  }
  ;
  J(ot, "targets", ["menu", "button", "menuItem"]),
  J(ot, "values", {
      open: {
          type: Boolean,
          default: !1
      },
      closeOnEscape: {
          type: Boolean,
          default: !0
      },
      closeOnClickOutside: {
          type: Boolean,
          default: !0
      }
  }),
  J(ot, "classes", ["enter", "enterFrom", "enterTo", "leave", "leaveFrom", "leaveTo", "toggle"]);
  var Br = class extends q {
      connect() {
          this.openValue && this.open(),
          document.addEventListener("turbo:before-cache", this.beforeCache.bind(this))
      }
      disconnect() {
          document.removeEventListener("turbo:before-cache", this.beforeCache.bind(this))
      }
      open() {
          this.dialogTarget.showModal()
      }
      close() {
          this.dialogTarget.setAttribute("closing", ""),
          Promise.all(this.dialogTarget.getAnimations().map(s=>s.finished)).then(()=>{
              this.dialogTarget.removeAttribute("closing"),
              this.dialogTarget.close()
          }
          )
      }
      backdropClose(s) {
          s.target.nodeName == "DIALOG" && this.close()
      }
      show() {
          this.dialogTarget.show()
      }
      hide() {
          this.close()
      }
      beforeCache() {
          this.close()
      }
  }
  ;
  J(Br, "targets", ["dialog"]),
  J(Br, "values", {
      open: Boolean
  });
  var $r = class extends q {
      openValueChanged() {
          Hs(this.contentTarget, this.openValue),
          this.shouldAutoDismiss && this.scheduleDismissal()
      }
      show(s) {
          this.shouldAutoDismiss && this.scheduleDismissal(),
          this.openValue = !0
      }
      hide() {
          this.openValue = !1
      }
      toggle() {
          this.openValue = !this.openValue
      }
      get shouldAutoDismiss() {
          return this.openValue && this.hasDismissAfterValue
      }
      scheduleDismissal() {
          this.hasDismissAfterValue && (this.cancelDismissal(),
          this.timeoutId = setTimeout(()=>{
              this.hide(),
              this.timeoutId = void 0
          }
          , this.dismissAfterValue))
      }
      cancelDismissal() {
          typeof this.timeoutId == "number" && (clearTimeout(this.timeoutId),
          this.timeoutId = void 0)
      }
  }
  ;
  J($r, "targets", ["content"]),
  J($r, "values", {
      dismissAfter: Number,
      open: {
          type: Boolean,
          default: !1
      }
  });
  var Vr = class extends q {
      connect() {
          this.openValue && this.open(),
          document.addEventListener("turbo:before-cache", this.beforeCache.bind(this))
      }
      disconnect() {
          document.removeEventListener("turbo:before-cache", this.beforeCache.bind(this))
      }
      open() {
          this.dialogTarget.showModal()
      }
      close() {
          this.dialogTarget.setAttribute("closing", ""),
          Promise.all(this.dialogTarget.getAnimations().map(s=>s.finished)).then(()=>{
              this.dialogTarget.removeAttribute("closing"),
              this.dialogTarget.close()
          }
          )
      }
      backdropClose(s) {
          s.target.nodeName == "DIALOG" && this.close()
      }
      show() {
          this.open()
      }
      hide() {
          this.close()
      }
      beforeCache() {
          this.close()
      }
  }
  ;
  J(Vr, "targets", ["dialog"]),
  J(Vr, "values", {
      open: Boolean
  });
  var zs = class extends q {
      initialize() {
          this.anchor && (this.indexValue = this.tabTargets.findIndex(s=>s.id === this.anchor))
      }
      connect() {
          this.showTab()
      }
      change(s) {
          s.currentTarget.tagName === "SELECT" ? this.indexValue = s.currentTarget.selectedIndex : s.currentTarget.dataset.index ? this.indexValue = s.currentTarget.dataset.index : s.currentTarget.dataset.id ? this.indexValue = this.tabTargets.findIndex(e=>e.id == s.currentTarget.dataset.id) : this.indexValue = this.tabTargets.indexOf(s.currentTarget)
      }
      nextTab() {
          this.indexValue = Math.min(this.indexValue + 1, this.tabsCount - 1)
      }
      previousTab() {
          this.indexValue = Math.max(this.indexValue - 1, 0)
      }
      firstTab() {
          this.indexValue = 0
      }
      lastTab() {
          this.indexValue = this.tabsCount - 1
      }
      indexValueChanged() {
          if (this.showTab(),
          this.dispatch("tab-change", {
              target: this.tabTargets[this.indexValue],
              detail: {
                  activeIndex: this.indexValue
              }
          }),
          this.updateAnchorValue) {
              let s = this.tabTargets[this.indexValue].id;
              if (this.scrollToAnchorValue)
                  location.hash = s;
              else {
                  let e = window.location.href.split("#")[0] + "#" + s;
                  history.replaceState({}, document.title, e)
              }
          }
      }
      showTab() {
          this.panelTargets.forEach((s,e)=>{
              let t = this.tabTargets[e];
              e === this.indexValue ? (s.classList.remove("hidden"),
              t.ariaSelected = "true",
              t.dataset.active = !0,
              this.hasInactiveTabClass && t?.classList?.remove(...this.inactiveTabClasses),
              this.hasActiveTabClass && t?.classList?.add(...this.activeTabClasses)) : (s.classList.add("hidden"),
              t.ariaSelected = null,
              delete t.dataset.active,
              this.hasActiveTabClass && t?.classList?.remove(...this.activeTabClasses),
              this.hasInactiveTabClass && t?.classList?.add(...this.inactiveTabClasses))
          }
          ),
          this.hasSelectTarget && (this.selectTarget.selectedIndex = this.indexValue),
          this.scrollActiveTabIntoViewValue && this.scrollToActiveTab()
      }
      scrollToActiveTab() {
          let s = this.element.querySelector("[aria-selected]");
          s && s.scrollIntoView({
              inline: "center"
          })
      }
      get tabsCount() {
          return this.tabTargets.length
      }
      get anchor() {
          return document.URL.split("#").length > 1 ? document.URL.split("#")[1] : null
      }
  }
  ;
  J(zs, "classes", ["activeTab", "inactiveTab"]),
  J(zs, "targets", ["tab", "panel", "select"]),
  J(zs, "values", {
      index: 0,
      updateAnchor: Boolean,
      scrollToAnchor: Boolean,
      scrollActiveTabIntoView: Boolean
  });
  var Ft = class extends q {
      toggle(s) {
          this.openValue = !this.openValue,
          this.animate()
      }
      toggleInput(s) {
          this.openValue = s.target.checked,
          this.animate()
      }
      hide() {
          this.openValue = !1,
          this.animate()
      }
      show() {
          this.openValue = !0,
          this.animate()
      }
      animate() {
          this.toggleableTargets.forEach(s=>{
              Hs(s, this.openValue)
          }
          )
      }
  }
  ;
  J(Ft, "targets", ["toggleable"]),
  J(Ft, "values", {
      open: {
          type: Boolean,
          default: !1
      }
  });
  ce.register("hello", It);
  ce.register("carousel", Or);
  ce.register("scroll-to", Rr);
  ce.register("contact-form", Ot);
  ce.register("toggle", Ft);
  ce.register("dropdown", ot);
  ce.register("visibility", kt);
  ce.register("nav-active", Rt);
  var yi = {};
  Di(yi, {
      FetchEnctype: ()=>Me,
      FetchMethod: ()=>ne,
      FetchRequest: ()=>Ae,
      FetchResponse: ()=>Xe,
      FrameElement: ()=>he,
      FrameLoadingStyle: ()=>Re,
      FrameRenderer: ()=>Ke,
      PageRenderer: ()=>Be,
      PageSnapshot: ()=>le,
      StreamActions: ()=>wi,
      StreamElement: ()=>Xt,
      StreamSourceElement: ()=>Yt,
      cache: ()=>cn,
      clearCache: ()=>pn,
      connectStreamSource: ()=>ht,
      disconnectStreamSource: ()=>ft,
      fetch: ()=>vi,
      fetchEnctypeFromString: ()=>nn,
      fetchMethodFromString: ()=>Ut,
      isSafe: ()=>Kt,
      navigator: ()=>dn,
      registerAdapter: ()=>un,
      renderStreamMessage: ()=>fn,
      session: ()=>U,
      setConfirmMethod: ()=>gn,
      setFormMode: ()=>vn,
      setProgressBarDelay: ()=>mn,
      start: ()=>bi,
      visit: ()=>hn
  });
  (function(s) {
      if (typeof s.requestSubmit == "function")
          return;
      s.requestSubmit = function(i) {
          i ? (e(i, this),
          i.click()) : (i = document.createElement("input"),
          i.type = "submit",
          i.hidden = !0,
          this.appendChild(i),
          i.click(),
          this.removeChild(i))
      }
      ;
      function e(i, r) {
          i instanceof HTMLElement || t(TypeError, "parameter 1 is not of type 'HTMLElement'"),
          i.type == "submit" || t(TypeError, "The specified element is not a submit button"),
          i.form == r || t(DOMException, "The specified element is not owned by this form element", "NotFoundError")
      }
      function t(i, r, n) {
          throw new i("Failed to execute 'requestSubmit' on 'HTMLFormElement': " + r + ".",n)
      }
  }
  )(HTMLFormElement.prototype);
  var Yr = new WeakMap;
  function zo(s) {
      let e = s instanceof Element ? s : s instanceof Node ? s.parentElement : null
        , t = e ? e.closest("input, button") : null;
      return t?.type == "submit" ? t : null
  }
  function Ho(s) {
      let e = zo(s.target);
      e && e.form && Yr.set(e.form, e)
  }
  (function() {
      if ("submitter"in Event.prototype)
          return;
      let s = window.Event.prototype;
      if ("SubmitEvent"in window) {
          let e = window.SubmitEvent.prototype;
          if (/Apple Computer/.test(navigator.vendor) && !("submitter"in e))
              s = e;
          else
              return
      }
      addEventListener("click", Ho, !0),
      Object.defineProperty(s, "submitter", {
          get() {
              if (this.type == "submit" && this.target instanceof HTMLFormElement)
                  return Yr.get(this.target)
          }
      })
  }
  )();
  var Re = {
      eager: "eager",
      lazy: "lazy"
  }
    , he = class s extends HTMLElement {
      static delegateConstructor = void 0;
      loaded = Promise.resolve();
      static get observedAttributes() {
          return ["disabled", "loading", "src"]
      }
      constructor() {
          super(),
          this.delegate = new s.delegateConstructor(this)
      }
      connectedCallback() {
          this.delegate.connect()
      }
      disconnectedCallback() {
          this.delegate.disconnect()
      }
      reload() {
          return this.delegate.sourceURLReloaded()
      }
      attributeChangedCallback(e) {
          e == "loading" ? this.delegate.loadingStyleChanged() : e == "src" ? this.delegate.sourceURLChanged() : e == "disabled" && this.delegate.disabledChanged()
      }
      get src() {
          return this.getAttribute("src")
      }
      set src(e) {
          e ? this.setAttribute("src", e) : this.removeAttribute("src")
      }
      get refresh() {
          return this.getAttribute("refresh")
      }
      set refresh(e) {
          e ? this.setAttribute("refresh", e) : this.removeAttribute("refresh")
      }
      get loading() {
          return qo(this.getAttribute("loading") || "")
      }
      set loading(e) {
          e ? this.setAttribute("loading", e) : this.removeAttribute("loading")
      }
      get disabled() {
          return this.hasAttribute("disabled")
      }
      set disabled(e) {
          e ? this.setAttribute("disabled", "") : this.removeAttribute("disabled")
      }
      get autoscroll() {
          return this.hasAttribute("autoscroll")
      }
      set autoscroll(e) {
          e ? this.setAttribute("autoscroll", "") : this.removeAttribute("autoscroll")
      }
      get complete() {
          return !this.delegate.isLoading
      }
      get isActive() {
          return this.ownerDocument === document && !this.isPreview
      }
      get isPreview() {
          return this.ownerDocument?.documentElement?.hasAttribute("data-turbo-preview")
      }
  }
  ;
  function qo(s) {
      switch (s.toLowerCase()) {
      case "lazy":
          return Re.lazy;
      default:
          return Re.eager
      }
  }
  function ee(s) {
      return new URL(s.toString(),document.baseURI)
  }
  function De(s) {
      let e;
      if (s.hash)
          return s.hash.slice(1);
      if (e = s.href.match(/#(.*)$/))
          return e[1]
  }
  function mi(s, e) {
      let t = e?.getAttribute("formaction") || s.getAttribute("action") || s.action;
      return ee(t)
  }
  function Wo(s) {
      return (Yo(s).match(/\.[^.]*$/) || [])[0] || ""
  }
  function _o(s) {
      return !!Wo(s).match(/^(?:|\.(?:htm|html|xhtml|php))$/)
  }
  function Go(s, e) {
      let t = Uo(e);
      return s.href === ee(t).href || s.href.startsWith(t)
  }
  function xe(s, e) {
      return Go(s, e) && _o(s)
  }
  function qs(s) {
      let e = De(s);
      return e != null ? s.href.slice(0, -(e.length + 1)) : s.href
  }
  function Bt(s) {
      return qs(s)
  }
  function jo(s, e) {
      return ee(s).href == ee(e).href
  }
  function Xo(s) {
      return s.pathname.split("/").slice(1)
  }
  function Yo(s) {
      return Xo(s).slice(-1)[0]
  }
  function Uo(s) {
      return Ko(s.origin + s.pathname)
  }
  function Ko(s) {
      return s.endsWith("/") ? s : s + "/"
  }
  var Xe = class {
      constructor(e) {
          this.response = e
      }
      get succeeded() {
          return this.response.ok
      }
      get failed() {
          return !this.succeeded
      }
      get clientError() {
          return this.statusCode >= 400 && this.statusCode <= 499
      }
      get serverError() {
          return this.statusCode >= 500 && this.statusCode <= 599
      }
      get redirected() {
          return this.response.redirected
      }
      get location() {
          return ee(this.response.url)
      }
      get isHTML() {
          return this.contentType && this.contentType.match(/^(?:text\/([^\s;,]+\b)?html|application\/xhtml\+xml)\b/)
      }
      get statusCode() {
          return this.response.status
      }
      get contentType() {
          return this.header("Content-Type")
      }
      get responseText() {
          return this.response.clone().text()
      }
      get responseHTML() {
          return this.isHTML ? this.response.clone().text() : Promise.resolve(void 0)
      }
      header(e) {
          return this.response.headers.get(e)
      }
  }
  ;
  function lt(s) {
      if (s.getAttribute("data-turbo-eval") == "false")
          return s;
      {
          let e = document.createElement("script")
            , t = Ye("csp-nonce");
          return t && (e.nonce = t),
          e.textContent = s.textContent,
          e.async = !1,
          Zo(e, s),
          e
      }
  }
  function Zo(s, e) {
      for (let {name: t, value: i} of e.attributes)
          s.setAttribute(t, i)
  }
  function Jo(s) {
      let e = document.createElement("template");
      return e.innerHTML = s,
      e.content
  }
  function K(s, {target: e, cancelable: t, detail: i}={}) {
      let r = new CustomEvent(s,{
          cancelable: t,
          bubbles: !0,
          composed: !0,
          detail: i
      });
      return e && e.isConnected ? e.dispatchEvent(r) : document.documentElement.dispatchEvent(r),
      r
  }
  function _e() {
      return document.visibilityState === "hidden" ? Kr() : Ur()
  }
  function Ur() {
      return new Promise(s=>requestAnimationFrame(()=>s()))
  }
  function Kr() {
      return new Promise(s=>setTimeout(()=>s(), 0))
  }
  function Qo() {
      return Promise.resolve()
  }
  function Zr(s="") {
      return new DOMParser().parseFromString(s, "text/html")
  }
  function Jr(s, ...e) {
      let t = el(s, e).replace(/^\n/, "").split(`
`)
        , i = t[0].match(/^\s+/)
        , r = i ? i[0].length : 0;
      return t.map(n=>n.slice(r)).join(`
`)
  }
  function el(s, e) {
      return s.reduce((t,i,r)=>{
          let n = e[r] == null ? "" : e[r];
          return t + i + n
      }
      , "")
  }
  function Ce() {
      return Array.from({
          length: 36
      }).map((s,e)=>e == 8 || e == 13 || e == 18 || e == 23 ? "-" : e == 14 ? "4" : e == 19 ? (Math.floor(Math.random() * 4) + 8).toString(16) : Math.floor(Math.random() * 15).toString(16)).join("")
  }
  function Vt(s, ...e) {
      for (let t of e.map(i=>i?.getAttribute(s)))
          if (typeof t == "string")
              return t;
      return null
  }
  function tl(s, ...e) {
      return e.some(t=>t && t.hasAttribute(s))
  }
  function Nt(...s) {
      for (let e of s)
          e.localName == "turbo-frame" && e.setAttribute("busy", ""),
          e.setAttribute("aria-busy", "true")
  }
  function zt(...s) {
      for (let e of s)
          e.localName == "turbo-frame" && e.removeAttribute("busy"),
          e.removeAttribute("aria-busy")
  }
  function sl(s, e=2e3) {
      return new Promise(t=>{
          let i = ()=>{
              s.removeEventListener("error", i),
              s.removeEventListener("load", i),
              t()
          }
          ;
          s.addEventListener("load", i, {
              once: !0
          }),
          s.addEventListener("error", i, {
              once: !0
          }),
          setTimeout(t, e)
      }
      )
  }
  function Qr(s) {
      switch (s) {
      case "replace":
          return history.replaceState;
      case "advance":
      case "restore":
          return history.pushState
      }
  }
  function il(s) {
      return s == "advance" || s == "replace" || s == "restore"
  }
  function Fe(...s) {
      let e = Vt("data-turbo-action", ...s);
      return il(e) ? e : null
  }
  function en(s) {
      return document.querySelector(`meta[name="${s}"]`)
  }
  function Ye(s) {
      let e = en(s);
      return e && e.content
  }
  function rl(s, e) {
      let t = en(s);
      return t || (t = document.createElement("meta"),
      t.setAttribute("name", s),
      document.head.appendChild(t)),
      t.setAttribute("content", e),
      t
  }
  function Ge(s, e) {
      if (s instanceof Element)
          return s.closest(e) || Ge(s.assignedSlot || s.getRootNode()?.host, e)
  }
  function gi(s) {
      return !!s && s.closest("[inert], :disabled, [hidden], details:not([open]), dialog:not([open])") == null && typeof s.focus == "function"
  }
  function tn(s) {
      return Array.from(s.querySelectorAll("[autofocus]")).find(gi)
  }
  async function nl(s, e) {
      let t = e();
      s(),
      await Ur();
      let i = e();
      return [t, i]
  }
  function al(s) {
      if (s.hasAttribute("target")) {
          for (let e of document.getElementsByName(s.target))
              if (e instanceof HTMLIFrameElement)
                  return !1
      }
      return !0
  }
  function ol(s) {
      return Ge(s, "a[href]:not([target^=_]):not([download])")
  }
  function sn(s) {
      return ee(s.getAttribute("href") || "")
  }
  function ll(s, e) {
      let t = null;
      return (...i)=>{
          let r = ()=>s.apply(this, i);
          clearTimeout(t),
          t = setTimeout(r, e)
      }
  }
  var Ws = class extends Set {
      constructor(e) {
          super(),
          this.maxSize = e
      }
      add(e) {
          if (this.size >= this.maxSize) {
              let i = this.values().next().value;
              this.delete(i)
          }
          super.add(e)
      }
  }
    , rn = new Ws(20)
    , cl = window.fetch;
  function vi(s, e={}) {
      let t = new Headers(e.headers || {})
        , i = Ce();
      return rn.add(i),
      t.append("X-Turbo-Request-Id", i),
      cl(s, {
          ...e,
          headers: t
      })
  }
  function Ut(s) {
      switch (s.toLowerCase()) {
      case "get":
          return ne.get;
      case "post":
          return ne.post;
      case "put":
          return ne.put;
      case "patch":
          return ne.patch;
      case "delete":
          return ne.delete
      }
  }
  var ne = {
      get: "get",
      post: "post",
      put: "put",
      patch: "patch",
      delete: "delete"
  };
  function nn(s) {
      switch (s.toLowerCase()) {
      case Me.multipart:
          return Me.multipart;
      case Me.plain:
          return Me.plain;
      default:
          return Me.urlEncoded
      }
  }
  var Me = {
      urlEncoded: "application/x-www-form-urlencoded",
      multipart: "multipart/form-data",
      plain: "text/plain"
  }
    , Ae = class {
      abortController = new AbortController;
      #e = e=>{}
      ;
      constructor(e, t, i, r=new URLSearchParams, n=null, o=Me.urlEncoded) {
          let[l,a] = Wr(ee(i), t, r, o);
          this.delegate = e,
          this.url = l,
          this.target = n,
          this.fetchOptions = {
              credentials: "same-origin",
              redirect: "follow",
              method: t,
              headers: {
                  ...this.defaultHeaders
              },
              body: a,
              signal: this.abortSignal,
              referrer: this.delegate.referrer?.href
          },
          this.enctype = o
      }
      get method() {
          return this.fetchOptions.method
      }
      set method(e) {
          let t = this.isSafe ? this.url.searchParams : this.fetchOptions.body || new FormData
            , i = Ut(e) || ne.get;
          this.url.search = "";
          let[r,n] = Wr(this.url, i, t, this.enctype);
          this.url = r,
          this.fetchOptions.body = n,
          this.fetchOptions.method = i
      }
      get headers() {
          return this.fetchOptions.headers
      }
      set headers(e) {
          this.fetchOptions.headers = e
      }
      get body() {
          return this.isSafe ? this.url.searchParams : this.fetchOptions.body
      }
      set body(e) {
          this.fetchOptions.body = e
      }
      get location() {
          return this.url
      }
      get params() {
          return this.url.searchParams
      }
      get entries() {
          return this.body ? Array.from(this.body.entries()) : []
      }
      cancel() {
          this.abortController.abort()
      }
      async perform() {
          let {fetchOptions: e} = this;
          this.delegate.prepareRequest(this);
          let t = await this.#t(e);
          try {
              this.delegate.requestStarted(this),
              t.detail.fetchRequest ? this.response = t.detail.fetchRequest.response : this.response = vi(this.url.href, e);
              let i = await this.response;
              return await this.receive(i)
          } catch (i) {
              if (i.name !== "AbortError")
                  throw this.#s(i) && this.delegate.requestErrored(this, i),
                  i
          } finally {
              this.delegate.requestFinished(this)
          }
      }
      async receive(e) {
          let t = new Xe(e);
          return K("turbo:before-fetch-response", {
              cancelable: !0,
              detail: {
                  fetchResponse: t
              },
              target: this.target
          }).defaultPrevented ? this.delegate.requestPreventedHandlingResponse(this, t) : t.succeeded ? this.delegate.requestSucceededWithResponse(this, t) : this.delegate.requestFailedWithResponse(this, t),
          t
      }
      get defaultHeaders() {
          return {
              Accept: "text/html, application/xhtml+xml"
          }
      }
      get isSafe() {
          return Kt(this.method)
      }
      get abortSignal() {
          return this.abortController.signal
      }
      acceptResponseType(e) {
          this.headers.Accept = [e, this.headers.Accept].join(", ")
      }
      async #t(e) {
          let t = new Promise(r=>this.#e = r)
            , i = K("turbo:before-fetch-request", {
              cancelable: !0,
              detail: {
                  fetchOptions: e,
                  url: this.url,
                  resume: this.#e
              },
              target: this.target
          });
          return this.url = i.detail.url,
          i.defaultPrevented && await t,
          i
      }
      #s(e) {
          return !K("turbo:fetch-request-error", {
              target: this.target,
              cancelable: !0,
              detail: {
                  request: this,
                  error: e
              }
          }).defaultPrevented
      }
  }
  ;
  function Kt(s) {
      return Ut(s) == ne.get
  }
  function Wr(s, e, t, i) {
      let r = Array.from(t).length > 0 ? new URLSearchParams(an(t)) : s.searchParams;
      return Kt(e) ? [dl(s, r), null] : i == Me.urlEncoded ? [s, r] : [s, t]
  }
  function an(s) {
      let e = [];
      for (let[t,i] of s)
          i instanceof File || e.push([t, i]);
      return e
  }
  function dl(s, e) {
      let t = new URLSearchParams(an(e));
      return s.search = t.toString(),
      s
  }
  var _s = class {
      started = !1;
      constructor(e, t) {
          this.delegate = e,
          this.element = t,
          this.intersectionObserver = new IntersectionObserver(this.intersect)
      }
      start() {
          this.started || (this.started = !0,
          this.intersectionObserver.observe(this.element))
      }
      stop() {
          this.started && (this.started = !1,
          this.intersectionObserver.unobserve(this.element))
      }
      intersect = e=>{
          e.slice(-1)[0]?.isIntersecting && this.delegate.elementAppearedInViewport(this.element)
      }
  }
    , Le = class {
      static contentType = "text/vnd.turbo-stream.html";
      static wrap(e) {
          return typeof e == "string" ? new this(Jo(e)) : e
      }
      constructor(e) {
          this.fragment = ul(e)
      }
  }
  ;
  function ul(s) {
      for (let e of s.querySelectorAll("turbo-stream")) {
          let t = document.importNode(e, !0);
          for (let i of t.templateElement.content.querySelectorAll("script"))
              i.replaceWith(lt(i));
          e.replaceWith(t)
      }
      return s
  }
  var hl = 100
    , Gs = class {
      #e = null;
      #t = null;
      get(e) {
          if (this.#t && this.#t.url === e && this.#t.expire > Date.now())
              return this.#t.request
      }
      setLater(e, t, i) {
          this.clear(),
          this.#e = setTimeout(()=>{
              t.perform(),
              this.set(e, t, i),
              this.#e = null
          }
          , hl)
      }
      set(e, t, i) {
          this.#t = {
              url: e,
              request: t,
              expire: new Date(new Date().getTime() + i)
          }
      }
      clear() {
          this.#e && clearTimeout(this.#e),
          this.#t = null
      }
  }
    , fl = 10 * 1e3
    , We = new Gs
    , qe = {
      initialized: "initialized",
      requesting: "requesting",
      waiting: "waiting",
      receiving: "receiving",
      stopping: "stopping",
      stopped: "stopped"
  }
    , ct = class s {
      state = qe.initialized;
      static confirmMethod(e, t, i) {
          return Promise.resolve(confirm(e))
      }
      constructor(e, t, i, r=!1) {
          let n = wl(t, i)
            , o = bl(vl(t, i), n)
            , l = pl(t, i)
            , a = yl(t, i);
          this.delegate = e,
          this.formElement = t,
          this.submitter = i,
          this.fetchRequest = new Ae(this,n,o,l,t,a),
          this.mustRedirect = r
      }
      get method() {
          return this.fetchRequest.method
      }
      set method(e) {
          this.fetchRequest.method = e
      }
      get action() {
          return this.fetchRequest.url.toString()
      }
      set action(e) {
          this.fetchRequest.url = ee(e)
      }
      get body() {
          return this.fetchRequest.body
      }
      get enctype() {
          return this.fetchRequest.enctype
      }
      get isSafe() {
          return this.fetchRequest.isSafe
      }
      get location() {
          return this.fetchRequest.url
      }
      async start() {
          let {initialized: e, requesting: t} = qe
            , i = Vt("data-turbo-confirm", this.submitter, this.formElement);
          if (!(typeof i == "string" && !await s.confirmMethod(i, this.formElement, this.submitter)) && this.state == e)
              return this.state = t,
              this.fetchRequest.perform()
      }
      stop() {
          let {stopping: e, stopped: t} = qe;
          if (this.state != e && this.state != t)
              return this.state = e,
              this.fetchRequest.cancel(),
              !0
      }
      prepareRequest(e) {
          if (!e.isSafe) {
              let t = ml(Ye("csrf-param")) || Ye("csrf-token");
              t && (e.headers["X-CSRF-Token"] = t)
          }
          this.requestAcceptsTurboStreamResponse(e) && e.acceptResponseType(Le.contentType)
      }
      requestStarted(e) {
          this.state = qe.waiting,
          this.submitter?.setAttribute("disabled", ""),
          this.setSubmitsWith(),
          Nt(this.formElement),
          K("turbo:submit-start", {
              target: this.formElement,
              detail: {
                  formSubmission: this
              }
          }),
          this.delegate.formSubmissionStarted(this)
      }
      requestPreventedHandlingResponse(e, t) {
          We.clear(),
          this.result = {
              success: t.succeeded,
              fetchResponse: t
          }
      }
      requestSucceededWithResponse(e, t) {
          if (t.clientError || t.serverError) {
              this.delegate.formSubmissionFailedWithResponse(this, t);
              return
          }
          if (We.clear(),
          this.requestMustRedirect(e) && gl(t)) {
              let i = new Error("Form responses must redirect to another location");
              this.delegate.formSubmissionErrored(this, i)
          } else
              this.state = qe.receiving,
              this.result = {
                  success: !0,
                  fetchResponse: t
              },
              this.delegate.formSubmissionSucceededWithResponse(this, t)
      }
      requestFailedWithResponse(e, t) {
          this.result = {
              success: !1,
              fetchResponse: t
          },
          this.delegate.formSubmissionFailedWithResponse(this, t)
      }
      requestErrored(e, t) {
          this.result = {
              success: !1,
              error: t
          },
          this.delegate.formSubmissionErrored(this, t)
      }
      requestFinished(e) {
          this.state = qe.stopped,
          this.submitter?.removeAttribute("disabled"),
          this.resetSubmitterText(),
          zt(this.formElement),
          K("turbo:submit-end", {
              target: this.formElement,
              detail: {
                  formSubmission: this,
                  ...this.result
              }
          }),
          this.delegate.formSubmissionFinished(this)
      }
      setSubmitsWith() {
          if (!(!this.submitter || !this.submitsWith)) {
              if (this.submitter.matches("button"))
                  this.originalSubmitText = this.submitter.innerHTML,
                  this.submitter.innerHTML = this.submitsWith;
              else if (this.submitter.matches("input")) {
                  let e = this.submitter;
                  this.originalSubmitText = e.value,
                  e.value = this.submitsWith
              }
          }
      }
      resetSubmitterText() {
          if (!(!this.submitter || !this.originalSubmitText)) {
              if (this.submitter.matches("button"))
                  this.submitter.innerHTML = this.originalSubmitText;
              else if (this.submitter.matches("input")) {
                  let e = this.submitter;
                  e.value = this.originalSubmitText
              }
          }
      }
      requestMustRedirect(e) {
          return !e.isSafe && this.mustRedirect
      }
      requestAcceptsTurboStreamResponse(e) {
          return !e.isSafe || tl("data-turbo-stream", this.submitter, this.formElement)
      }
      get submitsWith() {
          return this.submitter?.getAttribute("data-turbo-submits-with")
      }
  }
  ;
  function pl(s, e) {
      let t = new FormData(s)
        , i = e?.getAttribute("name")
        , r = e?.getAttribute("value");
      return i && t.append(i, r || ""),
      t
  }
  function ml(s) {
      if (s != null) {
          let t = (document.cookie ? document.cookie.split("; ") : []).find(i=>i.startsWith(s));
          if (t) {
              let i = t.split("=").slice(1).join("=");
              return i ? decodeURIComponent(i) : void 0
          }
      }
  }
  function gl(s) {
      return s.statusCode == 200 && !s.redirected
  }
  function vl(s, e) {
      let t = typeof s.action == "string" ? s.action : null;
      return e?.hasAttribute("formaction") ? e.getAttribute("formaction") || "" : s.getAttribute("action") || t || ""
  }
  function bl(s, e) {
      let t = ee(s);
      return Kt(e) && (t.search = ""),
      t
  }
  function wl(s, e) {
      let t = e?.getAttribute("formmethod") || s.getAttribute("method") || "";
      return Ut(t.toLowerCase()) || ne.get
  }
  function yl(s, e) {
      return nn(e?.getAttribute("formenctype") || s.enctype)
  }
  var Ue = class {
      constructor(e) {
          this.element = e
      }
      get activeElement() {
          return this.element.ownerDocument.activeElement
      }
      get children() {
          return [...this.element.children]
      }
      hasAnchor(e) {
          return this.getElementForAnchor(e) != null
      }
      getElementForAnchor(e) {
          return e ? this.element.querySelector(`[id='${e}'], a[name='${e}']`) : null
      }
      get isConnected() {
          return this.element.isConnected
      }
      get firstAutofocusableElement() {
          return tn(this.element)
      }
      get permanentElements() {
          return ln(this.element)
      }
      getPermanentElementById(e) {
          return on(this.element, e)
      }
      getPermanentElementMapForSnapshot(e) {
          let t = {};
          for (let i of this.permanentElements) {
              let {id: r} = i
                , n = e.getPermanentElementById(r);
              n && (t[r] = [i, n])
          }
          return t
      }
  }
  ;
  function on(s, e) {
      return s.querySelector(`#${e}[data-turbo-permanent]`)
  }
  function ln(s) {
      return s.querySelectorAll("[id][data-turbo-permanent]")
  }
  var dt = class {
      started = !1;
      constructor(e, t) {
          this.delegate = e,
          this.eventTarget = t
      }
      start() {
          this.started || (this.eventTarget.addEventListener("submit", this.submitCaptured, !0),
          this.started = !0)
      }
      stop() {
          this.started && (this.eventTarget.removeEventListener("submit", this.submitCaptured, !0),
          this.started = !1)
      }
      submitCaptured = ()=>{
          this.eventTarget.removeEventListener("submit", this.submitBubbled, !1),
          this.eventTarget.addEventListener("submit", this.submitBubbled, !1)
      }
      ;
      submitBubbled = e=>{
          if (!e.defaultPrevented) {
              let t = e.target instanceof HTMLFormElement ? e.target : void 0
                , i = e.submitter || void 0;
              t && Sl(t, i) && El(t, i) && this.delegate.willSubmitForm(t, i) && (e.preventDefault(),
              e.stopImmediatePropagation(),
              this.delegate.formSubmitted(t, i))
          }
      }
  }
  ;
  function Sl(s, e) {
      return (e?.getAttribute("formmethod") || s.getAttribute("method")) != "dialog"
  }
  function El(s, e) {
      if (e?.hasAttribute("formtarget") || s.hasAttribute("target")) {
          let t = e?.getAttribute("formtarget") || s.target;
          for (let i of document.getElementsByName(t))
              if (i instanceof HTMLIFrameElement)
                  return !1;
          return !0
      } else
          return !0
  }
  var Ht = class {
      #e = e=>{}
      ;
      #t = e=>{}
      ;
      constructor(e, t) {
          this.delegate = e,
          this.element = t
      }
      scrollToAnchor(e) {
          let t = this.snapshot.getElementForAnchor(e);
          t ? (this.scrollToElement(t),
          this.focusElement(t)) : this.scrollToPosition({
              x: 0,
              y: 0
          })
      }
      scrollToAnchorFromLocation(e) {
          this.scrollToAnchor(De(e))
      }
      scrollToElement(e) {
          e.scrollIntoView()
      }
      focusElement(e) {
          e instanceof HTMLElement && (e.hasAttribute("tabindex") ? e.focus() : (e.setAttribute("tabindex", "-1"),
          e.focus(),
          e.removeAttribute("tabindex")))
      }
      scrollToPosition({x: e, y: t}) {
          this.scrollRoot.scrollTo(e, t)
      }
      scrollToTop() {
          this.scrollToPosition({
              x: 0,
              y: 0
          })
      }
      get scrollRoot() {
          return window
      }
      async render(e) {
          let {isPreview: t, shouldRender: i, willRender: r, newSnapshot: n} = e
            , o = r;
          if (i)
              try {
                  this.renderPromise = new Promise(d=>this.#e = d),
                  this.renderer = e,
                  await this.prepareToRenderSnapshot(e);
                  let l = new Promise(d=>this.#t = d)
                    , a = {
                      resume: this.#t,
                      render: this.renderer.renderElement,
                      renderMethod: this.renderer.renderMethod
                  };
                  this.delegate.allowsImmediateRender(n, a) || await l,
                  await this.renderSnapshot(e),
                  this.delegate.viewRenderedSnapshot(n, t, this.renderer.renderMethod),
                  this.delegate.preloadOnLoadLinksForView(this.element),
                  this.finishRenderingSnapshot(e)
              } finally {
                  delete this.renderer,
                  this.#e(void 0),
                  delete this.renderPromise
              }
          else
              o && this.invalidate(e.reloadReason)
      }
      invalidate(e) {
          this.delegate.viewInvalidated(e)
      }
      async prepareToRenderSnapshot(e) {
          this.markAsPreview(e.isPreview),
          await e.prepareToRender()
      }
      markAsPreview(e) {
          e ? this.element.setAttribute("data-turbo-preview", "") : this.element.removeAttribute("data-turbo-preview")
      }
      markVisitDirection(e) {
          this.element.setAttribute("data-turbo-visit-direction", e)
      }
      unmarkVisitDirection() {
          this.element.removeAttribute("data-turbo-visit-direction")
      }
      async renderSnapshot(e) {
          await e.render()
      }
      finishRenderingSnapshot(e) {
          e.finishRendering()
      }
  }
    , js = class extends Ht {
      missing() {
          this.element.innerHTML = '<strong class="turbo-frame-error">Content missing</strong>'
      }
      get snapshot() {
          return new Ue(this.element)
      }
  }
    , qt = class {
      constructor(e, t) {
          this.delegate = e,
          this.element = t
      }
      start() {
          this.element.addEventListener("click", this.clickBubbled),
          document.addEventListener("turbo:click", this.linkClicked),
          document.addEventListener("turbo:before-visit", this.willVisit)
      }
      stop() {
          this.element.removeEventListener("click", this.clickBubbled),
          document.removeEventListener("turbo:click", this.linkClicked),
          document.removeEventListener("turbo:before-visit", this.willVisit)
      }
      clickBubbled = e=>{
          this.respondsToEventTarget(e.target) ? this.clickEvent = e : delete this.clickEvent
      }
      ;
      linkClicked = e=>{
          this.clickEvent && this.respondsToEventTarget(e.target) && e.target instanceof Element && this.delegate.shouldInterceptLinkClick(e.target, e.detail.url, e.detail.originalEvent) && (this.clickEvent.preventDefault(),
          e.preventDefault(),
          this.delegate.linkClickIntercepted(e.target, e.detail.url, e.detail.originalEvent)),
          delete this.clickEvent
      }
      ;
      willVisit = e=>{
          delete this.clickEvent
      }
      ;
      respondsToEventTarget(e) {
          let t = e instanceof Element ? e : e instanceof Node ? e.parentElement : null;
          return t && t.closest("turbo-frame, html") == this.element
      }
  }
    , Wt = class {
      started = !1;
      constructor(e, t) {
          this.delegate = e,
          this.eventTarget = t
      }
      start() {
          this.started || (this.eventTarget.addEventListener("click", this.clickCaptured, !0),
          this.started = !0)
      }
      stop() {
          this.started && (this.eventTarget.removeEventListener("click", this.clickCaptured, !0),
          this.started = !1)
      }
      clickCaptured = ()=>{
          this.eventTarget.removeEventListener("click", this.clickBubbled, !1),
          this.eventTarget.addEventListener("click", this.clickBubbled, !1)
      }
      ;
      clickBubbled = e=>{
          if (e instanceof MouseEvent && this.clickEventIsSignificant(e)) {
              let t = e.composedPath && e.composedPath()[0] || e.target
                , i = ol(t);
              if (i && al(i)) {
                  let r = sn(i);
                  this.delegate.willFollowLinkToLocation(i, r, e) && (e.preventDefault(),
                  this.delegate.followedLinkToLocation(i, r))
              }
          }
      }
      ;
      clickEventIsSignificant(e) {
          return !(e.target && e.target.isContentEditable || e.defaultPrevented || e.which > 1 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)
      }
  }
    , _t = class {
      constructor(e, t) {
          this.delegate = e,
          this.linkInterceptor = new Wt(this,t)
      }
      start() {
          this.linkInterceptor.start()
      }
      stop() {
          this.linkInterceptor.stop()
      }
      canPrefetchRequestToLocation(e, t) {
          return !1
      }
      prefetchAndCacheRequestToLocation(e, t) {}
      willFollowLinkToLocation(e, t, i) {
          return this.delegate.willSubmitFormLinkToLocation(e, t, i) && (e.hasAttribute("data-turbo-method") || e.hasAttribute("data-turbo-stream"))
      }
      followedLinkToLocation(e, t) {
          let i = document.createElement("form")
            , r = "hidden";
          for (let[c,u] of t.searchParams)
              i.append(Object.assign(document.createElement("input"), {
                  type: r,
                  name: c,
                  value: u
              }));
          let n = Object.assign(t, {
              search: ""
          });
          i.setAttribute("data-turbo", "true"),
          i.setAttribute("action", n.href),
          i.setAttribute("hidden", "");
          let o = e.getAttribute("data-turbo-method");
          o && i.setAttribute("method", o);
          let l = e.getAttribute("data-turbo-frame");
          l && i.setAttribute("data-turbo-frame", l);
          let a = Fe(e);
          a && i.setAttribute("data-turbo-action", a);
          let h = e.getAttribute("data-turbo-confirm");
          h && i.setAttribute("data-turbo-confirm", h),
          e.hasAttribute("data-turbo-stream") && i.setAttribute("data-turbo-stream", ""),
          this.delegate.submittedFormLinkToLocation(e, t, i),
          document.body.appendChild(i),
          i.addEventListener("turbo:submit-end", ()=>i.remove(), {
              once: !0
          }),
          requestAnimationFrame(()=>i.requestSubmit())
      }
  }
    , Gt = class {
      static async preservingPermanentElements(e, t, i) {
          let r = new this(e,t);
          r.enter(),
          await i(),
          r.leave()
      }
      constructor(e, t) {
          this.delegate = e,
          this.permanentElementMap = t
      }
      enter() {
          for (let e in this.permanentElementMap) {
              let[t,i] = this.permanentElementMap[e];
              this.delegate.enteringBardo(t, i),
              this.replaceNewPermanentElementWithPlaceholder(i)
          }
      }
      leave() {
          for (let e in this.permanentElementMap) {
              let[t] = this.permanentElementMap[e];
              this.replaceCurrentPermanentElementWithClone(t),
              this.replacePlaceholderWithPermanentElement(t),
              this.delegate.leavingBardo(t)
          }
      }
      replaceNewPermanentElementWithPlaceholder(e) {
          let t = Tl(e);
          e.replaceWith(t)
      }
      replaceCurrentPermanentElementWithClone(e) {
          let t = e.cloneNode(!0);
          e.replaceWith(t)
      }
      replacePlaceholderWithPermanentElement(e) {
          this.getPlaceholderById(e.id)?.replaceWith(e)
      }
      getPlaceholderById(e) {
          return this.placeholders.find(t=>t.content == e)
      }
      get placeholders() {
          return [...document.querySelectorAll("meta[name=turbo-permanent-placeholder][content]")]
      }
  }
  ;
  function Tl(s) {
      let e = document.createElement("meta");
      return e.setAttribute("name", "turbo-permanent-placeholder"),
      e.setAttribute("content", s.id),
      e
  }
  var ut = class {
      #e = null;
      constructor(e, t, i, r, n=!0) {
          this.currentSnapshot = e,
          this.newSnapshot = t,
          this.isPreview = r,
          this.willRender = n,
          this.renderElement = i,
          this.promise = new Promise((o,l)=>this.resolvingFunctions = {
              resolve: o,
              reject: l
          })
      }
      get shouldRender() {
          return !0
      }
      get reloadReason() {}
      prepareToRender() {}
      render() {}
      finishRendering() {
          this.resolvingFunctions && (this.resolvingFunctions.resolve(),
          delete this.resolvingFunctions)
      }
      async preservingPermanentElements(e) {
          await Gt.preservingPermanentElements(this, this.permanentElementMap, e)
      }
      focusFirstAutofocusableElement() {
          let e = this.connectedSnapshot.firstAutofocusableElement;
          e && e.focus()
      }
      enteringBardo(e) {
          this.#e || e.contains(this.currentSnapshot.activeElement) && (this.#e = this.currentSnapshot.activeElement)
      }
      leavingBardo(e) {
          e.contains(this.#e) && this.#e instanceof HTMLElement && (this.#e.focus(),
          this.#e = null)
      }
      get connectedSnapshot() {
          return this.newSnapshot.isConnected ? this.newSnapshot : this.currentSnapshot
      }
      get currentElement() {
          return this.currentSnapshot.element
      }
      get newElement() {
          return this.newSnapshot.element
      }
      get permanentElementMap() {
          return this.currentSnapshot.getPermanentElementMapForSnapshot(this.newSnapshot)
      }
      get renderMethod() {
          return "replace"
      }
  }
    , Ke = class extends ut {
      static renderElement(e, t) {
          let i = document.createRange();
          i.selectNodeContents(e),
          i.deleteContents();
          let r = t
            , n = r.ownerDocument?.createRange();
          n && (n.selectNodeContents(r),
          e.appendChild(n.extractContents()))
      }
      constructor(e, t, i, r, n, o=!0) {
          super(t, i, r, n, o),
          this.delegate = e
      }
      get shouldRender() {
          return !0
      }
      async render() {
          await _e(),
          this.preservingPermanentElements(()=>{
              this.loadFrameElement()
          }
          ),
          this.scrollFrameIntoView(),
          await _e(),
          this.focusFirstAutofocusableElement(),
          await _e(),
          this.activateScriptElements()
      }
      loadFrameElement() {
          this.delegate.willRenderFrame(this.currentElement, this.newElement),
          this.renderElement(this.currentElement, this.newElement)
      }
      scrollFrameIntoView() {
          if (this.currentElement.autoscroll || this.newElement.autoscroll) {
              let e = this.currentElement.firstElementChild
                , t = xl(this.currentElement.getAttribute("data-autoscroll-block"), "end")
                , i = Ml(this.currentElement.getAttribute("data-autoscroll-behavior"), "auto");
              if (e)
                  return e.scrollIntoView({
                      block: t,
                      behavior: i
                  }),
                  !0
          }
          return !1
      }
      activateScriptElements() {
          for (let e of this.newScriptElements) {
              let t = lt(e);
              e.replaceWith(t)
          }
      }
      get newScriptElements() {
          return this.currentElement.querySelectorAll("script")
      }
  }
  ;
  function xl(s, e) {
      return s == "end" || s == "start" || s == "center" || s == "nearest" ? s : e
  }
  function Ml(s, e) {
      return s == "auto" || s == "smooth" ? s : e
  }
  var Xs = class s {
      static animationDuration = 300;
      static get defaultCSS() {
          return Jr`
    .turbo-progress-bar {
      position: fixed;
      display: block;
      top: 0;
      left: 0;
      height: 3px;
      background: #0076ff;
      z-index: 2147483647;
      transition:
        width ${s.animationDuration}ms ease-out,
        opacity ${s.animationDuration / 2}ms ${s.animationDuration / 2}ms ease-in;
      transform: translate3d(0, 0, 0);
    }
  `
      }
      hiding = !1;
      value = 0;
      visible = !1;
      constructor() {
          this.stylesheetElement = this.createStylesheetElement(),
          this.progressElement = this.createProgressElement(),
          this.installStylesheetElement(),
          this.setValue(0)
      }
      show() {
          this.visible || (this.visible = !0,
          this.installProgressElement(),
          this.startTrickling())
      }
      hide() {
          this.visible && !this.hiding && (this.hiding = !0,
          this.fadeProgressElement(()=>{
              this.uninstallProgressElement(),
              this.stopTrickling(),
              this.visible = !1,
              this.hiding = !1
          }
          ))
      }
      setValue(e) {
          this.value = e,
          this.refresh()
      }
      installStylesheetElement() {
          document.head.insertBefore(this.stylesheetElement, document.head.firstChild)
      }
      installProgressElement() {
          this.progressElement.style.width = "0",
          this.progressElement.style.opacity = "1",
          document.documentElement.insertBefore(this.progressElement, document.body),
          this.refresh()
      }
      fadeProgressElement(e) {
          this.progressElement.style.opacity = "0",
          setTimeout(e, s.animationDuration * 1.5)
      }
      uninstallProgressElement() {
          this.progressElement.parentNode && document.documentElement.removeChild(this.progressElement)
      }
      startTrickling() {
          this.trickleInterval || (this.trickleInterval = window.setInterval(this.trickle, s.animationDuration))
      }
      stopTrickling() {
          window.clearInterval(this.trickleInterval),
          delete this.trickleInterval
      }
      trickle = ()=>{
          this.setValue(this.value + Math.random() / 100)
      }
      ;
      refresh() {
          requestAnimationFrame(()=>{
              this.progressElement.style.width = `${10 + this.value * 90}%`
          }
          )
      }
      createStylesheetElement() {
          let e = document.createElement("style");
          return e.type = "text/css",
          e.textContent = s.defaultCSS,
          this.cspNonce && (e.nonce = this.cspNonce),
          e
      }
      createProgressElement() {
          let e = document.createElement("div");
          return e.className = "turbo-progress-bar",
          e
      }
      get cspNonce() {
          return Ye("csp-nonce")
      }
  }
    , Ys = class extends Ue {
      detailsByOuterHTML = this.children.filter(e=>!Pl(e)).map(e=>kl(e)).reduce((e,t)=>{
          let {outerHTML: i} = t
            , r = i in e ? e[i] : {
              type: Cl(t),
              tracked: Al(t),
              elements: []
          };
          return {
              ...e,
              [i]: {
                  ...r,
                  elements: [...r.elements, t]
              }
          }
      }
      , {});
      get trackedElementSignature() {
          return Object.keys(this.detailsByOuterHTML).filter(e=>this.detailsByOuterHTML[e].tracked).join("")
      }
      getScriptElementsNotInSnapshot(e) {
          return this.getElementsMatchingTypeNotInSnapshot("script", e)
      }
      getStylesheetElementsNotInSnapshot(e) {
          return this.getElementsMatchingTypeNotInSnapshot("stylesheet", e)
      }
      getElementsMatchingTypeNotInSnapshot(e, t) {
          return Object.keys(this.detailsByOuterHTML).filter(i=>!(i in t.detailsByOuterHTML)).map(i=>this.detailsByOuterHTML[i]).filter(({type: i})=>i == e).map(({elements: [i]})=>i)
      }
      get provisionalElements() {
          return Object.keys(this.detailsByOuterHTML).reduce((e,t)=>{
              let {type: i, tracked: r, elements: n} = this.detailsByOuterHTML[t];
              return i == null && !r ? [...e, ...n] : n.length > 1 ? [...e, ...n.slice(1)] : e
          }
          , [])
      }
      getMetaValue(e) {
          let t = this.findMetaElementByName(e);
          return t ? t.getAttribute("content") : null
      }
      findMetaElementByName(e) {
          return Object.keys(this.detailsByOuterHTML).reduce((t,i)=>{
              let {elements: [r]} = this.detailsByOuterHTML[i];
              return Ol(r, e) ? r : t
          }
          , void 0 | void 0)
      }
  }
  ;
  function Cl(s) {
      if (Ll(s))
          return "script";
      if (Il(s))
          return "stylesheet"
  }
  function Al(s) {
      return s.getAttribute("data-turbo-track") == "reload"
  }
  function Ll(s) {
      return s.localName == "script"
  }
  function Pl(s) {
      return s.localName == "noscript"
  }
  function Il(s) {
      let e = s.localName;
      return e == "style" || e == "link" && s.getAttribute("rel") == "stylesheet"
  }
  function Ol(s, e) {
      return s.localName == "meta" && s.getAttribute("name") == e
  }
  function kl(s) {
      return s.hasAttribute("nonce") && s.setAttribute("nonce", ""),
      s
  }
  var le = class s extends Ue {
      static fromHTMLString(e="") {
          return this.fromDocument(Zr(e))
      }
      static fromElement(e) {
          return this.fromDocument(e.ownerDocument)
      }
      static fromDocument({documentElement: e, body: t, head: i}) {
          return new this(e,t,new Ys(i))
      }
      constructor(e, t, i) {
          super(t),
          this.documentElement = e,
          this.headSnapshot = i
      }
      clone() {
          let e = this.element.cloneNode(!0)
            , t = this.element.querySelectorAll("select")
            , i = e.querySelectorAll("select");
          for (let[r,n] of t.entries()) {
              let o = i[r];
              for (let l of o.selectedOptions)
                  l.selected = !1;
              for (let l of n.selectedOptions)
                  o.options[l.index].selected = !0
          }
          for (let r of e.querySelectorAll('input[type="password"]'))
              r.value = "";
          return new s(this.documentElement,e,this.headSnapshot)
      }
      get lang() {
          return this.documentElement.getAttribute("lang")
      }
      get headElement() {
          return this.headSnapshot.element
      }
      get rootLocation() {
          let e = this.getSetting("root") ?? "/";
          return ee(e)
      }
      get cacheControlValue() {
          return this.getSetting("cache-control")
      }
      get isPreviewable() {
          return this.cacheControlValue != "no-preview"
      }
      get isCacheable() {
          return this.cacheControlValue != "no-cache"
      }
      get isVisitable() {
          return this.getSetting("visit-control") != "reload"
      }
      get prefersViewTransitions() {
          return this.headSnapshot.getMetaValue("view-transition") === "same-origin"
      }
      get shouldMorphPage() {
          return this.getSetting("refresh-method") === "morph"
      }
      get shouldPreserveScrollPosition() {
          return this.getSetting("refresh-scroll") === "preserve"
      }
      getSetting(e) {
          return this.headSnapshot.getMetaValue(`turbo-${e}`)
      }
  }
    , Us = class {
      #e = !1;
      #t = Promise.resolve();
      renderChange(e, t) {
          return e && this.viewTransitionsAvailable && !this.#e ? (this.#e = !0,
          this.#t = this.#t.then(async()=>{
              await document.startViewTransition(t).finished
          }
          )) : this.#t = this.#t.then(t),
          this.#t
      }
      get viewTransitionsAvailable() {
          return document.startViewTransition
      }
  }
    , Rl = {
      action: "advance",
      historyChanged: !1,
      visitCachedSnapshot: ()=>{}
      ,
      willRender: !0,
      updateHistory: !0,
      shouldCacheSnapshot: !0,
      acceptsStreamResponse: !1
  }
    , $t = {
      visitStart: "visitStart",
      requestStart: "requestStart",
      requestEnd: "requestEnd",
      visitEnd: "visitEnd"
  }
    , we = {
      initialized: "initialized",
      started: "started",
      canceled: "canceled",
      failed: "failed",
      completed: "completed"
  }
    , je = {
      networkFailure: 0,
      timeoutFailure: -1,
      contentTypeMismatch: -2
  }
    , Dl = {
      advance: "forward",
      restore: "back",
      replace: "none"
  }
    , Ks = class {
      identifier = Ce();
      timingMetrics = {};
      followedRedirect = !1;
      historyChanged = !1;
      scrolled = !1;
      shouldCacheSnapshot = !0;
      acceptsStreamResponse = !1;
      snapshotCached = !1;
      state = we.initialized;
      viewTransitioner = new Us;
      constructor(e, t, i, r={}) {
          this.delegate = e,
          this.location = t,
          this.restorationIdentifier = i || Ce();
          let {action: n, historyChanged: o, referrer: l, snapshot: a, snapshotHTML: h, response: d, visitCachedSnapshot: c, willRender: u, updateHistory: m, shouldCacheSnapshot: g, acceptsStreamResponse: y, direction: w} = {
              ...Rl,
              ...r
          };
          this.action = n,
          this.historyChanged = o,
          this.referrer = l,
          this.snapshot = a,
          this.snapshotHTML = h,
          this.response = d,
          this.isSamePage = this.delegate.locationWithActionIsSamePage(this.location, this.action),
          this.isPageRefresh = this.view.isPageRefresh(this),
          this.visitCachedSnapshot = c,
          this.willRender = u,
          this.updateHistory = m,
          this.scrolled = !u,
          this.shouldCacheSnapshot = g,
          this.acceptsStreamResponse = y,
          this.direction = w || Dl[n]
      }
      get adapter() {
          return this.delegate.adapter
      }
      get view() {
          return this.delegate.view
      }
      get history() {
          return this.delegate.history
      }
      get restorationData() {
          return this.history.getRestorationDataForIdentifier(this.restorationIdentifier)
      }
      get silent() {
          return this.isSamePage
      }
      start() {
          this.state == we.initialized && (this.recordTimingMetric($t.visitStart),
          this.state = we.started,
          this.adapter.visitStarted(this),
          this.delegate.visitStarted(this))
      }
      cancel() {
          this.state == we.started && (this.request && this.request.cancel(),
          this.cancelRender(),
          this.state = we.canceled)
      }
      complete() {
          this.state == we.started && (this.recordTimingMetric($t.visitEnd),
          this.adapter.visitCompleted(this),
          this.state = we.completed,
          this.followRedirect(),
          this.followedRedirect || this.delegate.visitCompleted(this))
      }
      fail() {
          this.state == we.started && (this.state = we.failed,
          this.adapter.visitFailed(this),
          this.delegate.visitCompleted(this))
      }
      changeHistory() {
          if (!this.historyChanged && this.updateHistory) {
              let e = this.location.href === this.referrer?.href ? "replace" : this.action
                , t = Qr(e);
              this.history.update(t, this.location, this.restorationIdentifier),
              this.historyChanged = !0
          }
      }
      issueRequest() {
          this.hasPreloadedResponse() ? this.simulateRequest() : this.shouldIssueRequest() && !this.request && (this.request = new Ae(this,ne.get,this.location),
          this.request.perform())
      }
      simulateRequest() {
          this.response && (this.startRequest(),
          this.recordResponse(),
          this.finishRequest())
      }
      startRequest() {
          this.recordTimingMetric($t.requestStart),
          this.adapter.visitRequestStarted(this)
      }
      recordResponse(e=this.response) {
          if (this.response = e,
          e) {
              let {statusCode: t} = e;
              _r(t) ? this.adapter.visitRequestCompleted(this) : this.adapter.visitRequestFailedWithStatusCode(this, t)
          }
      }
      finishRequest() {
          this.recordTimingMetric($t.requestEnd),
          this.adapter.visitRequestFinished(this)
      }
      loadResponse() {
          if (this.response) {
              let {statusCode: e, responseHTML: t} = this.response;
              this.render(async()=>{
                  if (this.shouldCacheSnapshot && this.cacheSnapshot(),
                  this.view.renderPromise && await this.view.renderPromise,
                  _r(e) && t != null) {
                      let i = le.fromHTMLString(t);
                      await this.renderPageSnapshot(i, !1),
                      this.adapter.visitRendered(this),
                      this.complete()
                  } else
                      await this.view.renderError(le.fromHTMLString(t), this),
                      this.adapter.visitRendered(this),
                      this.fail()
              }
              )
          }
      }
      getCachedSnapshot() {
          let e = this.view.getCachedSnapshotForLocation(this.location) || this.getPreloadedSnapshot();
          if (e && (!De(this.location) || e.hasAnchor(De(this.location))) && (this.action == "restore" || e.isPreviewable))
              return e
      }
      getPreloadedSnapshot() {
          if (this.snapshotHTML)
              return le.fromHTMLString(this.snapshotHTML)
      }
      hasCachedSnapshot() {
          return this.getCachedSnapshot() != null
      }
      loadCachedSnapshot() {
          let e = this.getCachedSnapshot();
          if (e) {
              let t = this.shouldIssueRequest();
              this.render(async()=>{
                  this.cacheSnapshot(),
                  this.isSamePage || this.isPageRefresh ? this.adapter.visitRendered(this) : (this.view.renderPromise && await this.view.renderPromise,
                  await this.renderPageSnapshot(e, t),
                  this.adapter.visitRendered(this),
                  t || this.complete())
              }
              )
          }
      }
      followRedirect() {
          this.redirectedToLocation && !this.followedRedirect && this.response?.redirected && (this.adapter.visitProposedToLocation(this.redirectedToLocation, {
              action: "replace",
              response: this.response,
              shouldCacheSnapshot: !1,
              willRender: !1
          }),
          this.followedRedirect = !0)
      }
      goToSamePageAnchor() {
          this.isSamePage && this.render(async()=>{
              this.cacheSnapshot(),
              this.performScroll(),
              this.changeHistory(),
              this.adapter.visitRendered(this)
          }
          )
      }
      prepareRequest(e) {
          this.acceptsStreamResponse && e.acceptResponseType(Le.contentType)
      }
      requestStarted() {
          this.startRequest()
      }
      requestPreventedHandlingResponse(e, t) {}
      async requestSucceededWithResponse(e, t) {
          let i = await t.responseHTML
            , {redirected: r, statusCode: n} = t;
          i == null ? this.recordResponse({
              statusCode: je.contentTypeMismatch,
              redirected: r
          }) : (this.redirectedToLocation = t.redirected ? t.location : void 0,
          this.recordResponse({
              statusCode: n,
              responseHTML: i,
              redirected: r
          }))
      }
      async requestFailedWithResponse(e, t) {
          let i = await t.responseHTML
            , {redirected: r, statusCode: n} = t;
          i == null ? this.recordResponse({
              statusCode: je.contentTypeMismatch,
              redirected: r
          }) : this.recordResponse({
              statusCode: n,
              responseHTML: i,
              redirected: r
          })
      }
      requestErrored(e, t) {
          this.recordResponse({
              statusCode: je.networkFailure,
              redirected: !1
          })
      }
      requestFinished() {
          this.finishRequest()
      }
      performScroll() {
          !this.scrolled && !this.view.forceReloaded && !this.view.shouldPreserveScrollPosition(this) && (this.action == "restore" ? this.scrollToRestoredPosition() || this.scrollToAnchor() || this.view.scrollToTop() : this.scrollToAnchor() || this.view.scrollToTop(),
          this.isSamePage && this.delegate.visitScrolledToSamePageLocation(this.view.lastRenderedLocation, this.location),
          this.scrolled = !0)
      }
      scrollToRestoredPosition() {
          let {scrollPosition: e} = this.restorationData;
          if (e)
              return this.view.scrollToPosition(e),
              !0
      }
      scrollToAnchor() {
          let e = De(this.location);
          if (e != null)
              return this.view.scrollToAnchor(e),
              !0
      }
      recordTimingMetric(e) {
          this.timingMetrics[e] = new Date().getTime()
      }
      getTimingMetrics() {
          return {
              ...this.timingMetrics
          }
      }
      getHistoryMethodForAction(e) {
          switch (e) {
          case "replace":
              return history.replaceState;
          case "advance":
          case "restore":
              return history.pushState
          }
      }
      hasPreloadedResponse() {
          return typeof this.response == "object"
      }
      shouldIssueRequest() {
          return this.isSamePage ? !1 : this.action == "restore" ? !this.hasCachedSnapshot() : this.willRender
      }
      cacheSnapshot() {
          this.snapshotCached || (this.view.cacheSnapshot(this.snapshot).then(e=>e && this.visitCachedSnapshot(e)),
          this.snapshotCached = !0)
      }
      async render(e) {
          this.cancelRender(),
          this.frame = await _e(),
          await e(),
          delete this.frame
      }
      async renderPageSnapshot(e, t) {
          await this.viewTransitioner.renderChange(this.view.shouldTransitionTo(e), async()=>{
              await this.view.renderPage(e, t, this.willRender, this),
              this.performScroll()
          }
          )
      }
      cancelRender() {
          this.frame && (cancelAnimationFrame(this.frame),
          delete this.frame)
      }
  }
  ;
  function _r(s) {
      return s >= 200 && s < 300
  }
  var Zs = class {
      progressBar = new Xs;
      constructor(e) {
          this.session = e
      }
      visitProposedToLocation(e, t) {
          xe(e, this.navigator.rootLocation) ? this.navigator.startVisit(e, t?.restorationIdentifier || Ce(), t) : window.location.href = e.toString()
      }
      visitStarted(e) {
          this.location = e.location,
          e.loadCachedSnapshot(),
          e.issueRequest(),
          e.goToSamePageAnchor()
      }
      visitRequestStarted(e) {
          this.progressBar.setValue(0),
          e.hasCachedSnapshot() || e.action != "restore" ? this.showVisitProgressBarAfterDelay() : this.showProgressBar()
      }
      visitRequestCompleted(e) {
          e.loadResponse()
      }
      visitRequestFailedWithStatusCode(e, t) {
          switch (t) {
          case je.networkFailure:
          case je.timeoutFailure:
          case je.contentTypeMismatch:
              return this.reload({
                  reason: "request_failed",
                  context: {
                      statusCode: t
                  }
              });
          default:
              return e.loadResponse()
          }
      }
      visitRequestFinished(e) {}
      visitCompleted(e) {
          this.progressBar.setValue(1),
          this.hideVisitProgressBar()
      }
      pageInvalidated(e) {
          this.reload(e)
      }
      visitFailed(e) {
          this.progressBar.setValue(1),
          this.hideVisitProgressBar()
      }
      visitRendered(e) {}
      formSubmissionStarted(e) {
          this.progressBar.setValue(0),
          this.showFormProgressBarAfterDelay()
      }
      formSubmissionFinished(e) {
          this.progressBar.setValue(1),
          this.hideFormProgressBar()
      }
      showVisitProgressBarAfterDelay() {
          this.visitProgressBarTimeout = window.setTimeout(this.showProgressBar, this.session.progressBarDelay)
      }
      hideVisitProgressBar() {
          this.progressBar.hide(),
          this.visitProgressBarTimeout != null && (window.clearTimeout(this.visitProgressBarTimeout),
          delete this.visitProgressBarTimeout)
      }
      showFormProgressBarAfterDelay() {
          this.formProgressBarTimeout == null && (this.formProgressBarTimeout = window.setTimeout(this.showProgressBar, this.session.progressBarDelay))
      }
      hideFormProgressBar() {
          this.progressBar.hide(),
          this.formProgressBarTimeout != null && (window.clearTimeout(this.formProgressBarTimeout),
          delete this.formProgressBarTimeout)
      }
      showProgressBar = ()=>{
          this.progressBar.show()
      }
      ;
      reload(e) {
          K("turbo:reload", {
              detail: e
          }),
          window.location.href = this.location?.toString() || window.location.href
      }
      get navigator() {
          return this.session.navigator
      }
  }
    , Js = class {
      selector = "[data-turbo-temporary]";
      deprecatedSelector = "[data-turbo-cache=false]";
      started = !1;
      start() {
          this.started || (this.started = !0,
          addEventListener("turbo:before-cache", this.removeTemporaryElements, !1))
      }
      stop() {
          this.started && (this.started = !1,
          removeEventListener("turbo:before-cache", this.removeTemporaryElements, !1))
      }
      removeTemporaryElements = e=>{
          for (let t of this.temporaryElements)
              t.remove()
      }
      ;
      get temporaryElements() {
          return [...document.querySelectorAll(this.selector), ...this.temporaryElementsWithDeprecation]
      }
      get temporaryElementsWithDeprecation() {
          let e = document.querySelectorAll(this.deprecatedSelector);
          return e.length && console.warn(`The ${this.deprecatedSelector} selector is deprecated and will be removed in a future version. Use ${this.selector} instead.`),
          [...e]
      }
  }
    , Qs = class {
      constructor(e, t) {
          this.session = e,
          this.element = t,
          this.linkInterceptor = new qt(this,t),
          this.formSubmitObserver = new dt(this,t)
      }
      start() {
          this.linkInterceptor.start(),
          this.formSubmitObserver.start()
      }
      stop() {
          this.linkInterceptor.stop(),
          this.formSubmitObserver.stop()
      }
      shouldInterceptLinkClick(e, t, i) {
          return this.#t(e)
      }
      linkClickIntercepted(e, t, i) {
          let r = this.#s(e);
          r && r.delegate.linkClickIntercepted(e, t, i)
      }
      willSubmitForm(e, t) {
          return e.closest("turbo-frame") == null && this.#e(e, t) && this.#t(e, t)
      }
      formSubmitted(e, t) {
          let i = this.#s(e, t);
          i && i.delegate.formSubmitted(e, t)
      }
      #e(e, t) {
          let i = mi(e, t)
            , r = this.element.ownerDocument.querySelector('meta[name="turbo-root"]')
            , n = ee(r?.content ?? "/");
          return this.#t(e, t) && xe(i, n)
      }
      #t(e, t) {
          if (e instanceof HTMLFormElement ? this.session.submissionIsNavigatable(e, t) : this.session.elementIsNavigatable(e)) {
              let r = this.#s(e, t);
              return r ? r != e.closest("turbo-frame") : !1
          } else
              return !1
      }
      #s(e, t) {
          let i = t?.getAttribute("data-turbo-frame") || e.getAttribute("data-turbo-frame");
          if (i && i != "_top") {
              let r = this.element.querySelector(`#${i}:not([disabled])`);
              if (r instanceof he)
                  return r
          }
      }
  }
    , ei = class {
      location;
      restorationIdentifier = Ce();
      restorationData = {};
      started = !1;
      pageLoaded = !1;
      currentIndex = 0;
      constructor(e) {
          this.delegate = e
      }
      start() {
          this.started || (addEventListener("popstate", this.onPopState, !1),
          addEventListener("load", this.onPageLoad, !1),
          this.currentIndex = history.state?.turbo?.restorationIndex || 0,
          this.started = !0,
          this.replace(new URL(window.location.href)))
      }
      stop() {
          this.started && (removeEventListener("popstate", this.onPopState, !1),
          removeEventListener("load", this.onPageLoad, !1),
          this.started = !1)
      }
      push(e, t) {
          this.update(history.pushState, e, t)
      }
      replace(e, t) {
          this.update(history.replaceState, e, t)
      }
      update(e, t, i=Ce()) {
          e === history.pushState && ++this.currentIndex;
          let r = {
              turbo: {
                  restorationIdentifier: i,
                  restorationIndex: this.currentIndex
              }
          };
          e.call(history, r, "", t.href),
          this.location = t,
          this.restorationIdentifier = i
      }
      getRestorationDataForIdentifier(e) {
          return this.restorationData[e] || {}
      }
      updateRestorationData(e) {
          let {restorationIdentifier: t} = this
            , i = this.restorationData[t];
          this.restorationData[t] = {
              ...i,
              ...e
          }
      }
      assumeControlOfScrollRestoration() {
          this.previousScrollRestoration || (this.previousScrollRestoration = history.scrollRestoration ?? "auto",
          history.scrollRestoration = "manual")
      }
      relinquishControlOfScrollRestoration() {
          this.previousScrollRestoration && (history.scrollRestoration = this.previousScrollRestoration,
          delete this.previousScrollRestoration)
      }
      onPopState = e=>{
          if (this.shouldHandlePopState()) {
              let {turbo: t} = e.state || {};
              if (t) {
                  this.location = new URL(window.location.href);
                  let {restorationIdentifier: i, restorationIndex: r} = t;
                  this.restorationIdentifier = i;
                  let n = r > this.currentIndex ? "forward" : "back";
                  this.delegate.historyPoppedToLocationWithRestorationIdentifierAndDirection(this.location, i, n),
                  this.currentIndex = r
              }
          }
      }
      ;
      onPageLoad = async e=>{
          await Qo(),
          this.pageLoaded = !0
      }
      ;
      shouldHandlePopState() {
          return this.pageIsLoaded()
      }
      pageIsLoaded() {
          return this.pageLoaded || document.readyState == "complete"
      }
  }
    , ti = class {
      started = !1;
      #e = null;
      constructor(e, t) {
          this.delegate = e,
          this.eventTarget = t
      }
      start() {
          this.started || (this.eventTarget.readyState === "loading" ? this.eventTarget.addEventListener("DOMContentLoaded", this.#t, {
              once: !0
          }) : this.#t())
      }
      stop() {
          this.started && (this.eventTarget.removeEventListener("mouseenter", this.#s, {
              capture: !0,
              passive: !0
          }),
          this.eventTarget.removeEventListener("mouseleave", this.#r, {
              capture: !0,
              passive: !0
          }),
          this.eventTarget.removeEventListener("turbo:before-fetch-request", this.#i, !0),
          this.started = !1)
      }
      #t = ()=>{
          this.eventTarget.addEventListener("mouseenter", this.#s, {
              capture: !0,
              passive: !0
          }),
          this.eventTarget.addEventListener("mouseleave", this.#r, {
              capture: !0,
              passive: !0
          }),
          this.eventTarget.addEventListener("turbo:before-fetch-request", this.#i, !0),
          this.started = !0
      }
      ;
      #s = e=>{
          if (Ye("turbo-prefetch") === "false")
              return;
          let t = e.target;
          if (t.matches && t.matches("a[href]:not([target^=_]):not([download])") && this.#o(t)) {
              let r = t
                , n = sn(r);
              if (this.delegate.canPrefetchRequestToLocation(r, n)) {
                  this.#e = r;
                  let o = new Ae(this,ne.get,n,new URLSearchParams,t);
                  We.setLater(n.toString(), o, this.#a)
              }
          }
      }
      ;
      #r = e=>{
          e.target === this.#e && this.#n()
      }
      ;
      #n = ()=>{
          We.clear(),
          this.#e = null
      }
      ;
      #i = e=>{
          if (e.target.tagName !== "FORM" && e.detail.fetchOptions.method === "get") {
              let t = We.get(e.detail.url.toString());
              t && (e.detail.fetchRequest = t),
              We.clear()
          }
      }
      ;
      prepareRequest(e) {
          let t = e.target;
          e.headers["X-Sec-Purpose"] = "prefetch";
          let i = t.closest("turbo-frame")
            , r = t.getAttribute("data-turbo-frame") || i?.getAttribute("target") || i?.id;
          r && r !== "_top" && (e.headers["Turbo-Frame"] = r)
      }
      requestSucceededWithResponse() {}
      requestStarted(e) {}
      requestErrored(e) {}
      requestFinished(e) {}
      requestPreventedHandlingResponse(e, t) {}
      requestFailedWithResponse(e, t) {}
      get #a() {
          return Number(Ye("turbo-prefetch-cache-time")) || fl
      }
      #o(e) {
          return !(!e.getAttribute("href") || Fl(e) || Bl(e) || $l(e) || Vl(e) || zl(e))
      }
  }
    , Fl = s=>s.origin !== document.location.origin || !["http:", "https:"].includes(s.protocol) || s.hasAttribute("target")
    , Bl = s=>s.pathname + s.search === document.location.pathname + document.location.search || s.href.startsWith("#")
    , $l = s=>{
      if (s.getAttribute("data-turbo-prefetch") === "false" || s.getAttribute("data-turbo") === "false")
          return !0;
      let e = Ge(s, "[data-turbo-prefetch]");
      return !!(e && e.getAttribute("data-turbo-prefetch") === "false")
  }
    , Vl = s=>{
      let e = s.getAttribute("data-turbo-method");
      return !!(e && e.toLowerCase() !== "get" || Nl(s) || s.hasAttribute("data-turbo-confirm") || s.hasAttribute("data-turbo-stream"))
  }
    , Nl = s=>s.hasAttribute("data-remote") || s.hasAttribute("data-behavior") || s.hasAttribute("data-confirm") || s.hasAttribute("data-method")
    , zl = s=>K("turbo:before-prefetch", {
      target: s,
      cancelable: !0
  }).defaultPrevented
    , si = class {
      constructor(e) {
          this.delegate = e
      }
      proposeVisit(e, t={}) {
          this.delegate.allowsVisitingLocationWithAction(e, t.action) && this.delegate.visitProposedToLocation(e, t)
      }
      startVisit(e, t, i={}) {
          this.stop(),
          this.currentVisit = new Ks(this,ee(e),t,{
              referrer: this.location,
              ...i
          }),
          this.currentVisit.start()
      }
      submitForm(e, t) {
          this.stop(),
          this.formSubmission = new ct(this,e,t,!0),
          this.formSubmission.start()
      }
      stop() {
          this.formSubmission && (this.formSubmission.stop(),
          delete this.formSubmission),
          this.currentVisit && (this.currentVisit.cancel(),
          delete this.currentVisit)
      }
      get adapter() {
          return this.delegate.adapter
      }
      get view() {
          return this.delegate.view
      }
      get rootLocation() {
          return this.view.snapshot.rootLocation
      }
      get history() {
          return this.delegate.history
      }
      formSubmissionStarted(e) {
          typeof this.adapter.formSubmissionStarted == "function" && this.adapter.formSubmissionStarted(e)
      }
      async formSubmissionSucceededWithResponse(e, t) {
          if (e == this.formSubmission) {
              let i = await t.responseHTML;
              if (i) {
                  let r = e.isSafe;
                  r || this.view.clearSnapshotCache();
                  let {statusCode: n, redirected: o} = t
                    , a = {
                      action: this.#e(e, t),
                      shouldCacheSnapshot: r,
                      response: {
                          statusCode: n,
                          responseHTML: i,
                          redirected: o
                      }
                  };
                  this.proposeVisit(t.location, a)
              }
          }
      }
      async formSubmissionFailedWithResponse(e, t) {
          let i = await t.responseHTML;
          if (i) {
              let r = le.fromHTMLString(i);
              t.serverError ? await this.view.renderError(r, this.currentVisit) : await this.view.renderPage(r, !1, !0, this.currentVisit),
              r.shouldPreserveScrollPosition || this.view.scrollToTop(),
              this.view.clearSnapshotCache()
          }
      }
      formSubmissionErrored(e, t) {
          console.error(t)
      }
      formSubmissionFinished(e) {
          typeof this.adapter.formSubmissionFinished == "function" && this.adapter.formSubmissionFinished(e)
      }
      visitStarted(e) {
          this.delegate.visitStarted(e)
      }
      visitCompleted(e) {
          this.delegate.visitCompleted(e)
      }
      locationWithActionIsSamePage(e, t) {
          let i = De(e)
            , r = De(this.view.lastRenderedLocation)
            , n = t === "restore" && typeof i > "u";
          return t !== "replace" && qs(e) === qs(this.view.lastRenderedLocation) && (n || i != null && i !== r)
      }
      visitScrolledToSamePageLocation(e, t) {
          this.delegate.visitScrolledToSamePageLocation(e, t)
      }
      get location() {
          return this.history.location
      }
      get restorationIdentifier() {
          return this.history.restorationIdentifier
      }
      #e(e, t) {
          let {submitter: i, formElement: r} = e;
          return Fe(i, r) || this.#t(t)
      }
      #t(e) {
          return e.redirected && e.location.href === this.location?.href ? "replace" : "advance"
      }
  }
    , ke = {
      initial: 0,
      loading: 1,
      interactive: 2,
      complete: 3
  }
    , ii = class {
      stage = ke.initial;
      started = !1;
      constructor(e) {
          this.delegate = e
      }
      start() {
          this.started || (this.stage == ke.initial && (this.stage = ke.loading),
          document.addEventListener("readystatechange", this.interpretReadyState, !1),
          addEventListener("pagehide", this.pageWillUnload, !1),
          this.started = !0)
      }
      stop() {
          this.started && (document.removeEventListener("readystatechange", this.interpretReadyState, !1),
          removeEventListener("pagehide", this.pageWillUnload, !1),
          this.started = !1)
      }
      interpretReadyState = ()=>{
          let {readyState: e} = this;
          e == "interactive" ? this.pageIsInteractive() : e == "complete" && this.pageIsComplete()
      }
      ;
      pageIsInteractive() {
          this.stage == ke.loading && (this.stage = ke.interactive,
          this.delegate.pageBecameInteractive())
      }
      pageIsComplete() {
          this.pageIsInteractive(),
          this.stage == ke.interactive && (this.stage = ke.complete,
          this.delegate.pageLoaded())
      }
      pageWillUnload = ()=>{
          this.delegate.pageWillUnload()
      }
      ;
      get readyState() {
          return document.readyState
      }
  }
    , ri = class {
      started = !1;
      constructor(e) {
          this.delegate = e
      }
      start() {
          this.started || (addEventListener("scroll", this.onScroll, !1),
          this.onScroll(),
          this.started = !0)
      }
      stop() {
          this.started && (removeEventListener("scroll", this.onScroll, !1),
          this.started = !1)
      }
      onScroll = ()=>{
          this.updatePosition({
              x: window.pageXOffset,
              y: window.pageYOffset
          })
      }
      ;
      updatePosition(e) {
          this.delegate.scrollPositionChanged(e)
      }
  }
    , ni = class {
      render({fragment: e}) {
          Gt.preservingPermanentElements(this, Hl(e), ()=>{
              ql(e, ()=>{
                  Wl(()=>{
                      document.documentElement.appendChild(e)
                  }
                  )
              }
              )
          }
          )
      }
      enteringBardo(e, t) {
          t.replaceWith(e.cloneNode(!0))
      }
      leavingBardo() {}
  }
  ;
  function Hl(s) {
      let e = ln(document.documentElement)
        , t = {};
      for (let i of e) {
          let {id: r} = i;
          for (let n of s.querySelectorAll("turbo-stream")) {
              let o = on(n.templateElement.content, r);
              o && (t[r] = [i, o])
          }
      }
      return t
  }
  async function ql(s, e) {
      let t = `turbo-stream-autofocus-${Ce()}`
        , i = s.querySelectorAll("turbo-stream")
        , r = _l(i)
        , n = null;
      if (r && (r.id ? n = r.id : n = t,
      r.id = n),
      e(),
      await _e(),
      (document.activeElement == null || document.activeElement == document.body) && n) {
          let l = document.getElementById(n);
          gi(l) && l.focus(),
          l && l.id == t && l.removeAttribute("id")
      }
  }
  async function Wl(s) {
      let[e,t] = await nl(s, ()=>document.activeElement)
        , i = e && e.id;
      if (i) {
          let r = document.getElementById(i);
          gi(r) && r != t && r.focus()
      }
  }
  function _l(s) {
      for (let e of s) {
          let t = tn(e.templateElement.content);
          if (t)
              return t
      }
      return null
  }
  var ai = class {
      sources = new Set;
      #e = !1;
      constructor(e) {
          this.delegate = e
      }
      start() {
          this.#e || (this.#e = !0,
          addEventListener("turbo:before-fetch-response", this.inspectFetchResponse, !1))
      }
      stop() {
          this.#e && (this.#e = !1,
          removeEventListener("turbo:before-fetch-response", this.inspectFetchResponse, !1))
      }
      connectStreamSource(e) {
          this.streamSourceIsConnected(e) || (this.sources.add(e),
          e.addEventListener("message", this.receiveMessageEvent, !1))
      }
      disconnectStreamSource(e) {
          this.streamSourceIsConnected(e) && (this.sources.delete(e),
          e.removeEventListener("message", this.receiveMessageEvent, !1))
      }
      streamSourceIsConnected(e) {
          return this.sources.has(e)
      }
      inspectFetchResponse = e=>{
          let t = Gl(e);
          t && jl(t) && (e.preventDefault(),
          this.receiveMessageResponse(t))
      }
      ;
      receiveMessageEvent = e=>{
          this.#e && typeof e.data == "string" && this.receiveMessageHTML(e.data)
      }
      ;
      async receiveMessageResponse(e) {
          let t = await e.responseHTML;
          t && this.receiveMessageHTML(t)
      }
      receiveMessageHTML(e) {
          this.delegate.receivedMessageFromStream(Le.wrap(e))
      }
  }
  ;
  function Gl(s) {
      let e = s.detail?.fetchResponse;
      if (e instanceof Xe)
          return e
  }
  function jl(s) {
      return (s.contentType ?? "").startsWith(Le.contentType)
  }
  var jt = class extends ut {
      static renderElement(e, t) {
          let {documentElement: i, body: r} = document;
          i.replaceChild(t, r)
      }
      async render() {
          this.replaceHeadAndBody(),
          this.activateScriptElements()
      }
      replaceHeadAndBody() {
          let {documentElement: e, head: t} = document;
          e.replaceChild(this.newHead, t),
          this.renderElement(this.currentElement, this.newElement)
      }
      activateScriptElements() {
          for (let e of this.scriptElements) {
              let t = e.parentNode;
              if (t) {
                  let i = lt(e);
                  t.replaceChild(i, e)
              }
          }
      }
      get newHead() {
          return this.newSnapshot.headSnapshot.element
      }
      get scriptElements() {
          return document.documentElement.querySelectorAll("script")
      }
  }
    , Xl = function() {
      let s = new Set
        , e = {
          morphStyle: "outerHTML",
          callbacks: {
              beforeNodeAdded: u,
              afterNodeAdded: u,
              beforeNodeMorphed: u,
              afterNodeMorphed: u,
              beforeNodeRemoved: u,
              afterNodeRemoved: u,
              beforeAttributeUpdated: u
          },
          head: {
              style: "merge",
              shouldPreserve: function(E) {
                  return E.getAttribute("im-preserve") === "true"
              },
              shouldReAppend: function(E) {
                  return E.getAttribute("im-re-append") === "true"
              },
              shouldRemove: u,
              afterHeadMorphed: u
          }
      };
      function t(E, v, p={}) {
          E instanceof Document && (E = E.documentElement),
          typeof v == "string" && (v = x(v));
          let T = k(v)
            , M = g(E, T, p);
          return i(E, T, M)
      }
      function i(E, v, p) {
          if (p.head.block) {
              let T = E.querySelector("head")
                , M = v.querySelector("head");
              if (T && M) {
                  let F = c(M, T, p);
                  Promise.all(F).then(function() {
                      i(E, v, Object.assign(p, {
                          head: {
                              block: !1,
                              ignore: !0
                          }
                      }))
                  });
                  return
              }
          }
          if (p.morphStyle === "innerHTML")
              return o(v, E, p),
              E.children;
          if (p.morphStyle === "outerHTML" || p.morphStyle == null) {
              let T = $(v, E, p)
                , M = T?.previousSibling
                , F = T?.nextSibling
                , V = n(E, T, p);
              return T ? R(M, V, F) : []
          } else
              throw "Do not understand how to morph style " + p.morphStyle
      }
      function r(E, v) {
          return v.ignoreActiveValue && E === document.activeElement && E !== document.body
      }
      function n(E, v, p) {
          if (!(p.ignoreActive && E === document.activeElement))
              return v == null ? p.callbacks.beforeNodeRemoved(E) === !1 ? E : (E.remove(),
              p.callbacks.afterNodeRemoved(E),
              null) : w(E, v) ? (p.callbacks.beforeNodeMorphed(E, v) === !1 || (E instanceof HTMLHeadElement && p.head.ignore || (E instanceof HTMLHeadElement && p.head.style !== "morph" ? c(v, E, p) : (a(v, E, p),
              r(E, p) || o(v, E, p))),
              p.callbacks.afterNodeMorphed(E, v)),
              E) : p.callbacks.beforeNodeRemoved(E) === !1 || p.callbacks.beforeNodeAdded(v) === !1 ? E : (E.parentElement.replaceChild(v, E),
              p.callbacks.afterNodeAdded(v),
              p.callbacks.afterNodeRemoved(E),
              v)
      }
      function o(E, v, p) {
          let T = E.firstChild, M = v.firstChild, F;
          for (; T; ) {
              if (F = T,
              T = F.nextSibling,
              M == null) {
                  if (p.callbacks.beforeNodeAdded(F) === !1)
                      return;
                  v.appendChild(F),
                  p.callbacks.afterNodeAdded(F),
                  C(p, F);
                  continue
              }
              if (y(F, M, p)) {
                  n(M, F, p),
                  M = M.nextSibling,
                  C(p, F);
                  continue
              }
              let V = S(E, v, F, M, p);
              if (V) {
                  M = f(M, V, p),
                  n(V, F, p),
                  C(p, F);
                  continue
              }
              let W = b(E, v, F, M, p);
              if (W) {
                  M = f(M, W, p),
                  n(W, F, p),
                  C(p, F);
                  continue
              }
              if (p.callbacks.beforeNodeAdded(F) === !1)
                  return;
              v.insertBefore(F, M),
              p.callbacks.afterNodeAdded(F),
              C(p, F)
          }
          for (; M !== null; ) {
              let V = M;
              M = M.nextSibling,
              O(V, p)
          }
      }
      function l(E, v, p, T) {
          return E === "value" && T.ignoreActiveValue && v === document.activeElement ? !0 : T.callbacks.beforeAttributeUpdated(E, v, p) === !1
      }
      function a(E, v, p) {
          let T = E.nodeType;
          if (T === 1) {
              let M = E.attributes
                , F = v.attributes;
              for (let V of M)
                  l(V.name, v, "update", p) || v.getAttribute(V.name) !== V.value && v.setAttribute(V.name, V.value);
              for (let V = F.length - 1; 0 <= V; V--) {
                  let W = F[V];
                  l(W.name, v, "remove", p) || E.hasAttribute(W.name) || v.removeAttribute(W.name)
              }
          }
          (T === 8 || T === 3) && v.nodeValue !== E.nodeValue && (v.nodeValue = E.nodeValue),
          r(v, p) || d(E, v, p)
      }
      function h(E, v, p, T) {
          if (E[p] !== v[p]) {
              let M = l(p, v, "update", T);
              M || (v[p] = E[p]),
              E[p] ? M || v.setAttribute(p, E[p]) : l(p, v, "remove", T) || v.removeAttribute(p)
          }
      }
      function d(E, v, p) {
          if (E instanceof HTMLInputElement && v instanceof HTMLInputElement && E.type !== "file") {
              let T = E.value
                , M = v.value;
              h(E, v, "checked", p),
              h(E, v, "disabled", p),
              E.hasAttribute("value") ? T !== M && (l("value", v, "update", p) || (v.setAttribute("value", T),
              v.value = T)) : l("value", v, "remove", p) || (v.value = "",
              v.removeAttribute("value"))
          } else if (E instanceof HTMLOptionElement)
              h(E, v, "selected", p);
          else if (E instanceof HTMLTextAreaElement && v instanceof HTMLTextAreaElement) {
              let T = E.value
                , M = v.value;
              if (l("value", v, "update", p))
                  return;
              T !== M && (v.value = T),
              v.firstChild && v.firstChild.nodeValue !== T && (v.firstChild.nodeValue = T)
          }
      }
      function c(E, v, p) {
          let T = []
            , M = []
            , F = []
            , V = []
            , W = p.head.style
            , Q = new Map;
          for (let z of E.children)
              Q.set(z.outerHTML, z);
          for (let z of v.children) {
              let j = Q.has(z.outerHTML)
                , re = p.head.shouldReAppend(z)
                , Ne = p.head.shouldPreserve(z);
              j || Ne ? re ? M.push(z) : (Q.delete(z.outerHTML),
              F.push(z)) : W === "append" ? re && (M.push(z),
              V.push(z)) : p.head.shouldRemove(z) !== !1 && M.push(z)
          }
          V.push(...Q.values());
          let N = [];
          for (let z of V) {
              let j = document.createRange().createContextualFragment(z.outerHTML).firstChild;
              if (p.callbacks.beforeNodeAdded(j) !== !1) {
                  if (j.href || j.src) {
                      let re = null
                        , Ne = new Promise(function(yt) {
                          re = yt
                      }
                      );
                      j.addEventListener("load", function() {
                          re()
                      }),
                      N.push(Ne)
                  }
                  v.appendChild(j),
                  p.callbacks.afterNodeAdded(j),
                  T.push(j)
              }
          }
          for (let z of M)
              p.callbacks.beforeNodeRemoved(z) !== !1 && (v.removeChild(z),
              p.callbacks.afterNodeRemoved(z));
          return p.head.afterHeadMorphed(v, {
              added: T,
              kept: F,
              removed: M
          }),
          N
      }
      function u() {}
      function m(E) {
          let v = {};
          return Object.assign(v, e),
          Object.assign(v, E),
          v.callbacks = {},
          Object.assign(v.callbacks, e.callbacks),
          Object.assign(v.callbacks, E.callbacks),
          v.head = {},
          Object.assign(v.head, e.head),
          Object.assign(v.head, E.head),
          v
      }
      function g(E, v, p) {
          return p = m(p),
          {
              target: E,
              newContent: v,
              config: p,
              morphStyle: p.morphStyle,
              ignoreActive: p.ignoreActive,
              ignoreActiveValue: p.ignoreActiveValue,
              idMap: B(E, v),
              deadIds: new Set,
              callbacks: p.callbacks,
              head: p.head
          }
      }
      function y(E, v, p) {
          return E == null || v == null ? !1 : E.nodeType === v.nodeType && E.tagName === v.tagName ? E.id !== "" && E.id === v.id ? !0 : A(p, E, v) > 0 : !1
      }
      function w(E, v) {
          return E == null || v == null ? !1 : E.nodeType === v.nodeType && E.tagName === v.tagName
      }
      function f(E, v, p) {
          for (; E !== v; ) {
              let T = E;
              E = E.nextSibling,
              O(T, p)
          }
          return C(p, v),
          v.nextSibling
      }
      function S(E, v, p, T, M) {
          let F = A(M, p, v)
            , V = null;
          if (F > 0) {
              let W = T
                , Q = 0;
              for (; W != null; ) {
                  if (y(p, W, M))
                      return W;
                  if (Q += A(M, W, E),
                  Q > F)
                      return null;
                  W = W.nextSibling
              }
          }
          return V
      }
      function b(E, v, p, T, M) {
          let F = T
            , V = p.nextSibling
            , W = 0;
          for (; F != null; ) {
              if (A(M, F, E) > 0)
                  return null;
              if (w(p, F))
                  return F;
              if (w(V, F) && (W++,
              V = V.nextSibling,
              W >= 2))
                  return null;
              F = F.nextSibling
          }
          return F
      }
      function x(E) {
          let v = new DOMParser
            , p = E.replace(/<svg(\s[^>]*>|>)([\s\S]*?)<\/svg>/gim, "");
          if (p.match(/<\/html>/) || p.match(/<\/head>/) || p.match(/<\/body>/)) {
              let T = v.parseFromString(E, "text/html");
              if (p.match(/<\/html>/))
                  return T.generatedByIdiomorph = !0,
                  T;
              {
                  let M = T.firstChild;
                  return M ? (M.generatedByIdiomorph = !0,
                  M) : null
              }
          } else {
              let M = v.parseFromString("<body><template>" + E + "</template></body>", "text/html").body.querySelector("template").content;
              return M.generatedByIdiomorph = !0,
              M
          }
      }
      function k(E) {
          if (E == null)
              return document.createElement("div");
          if (E.generatedByIdiomorph)
              return E;
          if (E instanceof Node) {
              let v = document.createElement("div");
              return v.append(E),
              v
          } else {
              let v = document.createElement("div");
              for (let p of [...E])
                  v.append(p);
              return v
          }
      }
      function R(E, v, p) {
          let T = []
            , M = [];
          for (; E != null; )
              T.push(E),
              E = E.previousSibling;
          for (; T.length > 0; ) {
              let F = T.pop();
              M.push(F),
              v.parentElement.insertBefore(F, v)
          }
          for (M.push(v); p != null; )
              T.push(p),
              M.push(p),
              p = p.nextSibling;
          for (; T.length > 0; )
              v.parentElement.insertBefore(T.pop(), v.nextSibling);
          return M
      }
      function $(E, v, p) {
          let T;
          T = E.firstChild;
          let M = T
            , F = 0;
          for (; T; ) {
              let V = I(T, v, p);
              V > F && (M = T,
              F = V),
              T = T.nextSibling
          }
          return M
      }
      function I(E, v, p) {
          return w(E, v) ? .5 + A(p, E, v) : 0
      }
      function O(E, v) {
          C(v, E),
          v.callbacks.beforeNodeRemoved(E) !== !1 && (E.remove(),
          v.callbacks.afterNodeRemoved(E))
      }
      function L(E, v) {
          return !E.deadIds.has(v)
      }
      function D(E, v, p) {
          return (E.idMap.get(p) || s).has(v)
      }
      function C(E, v) {
          let p = E.idMap.get(v) || s;
          for (let T of p)
              E.deadIds.add(T)
      }
      function A(E, v, p) {
          let T = E.idMap.get(v) || s
            , M = 0;
          for (let F of T)
              L(E, F) && D(E, F, p) && ++M;
          return M
      }
      function P(E, v) {
          let p = E.parentElement
            , T = E.querySelectorAll("[id]");
          for (let M of T) {
              let F = M;
              for (; F !== p && F != null; ) {
                  let V = v.get(F);
                  V == null && (V = new Set,
                  v.set(F, V)),
                  V.add(M.id),
                  F = F.parentElement
              }
          }
      }
      function B(E, v) {
          let p = new Map;
          return P(E, p),
          P(v, p),
          p
      }
      return {
          morph: t,
          defaults: e
      }
  }()
    , Be = class extends ut {
      static renderElement(e, t) {
          document.body && t instanceof HTMLBodyElement ? document.body.replaceWith(t) : document.documentElement.appendChild(t)
      }
      get shouldRender() {
          return this.newSnapshot.isVisitable && this.trackedElementsAreIdentical
      }
      get reloadReason() {
          if (!this.newSnapshot.isVisitable)
              return {
                  reason: "turbo_visit_control_is_reload"
              };
          if (!this.trackedElementsAreIdentical)
              return {
                  reason: "tracked_element_mismatch"
              }
      }
      async prepareToRender() {
          this.#e(),
          await this.mergeHead()
      }
      async render() {
          this.willRender && await this.replaceBody()
      }
      finishRendering() {
          super.finishRendering(),
          this.isPreview || this.focusFirstAutofocusableElement()
      }
      get currentHeadSnapshot() {
          return this.currentSnapshot.headSnapshot
      }
      get newHeadSnapshot() {
          return this.newSnapshot.headSnapshot
      }
      get newElement() {
          return this.newSnapshot.element
      }
      #e() {
          let {documentElement: e} = this.currentSnapshot
            , {lang: t} = this.newSnapshot;
          t ? e.setAttribute("lang", t) : e.removeAttribute("lang")
      }
      async mergeHead() {
          let e = this.mergeProvisionalElements()
            , t = this.copyNewHeadStylesheetElements();
          this.copyNewHeadScriptElements(),
          await e,
          await t,
          this.willRender && this.removeUnusedDynamicStylesheetElements()
      }
      async replaceBody() {
          await this.preservingPermanentElements(async()=>{
              this.activateNewBody(),
              await this.assignNewBody()
          }
          )
      }
      get trackedElementsAreIdentical() {
          return this.currentHeadSnapshot.trackedElementSignature == this.newHeadSnapshot.trackedElementSignature
      }
      async copyNewHeadStylesheetElements() {
          let e = [];
          for (let t of this.newHeadStylesheetElements)
              e.push(sl(t)),
              document.head.appendChild(t);
          await Promise.all(e)
      }
      copyNewHeadScriptElements() {
          for (let e of this.newHeadScriptElements)
              document.head.appendChild(lt(e))
      }
      removeUnusedDynamicStylesheetElements() {
          for (let e of this.unusedDynamicStylesheetElements)
              document.head.removeChild(e)
      }
      async mergeProvisionalElements() {
          let e = [...this.newHeadProvisionalElements];
          for (let t of this.currentHeadProvisionalElements)
              this.isCurrentElementInElementList(t, e) || document.head.removeChild(t);
          for (let t of e)
              document.head.appendChild(t)
      }
      isCurrentElementInElementList(e, t) {
          for (let[i,r] of t.entries()) {
              if (e.tagName == "TITLE") {
                  if (r.tagName != "TITLE")
                      continue;
                  if (e.innerHTML == r.innerHTML)
                      return t.splice(i, 1),
                      !0
              }
              if (r.isEqualNode(e))
                  return t.splice(i, 1),
                  !0
          }
          return !1
      }
      removeCurrentHeadProvisionalElements() {
          for (let e of this.currentHeadProvisionalElements)
              document.head.removeChild(e)
      }
      copyNewHeadProvisionalElements() {
          for (let e of this.newHeadProvisionalElements)
              document.head.appendChild(e)
      }
      activateNewBody() {
          document.adoptNode(this.newElement),
          this.activateNewBodyScriptElements()
      }
      activateNewBodyScriptElements() {
          for (let e of this.newBodyScriptElements) {
              let t = lt(e);
              e.replaceWith(t)
          }
      }
      async assignNewBody() {
          await this.renderElement(this.currentElement, this.newElement)
      }
      get unusedDynamicStylesheetElements() {
          return this.oldHeadStylesheetElements.filter(e=>e.getAttribute("data-turbo-track") === "dynamic")
      }
      get oldHeadStylesheetElements() {
          return this.currentHeadSnapshot.getStylesheetElementsNotInSnapshot(this.newHeadSnapshot)
      }
      get newHeadStylesheetElements() {
          return this.newHeadSnapshot.getStylesheetElementsNotInSnapshot(this.currentHeadSnapshot)
      }
      get newHeadScriptElements() {
          return this.newHeadSnapshot.getScriptElementsNotInSnapshot(this.currentHeadSnapshot)
      }
      get currentHeadProvisionalElements() {
          return this.currentHeadSnapshot.provisionalElements
      }
      get newHeadProvisionalElements() {
          return this.newHeadSnapshot.provisionalElements
      }
      get newBodyScriptElements() {
          return this.newElement.querySelectorAll("script")
      }
  }
    , oi = class extends Be {
      async render() {
          this.willRender && await this.#e()
      }
      get renderMethod() {
          return "morph"
      }
      async #e() {
          this.#t(this.currentElement, this.newElement),
          this.#o(),
          K("turbo:morph", {
              detail: {
                  currentElement: this.currentElement,
                  newElement: this.newElement
              }
          })
      }
      #t(e, t, i="outerHTML") {
          this.isMorphingTurboFrame = this.#l(e),
          Xl.morph(e, t, {
              morphStyle: i,
              callbacks: {
                  beforeNodeAdded: this.#s,
                  beforeNodeMorphed: this.#r,
                  beforeAttributeUpdated: this.#n,
                  beforeNodeRemoved: this.#a,
                  afterNodeMorphed: this.#i
              }
          })
      }
      #s = e=>!(e.id && e.hasAttribute("data-turbo-permanent") && document.getElementById(e.id));
      #r = (e,t)=>{
          if (e instanceof HTMLElement)
              return !e.hasAttribute("data-turbo-permanent") && (this.isMorphingTurboFrame || !this.#l(e)) ? !K("turbo:before-morph-element", {
                  cancelable: !0,
                  target: e,
                  detail: {
                      newElement: t
                  }
              }).defaultPrevented : !1
      }
      ;
      #n = (e,t,i)=>!K("turbo:before-morph-attribute", {
          cancelable: !0,
          target: t,
          detail: {
              attributeName: e,
              mutationType: i
          }
      }).defaultPrevented;
      #i = (e,t)=>{
          t instanceof HTMLElement && K("turbo:morph-element", {
              target: e,
              detail: {
                  newElement: t
              }
          })
      }
      ;
      #a = e=>this.#r(e);
      #o() {
          this.#h().forEach(e=>{
              this.#l(e) && (this.#d(e),
              e.reload())
          }
          )
      }
      #d(e) {
          e.addEventListener("turbo:before-frame-render", t=>{
              t.detail.render = this.#u
          }
          , {
              once: !0
          })
      }
      #u = (e,t)=>{
          K("turbo:before-frame-morph", {
              target: e,
              detail: {
                  currentElement: e,
                  newElement: t
              }
          }),
          this.#t(e, t.children, "innerHTML")
      }
      ;
      #l(e) {
          return e.src && e.refresh === "morph"
      }
      #h() {
          return Array.from(document.querySelectorAll("turbo-frame[src]")).filter(e=>!e.closest("[data-turbo-permanent]"))
      }
  }
    , li = class {
      keys = [];
      snapshots = {};
      constructor(e) {
          this.size = e
      }
      has(e) {
          return Bt(e)in this.snapshots
      }
      get(e) {
          if (this.has(e)) {
              let t = this.read(e);
              return this.touch(e),
              t
          }
      }
      put(e, t) {
          return this.write(e, t),
          this.touch(e),
          t
      }
      clear() {
          this.snapshots = {}
      }
      read(e) {
          return this.snapshots[Bt(e)]
      }
      write(e, t) {
          this.snapshots[Bt(e)] = t
      }
      touch(e) {
          let t = Bt(e)
            , i = this.keys.indexOf(t);
          i > -1 && this.keys.splice(i, 1),
          this.keys.unshift(t),
          this.trim()
      }
      trim() {
          for (let e of this.keys.splice(this.size))
              delete this.snapshots[e]
      }
  }
    , ci = class extends Ht {
      snapshotCache = new li(10);
      lastRenderedLocation = new URL(location.href);
      forceReloaded = !1;
      shouldTransitionTo(e) {
          return this.snapshot.prefersViewTransitions && e.prefersViewTransitions
      }
      renderPage(e, t=!1, i=!0, r) {
          let o = this.isPageRefresh(r) && this.snapshot.shouldMorphPage ? oi : Be
            , l = new o(this.snapshot,e,Be.renderElement,t,i);
          return l.shouldRender ? r?.changeHistory() : this.forceReloaded = !0,
          this.render(l)
      }
      renderError(e, t) {
          t?.changeHistory();
          let i = new jt(this.snapshot,e,jt.renderElement,!1);
          return this.render(i)
      }
      clearSnapshotCache() {
          this.snapshotCache.clear()
      }
      async cacheSnapshot(e=this.snapshot) {
          if (e.isCacheable) {
              this.delegate.viewWillCacheSnapshot();
              let {lastRenderedLocation: t} = this;
              await Kr();
              let i = e.clone();
              return this.snapshotCache.put(t, i),
              i
          }
      }
      getCachedSnapshotForLocation(e) {
          return this.snapshotCache.get(e)
      }
      isPageRefresh(e) {
          return !e || this.lastRenderedLocation.pathname === e.location.pathname && e.action === "replace"
      }
      shouldPreserveScrollPosition(e) {
          return this.isPageRefresh(e) && this.snapshot.shouldPreserveScrollPosition
      }
      get snapshot() {
          return le.fromElement(this.element)
      }
  }
    , di = class {
      selector = "a[data-turbo-preload]";
      constructor(e, t) {
          this.delegate = e,
          this.snapshotCache = t
      }
      start() {
          document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", this.#e) : this.preloadOnLoadLinksForView(document.body)
      }
      stop() {
          document.removeEventListener("DOMContentLoaded", this.#e)
      }
      preloadOnLoadLinksForView(e) {
          for (let t of e.querySelectorAll(this.selector))
              this.delegate.shouldPreloadLink(t) && this.preloadURL(t)
      }
      async preloadURL(e) {
          let t = new URL(e.href);
          if (this.snapshotCache.has(t))
              return;
          await new Ae(this,ne.get,t,new URLSearchParams,e).perform()
      }
      prepareRequest(e) {
          e.headers["X-Sec-Purpose"] = "prefetch"
      }
      async requestSucceededWithResponse(e, t) {
          try {
              let i = await t.responseHTML
                , r = le.fromHTMLString(i);
              this.snapshotCache.put(e.url, r)
          } catch {}
      }
      requestStarted(e) {}
      requestErrored(e) {}
      requestFinished(e) {}
      requestPreventedHandlingResponse(e, t) {}
      requestFailedWithResponse(e, t) {}
      #e = ()=>{
          this.preloadOnLoadLinksForView(document.body)
      }
  }
    , ui = class {
      constructor(e) {
          this.session = e
      }
      clear() {
          this.session.clearCache()
      }
      resetCacheControl() {
          this.#e("")
      }
      exemptPageFromCache() {
          this.#e("no-cache")
      }
      exemptPageFromPreview() {
          this.#e("no-preview")
      }
      #e(e) {
          rl("turbo-cache-control", e)
      }
  }
    , hi = class {
      navigator = new si(this);
      history = new ei(this);
      view = new ci(this,document.documentElement);
      adapter = new Zs(this);
      pageObserver = new ii(this);
      cacheObserver = new Js;
      linkPrefetchObserver = new ti(this,document);
      linkClickObserver = new Wt(this,window);
      formSubmitObserver = new dt(this,document);
      scrollObserver = new ri(this);
      streamObserver = new ai(this);
      formLinkClickObserver = new _t(this,document.documentElement);
      frameRedirector = new Qs(this,document.documentElement);
      streamMessageRenderer = new ni;
      cache = new ui(this);
      drive = !0;
      enabled = !0;
      progressBarDelay = 500;
      started = !1;
      formMode = "on";
      #e = 150;
      constructor(e) {
          this.recentRequests = e,
          this.preloader = new di(this,this.view.snapshotCache),
          this.debouncedRefresh = this.refresh,
          this.pageRefreshDebouncePeriod = this.pageRefreshDebouncePeriod
      }
      start() {
          this.started || (this.pageObserver.start(),
          this.cacheObserver.start(),
          this.linkPrefetchObserver.start(),
          this.formLinkClickObserver.start(),
          this.linkClickObserver.start(),
          this.formSubmitObserver.start(),
          this.scrollObserver.start(),
          this.streamObserver.start(),
          this.frameRedirector.start(),
          this.history.start(),
          this.preloader.start(),
          this.started = !0,
          this.enabled = !0)
      }
      disable() {
          this.enabled = !1
      }
      stop() {
          this.started && (this.pageObserver.stop(),
          this.cacheObserver.stop(),
          this.linkPrefetchObserver.stop(),
          this.formLinkClickObserver.stop(),
          this.linkClickObserver.stop(),
          this.formSubmitObserver.stop(),
          this.scrollObserver.stop(),
          this.streamObserver.stop(),
          this.frameRedirector.stop(),
          this.history.stop(),
          this.preloader.stop(),
          this.started = !1)
      }
      registerAdapter(e) {
          this.adapter = e
      }
      visit(e, t={}) {
          let i = t.frame ? document.getElementById(t.frame) : null;
          if (i instanceof he) {
              let r = t.action || Fe(i);
              i.delegate.proposeVisitIfNavigatedWithAction(i, r),
              i.src = e.toString()
          } else
              this.navigator.proposeVisit(ee(e), t)
      }
      refresh(e, t) {
          t && this.recentRequests.has(t) || this.visit(e, {
              action: "replace",
              shouldCacheSnapshot: !1
          })
      }
      connectStreamSource(e) {
          this.streamObserver.connectStreamSource(e)
      }
      disconnectStreamSource(e) {
          this.streamObserver.disconnectStreamSource(e)
      }
      renderStreamMessage(e) {
          this.streamMessageRenderer.render(Le.wrap(e))
      }
      clearCache() {
          this.view.clearSnapshotCache()
      }
      setProgressBarDelay(e) {
          this.progressBarDelay = e
      }
      setFormMode(e) {
          this.formMode = e
      }
      get location() {
          return this.history.location
      }
      get restorationIdentifier() {
          return this.history.restorationIdentifier
      }
      get pageRefreshDebouncePeriod() {
          return this.#e
      }
      set pageRefreshDebouncePeriod(e) {
          this.refresh = ll(this.debouncedRefresh.bind(this), e),
          this.#e = e
      }
      shouldPreloadLink(e) {
          let t = e.hasAttribute("data-turbo-method")
            , i = e.hasAttribute("data-turbo-stream")
            , r = e.getAttribute("data-turbo-frame")
            , n = r == "_top" ? null : document.getElementById(r) || Ge(e, "turbo-frame:not([disabled])");
          if (t || i || n instanceof he)
              return !1;
          {
              let o = new URL(e.href);
              return this.elementIsNavigatable(e) && xe(o, this.snapshot.rootLocation)
          }
      }
      historyPoppedToLocationWithRestorationIdentifierAndDirection(e, t, i) {
          this.enabled ? this.navigator.startVisit(e, t, {
              action: "restore",
              historyChanged: !0,
              direction: i
          }) : this.adapter.pageInvalidated({
              reason: "turbo_disabled"
          })
      }
      scrollPositionChanged(e) {
          this.history.updateRestorationData({
              scrollPosition: e
          })
      }
      willSubmitFormLinkToLocation(e, t) {
          return this.elementIsNavigatable(e) && xe(t, this.snapshot.rootLocation)
      }
      submittedFormLinkToLocation() {}
      canPrefetchRequestToLocation(e, t) {
          return this.elementIsNavigatable(e) && xe(t, this.snapshot.rootLocation)
      }
      willFollowLinkToLocation(e, t, i) {
          return this.elementIsNavigatable(e) && xe(t, this.snapshot.rootLocation) && this.applicationAllowsFollowingLinkToLocation(e, t, i)
      }
      followedLinkToLocation(e, t) {
          let i = this.getActionForLink(e)
            , r = e.hasAttribute("data-turbo-stream");
          this.visit(t.href, {
              action: i,
              acceptsStreamResponse: r
          })
      }
      allowsVisitingLocationWithAction(e, t) {
          return this.locationWithActionIsSamePage(e, t) || this.applicationAllowsVisitingLocation(e)
      }
      visitProposedToLocation(e, t) {
          Gr(e),
          this.adapter.visitProposedToLocation(e, t)
      }
      visitStarted(e) {
          e.acceptsStreamResponse || (Nt(document.documentElement),
          this.view.markVisitDirection(e.direction)),
          Gr(e.location),
          e.silent || this.notifyApplicationAfterVisitingLocation(e.location, e.action)
      }
      visitCompleted(e) {
          this.view.unmarkVisitDirection(),
          zt(document.documentElement),
          this.notifyApplicationAfterPageLoad(e.getTimingMetrics())
      }
      locationWithActionIsSamePage(e, t) {
          return this.navigator.locationWithActionIsSamePage(e, t)
      }
      visitScrolledToSamePageLocation(e, t) {
          this.notifyApplicationAfterVisitingSamePageLocation(e, t)
      }
      willSubmitForm(e, t) {
          let i = mi(e, t);
          return this.submissionIsNavigatable(e, t) && xe(ee(i), this.snapshot.rootLocation)
      }
      formSubmitted(e, t) {
          this.navigator.submitForm(e, t)
      }
      pageBecameInteractive() {
          this.view.lastRenderedLocation = this.location,
          this.notifyApplicationAfterPageLoad()
      }
      pageLoaded() {
          this.history.assumeControlOfScrollRestoration()
      }
      pageWillUnload() {
          this.history.relinquishControlOfScrollRestoration()
      }
      receivedMessageFromStream(e) {
          this.renderStreamMessage(e)
      }
      viewWillCacheSnapshot() {
          this.navigator.currentVisit?.silent || this.notifyApplicationBeforeCachingSnapshot()
      }
      allowsImmediateRender({element: e}, t) {
          let i = this.notifyApplicationBeforeRender(e, t)
            , {defaultPrevented: r, detail: {render: n}} = i;
          return this.view.renderer && n && (this.view.renderer.renderElement = n),
          !r
      }
      viewRenderedSnapshot(e, t, i) {
          this.view.lastRenderedLocation = this.history.location,
          this.notifyApplicationAfterRender(i)
      }
      preloadOnLoadLinksForView(e) {
          this.preloader.preloadOnLoadLinksForView(e)
      }
      viewInvalidated(e) {
          this.adapter.pageInvalidated(e)
      }
      frameLoaded(e) {
          this.notifyApplicationAfterFrameLoad(e)
      }
      frameRendered(e, t) {
          this.notifyApplicationAfterFrameRender(e, t)
      }
      applicationAllowsFollowingLinkToLocation(e, t, i) {
          return !this.notifyApplicationAfterClickingLinkToLocation(e, t, i).defaultPrevented
      }
      applicationAllowsVisitingLocation(e) {
          return !this.notifyApplicationBeforeVisitingLocation(e).defaultPrevented
      }
      notifyApplicationAfterClickingLinkToLocation(e, t, i) {
          return K("turbo:click", {
              target: e,
              detail: {
                  url: t.href,
                  originalEvent: i
              },
              cancelable: !0
          })
      }
      notifyApplicationBeforeVisitingLocation(e) {
          return K("turbo:before-visit", {
              detail: {
                  url: e.href
              },
              cancelable: !0
          })
      }
      notifyApplicationAfterVisitingLocation(e, t) {
          return K("turbo:visit", {
              detail: {
                  url: e.href,
                  action: t
              }
          })
      }
      notifyApplicationBeforeCachingSnapshot() {
          return K("turbo:before-cache")
      }
      notifyApplicationBeforeRender(e, t) {
          return K("turbo:before-render", {
              detail: {
                  newBody: e,
                  ...t
              },
              cancelable: !0
          })
      }
      notifyApplicationAfterRender(e) {
          return K("turbo:render", {
              detail: {
                  renderMethod: e
              }
          })
      }
      notifyApplicationAfterPageLoad(e={}) {
          return K("turbo:load", {
              detail: {
                  url: this.location.href,
                  timing: e
              }
          })
      }
      notifyApplicationAfterVisitingSamePageLocation(e, t) {
          dispatchEvent(new HashChangeEvent("hashchange",{
              oldURL: e.toString(),
              newURL: t.toString()
          }))
      }
      notifyApplicationAfterFrameLoad(e) {
          return K("turbo:frame-load", {
              target: e
          })
      }
      notifyApplicationAfterFrameRender(e, t) {
          return K("turbo:frame-render", {
              detail: {
                  fetchResponse: e
              },
              target: t,
              cancelable: !0
          })
      }
      submissionIsNavigatable(e, t) {
          if (this.formMode == "off")
              return !1;
          {
              let i = t ? this.elementIsNavigatable(t) : !0;
              return this.formMode == "optin" ? i && e.closest('[data-turbo="true"]') != null : i && this.elementIsNavigatable(e)
          }
      }
      elementIsNavigatable(e) {
          let t = Ge(e, "[data-turbo]")
            , i = Ge(e, "turbo-frame");
          return this.drive || i ? t ? t.getAttribute("data-turbo") != "false" : !0 : t ? t.getAttribute("data-turbo") == "true" : !1
      }
      getActionForLink(e) {
          return Fe(e) || "advance"
      }
      get snapshot() {
          return this.view.snapshot
      }
  }
  ;
  function Gr(s) {
      Object.defineProperties(s, Yl)
  }
  var Yl = {
      absoluteURL: {
          get() {
              return this.toString()
          }
      }
  }
    , U = new hi(rn)
    , {cache: cn, navigator: dn} = U;
  function bi() {
      U.start()
  }
  function un(s) {
      U.registerAdapter(s)
  }
  function hn(s, e) {
      U.visit(s, e)
  }
  function ht(s) {
      U.connectStreamSource(s)
  }
  function ft(s) {
      U.disconnectStreamSource(s)
  }
  function fn(s) {
      U.renderStreamMessage(s)
  }
  function pn() {
      console.warn("Please replace `Turbo.clearCache()` with `Turbo.cache.clear()`. The top-level function is deprecated and will be removed in a future version of Turbo.`"),
      U.clearCache()
  }
  function mn(s) {
      U.setProgressBarDelay(s)
  }
  function gn(s) {
      ct.confirmMethod = s
  }
  function vn(s) {
      U.setFormMode(s)
  }
  var Ul = Object.freeze({
      __proto__: null,
      navigator: dn,
      session: U,
      cache: cn,
      PageRenderer: Be,
      PageSnapshot: le,
      FrameRenderer: Ke,
      fetch: vi,
      start: bi,
      registerAdapter: un,
      visit: hn,
      connectStreamSource: ht,
      disconnectStreamSource: ft,
      renderStreamMessage: fn,
      clearCache: pn,
      setProgressBarDelay: mn,
      setConfirmMethod: gn,
      setFormMode: vn
  })
    , fi = class extends Error {
  }
    , pi = class {
      fetchResponseLoaded = e=>Promise.resolve();
      #e = null;
      #t = ()=>{}
      ;
      #s = !1;
      #r = !1;
      #n = new Set;
      action = null;
      constructor(e) {
          this.element = e,
          this.view = new js(this,this.element),
          this.appearanceObserver = new _s(this,this.element),
          this.formLinkClickObserver = new _t(this,this.element),
          this.linkInterceptor = new qt(this,this.element),
          this.restorationIdentifier = Ce(),
          this.formSubmitObserver = new dt(this,this.element)
      }
      connect() {
          this.#s || (this.#s = !0,
          this.loadingStyle == Re.lazy ? this.appearanceObserver.start() : this.#i(),
          this.formLinkClickObserver.start(),
          this.linkInterceptor.start(),
          this.formSubmitObserver.start())
      }
      disconnect() {
          this.#s && (this.#s = !1,
          this.appearanceObserver.stop(),
          this.formLinkClickObserver.stop(),
          this.linkInterceptor.stop(),
          this.formSubmitObserver.stop())
      }
      disabledChanged() {
          this.loadingStyle == Re.eager && this.#i()
      }
      sourceURLChanged() {
          this.#v("src") || (this.element.isConnected && (this.complete = !1),
          (this.loadingStyle == Re.eager || this.#r) && this.#i())
      }
      sourceURLReloaded() {
          let {src: e} = this.element;
          return this.element.removeAttribute("complete"),
          this.element.src = null,
          this.element.src = e,
          this.element.loaded
      }
      loadingStyleChanged() {
          this.loadingStyle == Re.lazy ? this.appearanceObserver.start() : (this.appearanceObserver.stop(),
          this.#i())
      }
      async #i() {
          this.enabled && this.isActive && !this.complete && this.sourceURL && (this.element.loaded = this.#o(ee(this.sourceURL)),
          this.appearanceObserver.stop(),
          await this.element.loaded,
          this.#r = !0)
      }
      async loadResponse(e) {
          (e.redirected || e.succeeded && e.isHTML) && (this.sourceURL = e.response.url);
          try {
              let t = await e.responseHTML;
              if (t) {
                  let i = Zr(t);
                  le.fromDocument(i).isVisitable ? await this.#a(e, i) : await this.#u(e)
              }
          } finally {
              this.fetchResponseLoaded = ()=>Promise.resolve()
          }
      }
      elementAppearedInViewport(e) {
          this.proposeVisitIfNavigatedWithAction(e, Fe(e)),
          this.#i()
      }
      willSubmitFormLinkToLocation(e) {
          return this.#f(e)
      }
      submittedFormLinkToLocation(e, t, i) {
          let r = this.#c(e);
          r && i.setAttribute("data-turbo-frame", r.id)
      }
      shouldInterceptLinkClick(e, t, i) {
          return this.#f(e)
      }
      linkClickIntercepted(e, t) {
          this.#d(e, t)
      }
      willSubmitForm(e, t) {
          return e.closest("turbo-frame") == this.element && this.#f(e, t)
      }
      formSubmitted(e, t) {
          this.formSubmission && this.formSubmission.stop(),
          this.formSubmission = new ct(this,e,t);
          let {fetchRequest: i} = this.formSubmission;
          this.prepareRequest(i),
          this.formSubmission.start()
      }
      prepareRequest(e) {
          e.headers["Turbo-Frame"] = this.id,
          this.currentNavigationElement?.hasAttribute("data-turbo-stream") && e.acceptResponseType(Le.contentType)
      }
      requestStarted(e) {
          Nt(this.element)
      }
      requestPreventedHandlingResponse(e, t) {
          this.#t()
      }
      async requestSucceededWithResponse(e, t) {
          await this.loadResponse(t),
          this.#t()
      }
      async requestFailedWithResponse(e, t) {
          await this.loadResponse(t),
          this.#t()
      }
      requestErrored(e, t) {
          console.error(t),
          this.#t()
      }
      requestFinished(e) {
          zt(this.element)
      }
      formSubmissionStarted({formElement: e}) {
          Nt(e, this.#c(e))
      }
      formSubmissionSucceededWithResponse(e, t) {
          let i = this.#c(e.formElement, e.submitter);
          i.delegate.proposeVisitIfNavigatedWithAction(i, Fe(e.submitter, e.formElement, i)),
          i.delegate.loadResponse(t),
          e.isSafe || U.clearCache()
      }
      formSubmissionFailedWithResponse(e, t) {
          this.element.delegate.loadResponse(t),
          U.clearCache()
      }
      formSubmissionErrored(e, t) {
          console.error(t)
      }
      formSubmissionFinished({formElement: e}) {
          zt(e, this.#c(e))
      }
      allowsImmediateRender({element: e}, t) {
          let i = K("turbo:before-frame-render", {
              target: this.element,
              detail: {
                  newFrame: e,
                  ...t
              },
              cancelable: !0
          })
            , {defaultPrevented: r, detail: {render: n}} = i;
          return this.view.renderer && n && (this.view.renderer.renderElement = n),
          !r
      }
      viewRenderedSnapshot(e, t, i) {}
      preloadOnLoadLinksForView(e) {
          U.preloadOnLoadLinksForView(e)
      }
      viewInvalidated() {}
      willRenderFrame(e, t) {
          this.previousFrameElement = e.cloneNode(!0)
      }
      visitCachedSnapshot = ({element: e})=>{
          let t = e.querySelector("#" + this.element.id);
          t && this.previousFrameElement && t.replaceChildren(...this.previousFrameElement.children),
          delete this.previousFrameElement
      }
      ;
      async #a(e, t) {
          let i = await this.extractForeignFrameElement(t.body);
          if (i) {
              let r = new Ue(i)
                , n = new Ke(this,this.view.snapshot,r,Ke.renderElement,!1,!1);
              this.view.renderPromise && await this.view.renderPromise,
              this.changeHistory(),
              await this.view.render(n),
              this.complete = !0,
              U.frameRendered(e, this.element),
              U.frameLoaded(this.element),
              await this.fetchResponseLoaded(e)
          } else
              this.#l(e) && this.#h(e)
      }
      async #o(e) {
          let t = new Ae(this,ne.get,e,new URLSearchParams,this.element);
          return this.#e?.cancel(),
          this.#e = t,
          new Promise(i=>{
              this.#t = ()=>{
                  this.#t = ()=>{}
                  ,
                  this.#e = null,
                  i()
              }
              ,
              t.perform()
          }
          )
      }
      #d(e, t, i) {
          let r = this.#c(e, i);
          r.delegate.proposeVisitIfNavigatedWithAction(r, Fe(i, e, r)),
          this.#w(e, ()=>{
              r.src = t
          }
          )
      }
      proposeVisitIfNavigatedWithAction(e, t=null) {
          if (this.action = t,
          this.action) {
              let i = le.fromElement(e).clone()
                , {visitCachedSnapshot: r} = e.delegate;
              e.delegate.fetchResponseLoaded = async n=>{
                  if (e.src) {
                      let {statusCode: o, redirected: l} = n
                        , a = await n.responseHTML
                        , d = {
                          response: {
                              statusCode: o,
                              redirected: l,
                              responseHTML: a
                          },
                          visitCachedSnapshot: r,
                          willRender: !1,
                          updateHistory: !1,
                          restorationIdentifier: this.restorationIdentifier,
                          snapshot: i
                      };
                      this.action && (d.action = this.action),
                      U.visit(e.src, d)
                  }
              }
          }
      }
      changeHistory() {
          if (this.action) {
              let e = Qr(this.action);
              U.history.update(e, ee(this.element.src || ""), this.restorationIdentifier)
          }
      }
      async #u(e) {
          console.warn(`The response (${e.statusCode}) from <turbo-frame id="${this.element.id}"> is performing a full page visit due to turbo-visit-control.`),
          await this.#p(e.response)
      }
      #l(e) {
          this.element.setAttribute("complete", "");
          let t = e.response
            , i = async(n,o)=>{
              n instanceof Response ? this.#p(n) : U.visit(n, o)
          }
          ;
          return !K("turbo:frame-missing", {
              target: this.element,
              detail: {
                  response: t,
                  visit: i
              },
              cancelable: !0
          }).defaultPrevented
      }
      #h(e) {
          this.view.missing(),
          this.#m(e)
      }
      #m(e) {
          let t = `The response (${e.statusCode}) did not contain the expected <turbo-frame id="${this.element.id}"> and will be ignored. To perform a full page visit instead, set turbo-visit-control to reload.`;
          throw new fi(t)
      }
      async #p(e) {
          let t = new Xe(e)
            , i = await t.responseHTML
            , {location: r, redirected: n, statusCode: o} = t;
          return U.visit(r, {
              response: {
                  redirected: n,
                  statusCode: o,
                  responseHTML: i
              }
          })
      }
      #c(e, t) {
          let i = Vt("data-turbo-frame", t, e) || this.element.getAttribute("target");
          return jr(i) ?? this.element
      }
      async extractForeignFrameElement(e) {
          let t, i = CSS.escape(this.id);
          try {
              if (t = Xr(e.querySelector(`turbo-frame#${i}`), this.sourceURL),
              t)
                  return t;
              if (t = Xr(e.querySelector(`turbo-frame[src][recurse~=${i}]`), this.sourceURL),
              t)
                  return await t.loaded,
                  await this.extractForeignFrameElement(t)
          } catch (r) {
              return console.error(r),
              new he
          }
          return null
      }
      #g(e, t) {
          let i = mi(e, t);
          return xe(ee(i), this.rootLocation)
      }
      #f(e, t) {
          let i = Vt("data-turbo-frame", t, e) || this.element.getAttribute("target");
          if (e instanceof HTMLFormElement && !this.#g(e, t) || !this.enabled || i == "_top")
              return !1;
          if (i) {
              let r = jr(i);
              if (r)
                  return !r.disabled
          }
          return !(!U.elementIsNavigatable(e) || t && !U.elementIsNavigatable(t))
      }
      get id() {
          return this.element.id
      }
      get enabled() {
          return !this.element.disabled
      }
      get sourceURL() {
          if (this.element.src)
              return this.element.src
      }
      set sourceURL(e) {
          this.#b("src", ()=>{
              this.element.src = e ?? null
          }
          )
      }
      get loadingStyle() {
          return this.element.loading
      }
      get isLoading() {
          return this.formSubmission !== void 0 || this.#t() !== void 0
      }
      get complete() {
          return this.element.hasAttribute("complete")
      }
      set complete(e) {
          e ? this.element.setAttribute("complete", "") : this.element.removeAttribute("complete")
      }
      get isActive() {
          return this.element.isActive && this.#s
      }
      get rootLocation() {
          let t = this.element.ownerDocument.querySelector('meta[name="turbo-root"]')?.content ?? "/";
          return ee(t)
      }
      #v(e) {
          return this.#n.has(e)
      }
      #b(e, t) {
          this.#n.add(e),
          t(),
          this.#n.delete(e)
      }
      #w(e, t) {
          this.currentNavigationElement = e,
          t(),
          delete this.currentNavigationElement
      }
  }
  ;
  function jr(s) {
      if (s != null) {
          let e = document.getElementById(s);
          if (e instanceof he)
              return e
      }
  }
  function Xr(s, e) {
      if (s) {
          let t = s.getAttribute("src");
          if (t != null && e != null && jo(t, e))
              throw new Error(`Matching <turbo-frame id="${s.id}"> element has a source URL which references itself`);
          if (s.ownerDocument !== document && (s = document.importNode(s, !0)),
          s instanceof he)
              return s.connectedCallback(),
              s.disconnectedCallback(),
              s
      }
  }
  var wi = {
      after() {
          this.targetElements.forEach(s=>s.parentElement?.insertBefore(this.templateContent, s.nextSibling))
      },
      append() {
          this.removeDuplicateTargetChildren(),
          this.targetElements.forEach(s=>s.append(this.templateContent))
      },
      before() {
          this.targetElements.forEach(s=>s.parentElement?.insertBefore(this.templateContent, s))
      },
      prepend() {
          this.removeDuplicateTargetChildren(),
          this.targetElements.forEach(s=>s.prepend(this.templateContent))
      },
      remove() {
          this.targetElements.forEach(s=>s.remove())
      },
      replace() {
          this.targetElements.forEach(s=>s.replaceWith(this.templateContent))
      },
      update() {
          this.targetElements.forEach(s=>{
              s.innerHTML = "",
              s.append(this.templateContent)
          }
          )
      },
      refresh() {
          U.refresh(this.baseURI, this.requestId)
      }
  }
    , Xt = class s extends HTMLElement {
      static async renderElement(e) {
          await e.performAction()
      }
      async connectedCallback() {
          try {
              await this.render()
          } catch (e) {
              console.error(e)
          } finally {
              this.disconnect()
          }
      }
      async render() {
          return this.renderPromise ??= (async()=>{
              let e = this.beforeRenderEvent;
              this.dispatchEvent(e) && (await _e(),
              await e.detail.render(this))
          }
          )()
      }
      disconnect() {
          try {
              this.remove()
          } catch {}
      }
      removeDuplicateTargetChildren() {
          this.duplicateChildren.forEach(e=>e.remove())
      }
      get duplicateChildren() {
          let e = this.targetElements.flatMap(i=>[...i.children]).filter(i=>!!i.id)
            , t = [...this.templateContent?.children || []].filter(i=>!!i.id).map(i=>i.id);
          return e.filter(i=>t.includes(i.id))
      }
      get performAction() {
          if (this.action) {
              let e = wi[this.action];
              if (e)
                  return e;
              this.#e("unknown action")
          }
          this.#e("action attribute is missing")
      }
      get targetElements() {
          if (this.target)
              return this.targetElementsById;
          if (this.targets)
              return this.targetElementsByQuery;
          this.#e("target or targets attribute is missing")
      }
      get templateContent() {
          return this.templateElement.content.cloneNode(!0)
      }
      get templateElement() {
          if (this.firstElementChild === null) {
              let e = this.ownerDocument.createElement("template");
              return this.appendChild(e),
              e
          } else if (this.firstElementChild instanceof HTMLTemplateElement)
              return this.firstElementChild;
          this.#e("first child element must be a <template> element")
      }
      get action() {
          return this.getAttribute("action")
      }
      get target() {
          return this.getAttribute("target")
      }
      get targets() {
          return this.getAttribute("targets")
      }
      get requestId() {
          return this.getAttribute("request-id")
      }
      #e(e) {
          throw new Error(`${this.description}: ${e}`)
      }
      get description() {
          return (this.outerHTML.match(/<[^>]+>/) ?? [])[0] ?? "<turbo-stream>"
      }
      get beforeRenderEvent() {
          return new CustomEvent("turbo:before-stream-render",{
              bubbles: !0,
              cancelable: !0,
              detail: {
                  newStream: this,
                  render: s.renderElement
              }
          })
      }
      get targetElementsById() {
          let e = this.ownerDocument?.getElementById(this.target);
          return e !== null ? [e] : []
      }
      get targetElementsByQuery() {
          let e = this.ownerDocument?.querySelectorAll(this.targets);
          return e.length !== 0 ? Array.prototype.slice.call(e) : []
      }
  }
    , Yt = class extends HTMLElement {
      streamSource = null;
      connectedCallback() {
          this.streamSource = this.src.match(/^ws{1,2}:/) ? new WebSocket(this.src) : new EventSource(this.src),
          ht(this.streamSource)
      }
      disconnectedCallback() {
          this.streamSource && (this.streamSource.close(),
          ft(this.streamSource))
      }
      get src() {
          return this.getAttribute("src") || ""
      }
  }
  ;
  he.delegateConstructor = pi;
  customElements.get("turbo-frame") === void 0 && customElements.define("turbo-frame", he);
  customElements.get("turbo-stream") === void 0 && customElements.define("turbo-stream", Xt);
  customElements.get("turbo-stream-source") === void 0 && customElements.define("turbo-stream-source", Yt);
  (()=>{
      let s = document.currentScript;
      if (s && !s.hasAttribute("data-turbo-suppress-warning"))
          for (s = s.parentElement; s; ) {
              if (s == document.body)
                  return console.warn(Jr`
      You are loading Turbo from a <script> element inside the <body> element. This is probably not what you meant to do!

      Load your application’s JavaScript bundle inside the <head> element instead. <script> elements in <body> are evaluated with each page change.

      For more information, see: https://turbo.hotwired.dev/handbook/building#working-with-script-elements

      ——
      Suppress this warning by adding a "data-turbo-suppress-warning" attribute to: %s
    `, s.outerHTML);
              s = s.parentElement
          }
  }
  )();
  window.Turbo = {
      ...Ul,
      StreamActions: wi
  };
  bi();
  var xn;
  async function Ql() {
      return xn || Tn(ec().then(Tn))
  }
  function Tn(s) {
      return xn = s
  }
  async function ec() {
      let {createConsumer: s} = await Promise.resolve().then(()=>(En(),
      Sn));
      return s()
  }
  async function Mn(s, e) {
      let {subscriptions: t} = await Ql();
      return t.create(s, e)
  }
  function wt(s) {
      return !s || typeof s != "object" || s instanceof Date || s instanceof RegExp ? s : Array.isArray(s) ? s.map(wt) : Object.keys(s).reduce(function(e, t) {
          var i = t[0].toLowerCase() + t.slice(1).replace(/([A-Z]+)/g, function(r, n) {
              return "_" + n.toLowerCase()
          });
          return e[i] = wt(s[t]),
          e
      }, {})
  }
  var Ii = class extends HTMLElement {
      async connectedCallback() {
          ht(this),
          this.subscription = await Mn(this.channel, {
              received: this.dispatchMessageEvent.bind(this),
              connected: this.subscriptionConnected.bind(this),
              disconnected: this.subscriptionDisconnected.bind(this)
          })
      }
      disconnectedCallback() {
          ft(this),
          this.subscription && this.subscription.unsubscribe()
      }
      dispatchMessageEvent(e) {
          let t = new MessageEvent("message",{
              data: e
          });
          return this.dispatchEvent(t)
      }
      subscriptionConnected() {
          this.setAttribute("connected", "")
      }
      subscriptionDisconnected() {
          this.removeAttribute("connected")
      }
      get channel() {
          let e = this.getAttribute("channel")
            , t = this.getAttribute("signed-stream-name");
          return {
              channel: e,
              signed_stream_name: t,
              ...wt({
                  ...this.dataset
              })
          }
      }
  }
  ;
  customElements.get("turbo-cable-stream-source") === void 0 && customElements.define("turbo-cable-stream-source", Ii);
  function Cn(s) {
      if (s.target instanceof HTMLFormElement) {
          let {target: e, detail: {fetchOptions: t}} = s;
          e.addEventListener("turbo:submit-start", ({detail: {formSubmission: {submitter: i}}})=>{
              let r = rc(t.body) ? t.body : new URLSearchParams
                , n = sc(i, r, e);
              /get/i.test(n) || (/post/i.test(n) ? r.delete("_method") : r.set("_method", n),
              t.method = "post")
          }
          , {
              once: !0
          })
      }
  }
  function sc(s, e, t) {
      let i = ic(s)
        , r = e.get("_method")
        , n = t.getAttribute("method") || "get";
      return typeof i == "string" ? i : typeof r == "string" ? r : n
  }
  function ic(s) {
      return s instanceof HTMLButtonElement || s instanceof HTMLInputElement ? s.name === "_method" ? s.value : s.hasAttribute("formmethod") ? s.formMethod : null : null
  }
  function rc(s) {
      return s instanceof FormData || s instanceof URLSearchParams
  }
  window.Turbo = yi;
  addEventListener("turbo:before-fetch-request", Cn);
}
)();
/*! Bundled license information:

@hotwired/turbo/dist/turbo.es2017-esm.js:
(*!
Turbo 8.0.4
Copyright © 2024 37signals LLC
 *)
*/
;