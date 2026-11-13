
'use strict';

/* =========================================
   1. GLOBAL VARIABLES AND STORAGE
========================================= */

const $ = id => document.getElementById(id);

const storeKey = 'neurobridge-organizer-v1';

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(storeKey));

    return {
      appointments: Array.isArray(d?.appointments)
        ? d.appointments
        : [],

      medications: Array.isArray(d?.medications)
        ? d.medications
        : []
    };

  } catch {
    return {
      appointments: [],
      medications: []
    };
  }
}

let data = load();

let remindersEnabled = false;

let lastAlerted = new Set();


/* =========================================
   2. SAVE DATA
========================================= */

function save() {
  try {
    localStorage.setItem(
      storeKey,
      JSON.stringify(data)
    );

  } catch {
    toast(
      'Unable to save in this browser. Check storage settings.'
    );
  }
}


/* =========================================
   3. NOTIFICATION MESSAGES
========================================= */

function toast(msg) {
  const e = $('toast');

  e.textContent = msg;
  e.classList.add('show');

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    e.classList.remove('show');
  }, 5000);
}


/* =========================================
   4. DATE AND TIME FORMATTING
========================================= */

function localDate(d) {
  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function formatDate(value) {
  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? 'Invalid date'
    : d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
}

function formatTime(time) {
  const [h, m] = time.split(':').map(Number);

  const d = new Date();

  d.setHours(h, m, 0, 0);

  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}


/* =========================================
   5. CREATE HTML ELEMENTS
========================================= */

function make(tag, txt, cls) {
  const e = document.createElement(tag);

  if (txt !== undefined) {
    e.textContent = txt;
  }

  if (cls) {
    e.className = cls;
  }

  return e;
}


/* =========================================
   6. CREATE SCHEDULE ENTRIES
========================================= */

function entry(title, sub, note, remove) {
  const box = make('div', undefined, 'entry');

  box.append(
    make('strong', title),
    make('small', sub)
  );

  if (note) {
    box.append(make('p', note));
  }

  if (remove) {
    const b = make('button', 'Remove');

    b.type = 'button';

    b.addEventListener('click', remove);

    box.append(b);
  }

  return box;
}


/* =========================================
   7. MEDICATION SCHEDULE HELPERS
========================================= */

function medToday(m, day) {
  return (
    m.frequency === 'daily' ||
    (m.frequency === 'once' && m.date === day)
  );
}


/* =========================================
   8. GET TODAY'S SCHEDULE
========================================= */

function getTodayItems() {
  const now = new Date();

  const day = localDate(now);

  const items = [];

  // Today's appointments
  for (const a of data.appointments) {
    if (a.when.slice(0, 10) === day) {
      items.push({
        when: new Date(a.when),
        title: `Appointment: ${a.name}`
      });
    }
  }

  // Today's medication times
  for (const m of data.medications) {
    if (medToday(m, day)) {
      items.push({
        when: new Date(`${day}T${m.time}`),
        title: `Medication time: ${m.name}`
      });
    }
  }

  return items.sort((a, b) => a.when - b.when);
}


/* =========================================
   9. RENDER DASHBOARD AND SCHEDULES
========================================= */

function render() {
  const now = new Date();

  // Upcoming appointments
  const upcoming = data.appointments
    .filter(a => new Date(a.when) >= now)
    .sort(
      (a, b) =>
        new Date(a.when) - new Date(b.when)
    );

  // Dashboard counts
  $('apptCount').textContent = upcoming.length;

  $('medCount').textContent = data.medications.filter(
    m => medToday(m, localDate(now))
  ).length;


  /* -----------------------------------------
     UPCOMING APPOINTMENTS
  ----------------------------------------- */

  const al = $('appointmentList');

  al.replaceChildren();

  if (!upcoming.length) {
    al.append(
      make(
        'p',
        'No upcoming appointments.',
        'muted'
      )
    );
  }

  for (const a of upcoming) {
    al.append(
      entry(
        a.name,

        `${formatDate(a.when)}${
          a.place ? ' · ' + a.place : ''
        }`,

        a.notes,

        () => {
          data.appointments = data.appointments.filter(
            x => x.id !== a.id
          );

          save();
          render();
        }
      )
    );
  }


  /* -----------------------------------------
     SAVED MEDICATION TIMES
  ----------------------------------------- */

  const ml = $('medicationList');

  ml.replaceChildren();

  if (!data.medications.length) {
    ml.append(
      make(
        'p',
        'No medication times saved.',
        'muted'
      )
    );
  }

  const sortedMedications = [...data.medications].sort(
    (a, b) => a.time.localeCompare(b.time)
  );

  for (const m of sortedMedications) {
    ml.append(
      entry(
        m.name,

        `${formatTime(m.time)} · ${
          m.frequency === 'daily'
            ? 'Every day'
            : m.date
        }`,

        m.notes,

        () => {
          data.medications = data.medications.filter(
            x => x.id !== m.id
          );

          save();
          render();
        }
      )
    );
  }


  /* -----------------------------------------
     TODAY AT A GLANCE
  ----------------------------------------- */

  const tl = $('todayList');

  tl.replaceChildren();

  const items = getTodayItems();

  if (!items.length) {
    tl.append(
      make(
        'p',
        'Nothing scheduled today.',
        'muted'
      )
    );
  }

  for (const item of items) {
    tl.append(
      entry(
        item.title,

        item.when.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit'
        })
      )
    );
  }


  /* -----------------------------------------
     NEXT SCHEDULED ITEM
  ----------------------------------------- */

  const future = [
    ...upcoming.map(a => ({
      when: new Date(a.when),
      title: a.name
    })),

    ...data.medications.flatMap(m => {
      const next = new Date();

      const [h, min] = m.time
        .split(':')
        .map(Number);

      next.setHours(h, min, 0, 0);

      if (m.frequency === 'once') {
        const d = new Date(
          `${m.date}T${m.time}`
        );

        return d >= now
          ? [{ when: d, title: m.name }]
          : [];
      }

      if (next < now) {
        next.setDate(next.getDate() + 1);
      }

      return [{
        when: next,
        title: m.name
      }];
    })

  ].sort((a, b) => a.when - b.when);

  $('nextItem').textContent = future.length
    ? `${future[0].title} · ${formatDate(future[0].when)}`
    : 'Nothing scheduled';
}


/* =========================================
   10. ADD APPOINTMENTS
========================================= */

$('appointmentForm').addEventListener(
  'submit',
  e => {
    e.preventDefault();

    const when = $('apptWhen').value;

    if (
      !when ||
      Number.isNaN(new Date(when).getTime())
    ) {
      return toast(
        'Enter a valid appointment date.'
      );
    }

    data.appointments.push({
      id: crypto.randomUUID?.() || String(Date.now()),

      name: $('apptName').value.trim(),

      when: when,

      place: $('apptPlace').value.trim(),

      notes: $('apptNotes').value.trim()
    });

    save();

    e.target.reset();

    render();

    toast(
      'Appointment saved in this browser.'
    );
  }
);


/* =========================================
   11. MEDICATION FREQUENCY SELECTION
========================================= */

$('medFrequency').addEventListener(
  'change',
  () => {
    $('medDateWrap').hidden =
      $('medFrequency').value !== 'once';

    $('medDate').required =
      $('medFrequency').value === 'once';
  }
);


/* =========================================
   12. ADD MEDICATION TIMES
========================================= */

$('medicationForm').addEventListener(
  'submit',
  e => {
    e.preventDefault();

    const frequency = $('medFrequency').value;

    const date = $('medDate').value;

    if (frequency === 'once' && !date) {
      return toast(
        'Choose the instructed date.'
      );
    }

    data.medications.push({
      id: crypto.randomUUID?.() || String(Date.now()),

      name: $('medName').value.trim(),

      time: $('medTime').value,

      frequency: frequency,

      date: frequency === 'once'
        ? date
        : null,

      notes: $('medNotes').value.trim()
    });

    save();

    e.target.reset();

    $('medDateWrap').hidden = true;

    $('medDate').required = false;

    render();

    toast(
      'Medication time saved. Keep using your regular alarms.'
    );
  }
);


/* =========================================
   13. PRINT AND DELETE SCHEDULES
========================================= */

$('print').addEventListener(
  'click',
  () => window.print()
);

$('clearData').addEventListener(
  'click',
  () => {
    const confirmed = confirm(
      'Delete all appointments and medication times saved by NeuroBridge in this browser? This cannot be undone.'
    );

    if (confirmed) {
      data = {
        appointments: [],
        medications: []
      };

      save();
      render();

      toast('Saved schedules deleted.');
    }
  }
);


/* =========================================
   14. ACCESSIBILITY CONTROLS
========================================= */

$('contrast').addEventListener(
  'click',
  () => {
    document.body.classList.toggle('contrast');
  }
);

$('font').addEventListener(
  'click',
  () => {
    document.body.classList.toggle('large');
  }
);


/* =========================================
   15. ENABLE MEDICATION REMINDERS
========================================= */

$('enableReminders').addEventListener(
  'click',
  async () => {
    remindersEnabled = true;

    let note =
      'On-page reminders enabled while this tab is open and running. Keep using your usual alarms.';

    if (
      'Notification' in window &&
      window.isSecureContext
    ) {
      try {
        const permission =
          await Notification.requestPermission();

        if (permission === 'granted') {
          note =
            'Browser notifications enabled while this page is open and running. They are not guaranteed.';
        }

      } catch {
        // Browser notification permission unavailable
      }
    }

    $('reminderStatus').textContent = note;

    toast(note);

    checkReminders();
  }
);


/* =========================================
   16. CHECK SCHEDULED REMINDERS
========================================= */

function checkReminders() {
  if (!remindersEnabled) {
    return;
  }

  const now = new Date();

  const day = localDate(now);

  const hhmm =
    `${String(now.getHours()).padStart(2, '0')}:` +
    `${String(now.getMinutes()).padStart(2, '0')}`;

  const events = [];


  // Check medication times
  for (const m of data.medications) {
    if (
      medToday(m, day) &&
      m.time === hhmm
    ) {
      events.push({
        key: `med-${m.id}-${day}-${hhmm}`,

        text:
          `Scheduled medication time: ${m.name}. ` +
          `Follow your healthcare team's instructions.`
      });
    }
  }


  // Check appointment times
  for (const a of data.appointments) {
    if (a.when === `${day}T${hhmm}`) {
      events.push({
        key: `appt-${a.id}`,

        text: `Appointment scheduled now: ${a.name}`
      });
    }
  }


  // Display reminders
  for (const ev of events) {
    if (lastAlerted.has(ev.key)) {
      continue;
    }

    lastAlerted.add(ev.key);

    toast(ev.text);

    if (
      'Notification' in window &&
      Notification.permission === 'granted' &&
      window.isSecureContext
    ) {
      try {
        new Notification(
          'NeuroBridge reminder',
          { body: ev.text }
        );

      } catch {
        // Notification could not be displayed
      }
    }
  }


  // Prevent unlimited reminder history
  if (lastAlerted.size > 200) {
    lastAlerted = new Set(
      [...lastAlerted].slice(-100)
    );
  }
}


/* =========================================
   17. AUTOMATIC SCHEDULE UPDATES
========================================= */

setInterval(
  () => {
    render();
    checkReminders();
  },
  30000
);


/* =========================================
   18. CANCER INFORMATION DATABASE

   Broad educational selection.
   NOT a Delaware cancer incidence ranking.

   Links point to official NCI cancer hubs.
========================================= */

const cancers = [

  [
    'Breast cancer',
    'Cancer that begins in breast tissue.',
    'breast'
  ],

  [
    'Lung cancer',
    'Cancer that begins in the lungs; different types are treated differently.',
    'lung'
  ],

  [
    'Colorectal cancer',
    'Cancer that begins in the colon or rectum.',
    'colorectal'
  ],

  [
    'Prostate cancer',
    'Cancer that begins in the prostate gland.',
    'prostate'
  ],

  [
    'Skin cancer (melanoma)',
    'A type of skin cancer that develops from pigment-producing cells.',
    'skin'
  ],

  [
    'Bladder cancer',
    'Cancer that begins in tissues of the urinary bladder.',
    'bladder'
  ],

  [
    'Kidney cancer',
    'Cancer that begins in the kidney.',
    'kidney'
  ],

  [
    'Non-Hodgkin lymphoma',
    'A group of cancers involving lymphocytes, a type of immune cell.',
    'lymphoma'
  ],

  [
    'Leukemia',
    'A group of cancers affecting blood-forming tissues.',
    'leukemia'
  ],

  [
    'Pancreatic cancer',
    'Cancer that begins in the pancreas.',
    'pancreatic'
  ],

  [
    'Thyroid cancer',
    'Cancer that begins in the thyroid gland.',
    'thyroid'
  ],

  [
    'Liver cancer',
    'Cancer that begins in the liver.',
    'liver'
  ],

  [
    'Uterine (endometrial) cancer',
    'Cancer that begins in the lining of the uterus.',
    'uterine'
  ],

  [
    'Ovarian cancer',
    'Cancer that begins in the ovary, fallopian tube, or related tissues.',
    'ovarian'
  ],

  [
    'Cervical cancer',
    'Cancer that begins in the cervix.',
    'cervical'
  ],

  [
    'Stomach cancer',
    'Cancer that begins in the stomach.',
    'stomach'
  ],

  [
    'Esophageal cancer',
    'Cancer that begins in the esophagus.',
    'esophageal'
  ],

  [
    'Head and neck cancer',
    'A group of cancers arising in areas such as the mouth, throat, or voice box.',
    'head-and-neck'
  ],

  [
    'Brain and central nervous system tumors',
    'Tumors that arise in the brain or spinal cord; not all are cancerous. Glioblastoma is one malignant type.',
    'brain'
  ],

  [
    'Multiple myeloma',
    'Cancer involving plasma cells in the bone marrow.',
    'myeloma'
  ]

];


/* =========================================
   19. DISPLAY CANCER INFORMATION
========================================= */

function showCancer(i) {
  const c = cancers[i];

  const detail = $('cancerDetail');

  detail.replaceChildren();

  detail.append(
    make('h3', c[0]),

    make('p', c[1]),

    make(
      'p',
      'For details on diagnosis, treatment, and questions to discuss with your care team, read the National Cancer Institute information.'
    )
  );


  // Official National Cancer Institute link
  const link = make(
    'a',
    'Read the NCI cancer information →'
  );

  link.href = `https://www.cancer.gov/types/${c[2]}`;

  link.target = '_blank';

  link.rel = 'noopener noreferrer';

  detail.append(link);


  // Highlight selected cancer type
  document.querySelectorAll('.cancer-choice').forEach(
    b => {
      const selected =
        Number(b.dataset.index) === i;

      b.classList.toggle(
        'active',
        selected
      );

      b.setAttribute(
        'aria-pressed',
        String(selected)
      );
    }
  );
}


/* =========================================
   20. SEARCH CANCER TYPES
========================================= */

function renderCancers() {
  const term = $('cancerSearch')
    .value
    .toLowerCase()
    .trim();

  const grid = $('cancerGrid');

  grid.replaceChildren();

  let n = 0;

  cancers.forEach((c, i) => {
    if (!c[0].toLowerCase().includes(term)) {
      return;
    }

    const b = make(
      'button',
      c[0],
      'cancer-choice'
    );

    b.type = 'button';

    b.dataset.index = i;

    b.setAttribute(
      'aria-pressed',
      'false'
    );

    b.addEventListener(
      'click',
      () => showCancer(i)
    );

    grid.append(b);

    n++;
  });


  // No search results
  if (!n) {
    grid.append(
      make(
        'p',
        'No matching cancer types in this selection.',
        'muted'
      )
    );
  }
}


/* =========================================
   21. INITIALIZE CANCER LIBRARY
========================================= */

$('cancerSearch').addEventListener(
  'input',
  renderCancers
);

renderCancers();

render();


/* =========================================
   22. COMMUNICATION PHRASE DATABASE

   Optional augmentative communication board.
   Designed for simple, user-controlled
   communication.
========================================= */

const phrases = [

  ['👍', 'Yes'],

  ['👎', 'No'],

  ['🤷', 'I am not sure'],

  ['🆘', 'I need help'],

  ['😣', 'I am uncomfortable'],

  ['💧', 'I would like water'],

  ['🚻', 'I need the bathroom'],

  ['🛏️', 'I need to rest'],

  ['🧑‍🤝‍🧑', 'Please call my caregiver'],

  ['🐢', 'Please speak slowly'],

  ['🔁', 'Please say that again'],

  ['❓', 'I do not understand'],

  ['⏳', 'Please give me more time'],

  ['✍️', 'Please write it down'],

  ['🙏', 'Thank you']

];


/* =========================================
   23. TEXT-TO-SPEECH FUNCTION
========================================= */

let voiceOn = false;

function speak(text) {
  if (!('speechSynthesis' in window)) {
    toast(
      'Voice playback is not available on this browser. You can still show the message.'
    );

    return;
  }

  try {
    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang = 'en-US';

    utterance.rate = 0.85;

    window.speechSynthesis.speak(utterance);

  } catch {
    toast(
      'Voice playback is unavailable. Please show the written message.'
    );
  }
}


/* =========================================
   24. DISPLAY COMMUNICATION MESSAGES
========================================= */

function displayMessage(
  text,
  shouldSpeak = voiceOn
) {
  $('messageDisplay').textContent = text;

  if (shouldSpeak) {
    speak(text);
  }
}


/* =========================================
   25. CREATE COMMUNICATION BUTTONS
========================================= */

const commGrid = $('commGrid');

for (const [symbol, phrase] of phrases) {
  const button = make(
    'button',
    undefined,
    'comm-phrase'
  );

  button.type = 'button';

  const emoji = make(
    'span',
    symbol,
    'emoji'
  );

  emoji.setAttribute(
    'aria-hidden',
    'true'
  );

  button.append(
    emoji,
    make('span', phrase)
  );

  button.setAttribute(
    'aria-label',
    phrase
  );

  button.addEventListener(
    'click',
    () => displayMessage(phrase)
  );

  commGrid.append(button);
}


/* =========================================
   26. TURN VOICE ON OR OFF
========================================= */

$('speakToggle').addEventListener(
  'click',
  () => {
    voiceOn = !voiceOn;

    $('speakToggle').textContent = voiceOn
      ? '🔊 Voice: on'
      : '🔈 Voice: off';

    $('speakToggle').setAttribute(
      'aria-pressed',
      String(voiceOn)
    );
  }
);


/* =========================================
   27. STOP SPEAKING
========================================= */

$('stopSpeaking').addEventListener(
  'click',
  () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
);


/* =========================================
   28. CLEAR COMMUNICATION MESSAGE
========================================= */

$('clearMessage').addEventListener(
  'click',
  () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    $('messageDisplay').textContent =
      'Tap a message below.';

    $('customMessage').value = '';
  }
);


/* =========================================
   29. SHOW CUSTOM MESSAGE
========================================= */

$('showCustom').addEventListener(
  'click',
  () => {
    const value = $('customMessage')
      .value
      .trim();

    if (value) {
      displayMessage(value, false);

    } else {
      toast('Type a message first.');
    }
  }
);


/* =========================================
   30. SPEAK CUSTOM MESSAGE
========================================= */

$('speakCustom').addEventListener(
  'click',
  () => {
    const value = $('customMessage')
      .value
      .trim();

    if (value) {
      displayMessage(value, true);

    } else {
      toast('Type a message first.');
    }
  }
);


/* =========================================
   31. UPDATE ACCESSIBILITY BUTTON STATES
========================================= */

for (const id of ['contrast', 'font']) {
  $(id).addEventListener(
    'click',
    () => {
      const active = document.body.classList.contains(
        id === 'contrast'
          ? 'contrast'
          : 'large'
      );

      $(id).setAttribute(
        'aria-pressed',
        String(active)
      );
    }
  );
}
