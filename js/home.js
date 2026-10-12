// Passova home page.
// Everything lives in memory for this page view only: nothing is written to
// cookies, localStorage, sessionStorage or any server.
(function () {
  "use strict";

  var TIME_ZONE = "Asia/Kuwait";
  var DAY = 24 * 60;

  // ---------- Kuwait time ----------

  var timeFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  var dateFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Minutes since midnight in Kuwait.
  function kuwaitMinutes() {
    var parts = timeFormat.formatToParts(new Date());
    var h = 0;
    var m = 0;
    parts.forEach(function (p) {
      if (p.type === "hour") h = Number(p.value);
      if (p.type === "minute") m = Number(p.value);
    });
    return h * 60 + m;
  }

  function formatMinutes(total) {
    var h = Math.floor(total / 60);
    var m = total % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  // A time of day `offset` minutes from now, rounded to 5 minutes.
  function minutesFromNow(offset) {
    var t = kuwaitMinutes() + offset;
    t = Math.round(t / 5) * 5;
    return ((t % DAY) + DAY) % DAY;
  }

  // Due when the time has been reached within the last 12 hours, so a
  // reminder for 23:50 is not treated as due at 00:10 the day before.
  function isDue(due) {
    if (due === null) return false;
    var since = (kuwaitMinutes() - due + DAY) % DAY;
    return since < DAY / 2;
  }

  // ---------- Demo data ----------

  var STATUS = {
    "not-seen": "Not seen",
    reassess: "For reassessment",
    seen: "Seen",
  };

  var nextId = 1;
  function id(prefix) {
    return prefix + nextId++;
  }

  function order(label, due) {
    return { id: id("o"), label: label, due: due === undefined ? null : due };
  }

  var endorsements = [
    {
      id: id("p"), bed: "W1 R2", name: "Khalid A.", age: 64,
      diagnosis: "Community-acquired pneumonia", status: "reassess",
      orders: [order("Chest reassessment", minutesFromNow(20))],
    },
    {
      id: id("p"), bed: "W1 R7", name: "Fatma S.", age: 52,
      diagnosis: "DKA, resolving", status: "reassess",
      orders: [order("Labs", minutesFromNow(-10))],
    },
    {
      id: id("p"), bed: "W2 R4", name: "Abdullah M.", age: 71,
      diagnosis: "Heart failure exacerbation", status: "not-seen",
      orders: [order("Discharge")],
    },
    {
      id: id("p"), bed: "W2 R11", name: "Noura H.", age: 38,
      diagnosis: "Cellulitis, left leg", status: "seen",
      orders: [],
    },
  ];

  var admissions = [
    {
      id: id("p"), bed: "W1 R20", name: "Yousef B.", age: 58,
      diagnosis: "Chest pain, rule out ACS", status: "not-seen",
      orders: [order("Chest reassessment", minutesFromNow(45))],
    },
    {
      id: id("p"), bed: "W3 R5", name: "Mariam K.", age: 45,
      diagnosis: "Acute pancreatitis", status: "reassess",
      orders: [order("Labs", minutesFromNow(90))],
    },
    {
      id: id("p"), bed: "W3 R9", name: "Hamad F.", age: 33,
      diagnosis: "Asthma exacerbation", status: "seen",
      orders: [order("Discharge")],
    },
    {
      id: id("p"), bed: "W2 R14", name: "Dalal A.", age: 67,
      diagnosis: "UTI with acute kidney injury", status: "seen",
      orders: [],
    },
  ];

  var patients = endorsements.concat(admissions);

  function findPatient(patientId) {
    return patients.find(function (p) { return p.id === patientId; }) || null;
  }

  // Every pending order starts life as a reminder.
  var reminders = [];
  patients.forEach(function (p) {
    p.orders.forEach(function (o) {
      reminders.push({
        id: id("r"),
        text: o.label,
        patientId: p.id,
        orderId: o.id,
        due: o.due,
        alerted: false,
        isNew: false,
      });
    });
  });

  // ---------- DOM helpers ----------

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "class") node.className = attrs[key];
        else if (key === "text") node.textContent = attrs[key];
        else if (key === "html") node.innerHTML = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach(function (child) {
      if (child) node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  var ICON = {
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6v4H9zM15 5h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3M9 12h6M9 16h4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
  };

  // ---------- Reminders ----------

  var reminderList = document.getElementById("reminder-list");
  var remindersEmpty = document.getElementById("reminders-empty");
  var reminderCount = document.getElementById("reminder-count");

  function renderReminders() {
    reminderList.textContent = "";

    reminders.forEach(function (r) {
      var patient = r.patientId ? findPatient(r.patientId) : null;
      var due = isDue(r.due);

      var meta = el("div", { class: "reminder-meta" }, [
        patient ? el("span", { class: "tag tag-bed", text: patient.bed }) : null,
        patient ? el("span", { text: patient.name }) : null,
        el("span", {
          class: "tag " + (r.orderId ? "tag-order" : "tag-manual"),
          text: r.orderId ? "Pending order" : "Added manually",
        }),
        due
          ? el("span", { class: "tag tag-due", text: "Due " + formatMinutes(r.due) })
          : el("span", {
              class: "reminder-time",
              text: r.due === null ? "Any time" : "At " + formatMinutes(r.due),
            }),
      ]);

      var doneBtn = el("button", {
        class: "reminder-done",
        type: "button",
        "aria-label": "Mark “" + r.text + "” as done",
        html: ICON.check + "<span>Done</span>",
      });
      doneBtn.addEventListener("click", function () {
        completeReminder(r.id, item);
      });

      var item = el("li", { class: "reminder" + (due ? " is-due" : "") + (r.isNew ? " is-new" : "") }, [
        el("div", { class: "reminder-icon", html: r.orderId ? ICON.clipboard : ICON.bell }),
        el("div", null, [el("p", { class: "reminder-text", text: r.text }), meta]),
        doneBtn,
      ]);
      r.isNew = false;

      reminderList.appendChild(item);
    });

    reminderCount.textContent = reminders.length;
    remindersEmpty.hidden = reminders.length > 0;
    reminderList.hidden = reminders.length === 0;
  }

  // Finishing a reminder that came from a pending order also clears the order.
  function completeReminder(reminderId, item) {
    var reminder = reminders.find(function (r) { return r.id === reminderId; });
    if (!reminder) return;

    item.classList.add("is-leaving");
    window.setTimeout(function () {
      reminders = reminders.filter(function (r) { return r.id !== reminderId; });
      if (reminder.orderId) {
        var patient = findPatient(reminder.patientId);
        if (patient) {
          patient.orders = patient.orders.filter(function (o) { return o.id !== reminder.orderId; });
        }
        renderPatients();
      }
      renderReminders();
    }, 200);
  }

  // ---------- Patient rows ----------

  function orderChips(patient) {
    var wrap = el("div", { class: "row-orders" });
    if (patient.orders.length === 0) {
      wrap.appendChild(el("span", { class: "order-chip none", text: "None" }));
      return wrap;
    }
    patient.orders.forEach(function (o) {
      var due = isDue(o.due);
      var chip = el("span", { class: "order-chip" + (due ? " is-due" : "") }, [
        el("span", { text: o.label }),
        o.due === null ? null : el("span", { class: "order-time", text: formatMinutes(o.due) }),
      ]);
      chip.insertAdjacentHTML("afterbegin", o.due === null ? ICON.clipboard : ICON.clock);
      wrap.appendChild(chip);
    });
    return wrap;
  }

  function statusChip(status) {
    return el("span", { class: "status-chip " + status, text: STATUS[status] });
  }

  function renderPatients() {
    var endorseRows = document.getElementById("endorse-rows");
    endorseRows.textContent = "";
    endorsements.forEach(function (p) {
      endorseRows.appendChild(
        el("li", { class: "row" }, [
          el("div", { class: "row-main" }, [
            el("span", { class: "status-bar status-" + p.status, title: STATUS[p.status] }),
            el("span", { class: "bed", text: p.bed }),
            el("div", { class: "cell summary" }, [
              el("span", { class: "patient-name", text: p.name }),
              el("span", { class: "muted", text: p.age + " y · " + p.diagnosis }),
              statusChip(p.status),
            ]),
          ]),
          orderChips(p),
        ])
      );
    });

    var admitRows = document.getElementById("admit-rows");
    admitRows.textContent = "";
    admissions.forEach(function (p, i) {
      admitRows.appendChild(
        el("li", { class: "row" }, [
          el("div", { class: "row-main" }, [
            el("span", { class: "admit-index", text: String(i + 1) }),
            el("span", { class: "bed", text: p.bed }),
            el("div", { class: "cell cell-name" }, [
              el("span", { class: "cell-label", text: "Name" }),
              el("span", { class: "patient-name", text: p.name }),
            ]),
            el("div", { class: "cell cell-age" }, [
              el("span", { class: "cell-label", text: "Age" }),
              el("span", { text: String(p.age) }),
            ]),
            el("div", { class: "cell cell-dx" }, [
              el("span", { class: "cell-label", text: "Diagnosis" }),
              el("span", { class: "muted", text: p.diagnosis }),
            ]),
            el("div", { class: "cell cell-status" }, [
              el("span", { class: "cell-label", text: "Status" }),
              statusChip(p.status),
            ]),
          ]),
          orderChips(p),
        ])
      );
    });

    document.getElementById("admit-total").textContent = admissions.length;
  }

  // ---------- Toasts ----------

  var toasts = document.getElementById("toasts");

  function toast(title, body) {
    var close = el("button", { type: "button", "aria-label": "Dismiss", text: "×" });
    var node = el("div", { class: "toast", role: "status" }, [
      el("div", { class: "toast-icon", html: ICON.alert }),
      el("div", null, [el("strong", { text: title }), el("span", { text: body })]),
      close,
    ]);
    function remove() {
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    close.addEventListener("click", remove);
    window.setTimeout(remove, 9000);
    toasts.appendChild(node);
  }

  // Pop up any reminder whose time has just been reached.
  function checkDue() {
    var changed = false;
    reminders.forEach(function (r) {
      if (!r.alerted && isDue(r.due)) {
        r.alerted = true;
        changed = true;
        var patient = r.patientId ? findPatient(r.patientId) : null;
        toast(
          "Reminder due · " + formatMinutes(r.due),
          r.text + (patient ? " — " + patient.bed + ", " + patient.name : "")
        );
      }
    });
    if (changed) {
      renderReminders();
      renderPatients();
    }
  }

  // ---------- Add reminder dialog ----------

  var dialog = document.getElementById("reminder-dialog");
  var form = document.getElementById("reminder-form");
  var textInput = document.getElementById("reminder-text");
  var bedSelect = document.getElementById("reminder-bed");
  var timeInput = document.getElementById("reminder-time");

  bedSelect.appendChild(el("option", { value: "", text: "General (no patient)" }));
  patients.forEach(function (p) {
    bedSelect.appendChild(el("option", { value: p.id, text: p.bed + " — " + p.name }));
  });

  document.getElementById("add-reminder").addEventListener("click", function () {
    form.reset();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    textInput.focus();
  });

  document.getElementById("reminder-cancel").addEventListener("click", function () {
    dialog.close();
  });

  form.addEventListener("submit", function (event) {
    var text = textInput.value.trim();
    if (!text) {
      event.preventDefault();
      textInput.focus();
      return;
    }

    var due = null;
    if (timeInput.value) {
      var hm = timeInput.value.split(":");
      due = Number(hm[0]) * 60 + Number(hm[1]);
    }

    reminders.push({
      id: id("r"),
      text: text,
      patientId: bedSelect.value || null,
      orderId: null,
      due: due,
      // A time already passed should not toast straight away; it shows as due.
      alerted: isDue(due),
      isNew: true,
    });
    renderReminders();
  });

  // ---------- Menu ----------

  var menuOpen = document.getElementById("menu-open");
  var drawer = document.getElementById("drawer");

  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    menuOpen.setAttribute("aria-expanded", String(open));
    drawer.setAttribute("aria-hidden", String(!open));
    if (open) document.getElementById("menu-close").focus();
    else menuOpen.focus();
  }

  menuOpen.addEventListener("click", function () { setMenu(true); });
  document.getElementById("menu-close").addEventListener("click", function () { setMenu(false); });
  document.getElementById("scrim").addEventListener("click", function () { setMenu(false); });
  drawer.querySelectorAll("a[href^='#']").forEach(function (link) {
    link.addEventListener("click", function () { setMenu(false); });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && document.body.classList.contains("menu-open")) setMenu(false);
  });

  // ---------- Clock ----------

  var clockTime = document.getElementById("clock-time");
  var clockDate = document.getElementById("clock-date");
  var lastMinute = -1;

  function tick() {
    var now = new Date();
    clockTime.textContent = timeFormat.format(now);
    clockDate.textContent = dateFormat.format(now);

    var minute = kuwaitMinutes();
    if (minute !== lastMinute) {
      lastMinute = minute;
      checkDue();
    }
  }

  // ---------- Start ----------

  renderPatients();
  renderReminders();
  tick();
  window.setInterval(tick, 1000);
})();
