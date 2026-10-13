// Demo mode: lets someone look around Passova without an account.
//
// Turned on by the "Try the demo" button on the sign-in and sign-up pages.
// It swaps the Supabase client for a small stand-in that keeps sample data
// in this browser tab (sessionStorage) only: nothing reaches the real
// database, and closing the tab or leaving the demo throws it all away.
(function () {
  "use strict";

  var FLAG = "passova-demo";
  var STORE = "passova-demo-data";
  var ME = "d0000000-0000-0000-0000-000000000001";
  var OTHER = "d0000000-0000-0000-0000-000000000002";
  var THIRD = "d0000000-0000-0000-0000-000000000003";

  function read(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (e) { /* private mode: demo lasts one page */ }
  }
  function remove(key) {
    try { window.sessionStorage.removeItem(key); } catch (e) { /* nothing stored */ }
  }

  var memory = null;

  function seed() {
    var now = Date.now();
    // Keep the sample inside the current 08:00–08:00 Kuwait shift, or the
    // pages would filter it out just after 08:00.
    var offset = (3 - 8) * 3600000;
    var shiftStart = Math.floor((now + offset) / 86400000) * 86400000 - offset;
    var room = Math.max(now - shiftStart - 60000, 0);
    function ago(min) { return new Date(now - Math.min(min * 60000, room * min / 100)).toISOString(); }
    function ahead(min) { return new Date(now + min * 60000).toISOString(); }
    return {
      profiles: [
        { id: ME, full_name: "Demo Doctor", position: "Registrar", team: 1, phone: null },
        { id: OTHER, full_name: "Faisal Al-Mutawa", position: "Resident", team: 2, phone: null },
        { id: THIRD, full_name: "Reem Al-Saleh", position: "Specialist", team: 3, phone: null },
      ],
      endorsements: [
        {
          id: "de1", created_at: ago(95), created_by: OTHER, ward: "W1", room: "R2", team: 2,
          patient_name: "Khalid A.", age: 64, gender: "male", severity: "watcher",
          working_diagnosis: "Community-acquired pneumonia",
          summary: "64M, DM2, HTN. 3 days of fever and productive cough.\nCXR: right lower lobe consolidation. CRP 180.\nIV access: left forearm.",
          ongoing_assessment: "Improving, still on 2 L O2 via nasal cannula.",
          plan: "Continue IV ceftriaxone + azithromycin. Wean O2 as tolerated.",
          suggestions: "If SpO2 < 92% on 4 L, then ABG and call the registrar.",
          synthesis: "", status: "not_seen", status_by: null, status_at: null, seen_by: null, seen_at: null,
        },
        {
          id: "de2", created_at: ago(70), created_by: THIRD, ward: "W2", room: "R4", team: 3,
          patient_name: "Abdullah M.", age: 71, gender: "male", severity: "stable",
          working_diagnosis: "Heart failure exacerbation",
          summary: "71M, IHD, EF 30%. Admitted with fluid overload; 3 kg down since admission.",
          ongoing_assessment: "Euvolaemic on exam this afternoon.",
          plan: "Switch to oral furosemide tomorrow if U&E stable.",
          suggestions: "If urine output < 0.5 ml/kg/h for 4 h, then bladder scan and review.",
          synthesis: "", status: "reassess", status_by: OTHER, status_at: ago(30), seen_by: null, seen_at: null,
        },
        {
          id: "de3", created_at: ago(50), created_by: ME, ward: "W2", room: "R11", team: 1,
          patient_name: "Noura H.", age: 38, gender: "female", severity: "stable",
          working_diagnosis: "Cellulitis, left leg",
          summary: "38F, no PMH. Spreading erythema, margins marked at 14:00.",
          ongoing_assessment: "Afebrile, erythema within the marked margins.",
          plan: "IV flucloxacillin; step down to oral in 48 h.",
          suggestions: "", synthesis: "Uncomplicated cellulitis, responding. Review margins in the morning.",
          status: "seen", status_by: THIRD, status_at: ago(25), seen_by: THIRD, seen_at: ago(25),
        },
      ],
      admissions: [
        {
          id: "da1", created_at: ago(40), created_by: OTHER, ward: "W1", room: "R20", patient_name: "Yousef B.", age: 58,
          diagnosis: "Chest pain, rule out ACS", condition: "unstable",
          status: "not_seen", status_by: null, status_at: null, seen_by: null, seen_at: null,
        },
        {
          id: "da2", created_at: ago(25), created_by: THIRD, ward: "W3", room: "R5", patient_name: "Mariam K.", age: 45,
          diagnosis: "Acute pancreatitis", condition: "watcher",
          status: "reassess", status_by: THIRD, status_at: ago(10), seen_by: null, seen_at: null,
        },
        {
          id: "da3", created_at: ago(15), created_by: ME, ward: "W3", room: "R9", patient_name: "Hamad F.", age: 33,
          diagnosis: "Asthma exacerbation", condition: "stable",
          status: "seen", status_by: OTHER, status_at: ago(8), seen_by: OTHER, seen_at: ago(8),
        },
      ],
      orders: [
        { id: "do1", created_at: ago(95), created_by: OTHER, endorsement_id: "de1", admission_id: null, label: "Chest reassessment", due_at: ahead(2), done: false, done_by: null, done_at: null },
        { id: "do2", created_at: ago(95), created_by: OTHER, endorsement_id: "de1", admission_id: null, label: "Repeat CBC and CRP", due_at: ago(5), done: false, done_by: null, done_at: null },
        { id: "do3", created_at: ago(70), created_by: THIRD, endorsement_id: "de2", admission_id: null, label: "U&E in the morning", due_at: null, done: false, done_by: null, done_at: null },
        { id: "do4", created_at: ago(40), created_by: OTHER, endorsement_id: null, admission_id: "da1", label: "Troponin at 3 h", due_at: ahead(50), done: false, done_by: null, done_at: null },
        { id: "do5", created_at: ago(15), created_by: ME, endorsement_id: null, admission_id: "da3", label: "Discharge summary", due_at: null, done: false, done_by: null, done_at: null },
      ],
      reminders: [
        { id: "dr1", created_at: ago(20), created_by: THIRD, endorsement_id: null, admission_id: null, patient_label: "Salem Q., W4 R6", text: "Call radiology about his CT abdomen", due_at: null, done: false, done_by: null, done_at: null },
        { id: "dr2", created_at: ago(10), created_by: ME, endorsement_id: "de3", admission_id: null, patient_label: null, text: "Re-mark cellulitis margins", due_at: ahead(90), done: false, done_by: null, done_at: null },
      ],
    };
  }

  function load() {
    if (memory) return memory;
    var saved = read(STORE);
    try { memory = saved ? JSON.parse(saved) : null; } catch (e) { memory = null; }
    if (!memory) {
      memory = seed();
      save();
    }
    return memory;
  }

  function save() {
    write(STORE, JSON.stringify(memory));
  }

  var counter = 0;
  function newId() {
    counter++;
    return "dx" + Date.now().toString(36) + counter;
  }

  function copy(row) {
    return row ? JSON.parse(JSON.stringify(row)) : row;
  }

  var PATIENT_TABLES = { endorsements: true, admissions: true };
  var TASK_TABLES = { orders: true, reminders: true };

  // Mirrors what supabase-js queries do, for the handful of calls the pages make.
  function Query(table) {
    this.table = table;
    this.op = "select";
    this.filters = [];
    this.payload = null;
    this.one = false;
  }
  Query.prototype.select = function () { return this; };
  Query.prototype.order = function () { return this; };
  Query.prototype.single = function () { this.one = true; return this; };
  Query.prototype.gte = function (col, v) {
    this.filters.push(function (r) { return r[col] >= v; });
    return this;
  };
  Query.prototype.eq = function (col, v) {
    this.filters.push(function (r) { return r[col] === v; });
    return this;
  };
  Query.prototype.insert = function (p) { this.op = "insert"; this.payload = p; return this; };
  Query.prototype.update = function (p) { this.op = "update"; this.payload = p; return this; };
  Query.prototype.delete = function () { this.op = "delete"; return this; };

  Query.prototype.run = function () {
    var self = this;
    var db = load();
    var rows = db[self.table];
    function match(r) { return self.filters.every(function (f) { return f(r); }); }
    var stamp = new Date().toISOString();

    if (self.op === "select") {
      var found = rows.filter(match).map(copy);
      return { data: self.one ? found[0] || null : found, error: null };
    }

    if (self.op === "insert") {
      var list = Array.isArray(self.payload) ? self.payload : [self.payload];
      var made = list.map(function (p) {
        var r = Object.assign({}, p, { id: newId(), created_at: stamp, created_by: ME });
        if (PATIENT_TABLES[self.table]) {
          Object.assign(r, { status: "not_seen", status_by: null, status_at: null, seen_by: null, seen_at: null });
          if (self.table === "endorsements" && !r.synthesis) r.synthesis = "";
        }
        if (TASK_TABLES[self.table]) Object.assign(r, { done: false, done_by: null, done_at: null });
        rows.push(r);
        return copy(r);
      });
      save();
      return { data: self.one ? made[0] : made, error: null };
    }

    if (self.op === "update") {
      var hit = rows.filter(match);
      for (var i = 0; i < hit.length; i++) {
        var r = hit[i];
        var p = self.payload;
        if ("status" in p && p.status !== r.status) {
          if (r.status === "seen") return { data: null, error: { message: "This patient is already marked as seen." } };
          r.status = p.status;
          r.status_by = ME;
          r.status_at = stamp;
          if (r.status === "seen") {
            r.seen_by = ME;
            r.seen_at = stamp;
          }
        }
        if (p.done && !r.done) {
          r.done = true;
          r.done_by = ME;
          r.done_at = stamp;
        }
        Object.keys(p).forEach(function (k) {
          if (k !== "status" && k !== "done") r[k] = p[k];
        });
      }
      save();
      return { data: self.one ? copy(hit[0]) || null : hit.map(copy), error: null };
    }

    if (self.op === "delete") {
      var gone = rows.filter(match).map(function (r) { return r.id; });
      db[self.table] = rows.filter(function (r) { return !match(r); });
      if (PATIENT_TABLES[self.table]) {
        var key = self.table === "endorsements" ? "endorsement_id" : "admission_id";
        db.orders = db.orders.filter(function (o) { return gone.indexOf(o[key]) === -1; });
        db.reminders = db.reminders.filter(function (o) { return gone.indexOf(o[key]) === -1; });
      }
      save();
      return { data: null, error: null };
    }

    return { data: null, error: { message: "Not available in the demo." } };
  };

  Query.prototype.then = function (ok, bad) {
    var self = this;
    return new Promise(function (resolve) {
      window.setTimeout(function () { resolve(self.run()); }, 60);
    }).then(ok, bad);
  };

  function createClient() {
    var session = { user: { id: ME, email: "demo@passova.app" } };
    return {
      from: function (table) { return new Query(table); },
      auth: {
        getSession: function () { return Promise.resolve({ data: { session: session }, error: null }); },
        onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
        signOut: function () {
          stop();
          return Promise.resolve({ error: null });
        },
      },
      channel: function () {
        return { on: function () { return this; }, subscribe: function () { return this; } };
      },
    };
  }

  function start() {
    write(FLAG, "1");
    remove(STORE);
    memory = null;
  }

  function stop() {
    remove(FLAG);
    remove(STORE);
    memory = null;
  }

  window.PassovaDemo = {
    active: function () { return read(FLAG) === "1"; },
    start: start,
    stop: stop,
    createClient: createClient,
  };
})();
