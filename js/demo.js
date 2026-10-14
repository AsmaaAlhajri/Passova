// Demo mode: lets someone look around Passova without an account.
//
// Turned on by the "Try the demo" or "Try the admin demo" buttons on the
// sign-in and sign-up pages; the admin demo adds the admin-only pages.
// It swaps the Supabase client for a small stand-in that keeps sample data
// in this browser tab (sessionStorage) only: nothing reaches the real
// database, and closing the tab or leaving the demo throws it all away.
(function () {
  "use strict";

  var FLAG = "passova-demo";
  var STORE = "passova-demo-data-v3";
  var ME = "d0000000-0000-0000-0000-000000000001";
  var OTHER = "d0000000-0000-0000-0000-000000000002";
  var THIRD = "d0000000-0000-0000-0000-000000000003";
  var FOURTH = "d0000000-0000-0000-0000-000000000004";
  var FIFTH = "d0000000-0000-0000-0000-000000000005";
  var KUWAIT_OFFSET_MS = 3 * 3600000;

  // Start of the Kuwait calendar month `back` months ago, in ms.
  function monthStart(back) {
    var k = new Date(Date.now() + KUWAIT_OFFSET_MS);
    return Date.UTC(k.getUTCFullYear(), k.getUTCMonth() - back, 1) - KUWAIT_OFFSET_MS;
  }

  // A made-up history of who marked patients as seen, so My profile and
  // Top doctors have something to show.
  function seedSeenLog() {
    var log = [];
    var now = Date.now();
    function spread(doctor, count, from, to) {
      for (var i = 0; i < count; i++) {
        log.push({ doctor_id: doctor, seen_at: new Date(from + (to - from) * (i + 0.5) / count).toISOString() });
      }
    }
    var thisStart = monthStart(0);
    var lastStart = monthStart(1);
    spread(THIRD, 14, thisStart, now);
    spread(OTHER, 11, thisStart, now);
    spread(ME, 9, thisStart, now);
    spread(FOURTH, 7, thisStart, now);
    spread(FIFTH, 4, thisStart, now);
    spread(OTHER, 18, lastStart, thisStart);
    spread(FOURTH, 15, lastStart, thisStart);
    spread(THIRD, 12, lastStart, thisStart);
    spread(ME, 10, lastStart, thisStart);
    spread(FIFTH, 6, lastStart, thisStart);
    spread(ME, 21, monthStart(2), lastStart);
    return log;
  }

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

  function adminDemo() {
    return read(FLAG) === "admin";
  }

  // Past shifts for the admin's History page: older than today's shift, so
  // the regular pages never show them.
  function seedHistory(shiftStart) {
    var out = { endorsements: [], admissions: [], orders: [] };
    var who = [OTHER, THIRD, FOURTH, FIFTH, ME];
    var endorsed = [
      ["Fahad R.", 72, "male", "watcher", "Upper GI bleed", "W1", "R4"],
      ["Latifa S.", 55, "female", "stable", "Diabetic foot infection", "W2", "R8"],
      ["Bader K.", 81, "male", "unstable", "Septic shock, likely urinary source", "W3", "R2"],
      ["Hessa M.", 29, "female", "stable", "Pyelonephritis", "W1", "R12"],
      ["Talal A.", 63, "male", "watcher", "COPD exacerbation", "W2", "R3"],
      ["Shaikha N.", 47, "female", "stable", "Hypokalaemia, replacing", "W3", "R7"],
      ["Jassim H.", 68, "male", "watcher", "New atrial fibrillation", "W1", "R9"],
    ];
    var admitted = [
      ["Mona Q.", 34, "years", "Acute asthma", "stable", "W2", "R6"],
      ["Ali B.", 9, "days", "Neonatal jaundice", "stable", "W3", "R1"],
      ["Ibrahim F.", 77, "years", "Stroke, left MCA", "unstable", "W1", "R15"],
      ["Dana T.", 52, "years", "DKA", "watcher", "W2", "R10"],
      ["Waleed S.", 41, "years", "Cellulitis, right arm", "stable", "W3", "R11"],
      ["Nour A.", 6, "months", "Bronchiolitis", "watcher", "W1", "R3"],
      ["Saad M.", 59, "years", "Chest pain, NSTEMI", "unstable", "W2", "R14"],
    ];
    function at(daysBack, hour) {
      return new Date(shiftStart - daysBack * 86400000 + hour * 3600000).toISOString();
    }
    endorsed.forEach(function (e, i) {
      var days = 1 + i * 4;
      var by = who[i % who.length];
      var seenBy = who[(i + 2) % who.length];
      var id = "he" + i;
      out.endorsements.push({
        id: id, created_at: at(days, 9 + i), created_by: by, ward: e[5], room: e[6], team: (i % 3) + 1,
        patient_name: e[0], age: e[1], age_unit: "years", gender: e[2], severity: e[3], working_diagnosis: e[4],
        summary: e[1] + (e[2] === "male" ? "M" : "F") + ". Handed over at the evening meeting.",
        ongoing_assessment: "", plan: "Continue current management; review bloods in the morning.",
        suggestions: "If deteriorates, then call the on-call registrar.",
        synthesis: i % 2 ? "Agreed plan; will review at 22:00." : "",
        status: "seen", status_by: seenBy, status_at: at(days, 11 + i), seen_by: seenBy, seen_at: at(days, 11 + i),
        deleted_at: i === 3 ? at(days, 12 + i) : null,
      });
      out.orders.push({ id: "ho" + i, created_at: at(days, 9 + i), created_by: by, endorsement_id: id, admission_id: null,
        label: "Repeat bloods", due_at: null, done: true, done_by: seenBy, done_at: at(days, 13 + i) });
    });
    admitted.forEach(function (a, i) {
      var days = 2 + i * 4;
      var by = who[(i + 1) % who.length];
      var seenBy = who[(i + 3) % who.length];
      out.admissions.push({
        id: "ha" + i, created_at: at(days, 14 + i), created_by: by, ward: a[5], room: a[6],
        patient_name: a[0], age: a[1], age_unit: a[2], diagnosis: a[3], condition: a[4],
        status: i === 4 ? "reassess" : "seen", status_by: seenBy, status_at: at(days, 15 + i),
        seen_by: i === 4 ? null : seenBy, seen_at: i === 4 ? null : at(days, 15 + i),
        deleted_at: i === 5 ? at(days, 16 + i) : null,
      });
    });
    return out;
  }

  function seed() {
    var now = Date.now();
    // Keep the sample inside the current 08:00–08:00 Kuwait shift, or the
    // pages would filter it out just after 08:00.
    var offset = (3 - 8) * 3600000;
    var shiftStart = Math.floor((now + offset) / 86400000) * 86400000 - offset;
    var room = Math.max(now - shiftStart - 60000, 0);
    function ago(min) { return new Date(now - Math.min(min * 60000, room * min / 100)).toISOString(); }
    function ahead(min) { return new Date(now + min * 60000).toISOString(); }
    var past = seedHistory(shiftStart);
    var admin = adminDemo();
    var seeded = {
      profiles: [
        { id: ME, full_name: admin ? "Demo Admin" : "Demo Doctor", position: admin ? "Consultant" : "Registrar", team: 1, phone: null, is_admin: admin },
        { id: OTHER, full_name: "Faisal Al-Mutawa", position: "Resident", team: 2, phone: null },
        { id: THIRD, full_name: "Reem Al-Saleh", position: "Specialist", team: 3, phone: null },
        { id: FOURTH, full_name: "Sara Al-Enezi", position: "Senior Registrar", team: 2, phone: null },
        { id: FIFTH, full_name: "Mohammed Al-Kandari", position: "Resident", team: 3, phone: null },
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
      seen_log: seedSeenLog(),
      allowed_emails: [
        { email: "faisal.almutawa@hospital.kw", added_at: ago(90), added_by: ME, has_account: true },
        { email: "reem.alsaleh@hospital.kw", added_at: ago(80), added_by: ME, has_account: true },
        { email: "sara.alenezi@hospital.kw", added_at: ago(60), added_by: ME, has_account: true },
        { email: "new.resident@hospital.kw", added_at: ago(5), added_by: ME, has_account: false },
      ],
    };
    // Today's patients come first; past shifts go after them for History.
    seeded.endorsements = seeded.endorsements.concat(past.endorsements);
    seeded.admissions = seeded.admissions.concat(past.admissions);
    seeded.orders = seeded.orders.concat(past.orders);
    return seeded;
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
  Query.prototype.order = function (col, opts) {
    this.sortCol = col;
    this.sortDesc = !!(opts && opts.ascending === false);
    return this;
  };
  Query.prototype.lt = function (col, v) {
    this.filters.push(function (r) { return r[col] < v; });
    return this;
  };
  Query.prototype.is = function (col, v) {
    this.filters.push(function (r) { return v === null ? r[col] === null || r[col] === undefined : r[col] === v; });
    return this;
  };
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
      if (self.sortCol) {
        found.sort(function (a, b) {
          var x = String(a[self.sortCol]);
          var y = String(b[self.sortCol]);
          return self.sortDesc ? y.localeCompare(x) : x.localeCompare(y);
        });
      }
      return { data: self.one ? found[0] || null : found, error: null };
    }

    if (self.op === "insert") {
      var list = Array.isArray(self.payload) ? self.payload : [self.payload];
      var made = list.map(function (p) {
        if (self.table === "allowed_emails") {
          var a = { email: String(p.email).trim().toLowerCase(), added_at: stamp, added_by: ME, has_account: false };
          rows.unshift(a);
          return copy(a);
        }
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
            db.seen_log.push({ doctor_id: ME, seen_at: stamp });
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

  // The two database functions the pages call.
  function rpc(name, args) {
    var db = load();
    var data = null;
    if (name === "my_seen_counts") {
      var since = new Date(monthStart(0)).toISOString();
      var mine = db.seen_log.filter(function (l) { return l.doctor_id === ME; });
      data = [{
        this_month: mine.filter(function (l) { return l.seen_at >= since; }).length,
        all_time: mine.length,
      }];
    } else if (name === "remove_patient") {
      var table = args.p_kind === "endorsement" ? db.endorsements : db.admissions;
      var row = table.find(function (r) { return r.id === args.p_id && r.created_by === ME && !r.deleted_at; });
      if (!row) return Promise.resolve({ data: null, error: { message: "Only the doctor who entered this can remove it." } });
      row.deleted_at = new Date().toISOString();
      save();
    } else if (name === "admin_allowed_emails") {
      data = adminDemo() ? db.allowed_emails.map(copy) : [];
    } else if (name === "seen_leaderboard") {
      var tally = {};
      db.seen_log.forEach(function (l) {
        if (l.seen_at < args.month_start || l.seen_at >= args.month_end) return;
        var t = tally[l.doctor_id] || (tally[l.doctor_id] = { count: 0, last: "" });
        t.count++;
        if (l.seen_at > t.last) t.last = l.seen_at;
      });
      data = Object.keys(tally).map(function (id) {
        var p = db.profiles.find(function (x) { return x.id === id; }) || {};
        return { doctor_id: id, full_name: p.full_name || "", position: p.position || null, seen_count: tally[id].count, last: tally[id].last };
      }).sort(function (a, b) {
        return b.seen_count - a.seen_count || a.last.localeCompare(b.last);
      });
    } else {
      return Promise.resolve({ data: null, error: { message: "Not available in the demo." } });
    }
    return new Promise(function (resolve) {
      window.setTimeout(function () { resolve({ data: data, error: null }); }, 60);
    });
  }

  function createClient() {
    var session = { user: { id: ME, email: adminDemo() ? "admin@passova.app" : "demo@passova.app" } };
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
      rpc: rpc,
      channel: function () {
        return { on: function () { return this; }, subscribe: function () { return this; } };
      },
    };
  }

  function start(asAdmin) {
    write(FLAG, asAdmin ? "admin" : "1");
    remove(STORE);
    memory = null;
  }

  function stop() {
    remove(FLAG);
    remove(STORE);
    memory = null;
  }

  window.PassovaDemo = {
    active: function () { return read(FLAG) === "1" || read(FLAG) === "admin"; },
    isAdmin: adminDemo,
    start: start,
    stop: stop,
    createClient: createClient,
  };
})();
