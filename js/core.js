// Passova shared code: Supabase client, sign-in guard, the page header and
// menu, Kuwait time and shifts, and the small windows used across pages.
(function () {
  "use strict";

  var config = window.PASSOVA_CONFIG;
  var demo = !!(window.PassovaDemo && window.PassovaDemo.active());
  var db = demo
    ? window.PassovaDemo.createClient()
    : window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  // ---------- Kuwait time and shifts ----------

  var TIME_ZONE = "Asia/Kuwait";
  var MINUTE_MS = 60 * 1000;
  var HOUR_MS = 60 * MINUTE_MS;
  var DAY_MS = 24 * HOUR_MS;
  // A shift runs 08:00 to 08:00 Kuwait time (UTC+3, no daylight saving).
  var SHIFT_OFFSET_MS = (3 - 8) * HOUR_MS;
  var TEAMS = 3;
  // The shift starting 12 October 2026 at 08:00 belongs to Team 1; the
  // on-call team then moves on each day: 1 > 2 > 3 > 1 ...
  var TEAM_ONE_SHIFT = Date.UTC(2026, 9, 12) / DAY_MS;

  var clockFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  var hmFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  var dateFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  function shiftNumber(ms) {
    return Math.floor((ms + SHIFT_OFFSET_MS) / DAY_MS);
  }

  function shiftStart(shift) {
    return shift * DAY_MS - SHIFT_OFFSET_MS;
  }

  function currentShift() {
    return shiftNumber(Date.now());
  }

  function currentShiftStartISO() {
    return new Date(shiftStart(currentShift())).toISOString();
  }

  function teamOnCall(shift) {
    return ((((shift - TEAM_ONE_SHIFT) % TEAMS) + TEAMS) % TEAMS) + 1;
  }

  function formatHM(value) {
    return value ? hmFormat.format(new Date(value)) : "";
  }

  // "HH:MM" typed into a time field, placed inside the current shift:
  // 08:00 onwards is today, earlier is the small hours of tomorrow.
  function dueFromTimeInput(value) {
    if (!value) return null;
    var hm = value.split(":");
    var minutes = Number(hm[0]) * 60 + Number(hm[1]);
    var sinceStart = ((minutes - 8 * 60) % (24 * 60) + 24 * 60) % (24 * 60);
    return new Date(shiftStart(currentShift()) + sinceStart * MINUTE_MS).toISOString();
  }

  function isDue(dueAt) {
    return !!dueAt && new Date(dueAt).getTime() <= Date.now();
  }

  // ---------- DOM helpers ----------

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "html") node.innerHTML = value;
        else node.setAttribute(key, value === true ? "" : value);
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function svg(paths, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + ((extra && extra.width) || 2) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>";
  }

  var ICON = {
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    home: svg('<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>'),
    endorse: svg('<path d="M9 3h6v4H9zM15 5h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3M9 12h6M9 16h4"/>'),
    admit: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6"/>'),
    profile: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    signout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
    bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
    clipboard: svg('<path d="M9 3h6v4H9zM15 5h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3M9 12h6M9 16h4"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>', { width: 2.4 }),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    edit: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
    info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  };

  // ---------- Toasts ----------

  function toast(title, body, kind) {
    var host = document.getElementById("toasts");
    if (!host) {
      host = el("div", { class: "toasts", id: "toasts", "aria-live": "polite" });
      document.body.appendChild(host);
    }
    var close = el("button", { type: "button", "aria-label": "Dismiss", text: "×" });
    var node = el("div", { class: "toast" + (kind ? " toast-" + kind : ""), role: "status" }, [
      el("div", { class: "toast-icon", html: kind === "ok" ? ICON.check : kind === "info" ? ICON.info : ICON.bell }),
      el("div", null, [el("strong", { text: title }), body ? el("span", { text: body }) : null]),
      close,
    ]);
    function remove() {
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    close.addEventListener("click", remove);
    window.setTimeout(remove, 9000);
    host.appendChild(node);
  }

  function errorMessage(error) {
    if (!error) return "Something went wrong. Please try again.";
    if (/already marked as seen/i.test(error.message || "")) return "This patient is already marked as seen.";
    if (/fetch/i.test(error.message || "")) return "Could not reach the server. Check the connection and try again.";
    return error.message || "Something went wrong. Please try again.";
  }

  // ---------- Doctors ----------

  var profiles = {};
  var me = null;

  function doctorName(id) {
    var p = profiles[id];
    if (!p || !p.full_name) return "A doctor";
    return /^dr\.?\s/i.test(p.full_name) ? p.full_name : "Dr. " + p.full_name;
  }

  function initials(name) {
    return name
      .replace(/^Dr\.?\s+/i, "")
      .split(/[\s-]+/)
      .filter(function (w) { return w && w.toLowerCase() !== "al"; })
      .slice(0, 2)
      .map(function (w) { return w.charAt(0).toUpperCase(); })
      .join("") || "?";
  }

  function loadProfiles() {
    return db.from("profiles").select("id, full_name, position, team, phone").then(function (res) {
      if (res.error) throw res.error;
      res.data.forEach(function (p) { profiles[p.id] = p; });
      return profiles;
    });
  }

  // ---------- Sign-in guard ----------

  // Resolves with { session, user, profile } or sends the visitor to sign in.
  function requireAuth() {
    return db.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (!session) {
        window.location.replace("index.html");
        return new Promise(function () {});
      }
      return loadProfiles().then(function () {
        me = { session: session, user: session.user, profile: profiles[session.user.id] || null };
        document.body.classList.remove("auth-pending");
        return me;
      });
    });
  }

  db.auth.onAuthStateChange(function (event) {
    if (event === "SIGNED_OUT" && !/index\.html$|signup\.html$|\/$/.test(window.location.pathname)) {
      window.location.replace("index.html");
    }
  });

  function signOut() {
    db.auth.signOut().finally(function () {
      window.location.replace("index.html");
    });
  }

  // ---------- Header and menu ----------

  var NAV = [
    { id: "home", href: "home.html", label: "Home", icon: ICON.home },
    { id: "endorsement", href: "endorsement.html", label: "Endorsement", icon: ICON.endorse },
    { id: "admissions", href: "admissions.html", label: "New admissions", icon: ICON.admit },
    { id: "profile", href: "profile.html", label: "My profile", icon: ICON.profile },
  ];

  function renderShell(active) {
    var scrim = el("div", { class: "scrim", id: "scrim" });
    var closeBtn = el("button", { class: "drawer-close", type: "button", "aria-label": "Close menu", html: ICON.close });
    var signOutLink = el("a", { href: "index.html", html: ICON.signout + "Sign out" });
    signOutLink.addEventListener("click", function (event) {
      event.preventDefault();
      signOut();
    });

    var drawer = el("aside", { class: "drawer", id: "drawer", "aria-label": "Main menu", "aria-hidden": "true" }, [
      el("div", { class: "drawer-head" }, [
        el("div", { class: "brand-lockup" }, [
          el("img", { src: "assets/passova-logo.svg", alt: "" }),
          el("span", { class: "brand-name", text: "PASSOVA" }),
        ]),
        closeBtn,
      ]),
      el("div", { class: "drawer-user", id: "drawer-user" }),
      el("nav", null, NAV.map(function (item) {
        return el("a", {
          href: item.href,
          "aria-current": item.id === active ? "page" : null,
          html: item.icon + item.label,
        });
      })),
      el("div", { class: "drawer-foot" }, [signOutLink]),
    ]);

    var menuBtn = el("button", {
      class: "menu-btn", type: "button", "aria-controls": "drawer", "aria-expanded": "false",
      html: ICON.menu + "<span>Menu</span>",
    });

    var header = el("header", { class: "topbar" }, [
      el("div", { class: "topbar-left" }, [
        menuBtn,
        el("a", { class: "app-mark", href: "home.html" }, [
          el("img", { src: "assets/passova-logo.svg", alt: "Passova" }),
          el("span", { text: "PASSOVA" }),
        ]),
      ]),
      el("a", { class: "hospital-logo", href: "home.html" }, [
        el("img", { src: "assets/jaber-alahmad-logo.png", alt: "Jaber Al-Ahmad Hospital" }),
      ]),
      el("div", { class: "topbar-right" }, [
        el("div", null, [
          el("div", { class: "clock-time", id: "clock-time", text: "--:--:--" }),
          el("div", { class: "clock-date", id: "clock-date", text: " " }),
        ]),
        el("div", { class: "oncall", title: "Changes to the next team every day at 08:00" }, [
          "Team on-call",
          el("span", { class: "oncall-team", id: "oncall-team", text: String(teamOnCall(currentShift())) }),
        ]),
      ]),
    ]);

    document.body.insertBefore(header, document.body.firstChild);
    if (demo) {
      var exit = el("button", { type: "button", class: "demo-exit", text: "Exit demo" });
      exit.addEventListener("click", signOut);
      document.body.insertBefore(el("div", { class: "demo-bar", role: "note" }, [
        el("span", { class: "demo-dot" }),
        el("span", null, [el("strong", { text: "Demo mode" }), " · sample patients; nothing is saved to the real database."]),
        exit,
      ]), document.body.firstChild);
    }
    document.body.insertBefore(drawer, document.body.firstChild);
    document.body.insertBefore(scrim, document.body.firstChild);

    function setMenu(open) {
      document.body.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      drawer.setAttribute("aria-hidden", String(!open));
      if (open) closeBtn.focus();
      else menuBtn.focus();
    }
    menuBtn.addEventListener("click", function () { setMenu(true); });
    closeBtn.addEventListener("click", function () { setMenu(false); });
    scrim.addEventListener("click", function () { setMenu(false); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.body.classList.contains("menu-open")) setMenu(false);
    });

    startClock();
  }

  function fillDrawerUser() {
    var host = document.getElementById("drawer-user");
    if (!host || !me) return;
    var name = doctorName(me.user.id);
    host.textContent = "";
    host.appendChild(el("span", { class: "drawer-avatar", text: initials(name) }));
    host.appendChild(el("div", null, [
      el("strong", { text: name }),
      el("span", { text: (me.profile && me.profile.position) || me.user.email }),
    ]));
  }

  // ---------- Clock and shift change ----------

  var shiftListeners = [];
  var minuteListeners = [];

  function onShiftChange(fn) { shiftListeners.push(fn); }
  function onMinute(fn) { minuteListeners.push(fn); }

  function startClock() {
    var timeNode = document.getElementById("clock-time");
    var dateNode = document.getElementById("clock-date");
    var teamNode = document.getElementById("oncall-team");
    var shift = currentShift();
    var lastMinute = -1;

    function tick() {
      var now = new Date();
      timeNode.textContent = clockFormat.format(now);
      dateNode.textContent = dateFormat.format(now);

      var nowShift = shiftNumber(now.getTime());
      teamNode.textContent = teamOnCall(nowShift);
      if (nowShift !== shift) {
        shift = nowShift;
        toast("New shift started", "Team " + teamOnCall(nowShift) + " is now on call. The lists start again empty.", "info");
        shiftListeners.forEach(function (fn) { fn(nowShift); });
      }

      var minute = Math.floor(now.getTime() / MINUTE_MS);
      if (minute !== lastMinute) {
        lastMinute = minute;
        minuteListeners.forEach(function (fn) { fn(); });
      }
    }

    tick();
    window.setInterval(tick, 1000);
  }

  // ---------- Live updates ----------

  // Calls `fn` (debounced) whenever any doctor changes patients, orders or
  // reminders.
  function onDataChange(fn) {
    var timer = null;
    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(fn, 250);
    }
    var channel = db.channel("passova-board");
    ["endorsements", "admissions", "orders", "reminders"].forEach(function (table) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: table }, schedule);
    });
    channel.subscribe();
    // Catch anything missed while the tab was in the background.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) schedule();
    });
  }

  // ---------- Status: chips, picker and "seen by" window ----------

  var STATUS = {
    not_seen: "Not seen",
    reassess: "For reassessment",
    seen: "Seen",
  };
  var STATUS_CLASS = { not_seen: "not-seen", reassess: "reassess", seen: "seen" };

  var pop = null;
  var popAnchor = null;

  function ensurePop() {
    if (pop) return pop;
    pop = el("div", { class: "seen-pop", role: "dialog", hidden: true });
    document.body.appendChild(pop);
    document.addEventListener("click", function (event) {
      if (popAnchor && !pop.contains(event.target) && !popAnchor.contains(event.target)) closePop();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && popAnchor) {
        var anchor = popAnchor;
        closePop();
        anchor.focus();
      }
    });
    window.addEventListener("scroll", placePop, { passive: true });
    window.addEventListener("resize", placePop);
    return pop;
  }

  function placePop() {
    if (!popAnchor || !pop) return;
    var r = popAnchor.getBoundingClientRect();
    var w = pop.offsetWidth;
    var h = pop.offsetHeight;
    var left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), window.innerWidth - w - 16);
    var top = r.bottom + 8;
    if (top + h > window.innerHeight - 8 && r.top - h - 8 > 8) top = r.top - h - 8;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function closePop() {
    if (!popAnchor) return;
    popAnchor.setAttribute("aria-expanded", "false");
    popAnchor = null;
    pop.hidden = true;
  }

  function openPop(anchor, children) {
    ensurePop();
    if (popAnchor === anchor) {
      closePop();
      return;
    }
    closePop();
    pop.textContent = "";
    children.forEach(function (c) { pop.appendChild(c); });
    popAnchor = anchor;
    anchor.setAttribute("aria-expanded", "true");
    pop.hidden = false;
    placePop();
  }

  function seenWindow(row) {
    var name = doctorName(row.seen_by);
    return [
      el("p", { class: "seen-pop-label", text: "Seen by" }),
      el("div", { class: "seen-pop-doctor" }, [
        el("span", { class: "seen-pop-avatar", text: initials(name) }),
        el("div", null, [
          el("p", { class: "seen-pop-name", text: name }),
          el("p", { class: "seen-pop-time", text: formatHM(row.seen_at) }),
        ]),
      ]),
    ];
  }

  function pickerWindow(table, row) {
    var list = el("div", { class: "status-options", role: "listbox", "aria-label": "Set status" });
    ["not_seen", "seen", "reassess"].forEach(function (value) {
      var option = el("button", {
        type: "button",
        class: "status-option" + (row.status === value ? " is-current" : ""),
        role: "option",
        "aria-selected": String(row.status === value),
      }, [
        el("span", { class: "status-chip " + STATUS_CLASS[value], text: STATUS[value] }),
        row.status === value ? el("span", { class: "status-option-check", html: ICON.check }) : null,
      ]);
      option.addEventListener("click", function () {
        if (value === row.status) {
          closePop();
          return;
        }
        option.disabled = true;
        db.from(table).update({ status: value }).eq("id", row.id).select().single().then(function (res) {
          closePop();
          if (res.error) {
            toast("Status not changed", errorMessage(res.error), "error");
            return;
          }
          Object.assign(row, res.data);
          document.dispatchEvent(new CustomEvent("passova:changed"));
        });
      });
      list.appendChild(option);
    });
    return [
      el("p", { class: "seen-pop-label is-neutral", text: "Set status" }),
      list,
      el("p", { class: "status-note", text: "Once marked as seen, the status cannot be changed." }),
    ];
  }

  // A status chip for a patient row in `table` ("endorsements" or "admissions").
  function statusButton(table, row) {
    var label = STATUS[row.status];
    var btn = el("button", {
      type: "button",
      class: "status-chip is-button " + STATUS_CLASS[row.status],
      "aria-haspopup": "dialog",
      "aria-expanded": "false",
      "aria-label": row.status === "seen"
        ? "Seen — show who saw " + row.patient_name
        : label + " — change status for " + row.patient_name,
      text: label,
    });
    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      openPop(btn, row.status === "seen" ? seenWindow(row) : pickerWindow(table, row));
    });
    return btn;
  }

  // An admitted patient's condition, as a chip that opens a window to change
  // it: Stable, Watcher or Unstable.
  var CONDITION = { stable: "Stable", watcher: "Watcher", unstable: "Unstable" };

  function conditionWindow(row) {
    var list = el("div", { class: "status-options", role: "listbox", "aria-label": "Set condition" });
    ["stable", "watcher", "unstable"].forEach(function (value) {
      var current = row.condition === value;
      var option = el("button", {
        type: "button",
        class: "status-option" + (current ? " is-current" : ""),
        role: "option",
        "aria-selected": String(current),
      }, [
        el("span", { class: "acuity acuity-" + value, text: CONDITION[value] }),
        current ? el("span", { class: "status-option-check", html: ICON.check }) : null,
      ]);
      option.addEventListener("click", function () {
        if (current) {
          closePop();
          return;
        }
        option.disabled = true;
        db.from("admissions").update({ condition: value }).eq("id", row.id).select().single().then(function (res) {
          closePop();
          if (res.error) {
            toast("Condition not changed", errorMessage(res.error), "error");
            return;
          }
          Object.assign(row, res.data);
          document.dispatchEvent(new CustomEvent("passova:changed"));
        });
      });
      list.appendChild(option);
    });
    return [el("p", { class: "seen-pop-label is-neutral", text: "Set condition" }), list];
  }

  function conditionButton(row) {
    var btn = el("button", {
      type: "button",
      class: "acuity is-button acuity-" + row.condition,
      "aria-haspopup": "dialog",
      "aria-expanded": "false",
      "aria-label": CONDITION[row.condition] + " — change condition for " + row.patient_name,
      text: CONDITION[row.condition],
    });
    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      openPop(btn, conditionWindow(row));
    });
    return btn;
  }

  // "58 years", "5 days", "1 month" — age with its unit (years if unset).
  function formatAge(row) {
    if (row.age === null || row.age === undefined) return "";
    var unit = row.age_unit || "years";
    return row.age + " " + (row.age === 1 ? unit.replace(/s$/, "") : unit);
  }

  function bedLabel(row) {
    return (row.ward + " " + row.room).trim();
  }

  // ---------- Two-step delete button ----------

  function confirmButton(label, onConfirm) {
    var btn = el("button", { type: "button", class: "btn-text danger", html: ICON.trash + "<span>" + label + "</span>" });
    var armed = false;
    var timer = null;
    btn.addEventListener("click", function () {
      if (!armed) {
        armed = true;
        btn.classList.add("is-armed");
        btn.querySelector("span").textContent = "Tap again to confirm";
        timer = window.setTimeout(function () {
          armed = false;
          btn.classList.remove("is-armed");
          btn.querySelector("span").textContent = label;
        }, 4000);
        return;
      }
      window.clearTimeout(timer);
      btn.disabled = true;
      onConfirm();
    });
    return btn;
  }

  // Edit and Remove, shown only on what the signed-in doctor entered.
  function ownerActions(onEdit, removeLabel, onRemove) {
    var editBtn = el("button", { type: "button", class: "btn-text", html: ICON.edit + "<span>Edit</span>" });
    editBtn.addEventListener("click", onEdit);
    return el("div", { class: "owner-actions" }, [editBtn, confirmButton(removeLabel, onRemove)]);
  }

  window.Passova = {
    db: db,
    el: el,
    ICON: ICON,
    toast: toast,
    errorMessage: errorMessage,
    requireAuth: requireAuth,
    renderShell: renderShell,
    fillDrawerUser: fillDrawerUser,
    signOut: signOut,
    isDemo: demo,
    loadProfiles: loadProfiles,
    profiles: profiles,
    me: function () { return me; },
    doctorName: doctorName,
    initials: initials,
    currentShift: currentShift,
    currentShiftStartISO: currentShiftStartISO,
    teamOnCall: teamOnCall,
    formatHM: formatHM,
    dueFromTimeInput: dueFromTimeInput,
    isDue: isDue,
    onShiftChange: onShiftChange,
    onMinute: onMinute,
    onDataChange: onDataChange,
    STATUS: STATUS,
    statusButton: statusButton,
    conditionButton: conditionButton,
    closePop: closePop,
    isPopOpen: function () { return !!popAnchor; },
    // True while a doctor is typing into a card (new order, synthesis), so
    // live updates can wait instead of wiping what they typed.
    isEditing: function () {
      var a = document.activeElement;
      return !!(a && a.closest && a.closest(".synthesis, .checklist-add") && (a.value || a.tagName === "TEXTAREA"));
    },
    bedLabel: bedLabel,
    formatAge: formatAge,
    confirmButton: confirmButton,
    ownerActions: ownerActions,
  };
})();
