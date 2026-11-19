// Medi60 · GitHub Pages database adapter
// The prototype was written for the Claude artifact database (window.claude.use('db')).
// On GitHub Pages that database does not exist, so this file provides the same small set of
// calls (doc, collection, set, delete, get, onSnapshot, acquire) on top of Google Firebase Firestore.
// The app code itself is unchanged. If Firebase is not configured, this file does nothing and the
// app falls back to same-browser sync (tabs on one computer).
(function () {
  if (window.claude && typeof window.claude.use === 'function') return; // running inside Claude: keep the real database

  var cfg = window.MEDI60_FIREBASE;
  var configured = cfg && cfg.apiKey && cfg.projectId && !/PASTE/i.test(cfg.apiKey + cfg.projectId);
  if (!configured || typeof firebase === 'undefined') {
    console.info('[medi60] Firebase not configured: using same-browser sync only. See README.md.');
    return;
  }

  var fs;
  try {
    firebase.initializeApp(cfg);
    fs = firebase.firestore();
  } catch (e) {
    console.error('[medi60] Firebase failed to start', e);
    return;
  }

  // Firestore error codes -> the codes the app already understands
  function mapErr(e) {
    var c = e && e.code;
    var m = { 'permission-denied': 'not_granted', 'resource-exhausted': 'quota_exceeded', 'unavailable': 'unavailable',
              'deadline-exceeded': 'unavailable', 'invalid-argument': 'invalid_argument' }[c];
    return { code: m || c || 'unknown', message: (e && e.message) || String(e) };
  }
  function rethrow(e) { throw mapErr(e); }

  // Each document is stored as one JSON string, so any app data shape is accepted by Firestore
  // (Firestore itself rejects nested arrays and undefined values).
  function wrapDoc(s) {
    var raw = s.exists ? s.get('j') : null;
    return {
      id: s.id,
      exists: raw != null,
      data: function () { return raw != null ? JSON.parse(raw) : undefined; },
      metadata: { fromCache: !!s.metadata.fromCache, hasPendingWrites: !!s.metadata.hasPendingWrites }
    };
  }
  function wrapQuery(q) {
    var docs = q.docs.map(wrapDoc).filter(function (d) { return d.exists; });
    return { docs: docs, size: docs.length, empty: !docs.length, docChanges: function () { return []; },
             metadata: { fromCache: !!q.metadata.fromCache, hasPendingWrites: !!q.metadata.hasPendingWrites } };
  }
  function pack(data) { return { j: JSON.stringify(data), t: firebase.firestore.FieldValue.serverTimestamp() }; }

  function docRef(path) {
    var ref = fs.doc(path);
    return {
      id: ref.id, path: path,
      get: function () { return ref.get().then(wrapDoc, rethrow); },
      set: function (data) { return ref.set(pack(data)).catch(rethrow); },
      update: function (data) {
        return fs.runTransaction(function (tx) {
          return tx.get(ref).then(function (s) {
            if (!s.exists) throw { code: 'invalid_argument', message: 'missing' };
            tx.set(ref, pack(Object.assign(JSON.parse(s.get('j')), data)));
          });
        }).catch(rethrow);
      },
      delete: function () { return ref.delete().catch(rethrow); },
      // Lease: only one holder at a time until it expires (used to pick the leader app)
      acquire: function (o) {
        var lref = fs.collection('_leases').doc(path.replace(/\//g, '__'));
        var ttl = Math.min(600000, Math.max(1000, (o && o.ttlMs) || 30000));
        return fs.runTransaction(function (tx) {
          return tx.get(lref).then(function (s) {
            var now = Date.now(), cur = s.exists ? s.data() : null;
            if (!cur || cur.exp < now || cur.holder === o.holder) {
              tx.set(lref, { holder: o.holder, exp: now + ttl });
              return { acquired: true, holder: o.holder, expiresAt: new Date(now + ttl).toISOString() };
            }
            return { acquired: false, expiresAt: new Date(cur.exp).toISOString() };
          });
        }).catch(rethrow);
      },
      onSnapshot: function (next, err) {
        return ref.onSnapshot(function (s) { next(wrapDoc(s)); }, function (e) { if (err) err(mapErr(e)); });
      },
      collection: function (sub) { return colRef(path + '/' + sub); }
    };
  }

  function colRef(path) {
    var ref = fs.collection(path);
    return {
      path: path,
      doc: function (id) { return docRef(path + '/' + (id || ref.doc().id)); },
      add: function (data) { var d = docRef(path + '/' + ref.doc().id); return d.set(data).then(function () { return d; }); },
      get: function () { return ref.get().then(wrapQuery, rethrow); },
      onSnapshot: function (next, err) {
        return ref.onSnapshot(function (q) { next(wrapQuery(q)); }, function (e) { if (err) err(mapErr(e)); });
      }
    };
  }

  var db = { doc: docRef, collection: colRef };
  window.claude = { use: function (name) { return Promise.resolve(name === 'db' ? db : null); } };
  console.info('[medi60] Firebase sync on: project ' + cfg.projectId);
})();
