// Loading this shift's patients, orders and reminders, and drawing the bits
// that more than one page shows.
(function () {
  "use strict";

  var P = window.Passova;
  var el = P.el;

  // Everything created since 08:00 today (Kuwait); earlier shifts drop away.
  function loadBoard() {
    var since = P.currentShiftStartISO();
    return Promise.all([
      P.db.from("endorsements").select("*").gte("created_at", since).is("deleted_at", null).order("created_at"),
      P.db.from("admissions").select("*").gte("created_at", since).is("deleted_at", null).order("created_at"),
      P.db.from("orders").select("*").gte("created_at", since).order("created_at"),
      P.db.from("reminders").select("*").gte("created_at", since).order("created_at"),
      P.loadProfiles(),
    ]).then(function (results) {
      for (var i = 0; i < 4; i++) {
        if (results[i].error) throw results[i].error;
      }
      var board = {
        endorsements: results[0].data,
        admissions: results[1].data,
        orders: results[2].data,
        reminders: results[3].data,
      };
      board.ordersFor = function (kind, id) {
        var key = kind === "endorsement" ? "endorsement_id" : "admission_id";
        return board.orders.filter(function (o) { return o[key] === id; });
      };
      return board;
    });
  }

  // Pending (not done) orders as chips; "None" when there are none.
  function orderChips(orders) {
    var wrap = el("div", { class: "row-orders" });
    var pending = orders.filter(function (o) { return !o.done; });
    if (pending.length === 0) {
      wrap.appendChild(el("span", { class: "order-chip none", text: "None" }));
      return wrap;
    }
    pending.forEach(function (o) {
      var chip = el("span", { class: "order-chip" + (P.isDue(o.due_at) ? " is-due" : "") }, [
        el("span", { text: o.label }),
        o.due_at ? el("span", { class: "order-time", text: P.formatHM(o.due_at) }) : null,
      ]);
      chip.insertAdjacentHTML("afterbegin", o.due_at ? P.ICON.clock : P.ICON.clipboard);
      wrap.appendChild(chip);
    });
    return wrap;
  }

  var SEVERITY = { stable: "Stable", watcher: "Watcher", unstable: "Unstable" };
  var CONDITION = { stable: "Stable", unstable: "Unstable", watcher: "Watcher" };

  function severityChip(value) {
    return el("span", { class: "acuity acuity-" + value, text: SEVERITY[value] || value });
  }

  // An editable action list (I-PASS "A"): rows of task + optional time.
  function actionListEditor(host) {
    var list = el("ul", { class: "action-editor" });
    var add = el("button", { type: "button", class: "btn-text", html: P.ICON.plus + "<span>Add an order</span>" });

    function addRow(focus) {
      var label = el("input", {
        class: "input", type: "text", maxlength: "200",
        placeholder: "e.g. Chest reassessment, CBC and U&E, discharge summary",
        "aria-label": "Order",
      });
      var time = el("input", { class: "input action-time", type: "time", "aria-label": "Due time (optional)" });
      var remove = el("button", { type: "button", class: "icon-btn", "aria-label": "Remove this order", html: P.ICON.close });
      var row = el("li", null, [label, time, remove]);
      remove.addEventListener("click", function () {
        row.parentNode.removeChild(row);
        if (!list.children.length) addRow(false);
      });
      list.appendChild(row);
      if (focus) label.focus();
    }

    add.addEventListener("click", function () { addRow(true); });
    host.appendChild(list);
    host.appendChild(add);
    addRow(false);

    return {
      values: function () {
        return Array.prototype.map.call(list.children, function (row) {
          var inputs = row.querySelectorAll("input");
          return { label: inputs[0].value.trim(), due_at: P.dueFromTimeInput(inputs[1].value) };
        }).filter(function (o) { return o.label; });
      },
      reset: function () {
        list.textContent = "";
        addRow(false);
      },
    };
  }

  // A patient's orders as a checklist: tick one off with the green check on
  // its left, or add another below. `kind` is "endorsement" or "admission";
  // `onChange` runs after anything is saved.
  function orderChecklist(kind, patient, orders, onChange) {
    var wrap = el("div", { class: "checklist" });

    if (orders.length) {
      wrap.appendChild(el("ul", { class: "action-list" }, orders.map(function (o) {
        var tick = el("button", {
          type: "button",
          class: "action-tick" + (o.done ? " is-done" : ""),
          "aria-label": o.done ? o.label + " — done" : "Mark “" + o.label + "” as done",
          "aria-pressed": String(o.done),
          disabled: o.done,
          html: P.ICON.check,
        });
        tick.addEventListener("click", function () {
          tick.disabled = true;
          tick.classList.add("is-done");
          P.db.from("orders").update({ done: true }).eq("id", o.id).then(function (res) {
            if (res.error) {
              tick.disabled = false;
              tick.classList.remove("is-done");
              P.toast("Not marked as done", P.errorMessage(res.error), "error");
              return;
            }
            onChange();
          });
        });
        return el("li", { class: o.done ? "is-done" : (P.isDue(o.due_at) ? "is-due" : "") }, [
          tick,
          el("span", { class: "action-label", text: o.label }),
          o.due_at ? el("span", { class: "action-due", text: P.formatHM(o.due_at) }) : null,
          o.done ? el("span", { class: "action-by", text: P.doctorName(o.done_by) + " · " + P.formatHM(o.done_at) }) : null,
        ]);
      })));
    } else {
      wrap.appendChild(el("p", { class: "muted checklist-empty", text: "No orders yet." }));
    }

    var label = el("input", {
      class: "input", type: "text", maxlength: "200", placeholder: "Add an order",
      "aria-label": "New order for " + patient.patient_name,
    });
    var time = el("input", { class: "input", type: "time", "aria-label": "Due time (optional)" });
    var add = el("button", { type: "submit", class: "btn btn-primary btn-sm", text: "Add" });
    var form = el("form", { class: "checklist-add", novalidate: true }, [label, time, add]);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var text = label.value.trim();
      if (!text) {
        label.focus();
        return;
      }
      var row = { label: text, due_at: P.dueFromTimeInput(time.value) };
      row[kind === "endorsement" ? "endorsement_id" : "admission_id"] = patient.id;
      add.disabled = true;
      P.db.from("orders").insert(row).then(function (res) {
        add.disabled = false;
        if (res.error) {
          P.toast("Order not added", P.errorMessage(res.error), "error");
          return;
        }
        onChange();
      });
    });
    wrap.appendChild(form);
    return wrap;
  }

  P.orderChecklist = orderChecklist;
  P.loadBoard = loadBoard;
  P.orderChips = orderChips;
  P.severityChip = severityChip;
  P.SEVERITY = SEVERITY;
  P.CONDITION = CONDITION;
  P.actionListEditor = actionListEditor;
})();
